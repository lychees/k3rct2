// 多人 E2E:两个客户端连接同一服务器,互见对方建造,快照/聊天/名单同步。
// 用法: node tools/mp-test.mjs   (要求 server 已运行 :8765)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.URL || 'http://localhost:8765';
fs.mkdirSync('shots', { recursive: true });
const errors = [];
let fails = 0;
const assert = (c, m) => { if (c) console.log('  ✓ ' + m); else { fails++; console.error('  ✗ ' + m); } };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
function newPage() {
  const p = browser.newPage({ viewport: { width: 1280, height: 800 } });
  return p;
}
const pageA = await newPage();
const pageB = await newPage();
for (const [tag, page] of [['A', pageA], ['B', pageB]]) {
  page.on('pageerror', e => errors.push(`[${tag} pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag} console] ${m.text()}`); });
}

// 1. 两人以联机模式进入
await pageA.goto(base + '/?mp=1&name=Alice');
await pageB.goto(base + '/?mp=1&name=Bob');
await pageA.waitForTimeout(3500);
await pageB.waitForTimeout(3500);
const okA = await pageA.evaluate(() => !!window.game && !!window.game.net && window.game.net.connected);
const okB = await pageB.evaluate(() => !!window.game && !!window.game.net && window.game.net.connected);
assert(okA, 'Alice 联机进入成功');
assert(okB, 'Bob 联机进入成功');

// 2. 双方名单互见
const playersA = await pageA.evaluate(() => window.game.net.players);
assert(playersA.includes('Alice') && playersA.includes('Bob'), `名单互见: ${JSON.stringify(playersA)}`);

// 3. Alice 清掉旧设施(重跑安全)并在平整区铺 5 格新路;Bob 应看到
const exInfo = await pageA.evaluate(() => {
  const g = window.game, w = g.world;
  for (const r of [...g.rides.list]) g.dispatchAction({ type: 'rideRemove', rideId: r.id });
  return { ex: w.entrance.x, ey: w.entrance.y, before: w.path.reduce((s, v) => s + (v ? 1 : 0), 0) };
});
const placed = await pageA.evaluate(({ ex, ey }) => {
  let n = 0;
  for (let i = 0; i < 5; i++) {
    const x = ex - 10 + i, y = ey + 13;   // 平坦区自由行
    const before = window.game.world.path[window.game.world.idx(x, y)];
    window.game.dispatchAction({ type: 'path', kind: 1, x, y });
    if (!before) n++;
  }
  return n;
}, exInfo);
await pageA.waitForTimeout(1200);
const aPaths = await pageA.evaluate(() => window.game.world.path.reduce((s, v) => s + (v ? 1 : 0), 0));
const bPaths = await pageB.evaluate(() => window.game.world.path.reduce((s, v) => s + (v ? 1 : 0), 0));
assert(aPaths === bPaths && bPaths === exInfo.before + placed, `路径同步 A=${aPaths} B=${bPaths} 预期=${exInfo.before + placed}`);

// 4. Bob 放旋转木马;Alice 应看到设施(先补门口路径,容忍已存在)
await pageB.evaluate(({ ex, ey }) => {
  // 抓 reject
  window.__rejects = [];
  const orig = window.game.net._onMessage.bind(window.game.net);
  window.game.net._onMessage = (m) => { if (m.type === 'reject') window.__rejects.push(m.reason); orig(m); };
  for (let px = ex - 9; px <= ex - 7; px++) {
    if (!window.game.world.path[window.game.world.idx(px, ey + 6)])
      window.game.dispatchAction({ type: 'path', kind: 1, x: px, y: ey + 6 });
  }
  window.__placeR = window.game.dispatchAction({ type: 'ridePlace', id: 'carousel', x: ex - 8, y: ey + 8 });
}, exInfo);
await pageA.waitForTimeout(1500);
const rejects = await pageB.evaluate(() => window.__rejects);
if (rejects.length) console.error('REJECTS: ' + JSON.stringify(rejects));
const ridesA = await pageA.evaluate(() => window.game.rides.list.map(r => [r.def.id, r.status]));
const ridesB = await pageB.evaluate(() => window.game.rides.list.map(r => [r.def.id, r.status]));
assert(ridesA.length === 1 && ridesB.length === 1, `设施互见 A=${JSON.stringify(ridesA)} B=${JSON.stringify(ridesB)}`);

// 5. Bob 开放它;Alice 状态同步
await pageB.evaluate(() => {
  const ride = window.game.rides.list[0];
  window.game.dispatchAction({ type: 'rideStatus', rideId: ride.id, status: 'open' });
});
await pageA.waitForTimeout(1000);
const stA = await pageA.evaluate(() => window.game.rides.list[0].status);
assert(stA === 'open', `设施状态同步 open,A 看到=${stA}`);

// 6. 共享资金:Alice 看到现金变少(木马 $900 + 路径 $×5)
const cashA = await pageA.evaluate(() => window.game.economy.cash);
const cashB = await pageB.evaluate(() => window.game.economy.cash);
assert(Math.abs(cashA - cashB) < 1 && cashA < 10000 - 800, `共享资金池 A=${cashA} B=${cashB} (<9200)`);

// 7. 聊天
await pageA.evaluate(() => window.game.net.sendChat('大家一起来修北边的过山车!'));
await pageA.waitForTimeout(800);
const chatB = await pageB.evaluate(() => window.game.messages.list.slice(-3).map(m => m.text));
assert(chatB.some(t => t.includes('过山车')), `聊天到达 B: ${JSON.stringify(chatB)}`);

// 8. 远端游客渲染
await pageA.waitForTimeout(8000);
const peepsA = await pageA.evaluate(() => window.game.peeps.list.length);
const peepsB = await pageB.evaluate(() => window.game.peeps.list.length);
assert(peepsA > 0 && peepsB > 0, `远端游客快照 A=${peepsA} B=${peepsB}`);

// 8b. 员工同步:Alice 雇清洁工 → Bob 应看到员工快照
await pageA.evaluate(() => window.game.dispatchAction({ type: 'staffHire', role: 'handyman' }));
await pageB.waitForTimeout(2500);
const staffB = await pageB.evaluate(() => window.game.staff.list.length);
const staffA2 = await pageA.evaluate(() => window.game.staff.list.length);
assert(staffA2 >= 1 && staffB >= 1, `员工快照同步 A=${staffA2} B=${staffB}`);

// 9. 截图:双方同机位
for (const [tag, page] of [['A', pageA], ['B', pageB]]) {
  await page.evaluate((exInfo2) => {
    const g = window.game;
    g.camera.centerOnTile(exInfo2.ex, exInfo2.ey + 8);
    g.camera.zoomIdx = 2; g.camera.snap();
    g.ui.panels.open('mp');
  }, exInfo);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/mp-${tag}.png` });
}

await browser.close();
if (errors.length) { console.log('PAGE ERRORS:'); errors.slice(0, 8).forEach(e => console.log('  ' + e)); }
console.log(fails || errors.length ? `MP TEST FAILS=${fails} errs=${errors.length}` : 'MP TEST ALL OK');
process.exit(fails || errors.length ? 1 : 0);
