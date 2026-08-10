import type { Config } from "../../config.js";
import type { Db } from "../../db.js";
import type { MessageSegment } from "../../onebot/types.js";

export interface ToolContext {
  db: Db;
  config: Config;
  sessionKey: string;
  sender: {
    userId: string;
    nickname: string;
    groupId?: string;
  };
}

export interface ToolResult {
  text?: string;
  media?: MessageSegment[];
}

export type ToolHandlerResult = string | ToolResult;

export interface BotTool {
  name: string;
  description: string;
  /** JSON Schema（object） */
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolHandlerResult>;
}
