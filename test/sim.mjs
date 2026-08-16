// 无头玩法仿真:搭一个完整小公园 → 注入游客 → 快进 3 分钟,断言经济循环成立。
// 用法:node test/sim.mjs [seconds]
import * as THREE from 'three';
import { World } from '../src/world/world.js';
import { generateTerrain } from '../src/world/terraingen.js';
import { Paths } from '../src/game/paths.js';
import { Rides } from '../src/game/rides.js';
import { Peeps } from '../src/game/peeps.js';
import { Scenery } from '../src/game/scenery.js';
import { Economy } from '../src/game/economy.js';
import { Messages } from '../src/game/messages.js';
import { PATH } from '../src/config.js';

const SECONDS = Number(process.argv[2] || 180);

const world = generateTerrain(new World(), 20240815);
const scene = new THREE.Scene();
const game = { world, scene, paused: false, time: 0, ui: null };
game.economy = new Economy(game);
game.messages = new Messages();
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
console.log(errs ? `\nSIM FAIL (${errs})` : '\nSIM OK');
process.exit(errs ? 1 : 0);
