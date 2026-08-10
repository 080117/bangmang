import { logger } from "../logger.js";
import type { Config } from "../config.js";
import type { ChatMessage, Db } from "../db.js";
import type { ApiFacade } from "../onebot/api-client.js";
import type { MessageContent, MessageSegment } from "../onebot/types.js";
import type { BotTool, ToolHandlerResult } from "./tools/types.js";
import { tryAcquireMemeSlot } from "./tools/meme.js";
import type { ChatClient } from "./llm.js";
import type { SessionManager } from "./session.js";

export interface AgentMessageInput {
  sessionKey: string;
  text: string;
  senderLabel: string;
  isGroup: boolean;
  groupId?: string;
  userId: string;
}

export interface AgentDeps {
  db: Db;
  config: Config;
  llm: ChatClient;
  api: ApiFacade;
  session: SessionManager;
  tools: Map<string, BotTool>;
}

/** 清理会话历史里的工具消息，避免截断后出现孤立的 tool 消息导致接口报错。 */
function sanitizeHistory(history: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of history) {
    if (m.role === "tool") continue;
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      if (m.content) out.push({ role: "assistant", content: m.content, ts: m.ts });
      continue;
    }
    out.push(m);
  }
  return out;
}

function toToolText(result: ToolHandlerResult): string {
  return typeof result === "string" ? result : (result.text ?? "已完成。");
}

export class Agent {
  private queues = new Map<string, Promise<unknown>>();

  constructor(private deps: AgentDeps) {}

  /** 每个会话串行处理，避免上下文竞态。 */
  handle(input: AgentMessageInput): Promise<boolean> {
    const prev = this.queues.get(input.sessionKey) ?? Promise.resolve(false);
    const next = prev
      .then(() => this.process(input))
      .catch((err) => {
        logger.error(`会话处理失败 (${input.sessionKey})`, err);
        return false;
      });
    this.queues.set(input.sessionKey, next);
    return next;
  }

  private async process(input: AgentMessageInput): Promise<boolean> {
    const { config, db, llm, api, session, tools } = this.deps;

    const userMsg: ChatMessage = {
      role: "user",
      content: input.isGroup ? `[${input.senderLabel}] ${input.text}` : input.text,
      ts: Date.now(),
    };

    const history = sanitizeHistory(session.getHistory(input.sessionKey));
    const system: ChatMessage = { role: "system", content: config.llm.system_prompt };
    const working: ChatMessage[] = [system, ...history, userMsg];

    const toolDefs = [...tools.values()].map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    let finalText: string | null = null;
    let pendingMeme: MessageSegment | null = null;

    try {
      for (let round = 0; round < config.reply.max_tool_rounds; round++) {
        const result = await llm.chat({
          messages: working,
          tools: toolDefs,
          temperature: config.llm.temperature,
          maxTokens: config.llm.max_tokens,
        });

        if (result.toolCalls.length === 0) {
          finalText = result.content;
          working.push({ role: "assistant", content: result.content });
          break;
        }

        working.push({
          role: "assistant",
          content: result.content,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        for (const tc of result.toolCalls) {
          const tool = tools.get(tc.name);
          let content: string;
          if (!tool) {
            content = `工具 ${tc.name} 不存在`;
          } else {
            let args: Record<string, unknown> = {};
            try {
              args = tc.arguments ? (JSON.parse(tc.arguments) as Record<string, unknown>) : {};
            } catch {
              args = {};
            }
            try {
              const raw = await tool.handler(args, {
                db,
                config,
                sessionKey: input.sessionKey,
                sender: {
                  userId: input.userId,
                  nickname: input.senderLabel,
                  groupId: input.groupId,
                },
              });
              if (typeof raw !== "string" && raw.media?.length && pendingMeme === null) {
                pendingMeme = raw.media.find((s) => s.type === "image") ?? raw.media[0] ?? null;
              }
              content = toToolText(raw);
            } catch (e) {
              content = `工具 ${tc.name} 执行出错: ${(e as Error).message}`;
            }
            logger.debug(
              `工具调用 ${tc.name}(${JSON.stringify(args)}) -> ${content.slice(0, 120)}`,
            );
          }
          working.push({ role: "tool", tool_call_id: tc.id, content });
        }
      }
    } catch (err) {
      logger.error(`LLM 处理失败 (${input.sessionKey})`, err);
      await this.sendReply(input, "抱歉，我刚刚处理请求时出了点问题，请稍后再试。");
    }

    // 持久化会话（去掉 system，按上限截断）
    const persisted = working.slice(1).slice(-config.reply.max_context_messages);
    db.saveSession(input.sessionKey, persisted);

    if (pendingMeme) {
      await this.sendMediaReply(input, pendingMeme, finalText);
    } else if (finalText !== null) {
      await this.sendReply(input, finalText);
    }

    return pendingMeme !== null;
  }

  private async sendMediaReply(
    input: AgentMessageInput,
    media: MessageSegment,
    text: string | null,
  ): Promise<void> {
    const { config } = this.deps;
    const trimmed = text?.trim() ?? "";
    if (!trimmed) {
      if (tryAcquireMemeSlot()) {
        await this.sendContent(input, [media]);
      }
      return;
    }
    if (!tryAcquireMemeSlot()) {
      await this.sendReply(input, trimmed);
      return;
    }
    const chunks = splitReply(trimmed, config.reply.max_reply_length);
    for (let i = 0; i < chunks.length; i += 1) {
      if (i === 0) {
        await this.sendContent(input, [media, { type: "text", data: { text: chunks[0] } }]);
      } else {
        await this.sendContent(input, chunks[i]);
      }
    }
  }

  private async sendContent(input: AgentMessageInput, content: MessageContent): Promise<void> {
    const { api } = this.deps;
    if (input.isGroup && input.groupId) {
      await api.sendGroupMsg(input.groupId, content);
    } else {
      await api.sendPrivateMsg(input.userId, content);
    }
  }

  private async sendReply(input: AgentMessageInput, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { api, config } = this.deps;
    for (const chunk of splitReply(trimmed, config.reply.max_reply_length)) {
      if (input.isGroup && input.groupId) {
        await api.sendGroupMsg(input.groupId, chunk);
      } else {
        await api.sendPrivateMsg(input.userId, chunk);
      }
    }
  }
}

/** 超长回复按换行处拆分，避免超出 QQ 单条上限。 */
export function splitReply(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n", maxLen);
    if (cut <= 0) cut = maxLen;
    const chunk = rest.slice(0, cut).trim();
    rest = rest.slice(cut).trim();
    if (chunk) chunks.push(chunk);
  }
  if (rest) chunks.push(rest);
  return chunks;
}
