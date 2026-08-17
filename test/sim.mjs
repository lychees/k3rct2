// 无头玩法仿真:搭一个完整小公园 → 注入游客 → 快进 3 分钟,断言经济循环成立。
// 用法:node test/sim.mjs [seconds]
import * as THREE from 'three';
import { World } from '../src/world/world.js';
import { generateTerrain } from '../src/world/terraingen.js';
import { Paths } from '../src/game/paths.js';
import { Rides, DEF_BY_ID } from '../src/game/rides.js';
import { Peeps } from '../src/game/peeps.js';
import { Scenery } from '../src/game/scenery.js';
import { Economy } from '../src/game/economy.js';
import { Messages } from '../src/game/messages.js';
import { Research, RESEARCH_QUEUE } from '../src/game/research.js';
import { applyAction } from '../src/game/actions.js';
import { SCENARIOS, applyScenario, unlockNext } from '../src/game/scenarios.js';
import { PATH, TILE } from '../src/config.js';

const SECONDS = Number(process.argv[2] || 180);

const world = generateTerrain(new World(), 20240815);
const scene = new THREE.Scene();
const game = { world, scene, paused: false, time: 0, ui: null };
game.economy = new Economy(game);
game.messages = new Messages();
game.research = new Research(game);
game.paths = new Paths(world, scene);
game.scenery = new Scenery(world, scene);
game.rides = new Rides(game);
game.peeps = new Peeps(game);

const ex = world.entrance.x, ey = world.entrance.y;
for (let x = ex - 8; x <= ex + 8; x++) game.paths.place(x, ey + 6, PATH.TARMAC);
for (let i = 0; i < 8; i++) { game.paths.place(ex - 8, ey + 6 + i, PATH.TARMAC); game.paths.place(ex + 8, ey + 6 + i, PATH.TARMAC); }
for (let x = ex - 8; x <= ex + 8; x++) game.paths.place(x, ey + 14, PATH.TARMAC);
console.log('放置:',
  game.rides.place('carousel', ex - 5, ey + 8).ok,
  game.rides.place('ferris', ex + 4, ey + 8).ok,
  game.rides.place('twist', ex + 6, ey + 11).ok,
  game.rides.place('burger', ex - 9, ey + 8).ok,
  game.rides.place('drinks', ex + 9, ey + 8).ok);
let woody = null;
let spareSpot = null, gateSpot = null;
outer: for (let ay = ey + 20; ay < ey + 55; ay++) for (let ax = ex - 25; ax < ex + 25; ax++) {
  const v = game.rides.validate('woodie', ax, ay);
  if (!v.ok) continue;
  if (!v.needGate) { gateSpot = [ax, ay]; break outer; }
  if (!spareSpot) spareSpot = [ax, ay];
}
const spot = gateSpot || spareSpot;
if (spot) {
  const wr = game.rides.place('woodie', spot[0], spot[1]);
  woody = wr.ride;
}
console.log('过山车:', woody ? `ok@${woody.x},${woody.y} gate=${woody.entrance.outer} 需设门=${!!woody.needGate}` : 'FAIL');
for (const r of game.rides.list) r.status = 'open';
for (let i = 0; i < 100; i++) game.peeps.trySpawn();

let errs = 0;
const assertT = (c, m) => { if (!c) { console.error('  ✗ ' + m); errs++; } else console.log('  ✓ ' + m); };

const dt = 1 / 15;
let maxCoasterRiders = 0;
for (let t = 0; t < SECONDS; t += dt) {
  game.time += dt;
  game.economy.update(dt);
  game.rides.update(dt);
  game.peeps.update(dt);
  if (woody) maxCoasterRiders = Math.max(maxCoasterRiders, woody.riders.length);
  if (Math.abs(t % 60) < dt) console.log(`  …t=${Math.round(t)}s 游客=${game.peeps.list.length}`);
}
const R = Object.fromEntries(game.rides.list.map(r => [r.def.id, r]));
console.log('结算:', game.rides.list.map(r => `${r.def.id}:乘${r.guestsServed}队${r.queue.length}收${Math.round(r.incomeTotal)}`).join(' | '));
console.log(`现金=${Math.round(game.economy.cash)} 评分=${Math.round(game.economy.parkRating)} 游客=${game.peeps.list.length}`);
const totalServed = game.rides.list.reduce((s, r) => s + r.guestsServed, 0);
assertT(totalServed > 30, `总接待 ${totalServed} > 30`);
assertT(R.woodie && R.woodie.guestsServed >= 8, `过山车接待 ${R.woodie?.guestsServed} ≥ 8`);
assertT(maxCoasterRiders >= 4, `过山车单趟载客峰值 ${maxCoasterRiders} ≥ 4`);
assertT(R.burger.guestsServed > 3 && R.drinks.guestsServed > 3, '商店有成交');
assertT(game.economy.cash > 9000, `现金没有大幅亏损(${Math.round(game.economy.cash)} > 9000,玩家可调价/收门票扭亏)`);
assertT(game.peeps.list.length > 40, `园内还有 ${game.peeps.list.length} 名游客`);

// 开发者控制台:印钱 / 一键完成所有研究
const cash0 = game.economy.cash;
const rm = applyAction(game, { type: 'cheatMoney', amount: 10000 }, true);
assertT(rm.ok && Math.round(game.economy.cash - cash0) === 10000, '作弊:印钱 +10000');
const ra = applyAction(game, { type: 'researchAll' }, true);
assertT(ra.ok && game.research.done.length === RESEARCH_QUEUE.length && game.research.unlocked('woodie'),
  `作弊:一键完成所有研究(${game.research.done.length}/${RESEARCH_QUEUE.length})`);

// 旋转木马:旋转枢轴必须在盘面中心(几何绕原点,组位移到中心)
{
  const built = DEF_BY_ID.carousel.build({ animSpeed: 1 }, new THREE.MeshLambertMaterial({ vertexColors: true }));
  const spin = built.group.children.find(c => c.isGroup);
  built.update(1, { animSpeed: 1 });
  assertT(spin && Math.abs(spin.position.x - 1.5 * TILE) < 1e-6 && Math.abs(spin.position.z - 1.5 * TILE) < 1e-6,
    '旋转木马枢轴位于盘面中心');
  assertT(spin && Math.abs(spin.rotation.y - 1.1) < 1e-6, '旋转木马随 update 转动');
  if (spin) {   // 旋转部分几何必须围绕原点构建,否则公转会甩出基座
    const p = spin.children[0].geometry.attributes.position;
    let maxR = 0;
    for (let i = 0; i < p.count; i++) maxR = Math.max(maxR, Math.hypot(p.getX(i), p.getZ(i)));
    assertT(maxR < 2.6, `旋转木马旋转部分几何围绕原点(最大半径 ${maxR.toFixed(2)})`);
  }
}

// 关卡:定义合法 + 各地图有足够陆地可建园 + 现金目标判定 + 解锁
{
  assertT(SCENARIOS.length >= 5, `至少 5 个关卡(实际 ${SCENARIOS.length})`);
  for (const sc of SCENARIOS) {
    assertT(sc.id && sc.name && sc.goal.guests > 0 && sc.goal.rating > 0 && sc.goal.deadlineAbs > 0,
      `关卡「${sc.name}」目标字段完整`);
    const w2 = generateTerrain(new World(), sc.seed);
    let land = 0;
    for (let i = 0; i < w2.base.length; i++) if (w2.base[i] >= 4.5) land++;
    const frac = land / w2.base.length;
    assertT(frac > 0.5, `关卡「${sc.name}」地图陆地占比 ${(frac * 100) | 0}% > 50%`);
  }
  const tycoon = SCENARIOS.find(s => s.id === 'tycoon');
  applyScenario(game, tycoon);
  assertT(game.economy.goal.scenarioId === 'tycoon' && game.economy.cash === tycoon.startCash,
    '关卡应用:goal 与起始资金生效');
  game.economy.goal.won = false;               // 清掉可能被动触发的中途判定
  game.economy.cash = 40000;                   // 灌够现金 → cashOk
  game.economy.parkRating = 700;
  while (game.peeps.list.length < 310) game.peeps.list.push({ happiness: 200 });  // 垫到 ≥300 游客(checkGoal 只看数量)
  game.economy.checkGoal(game);
  assertT(game.economy.goal.won, '现金类关卡:游客+评分+现金均达标即判定通关');
  assertT(unlockNext('meadow').includes('已解锁'), '通关后解锁下一关提示');
}
console.log(errs ? `\nSIM FAIL (${errs})` : '\nSIM OK');
process.exit(errs ? 1 : 0);
