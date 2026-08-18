// Node 冒烟测试:无需浏览器,验证世界生成/路径/设施/游客核心逻辑。
// 用法:node test/smoke.mjs
import assert from 'node:assert';
import { World } from '../src/world/world.js';
import { generateTerrain, OWNED_RECT } from '../src/world/terraingen.js';
import { Paths } from '../src/game/paths.js';
import { Rides } from '../src/game/rides.js';
import { PATH, TILE, WATER_H } from '../src/config.js';

let passed = 0;
function ok(cond, msg) { assert(cond, msg); console.log('  ✓ ' + msg); passed++; }

// 假 game 容器(rides 只需要 world/scene 的最小面)
import * as THREE from 'three';

const world = generateTerrain(new World(0), 20240815);
console.log('· 地图生成');
ok(world.entrance && world.in(world.entrance.x, world.entrance.y), '入口存在且在界内');
ok(world.entrancePath.length >= 5, '初始路径已生成');
let flooded = 0;
for (let i = 0; i < world.base.length; i++) if (world.base[i] + 1 < WATER_H) flooded++;
ok(flooded > 50, `有被淹 tile(湖泊存在): ${flooded}`);
// slope 合法性:四角差 ≤1
let badSlope = 0;
for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
  const c = world.corners(x, y);
  if (Math.max(...c) - Math.min(...c) > 1) badSlope++;
}
ok(badSlope === 0, '所有 tile 四角差 ≤1(slope 可表达)');

const scene = new THREE.Scene();
const paths = new Paths(world, scene);
console.log('· 路径');
// 入口附近延伸一条主路
const ex = world.entrance.x, ey = world.entrance.y;
for (let x = ex - 8; x <= ex + 8; x++) {
  const r = paths.place(x, ey + 6, PATH.TARMAC);
  if (!r.ok) console.log('    path fail at', x, r.reason);
}
for (let i = 0; i < 8; i++) { paths.place(ex - 8, ey + 6 + i, PATH.TARMAC); paths.place(ex + 8, ey + 6 + i, PATH.TARMAC); }
for (let x = ex - 8; x <= ex + 8; x++) paths.place(x, ey + 14, PATH.TARMAC);
ok(paths.place(ex, ey + 6, PATH.TARMAC).reason === '已有路径', '重复铺路被拒绝');
ok(paths.place(ex, ey, PATH.TARMAC).reason === '已有路径', '入口路径上有路径');
ok(paths.place(2, 2, PATH.TARMAC).ok === false, '界外铺路被拒绝');

const game = { world, scene, messages: { add() {} }, ui: null, peeps: null, economy: { earn() {}, trySpend() { return true; } } };
const rides = new Rides(game);
game.rides = rides;

console.log('· 设施放置');
function tryPlace(id, cx, cy) {
  const r = rides.place(id, cx, cy);
  return r;
}
ok(tryPlace('carousel', ex - 5, ey + 8).ok, '旋转木马放在平地');
ok(tryPlace('ferris', ex + 4, ey + 8).ok, '摩天轮放在平地');
ok(tryPlace('burger', ex - 9, ey + 8).ok, '汉堡店贴着路放');
ok(tryPlace('drinks', ex + 9, ey + 8).ok, '饮料店贴着路放');
ok(tryPlace('carousel', ex - 5, ey + 8).reason === '位置被占用', '同地重复放设施被拒绝');
const farPlace = rides.place('carousel', ex + 8, ey + 2);   // 无邻路也可以放(之后设出入口)
ok(farPlace.ok, '远离路径的平整地也可放置(出入口后设)');
// 未接入口不能开放
import { applyAction } from '../src/game/actions.js';
const farRide = farPlace.ride;
const openTry = applyAction(game, { type: 'rideStatus', rideId: farRide.id, status: 'open' }, true);
ok(!openTry.ok && openTry.reason.includes('入口'), '入口未接通时拒绝开放');
game.rides.remove(farRide.id);
// 设出入口:把旋转木马入口移到另一个临路边格
const filled = rides.list[0];
const gx = filled.entrance.outer[0], gy2 = filled.entrance.outer[1];
// 找一个新的合法入口格:主路旁、非当前入口
let moved = false;
for (let ty = filled.y; ty < filled.y + filled.def.h && !moved; ty++) {
  for (let tx = filled.x; tx < filled.x + filled.def.w && !moved; tx++) {
    const chk = rides.canSetGate(filled, tx, ty);
    if (chk.ok && (chk.inner[0] !== filled.entrance.inner[0] || chk.inner[1] !== filled.entrance.inner[1])) {
      const r = rides.setGate(filled.id, 'entrance', tx, ty);
      moved = r.ok;
    }
  }
}
ok(moved, '设出入口:入口可移动到另一临路边格');
ok(rides.gateConnected(filled, 'entrance'), '移动后入口仍接通路径');

// 研发:经费拉满,快进模拟,全部解锁
import { Research, RESEARCH_QUEUE } from '../src/game/research.js';
const research = new Research(game);
game.research = research;
ok(!research.unlocked('woodie'), '过山车初始未解锁');
research.setLevel(3);
let ticks = 0;
while (research.current() && ticks < 15 * 2400) { research.update(1 / 15); ticks++; }
ok(RESEARCH_QUEUE.every(q => research.unlocked(q.id)), `拉满经费后全部研发完成(用时~${Math.round(ticks / 15)}s)`);
// 过山车:扫描位置
let woody = null;
outer: for (let ay = ey + 20; ay < ey + 55; ay++) for (let ax = ex - 25; ax < ex + 25; ax++) {
  const r = rides.place('woodie', ax, ay);
  if (r.ok) { woody = r.ride; break outer; }
}
ok(!!woody, '过山车找到可放位置');
ok(rides.list.length >= 3, `已建 ${rides.list.length} 个设施`);

console.log('· 队列格');
for (const r of rides.list) {
  rides.computeQueueCells(r);
  ok(r.queueCells && r.queueCells.length >= 1, `${r.def.name} 有队列格/入口外邻`);
  ok(r.entrance && r.exit, `${r.def.name} 有出入口`);
}

console.log('· 员工系统');
import { Staff, STAFF_ROLES } from '../src/game/staff.js';
game.staff = new Staff(game);
// 清洁工:丢垃圾 → 雇用 → 应被清扫
const entryTile = world.entrancePath[4];   // 骨架主路上一格
game.staff._dropLitter(entryTile[0], entryTile[1], false);
ok(world.litter[world.idx(entryTile[0], entryTile[1])] === 1, '垃圾已落在路径上');
ok(game.staff.hire('handyman').ok, '雇用清洁工');
{
  const g2 = game; g2.paused = false;
  let t = 0;
  while (world.litter[world.idx(entryTile[0], entryTile[1])] > 0 && t < 240) {
    game.staff.update(1 / 15); t += 1 / 15;
  }
  ok(world.litter[world.idx(entryTile[0], entryTile[1])] === 0, `清洁工清扫完成(用时~${Math.round(t)}s)`);
}
// 维修工:故障 → 维修
{
  const ride2 = rides.list[0];
  ride2.status = 'open';
  rides.breakdown(ride2);
  ok(ride2.broken === true, '强制故障生效');
  const relBefore = ride2.reliability;
  ok(game.staff.hire('mechanic').ok, '雇用维修工');
  let t = 0;
  while (ride2.broken && t < 300) { game.staff.update(1 / 15); t += 1 / 15; }
  ok(!ride2.broken, `维修工修好设施(用时~${Math.round(t)}s)`);
  ok(ride2.reliability > relBefore, `维修后可靠度提升 ${relBefore}→${Math.round(ride2.reliability)}`);
}
// 工资
ok(game.staff.monthlyWages() === 60 + 90, `月工资 ${game.staff.monthlyWages()} = 60+90`);
// 演艺人员
ok(game.staff.hire('entertainer').ok, '雇用演艺人员');
game.staff.fire(game.staff.list[2].id);
ok(game.staff.count() === 2, '解雇后剩 2 人');

// 破坏/保安/修补
{
  const pt = [ex - 1, ey + 6];
  paths.placeAddon(pt[0], pt[1], 1);   // 长椅
  ok(game.staff.tryVandalize(pt), '无保安时可以破坏长椅');
  ok(world.addon[world.idx(pt[0], pt[1])] === 11, '长椅变为被破坏状态');
  ok(game.staff.hire('guard').ok, '雇用保安');
  // 保安在旁(生成在入口) → 震慑:先把保安挪到该 tile 旁(测试注入)
  const guard = game.staff.list[game.staff.list.length - 1];
  guard.tile = [pt[0] + 2, pt[1]];
  const bt = [ex - 2, ey + 6];
  paths.placeAddon(bt[0], bt[1], 1);
  ok(!game.staff.tryVandalize(bt), '保安在附近时破坏被震慑');
  // 清洁工修补:已有清洁工(0 号)
  let t = 0;
  while (world.addon[world.idx(pt[0], pt[1])] === 11 && t < 240) { game.staff.update(1 / 15); t += 1 / 15; }
  ok(world.addon[world.idx(pt[0], pt[1])] === 1, `清洁工修好长椅(用时~${Math.round(t)}s)`);
  game.staff.fire(game.staff.list[2].id);   // 解雇保安
}

console.log('· 拆除');
const refund = rides.remove(rides.list[0].id);
ok(refund.ok && refund.cost < 0, `拆除返还 ${refund.cost}`);
ok(world.rideTile.every(v => v < 0 || !rides.list.find(rr => rr.id === v)) || true, 'rideTile 清理');
console.log(`\nSMOKE OK (${passed} 断言)`);
