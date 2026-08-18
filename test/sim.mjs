// 无头玩法仿真:搭一个完整小公园 → 注入游客 → 快进 3 分钟,断言经济循环成立。
// 用法:node test/sim.mjs [seconds]
import * as THREE from 'three';
import { World } from '../src/world/world.js';
import { generateTerrain } from '../src/world/terraingen.js';
import { Paths } from '../src/game/paths.js';
import { Rides, DEF_BY_ID } from '../src/game/rides.js';
import { Peeps } from '../src/game/peeps.js';
import { Staff } from '../src/game/staff.js';
import { Scenery } from '../src/game/scenery.js';
import { Economy } from '../src/game/economy.js';
import { Messages } from '../src/game/messages.js';
import { Research, RESEARCH_QUEUE } from '../src/game/research.js';
import { applyAction } from '../src/game/actions.js';
import { SCENARIOS, applyScenario, unlockNext } from '../src/game/scenarios.js';
import { canFinish } from '../src/game/coasterEdit.js';
import { Sfx } from '../src/core/audio.js';
import { PATH, TILE, H_UNIT, MAP_W, MAP_H } from '../src/config.js';

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
game.staff = new Staff(game);

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

// 乘坐可见:全部带 riderPos 的设施都能给出有限落点
{
  const flatIds = ['carousel', 'ferris', 'twist', 'haunted', 'bumper', 'pirate', 'tower',
    'slide', 'teacups', 'chairs', 'droptower', 'frisbee', 'topspin'];
  const mat2 = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const id of flatIds) {
    const def = DEF_BY_ID[id];
    const built = def.build({ animSpeed: 1 }, mat2);
    built.update(0.5, { animSpeed: 1 });
    const out = { x: 0, y: 0, z: 0 };
    let okR = !!built.riderPos;
    if (okR) for (let i = 0; i < def.capacity; i++) {
      built.riderPos(i, out);
      if (!Number.isFinite(out.x + out.y + out.z)) { okR = false; break; }
    }
    assertT(okR, `乘坐可见:「${def.name}」riderPos 落点有效`);
  }
  const wRide = game.rides.list.find(r => r.def.id === 'woodie');
  const out2 = { x: 0, y: 0, z: 0 };
  wRide.api.riderPos(3, out2);
  assertT(Number.isFinite(out2.x + out2.y + out2.z), '乘坐可见:过山车车厢 riderPos 落点有效');
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

// 定制轨道设施:扫描平地 → 逐段铺轨 → 闭环 → 测试模式跑一整圈(过山车/小火车/激流勇进三种风格)
{
  const PLANS = [
    ['mycoaster', ['lift', 'lift', 'right', 'flat', 'right', 'down', 'down', 'flat', 'right', 'flat', 'right']],
    ['train', ['flat', 'right', 'flat', 'right', 'flat', 'right', 'left', 'right', 'right']],
    ['flume', ['lift', 'lift', 'right', 'flat', 'right', 'down', 'down', 'flat', 'right', 'flat', 'right']],
    ['mycoaster+loop', ['lift', 'lift', 'right', 'flat', 'right', 'down', 'down', 'flat', 'right', 'loop', 'right']],
    ['mycoaster+cork', ['lift', 'steepup', 'right', 'flat', 'right', 'steepdown', 'down', 'cork', 'right', 'flat', 'right']],
  ];
  for (const [defId, SEQ] of PLANS) {
    const realDef = defId.startsWith('mycoaster') ? 'mycoaster' : defId;
    let anchor = null;
    outer2: for (let ay = ey + 16; ay < ey + 55; ay++) for (let ax = ex - 24; ax < ex + 20; ax++) {
      if (!game.rides.canBeginCustom(ax, ay).ok) continue;
      // 用假 ride 预演整圈(canAddPiece 自带地形/自交校验)
      const fake = { def: DEF_BY_ID[realDef], pieces: [{ t: 'station', x: ax, y: ay, h: 0, dir: 1 }], baseY: game.world.maxH(ax, ay) * H_UNIT, custom: true, complete: false };
      let okAll = true;
      for (const t of SEQ) {
        const chk = game.rides.canAddPiece(fake, t);
        if (!chk.ok) { okAll = false; break; }
        fake.pieces.push({ t, x: chk.x, y: chk.y, h: chk.h, dir: chk.dir });
      }
      if (okAll) { anchor = [ax, ay]; break outer2; }
    }
    assertT(!!anchor, `${defId}:找到可建站台位置`);
    if (!anchor) continue;
    const b = game.rides.beginCustom(realDef, anchor[0], anchor[1], 1);
    const ride = b.ride;
    let allOk = !!b.ok;
    for (const t of SEQ) {
      const r = game.rides.addPiece(ride.id, t);
      if (!r.ok) { allOk = false; console.error('段失败', defId, t, r.reason); break; }
    }
    assertT(allOk, `${defId}:逐段铺轨 ${SEQ.length} 段`);
    assertT(canFinish(ride), `${defId}:轨道接回站台可闭环`);
    const f = game.rides.finishCustom(ride.id);
    assertT(f.ok && ride.complete, `${defId}:闭环建成(兴奋${ride.excitement})`);
    ride.status = 'test';
    let sawRun = false, laps = 0;
    for (let t = 0; t < 300 && laps < 1; t += 1 / 15) {
      ride.api.update(1 / 15);
      if (ride.api.state.mode === 'run') sawRun = true;
      if (sawRun && ride.api.state.mode === 'load') laps++;
    }
    assertT(laps >= 1, `${defId}:列车测试模式跑完一整圈`);
    game.rides.remove(ride.id);
  }
}

// 多站台小火车:两站各自排队、跨站上下车
{
  const SEQ = ['flat', 'right', 'station', 'right', 'flat', 'right', 'left', 'right', 'right'];
  let anchor = null;
  outer3: for (let ay = ey + 16; ay < ey + 55; ay++) for (let ax = ex - 24; ax < ex + 20; ax++) {
    const h0 = game.world.maxH(ax, ay);
    let okA = true;
    for (let dy = -1; dy <= 3 && okA; dy++) for (let dx = 0; dx <= 2 && okA; dx++) {
      if (game.world.maxH(ax + dx, ay + dy) !== h0 || game.world.minH(ax + dx, ay + dy) !== h0) okA = false;
    }
    if (!okA || !game.rides.canBeginCustom(ax, ay).ok) continue;
    if (!game.paths.canPlace(ax - 1, ay, PATH.TARMAC).ok || !game.paths.canPlace(ax + 1, ay + 3, PATH.TARMAC).ok) continue;
    const fake = { def: DEF_BY_ID.train, pieces: [{ t: 'station', x: ax, y: ay, h: 0, dir: 1 }], baseY: h0 * H_UNIT, custom: true, complete: false };
    let okAll = true;
    for (const t of SEQ) {
      const chk = game.rides.canAddPiece(fake, t);
      if (!chk.ok) { okAll = false; break; }
      fake.pieces.push({ t, x: chk.x, y: chk.y, h: chk.h, dir: chk.dir });
    }
    if (okAll) { anchor = [ax, ay]; break outer3; }
  }
  assertT(!!anchor, '多站台火车:找到可建位置');
  if (anchor) {
    const [ax, ay] = anchor;
    game.paths.place(ax - 1, ay, PATH.TARMAC);
    game.paths.place(ax + 1, ay + 3, PATH.TARMAC);
    const b = game.rides.beginCustom('train', ax, ay, 1);
    const ride = b.ride;
    let allOk = !!b.ok;
    for (const t of SEQ) {
      const r = game.rides.addPiece(ride.id, t);
      if (!r.ok) { allOk = false; console.error('段失败', t, r.reason); break; }
    }
    assertT(allOk, '多站台火车:铺轨 9 段(含第二站台)');
    assertT(game.rides.finishCustom(ride.id).ok && ride.stations.length === 2, `多站台火车:闭环建成,站点数 ${ride.stations?.length}`);
    assertT(Object.keys(ride.stationGateMap || {}).length === 2, '多站台火车:两站均接通路径');
    game.peeps.trySpawn(); game.peeps.trySpawn();
    const [pA, pB] = game.peeps.list.slice(-2);
    pA.tile = [ax - 1, ay]; pB.tile = [ax + 1, ay + 3];
    game.rides.joinQueue(pA, ride); game.rides.joinQueue(pB, ride);
    assertT(pA.queueStation === 0 && pB.queueStation === 1, '多站台火车:两站分别入队');
    ride.status = 'open';
    for (let t = 0; t < 300 && ride.guestsServed < 2; t += 1 / 15) game.rides.update(1 / 15);
    assertT(ride.guestsServed >= 2, `多站台火车:两名游客完成跨站乘坐(服务 ${ride.guestsServed})`);
    assertT(pA.state !== 'ride' && pB.state !== 'ride', '多站台火车:游客均已下车');
    game.rides.remove(ride.id);
  }
}

// 家庭组与游客偏好
{
  const withGid = game.peeps.list.filter(p => p.groupId > 0);
  const kids = game.peeps.list.filter(p => p.kid);
  assertT(withGid.length > 0, '家庭组:有组队游客');
  assertT(kids.length > 0 && kids.every(p => p.scale === 0.72 && p.thrill <= 0.46), `家庭组:儿童小体型低刺激偏好(${kids.length} 人)`);
  const byG = {};
  for (const p of withGid) (byG[p.groupId] ||= []).push(p);
  assertT(Object.values(byG).every(g2 => g2.length >= 1 && g2.length <= 5), '家庭组:组大小 ≤5(成员会陆续离园)');
  assertT(Object.values(byG).some(g2 => g2.some(p => p.isLeader)), '家庭组:存在领队仍在园的小组');
  const fakeRide = { id: 999, status: 'open', broken: false, price: 3, queue: [], queueCells: [1, 2], def: { kind: 'flat', intensity: 64 }, intensity: 64 };
  assertT(kids.length > 0 && !game.rides.wantsRide(kids[0], fakeRide), '偏好:儿童不玩高强度设施');
  const adult = game.peeps.list.find(p => !p.kid);
  const gentle = { ...fakeRide, def: { kind: 'flat', intensity: 20 }, intensity: 20 };
  assertT(game.rides.wantsRide(adult, gentle) === game.rides.wantsRide(adult, gentle), '偏好:同一游客对同一设施决定稳定');
}

// 涂装/改名
{
  const ride = game.rides.list[0];
  const r1 = applyAction(game, { type: 'rideRename', rideId: ride.id, name: '飞驰骏马' }, true);
  assertT(r1.ok && ride.customName === '飞驰骏马', '设施改名生效');
  const r2 = applyAction(game, { type: 'ridePaint', rideId: ride.id, color: 0x48b050 }, true);
  assertT(r2.ok && ride.paint === 0x48b050, '设施涂装生效');
  const r3 = applyAction(game, { type: 'ridePaint', rideId: ride.id, color: 0xffffff }, true);
  assertT(r3.ok && ride.paint === 0xffffff, '涂装恢复默认');
}

// 设施老化与翻新
{
  const ride = game.rides.list[0];
  ride.ageMonths = 30;
  const eff = game.rides.effExcitement(ride);
  assertT(eff < ride.excitement * 0.61, `老化:30 月兴奋度衰减到 ${(eff / ride.excitement * 100) | 0}%`);
  const r = applyAction(game, { type: 'rideRenovate', rideId: ride.id }, true);
  assertT(r.ok && ride.ageMonths === 0 && ride.reliability === 95, '翻新:园龄归零可靠度恢复');
}
// 购地扩建
{
  let spot = null;
  outer4: for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    if (game.world.ownedAt(x, y)) continue;
    for (let d = 0; d < 4; d++) if (game.world.ownedAt(x + [1, 0, -1, 0][d], y + [0, 1, 0, -1][d])) { spot = [x, y]; break outer4; }
  }
  assertT(!!spot, '购地:找到相邻未购地');
  if (spot) {
    const before = game.world.owned.reduce((s, v) => s + v, 0);
    const r = applyAction(game, { type: 'buyLand', x: spot[0], y: spot[1] }, true);
    const after = game.world.owned.reduce((s, v) => s + v, 0);
    assertT(r.ok && after > before, `购地:新增 ${after - before} 格`);
  }
}
// 员工巡逻区
{
  game.staff.hire('handyman');
  const s = game.staff.list[game.staff.list.length - 1];
  const r = applyAction(game, { type: 'staffArea', staffId: s.id, x0: ex - 5, y0: ey + 2, x1: ex + 5, y1: ey + 8 }, true);
  assertT(r.ok && s.area && s.area[0] === ex - 5, '巡逻区:划定生效');
  const r2 = applyAction(game, { type: 'staffArea', staffId: s.id, clear: true }, true);
  assertT(r2.ok && !s.area, '巡逻区:清除生效');
}
// 缆车:两点建索道并跑一趟
{
  let a = null, b2 = null;
  outer5: for (let ay = ey + 16; ay < ey + 50; ay++) for (let ax = ex - 24; ax < ex + 20; ax++) {
    if (!game.rides.canCableStation(ax, ay).ok) continue;
    if (game.rides.canCableStation(ax + 6, ay).ok) { a = [ax, ay]; b2 = [ax + 6, ay]; break outer5; }
  }
  assertT(!!a, '缆车:找到两个站台位');
  if (a) {
    const r = applyAction(game, { type: 'cablePlace', x1: a[0], y1: a[1], x2: b2[0], y2: b2[1] }, true);
    assertT(r.ok && r.ride.stations.length === 2, '缆车:索道建成');
    const ride = r.ride;
    ride.status = 'test';
    let arrived = false;
    for (let t = 0; t < 120 && !arrived; t += 1 / 15) {
      ride.api.update(1 / 15, ride);
      if (ride.api.state.stationIdx === 1) arrived = true;
    }
    assertT(arrived, '缆车:吊舱到达对岸');
    game.rides.remove(ride.id);
  }
}
// 脚踏船:邻水建码头,出船返航下客
{
  let spot = null;
  outer6: for (let ay = ey + 10; ay < ey + 60; ay++) for (let ax = ex - 30; ax < ex + 30; ax++) {
    if (game.rides.validate('boats', ax, ay).ok) { spot = [ax, ay]; break outer6; }
  }
  assertT(!!spot, '脚踏船:找到邻水码头位');
  if (spot) {
    const r = game.rides.place('boats', spot[0], spot[1]);
    assertT(!!r.ok, '脚踏船:码头建成');
    const ride = r.ride;
    ride.status = 'open';
    for (let i = 0; i < 4; i++) game.peeps.trySpawn();
    const riders = game.peeps.list.slice(-4);
    for (const p of riders) { p.tile = ride.entrance.outer.slice(); game.rides.joinQueue(p, ride); }
    for (let t = 0; t < 200 && ride.guestsServed < 4; t += 1 / 15) game.rides.update(1 / 15);
    assertT(ride.guestsServed >= 4, `脚踏船:出船返航下客(服务 ${ride.guestsServed})`);
    game.rides.remove(ride.id);
  }
}

// 音效:无 window 环境下所有预设安全空转(不抛异常)
{
  const sfx = new Sfx();
  let safe = true;
  try {
    for (const n of ['click', 'place', 'remove', 'error', 'cash', 'fanfare', 'win', 'lose', 'scream', 'rumble', 'clack']) sfx.play(n);
    sfx.ambient({ rain: true, crowd: 1, music: 1 });   // 环境音也无头安全
  }
  catch { safe = false; }
  assertT(safe, '音效模块无头环境安全空转');
}
console.log(errs ? `\nSIM FAIL (${errs})` : '\nSIM OK');
process.exit(errs ? 1 : 0);
