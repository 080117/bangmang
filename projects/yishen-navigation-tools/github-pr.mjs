#!/usr/bin/env node
// github-pr.mjs — 创建/更新 GitHub PR，避免 PowerShell 管道导致中文乱码。
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [action, repo, arg3, arg4] = process.argv.slice(2);
if (!action || !repo || (action === 'create' && (!arg3 || !arg4))) {
  console.error('Usage:');
  console.error('  node github-pr.mjs create <owner/repo> <head> <base>');
  console.error('  node github-pr.mjs update <owner/repo> <pr-number>');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'gitcred-'));
const empty = join(dir, 'empty.gitconfig');
writeFileSync(empty, '');
process.env.GIT_CONFIG_SYSTEM = empty;

let out;
try {
  out = execFileSync('git', ['-c', 'credential.helper=wincred', 'credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    env: process.env,
  });
} catch (err) {
  console.error('读取 GitHub 凭据失败:', err.stderr?.toString?.() || err.message);
  process.exit(1);
}

const token = out.match(/^password=(.*)$/m)?.[1] || '';
if (!token) {
  console.error('Windows 凭据管理器中未找到 GitHub token');
  process.exit(1);
}

const patchPath = fileURLToPath(new URL('./pr-patch.json', import.meta.url));
const patch = JSON.parse(readFileSync(patchPath, 'utf8'));
if (!patch.title || !patch.body) {
  console.error('pr-patch.json 必须包含 title 和 body');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': 'github-pr-helper',
};

let url = '';
let method = 'POST';
let body = {};
if (action === 'create') {
  url = `https://api.github.com/repos/${repo}/pulls`;
  body = { title: patch.title, body: patch.body, head: arg3, base: arg4 };
} else {
  url = `https://api.github.com/repos/${repo}/pulls/${arg3}`;
  method = 'PATCH';
  body = { title: patch.title, body: patch.body };
}

const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
const data = await res.json();
if (!res.ok) {
  console.error(`GitHub API 失败 ${res.status}:`, data.message || JSON.stringify(data));
  process.exit(1);
}

console.log(`PR #${data.number}: ${data.html_url}`);
