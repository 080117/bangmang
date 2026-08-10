import { access, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { logger } from "../../logger.js";
import type { Config } from "../../config.js";
import type { ApiFacade } from "../../onebot/api-client.js";
import type { MessageSegment } from "../../onebot/types.js";
import type { BotTool } from "./types.js";

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const MEME_INTERVAL_MS = 3000;
const PROACTIVE_ONLY_CONTEXTS = ["刚睡醒", "睡觉了"];
const MAX_DISPLAY_DIMENSION = 320;
let lastMemeSentAt = 0;

export function tryAcquireMemeSlot(): boolean {
  const now = Date.now();
  if (now - lastMemeSentAt < MEME_INTERVAL_MS) return false;
  lastMemeSentAt = now;
  return true;
}

export function resetMemeRateLimit(): void {
  lastMemeSentAt = 0;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_\s，。！？!?()（）\[\]【】、,.;；:：/\\]+/g, " ")
    .trim();
}

export async function imageSegmentForFile(filePath: string): Promise<MessageSegment> {
  try {
    const meta = await sharp(filePath).metadata();
    if (!meta.width || !meta.height) {
      return { type: "image", data: { file: pathToFileURL(filePath).href } };
    }
    const scale = Math.min(
      MAX_DISPLAY_DIMENSION / meta.width,
      MAX_DISPLAY_DIMENSION / meta.height,
      1,
    );
    const width = Math.max(1, Math.round(meta.width * scale));
    const height = Math.max(1, Math.round(meta.height * scale));
    const ext = extname(filePath).toLowerCase();
    const pipeline = sharp(filePath, ext === ".gif" ? { animated: true } : undefined).resize(
      width,
      height,
    );
    let buffer: Buffer;
    if (ext === ".gif") {
      buffer = await pipeline.gif().toBuffer();
    } else if (ext === ".png") {
      buffer = await pipeline.png().toBuffer();
    } else if (ext === ".webp") {
      buffer = await pipeline.webp().toBuffer();
    } else {
      buffer = await pipeline.jpeg({ quality: 85 }).toBuffer();
    }
    return { type: "image", data: { file: `base64://${buffer.toString("base64")}` } };
  } catch (e) {
    logger.warn(`表情包缩放失败，使用原图: ${filePath} (${(e as Error).message})`);
    return { type: "image", data: { file: pathToFileURL(filePath).href } };
  }
}

function isProactiveOnlyContext(context: string): boolean {
  const normalized = normalizeName(context);
  return PROACTIVE_ONLY_CONTEXTS.some((c) => normalized.includes(c) || c.includes(normalized));
}

/** 按语境词匹配文件名，返回匹配度最高的图片；同分时随机。 */
export async function findMemeByContext(
  dir: string,
  context: string,
  aliases: Record<string, string> = {},
): Promise<{ file: string; path: string } | null> {
  const normalizedContext = normalizeName(context);
  for (const [alias, file] of Object.entries(aliases)) {
    if (normalizeName(alias) !== normalizedContext) continue;
    const path = resolve(dir, file);
    try {
      await access(path);
      return { file, path };
    } catch {
      break;
    }
  }

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return null;
  }

  const terms = context
    .toLowerCase()
    .split(/[\s，。！？!?、,.;；:：()（）\[\]【】\-_/\\]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (terms.length === 0) return null;

  const candidates: Array<{ file: string; path: string; score: number }> = [];
  for (const file of files) {
    if (!SUPPORTED_EXTENSIONS.includes(extname(file).toLowerCase())) continue;
    const normalized = normalizeName(file);
    let score = 0;
    for (const term of terms) {
      if (normalized.includes(term)) score += 1;
    }
    if (score > 0) {
      candidates.push({ file, path: resolve(dir, file), score });
    }
  }
  if (candidates.length === 0) return null;

  const max = Math.max(...candidates.map((c) => c.score));
  const best = candidates.filter((c) => c.score === max);
  const pick = best[Math.floor(Math.random() * best.length)];
  return pick ?? null;
}

export const sendMemeTool: BotTool = {
  name: "send_meme",
  description:
    "根据你即将回复的内容语境，从本地表情包中选择一张并发送。当用户请你帮忙做事且这件事你能完成时，使用 context='小事一桩' 发送对应表情包；仅在语境明显匹配时调用，没有匹配就不要发。",
  parameters: {
    type: "object",
    properties: {
      context: {
        type: "string",
        description:
          "用 1-4 个词概括你即将回复的语境，例如：小事一桩、害羞、开心、办不到的事情、生气、重复内容；用户请你帮忙且你能完成时用：小事一桩",
      },
    },
    required: ["context"],
    additionalProperties: false,
  },
  async handler(args, ctx) {
    const context = String(args.context ?? "").trim();
    if (!context) return "缺少语境关键词。";
    if (isProactiveOnlyContext(context)) {
      return `「${context}」只能在启动或关闭机器人时主动发送。`;
    }
    if (
      normalizeName(context).includes("被@") ||
      normalizeName(context).includes("重复内容")
    ) {
      return "「被@/重复内容」表情包由系统在连续三次相似被@文本后自动发送。";
    }
    const dir = resolve(process.cwd(), ctx.config.memes.dir);
    const found = await findMemeByContext(dir, context, ctx.config.memes.context_aliases);
    if (!found) return `没有找到匹配「${context}」的本地表情包。`;
    return {
      text: `已选择表情包：${found.file}`,
      media: [await imageSegmentForFile(found.path)],
    };
  },
};

/** 启动/关闭时主动向配置的接收人发送表情包。 */
export async function sendProactiveMeme(
  api: ApiFacade,
  config: Config,
  context: string,
): Promise<boolean> {
  const dir = resolve(process.cwd(), config.memes.dir);
  const found = await findMemeByContext(dir, context, config.memes.context_aliases);
  if (!found) {
    logger.warn(`未找到主动表情包「${context}」`);
    return false;
  }
  if (!tryAcquireMemeSlot()) {
    logger.debug("表情包发送频率限制，跳过主动发送");
    return false;
  }
  const message: MessageSegment[] = [await imageSegmentForFile(found.path)];
  const recipients: Array<{ type: "private" | "group"; id: string }> = [
    ...config.memes.proactive_recipients,
  ];
  if (config.memes.proactive_all_groups) {
    try {
      const data = (await api.getGroupList()) as Array<{ group_id?: unknown }> | null;
      if (Array.isArray(data)) {
        for (const g of data) {
          const id = String(g?.group_id ?? "");
          if (id && !config.memes.proactive_excluded_groups.includes(id)) {
            recipients.push({ type: "group", id });
          }
        }
      }
    } catch (e) {
      logger.warn(`获取群列表失败，跳过群聊主动发送: ${(e as Error).message}`);
    }
  }
  if (recipients.length === 0) {
    recipients.push({ type: "private", id: config.owner });
  }
  const seen = new Set<string>();
  for (const r of recipients) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (r.type === "group" && config.memes.proactive_excluded_groups.includes(r.id)) continue;
    try {
      if (r.type === "private") {
        await api.sendPrivateMsg(r.id, message);
      } else {
        await api.sendGroupMsg(r.id, message);
      }
    } catch (e) {
      logger.warn(`主动发送表情包到 ${r.type}:${r.id} 失败: ${(e as Error).message}`);
    }
  }
  return true;
}
