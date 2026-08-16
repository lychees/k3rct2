// 多机位截图:建好示例公园后,从多个角度/缩放各拍一张。
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.env.URL || 'http://localhost:8765/';
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const g = window.game, w = g.world;
  const ex = w.entrance.x, ey = w.entrance.y;
  for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 6, 1);
  for (let i = 0; i < 8; i++) { g.paths.place(ex - 8, ey + 6 + i, 1); g.paths.place(ex + 8, ey + 6 + i, 1); }
  for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 14, 1);
  g.rides.place('carousel', ex - 5, ey + 8);
  g.rides.place('ferris', ex + 4, ey + 8);
  g.rides.place('twist', ex + 6, ey + 11);
  g.rides.place('burger', ex - 9, ey + 8);
  g.rides.place('drinks', ex + 9, ey + 8);
  outer: for (let ay = ey + 20; ay < ey + 55; ay++) for (let ax = ex - 25; ax < ex + 25; ax++)
    if (g.rides.place('woodie', ax, ay).ok) break outer;
  const trees = ['pine', 'oak', 'maple', 'birch'];
  for (let i = 0; i < 80; i++) g.scenery.place(trees[i % 4], ex - 24 + Math.floor(Math.random() * 48), ey + 2 + Math.floor(Math.random() * 34));
  for (let i = 0; i < 16; i++) g.scenery.place('flower', ex - 10 + Math.floor(Math.random() * 20), ey + 3 + Math.floor(Math.random() * 14));
  for (const r of g.rides.list) r.status = 'open';
  for (let i = 0; i < 120; i++) g.peeps.trySpawn();
});
await page.waitForTimeout(8000);
const poses = [
  ['p1-overview', () => { const g = window.game; const e = g.world.entrance; g.camera.centerOnTile(e.x, e.y + 12); g.camera.zoomIdx = 1; g.camera.yawIdx = 0; }],
  ['p2-coaster', () => { const g = window.game; const c = g.rides.list.find(r => r.def.kind === 'coaster'); if (c) { g.camera.centerOnTile(c.x + 9, c.y + 6); } g.camera.zoomIdx = 2; g.camera.yawIdx = 1; }],
  ['p3-peeps', () => { const g = window.game; const e = g.world.entrance; g.camera.centerOnTile(e.x, e.y + 4); g.camera.zoomIdx = 2; g.camera.yawIdx = 0; }],
  ['p4-rides', () => { const g = window.game; const e = g.world.entrance; g.camera.centerOnTile(e.x + 2, e.y + 9); g.camera.zoomIdx = 2; g.camera.yawIdx = 2; }],
  ['p5-far', () => { const g = window.game; const e = g.world.entrance; g.camera.centerOnTile(e.x, e.y + 16); g.camera.zoomIdx = 0; g.camera.yawIdx = 3; }],
];
for (const [name, fn] of poses) {
  await page.evaluate(fn);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `shots/${name}.png` });
}
// 清理多余的空 evaluate
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 10).join('\n') : 'ALL CLEAN');
