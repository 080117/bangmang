import { loadConfig } from "./config.js";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { logger } from "./logger.js";
import { Db } from "./db.js";
import { OneBotApiClient } from "./onebot/api-client.js";
import { OneBotWsServer } from "./onebot/ws-server.js";
import { EventRouter } from "./events.js";
import { LlmClient } from "./agent/llm.js";
import { SessionManager } from "./agent/session.js";
import { Agent } from "./agent/agent.js";
import { createToolRegistry } from "./agent/tools/index.js";
import { AdminCommands } from "./admin/commands.js";
import { Scheduler } from "./scheduler/cron.js";
import { sendProactiveMeme } from "./agent/tools/meme.js";

async function main(): Promise<void> {
  const app = loadConfig();
  const { config, env } = app;
  logger.info(`配置文件: ${app.configPath}`);
  logger.info(`LLM: ${env.baseUrl} / ${env.model}`);
  logger.info(`机器人 QQ: ${config.self_id}`);

  const db = new Db(process.env.DB_PATH ?? "data/bot.db");
  db.seedOwner(config.owner);
  logger.info("数据库已就绪 (data/bot.db)");

  const api = new OneBotApiClient();
  const llm = new LlmClient(env);
  const session = new SessionManager(db, config.reply.max_context_messages);
  const tools = createToolRegistry(config.tools.enabled);
  logger.info(`已启用工具: ${[...tools.keys()].join(", ") || "(无)"}`);

  const scheduler = new Scheduler(db, api);
  const admin = new AdminCommands({ config, db, api, scheduler });
  const agent = new Agent({ db, config, llm, api, session, tools });
  const router = new EventRouter({ config, api, agent, session, admin });

  const wsServer = new OneBotWsServer(
    {
      host: config.ws.host,
      port: config.ws.port,
      path: config.ws.path,
      token: config.ws.token,
    },
    (event) => router.handleEvent(event),
    (ws) => api.setSocket(ws),
  );

  await wsServer.start();
  scheduler.start();

  logger.info("Agent QQ 机器人已启动，请在 NapCat 中配置反向 WebSocket 连接。");
  logger.info(`连接地址: ws://${config.ws.host}:${config.ws.port}${config.ws.path}`);

  const requestDir = resolve(process.cwd(), "data");
  const startupRequestPath = join(requestDir, "startup.request.json");
  const shutdownRequestPath = join(requestDir, "shutdown.request.json");

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`收到 ${signal}，正在关闭...`);
    if (api.isConnected()) {
      await sendProactiveMeme(api, config, "睡觉了");
    }
    rmSync(startupRequestPath, { force: true });
    rmSync(shutdownRequestPath, { force: true });
    await wsServer.stop();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  const handleLifecycleRequests = async (): Promise<void> => {
    if (shuttingDown) return;
    if (existsSync(startupRequestPath)) {
      if (!api.isConnected()) return;
      rmSync(startupRequestPath, { force: true });
      await sendProactiveMeme(api, config, "刚睡醒");
    }
    if (existsSync(shutdownRequestPath)) {
      rmSync(shutdownRequestPath, { force: true });
      await shutdown("shutdown-request");
    }
  };
  const lifecycleTimer = setInterval(() => void handleLifecycleRequests(), 500);
  lifecycleTimer.unref?.();
}

main().catch((err) => {
  logger.error("启动失败", err);
  process.exit(1);
});
