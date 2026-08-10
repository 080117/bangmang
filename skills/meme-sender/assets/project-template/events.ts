import { resolve } from "node:path";
import { logger } from "./logger.js";
import type { Config } from "./config.js";
import type { Agent } from "./agent/agent.js";
import type { SessionManager } from "./agent/session.js";
import type { AdminCommands } from "./admin/commands.js";
import type { ApiFacade } from "./onebot/api-client.js";
import {
  findMemeByContext,
  imageSegmentForFile,
  tryAcquireMemeSlot,
} from "./agent/tools/meme.js";
import { extractAtQq, extractPlainText, extractReplyId } from "./onebot/message.js";
import type { OneBotEvent } from "./onebot/types.js";

export interface EventRouterDeps {
  config: Config;
  api: ApiFacade;
  agent: Agent;
  session: SessionManager;
  admin: AdminCommands;
}

export class EventRouter {
  private atSimilar = new Map<string, { lastText: string; count: number }>();
  private lastAtAt = new Map<string, number>();

  constructor(private deps: EventRouterDeps) {}

  handleEvent(event: OneBotEvent): void {
    if (event.echo !== undefined) {
      this.deps.api.handleApiResponse(event);
      return;
    }

    if (event.post_type === "meta_event") {
      logger.debug("meta 事件", event);
      return;
    }

    if (event.post_type === "message") {
      if (event.message_type === "private") {
        void this.handlePrivate(event).catch((e) => logger.error("处理私聊消息失败", e));
      } else if (event.message_type === "group") {
        void this.handleGroup(event).catch((e) => logger.error("处理群聊消息失败", e));
      }
      return;
    }

    if (event.post_type === "notice" || event.post_type === "request") {
      logger.debug(`暂不处理的事件: ${event.post_type}`, event);
    }
  }

  private isSelf(event: OneBotEvent): boolean {
    return String(event.user_id) === String(this.deps.config.self_id);
  }

  private isGroupAllowed(groupId: string): boolean {
    const { whitelist, blacklist } = this.deps.config.groups;
    if (blacklist.includes(groupId)) return false;
    if (whitelist.length > 0 && !whitelist.includes(groupId)) return false;
    return true;
  }

  private async handlePrivate(event: OneBotEvent): Promise<void> {
    if (this.isSelf(event)) return;
    const userId = String(event.user_id ?? "");
    if (!userId) return;
    const text = extractPlainText(event.message);
    if (!text) return;

    const senderLabel = event.sender?.card || event.sender?.nickname || userId;
    const sessionKey = this.deps.session.keyForPrivate(userId);
    const commandText = stripLeadingSelfAt(text, String(this.deps.config.self_id));

    if (commandText.startsWith(this.deps.config.reply.command_prefix)) {
      const reply = await this.deps.admin.runCommand(commandText, {
        userId,
        senderLabel,
        sessionKey,
        isGroup: false,
      });
      if (reply) await this.deps.api.sendPrivateMsg(userId, reply);
      return;
    }

    void this.deps.agent.handle({
      sessionKey,
      text,
      senderLabel,
      isGroup: false,
      userId,
    });
  }

  private async handleGroup(event: OneBotEvent): Promise<void> {
    if (this.isSelf(event)) return;
    const groupId = String(event.group_id ?? "");
    const userId = String(event.user_id ?? "");
    if (!groupId || !userId) return;
    if (!this.isGroupAllowed(groupId)) return;

    const text = extractPlainText(event.message);
    if (!text) return;

    const senderLabel = event.sender?.card || event.sender?.nickname || userId;
    const sessionKey = this.deps.session.keyForGroup(groupId);
    const commandText = stripLeadingSelfAt(text, String(this.deps.config.self_id));

    if (commandText.startsWith(this.deps.config.reply.command_prefix)) {
      if (this.deps.admin.isAdmin(userId)) {
        const reply = await this.deps.admin.runCommand(commandText, {
          userId,
          senderLabel,
          sessionKey,
          isGroup: true,
          groupId,
        });
        if (reply) await this.deps.api.sendGroupMsg(groupId, reply);
      } else {
        logger.debug(`非管理员尝试执行命令: ${userId} ${text}`);
      }
      return;
    }

    const mode = this.deps.config.reply.group_mode;
    const isAtSelf = extractAtQq(event.message).includes(String(this.deps.config.self_id));
    const replyId = extractReplyId(event.message);
    const repliedToBot = replyId !== null && this.deps.api.isRecentlySent(replyId);

    const triggered =
      mode === "all" ||
      (mode === "at" && isAtSelf) ||
      (mode === "at_or_reply" && (isAtSelf || repliedToBot));
    if (!triggered) return;

    let atIdleEligible = false;
    if (isAtSelf) {
      const now = Date.now();
      atIdleEligible = now - (this.lastAtAt.get(groupId) ?? 0) >= 5 * 60 * 1000;
      this.lastAtAt.set(groupId, now);
    }
    if (isAtSelf && (await this.trySendRepeatMeme(groupId, userId, commandText))) return;

    const memeSelected = await this.deps.agent.handle({
      sessionKey,
      text,
      senderLabel,
      isGroup: true,
      groupId,
      userId,
    });
    if (atIdleEligible && !memeSelected) {
      await this.trySendAtCooldownMeme(groupId);
    }
  }

  private async trySendAtCooldownMeme(groupId: string): Promise<boolean> {
    const dir = resolve(process.cwd(), this.deps.config.memes.dir);
    const found = await findMemeByContext(dir, "被@");
    if (!found || !tryAcquireMemeSlot()) return false;
    const message = [
      await imageSegmentForFile(found.path),
      { type: "text", data: { text: "这么久没人找我，哼。" } },
    ];
    await this.deps.api.sendGroupMsg(groupId, message);
    return true;
  }

  private async trySendRepeatMeme(groupId: string, userId: string, text: string): Promise<boolean> {
    const normalized = normalizeSimilarText(text);
    if (!normalized) return false;
    const key = `${groupId}:${userId}`;
    const prev = this.atSimilar.get(key);
    const count = prev && isSimilarText(normalized, prev.lastText) ? prev.count + 1 : 1;
    this.atSimilar.set(key, { lastText: normalized, count });
    if (count < 3) return false;

    this.atSimilar.delete(key);
    const dir = resolve(process.cwd(), this.deps.config.memes.dir);
    const found = await findMemeByContext(dir, "重复内容");
    if (!found || !tryAcquireMemeSlot()) return false;
    const message = [
      await imageSegmentForFile(found.path),
      { type: "text", data: { text: "又是同一件麻烦事。" } },
    ];
    await this.deps.api.sendGroupMsg(groupId, message);
    return true;
  }
}

/** 去掉开头的 @自己（QQ 里常写成 "@机器人 命令"），返回可能作为命令的文本。 */
function stripLeadingSelfAt(text: string, selfId: string): string {
  const re = new RegExp(`^@${selfId}\\s*`);
  return text.replace(re, "").trim();
}

function normalizeSimilarText(text: string): string {
  return text
    .toLowerCase()
    .replace(/@\d+/g, "")
    .replace(/[\s，。！？!?、,.;；:：()（）\[\]【】"“”'‘’~～\-_/\\]+/g, "")
    .trim();
}

function isSimilarText(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const setA = new Set([...a]);
  const setB = new Set([...b]);
  let inter = 0;
  for (const ch of setA) {
    if (setB.has(ch)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union > 0 && inter / union >= 0.6;
}
