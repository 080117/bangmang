import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
function argValue(name, def) {
  const i = args.findIndex((a) => a === `--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const hasFlag = (name) => args.includes(name);

const sitesArg = (argValue("site", "all") || "all").toLowerCase();
const sites = sitesArg === "all" ? ["weibo", "zhihu"] : [sitesArg];
const browserName = (argValue("browser", "chrome") || "chrome").toLowerCase();
const headless = (argValue("headless", "false") || "false").toLowerCase() === "true";
const timeoutMs = Math.max(20000, parseInt(argValue("timeout", "300000"), 10) || 300000);
const profileName = argValue("profile-name", "Default") || "Default";
const outDir = path.resolve(ROOT, "data/cookies");
const realProfile = hasFlag("--real-profile");

function chromeProfileRoot() {
  if (browserName === "edge") {
    return path.join(os.homedir(), "AppData", "Local", "Microsoft", "Edge", "User Data");
  }
  return path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
}

const LOGIN_MARKERS = { weibo: ["SUB"], zhihu: ["z_c0"] };
const LOGIN_URLS = {
  weibo: "https://passport.weibo.com/signin/login",
  zhihu: "https://www.zhihu.com/signin",
};
const DOMAINS = {
  weibo: ["https://weibo.com", "https://passport.weibo.com", "https://m.weibo.cn"],
  zhihu: ["https://www.zhihu.com", "https://zhihu.com"],
};

function isBrowserRunning() {
  const img = browserName === "edge" ? "msedge.exe" : "chrome.exe";
  try {
    const out = execFileSync("tasklist", ["/FI", `IMAGENAME eq ${img}`], { encoding: "utf8" });
    return out.toLowerCase().includes(img);
  } catch {
    return false;
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const channel = browserName === "edge" ? "msedge" : "chrome";
  const say = (text) => console.log(`[msg] ${text}`);

  if (realProfile) {
    console.log(`[模式] 读取真实 Chrome 配置（${browserName} / profile=${profileName}）`);
    if (isBrowserRunning()) {
      console.log(`[提示] 检测到 ${browserName === "edge" ? "Edge" : "Chrome"} 正在运行，请先完全关闭它（含后台进程），再重新运行。`);
      say("检测到 Chrome 正在运行，请先完全关闭 Chrome 再重试。");
      process.exit(1);
    }
  } else {
    console.log("[模式] 独立窗口模式（需要在弹出的窗口里登录一次）");
  }

  console.log(`[启动] 目标=${sites.join(",")} 超时=${Math.round(timeoutMs / 1000)}秒 headless=${headless}`);
  console.log(`[说明] Cookie 只保存在本机: ${outDir}`);
  say("开始抓取，正在打开浏览器窗口…");

  const userDataDir = realProfile ? chromeProfileRoot() : path.resolve(ROOT, argValue("profile", "data/.browser-profile"));
  if (realProfile && isBrowserRunning()) {
    say("检测到浏览器仍在运行（可能被重新打开），请完全关闭 Chrome 后重试。");
    process.exit(1);
  }
  const launchArgs = [
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
    ...(realProfile ? [`--profile-directory=${profileName}`] : []),
  ];

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel,
    headless,
    viewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
    args: launchArgs,
  });

  const pages = [];
  for (const site of sites) pages.push(await context.newPage());
  for (let i = 0; i < sites.length; i++) {
    await pages[i]
      .goto(LOGIN_URLS[sites[i]], { waitUntil: "domcontentloaded", timeout: 60000 })
      .catch(() => {});
  }
  say("浏览器已打开，正在检测登录状态（已登录会自动识别）…");

  const start = Date.now();
  const found = new Set();
  let hinted = false;
  while (Date.now() - start < timeoutMs) {
    for (const site of sites) {
      if (found.has(site)) continue;
      const cookies = await context.cookies(DOMAINS[site]).catch(() => []);
      const names = cookies.map((c) => c.name);
      if (LOGIN_MARKERS[site].some((m) => names.includes(m))) {
        const jsonFile = path.join(outDir, `${site}.json`);
        const txtFile = path.join(outDir, `${site}.cookie.txt`);
        fs.writeFileSync(jsonFile, JSON.stringify(cookies, null, 2), "utf8");
        const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
        fs.writeFileSync(txtFile, cookieStr, "utf8");
        found.add(site);
        console.log(`[成功] ${site} 登录检测到，Cookie 已保存: ${jsonFile}`);
        say(`${site} 登录已识别，Cookie 已保存。`);
      }
    }
    if (found.size === sites.length) break;
    if (!hinted && Date.now() - start > 30000) {
      hinted = true;
      say("还没检测到登录：请在弹出来的 Chrome 窗口里确认是否已登录微博/知乎（已登录会自动识别，无需操作）。");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  for (const site of sites) {
    if (!found.has(site)) {
      const foundNames = (await context.cookies(DOMAINS[site]).catch(() => [])).map((c) => c.name);
      console.log(`[诊断] ${site} 当前 cookie 名: ${foundNames.join(",") || "(无)"}`);
      console.log(`[超时] ${site} 未检测到登录（${Math.round(timeoutMs / 1000)}秒），请重新运行再试。`);
      say(`超时：未检测到 ${site} 的登录，请确认该账号在此 Chrome 里已登录后重试。`);
    }
  }
  await context.close();
  if (found.size === sites.length) {
    console.log("[完成] 全部完成。");
    process.exit(0);
  }
  console.log("[完成] 有未完成的站点，请检查上面的提示。");
  process.exit(1);
}

main().catch((e) => {
  console.error("[出错]", e);
  process.exit(1);
});