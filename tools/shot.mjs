// 截图/冒烟测试工具:用系统 Chrome (Playwright channel=chrome) 加载游戏,收集控制台错误并截图。
// 用法: node tools/shot.mjs <out.png> [waitMs] [evalFile]
//   evalFile: 可选,一个 JS 文件,内容为 (page)=>{},在加载后执行(可调用 window.game 做操作)。
//   默认 URL 带 ?sp=1 (跳过开始界面进单机)。用 URL 环境变量覆盖。
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] || 'shots/shot.png';
const waitMs = Number(process.argv[3] || 2500);
const evalFile = process.argv[4];
const url = process.env.URL || 'http://localhost:8765/?sp=1';

fs.mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[console.${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
page.on('response', r => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(waitMs);
if (evalFile && fs.existsSync(evalFile)) {
  const src = fs.readFileSync(evalFile, 'utf8');
  const fn = eval(`(${src})`);
  try {
    await fn(page);
  } catch (e) { errors.push(`[eval] ${e.message}`); }
  await page.waitForTimeout(600);
}
await page.screenshot({ path: out });
await browser.close();
if (errors.length) {
  console.log('ERRORS:');
  for (const e of errors.slice(0, 30)) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('OK, no console/page errors. ->', out);
}
