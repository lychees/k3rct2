// 入口:渲染器、场景、灯光、启动流程(单人/多人)、主循环与系统接线。
import * as THREE from 'three';
import { generateTerrain } from './world/terraingen.js';
import { World } from './world/world.js';
import { Terrain } from './world/terrain.js';
import { IsoCamera } from './render/camera.js';
import { Picker } from './core/picker.js';
import { Paths } from './game/paths.js';
import { Scenery } from './game/scenery.js';
import { Rides } from './game/rides.js';
import { Peeps } from './game/peeps.js';
import { Economy } from './game/economy.js';
import { Staff } from './game/staff.js';
import { Messages, Thoughts } from './game/messages.js';
import { Weather } from './game/weather.js';
import { Tools } from './game/tools.js';
import { Saves, peekSave, applyWorldData } from './game/save.js';
import { applyAction } from './game/actions.js';
import { Research } from './game/research.js';
import { SCENARIOS, SCENARIO_BY_ID, applyScenario, maxUnlocked } from './game/scenarios.js';
import { Sfx } from './core/audio.js';
import { FirstPersonView } from './render/fpview.js';
import { UI } from './ui/ui.js';
import { NetClient } from './mp/net.js';
import { RemotePeeps } from './mp/remotePeeps.js';
import { ADDON, MAP_W, MAP_H, H_UNIT } from './config.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
try {   // 画质偏好(设置面板可调)
  if (localStorage.getItem('rct2js-quality') === 'low') renderer.setPixelRatio(1);
  else renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
} catch { renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); }
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1a2e);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a6032, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
sun.position.set(60, 90, 30);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x88aaff, 0.25);
fill.position.set(-50, 40, -60);
scene.add(fill);

// ---------- 启动覆盖层 ----------
function showStartOverlay() {
  return new Promise((resolve) => {
    const ui = document.getElementById('ui');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,16,28,0.72);z-index:90';
    const card = document.createElement('div');
    card.className = 'rct-win';
    card.style.width = '320px';
    const max = maxUnlocked();
    const lvOpts = SCENARIOS.map((s, i) =>
      `<option value="${s.id}" ${i > max ? 'disabled' : ''}>第${i + 1}关 ${s.name}${i > max ? '(未解锁)' : ''}</option>`).join('');
    card.innerHTML = `
      <div class="titlebar"><span>RCT2.js — 过山车大亨复刻</span></div>
      <div class="content" style="display:flex;flex-direction:column;gap:10px">
        <div class="hint" style="font-size:12px">等距视角 · 修路建园 · 接待游客 · 经营收支</div>
        <input id="__nickname" placeholder="昵称(联机用)" maxlength="12"
          style="background:rgba(20,24,34,0.8);border:1px solid rgba(255,255,255,0.25);color:#e8e6d0;padding:6px 8px;border-radius:3px;font-size:13px;outline:none">
        <select id="__lv" style="background:rgba(20,24,34,0.8);border:1px solid rgba(255,255,255,0.25);color:#e8e6d0;padding:6px 8px;border-radius:3px;font-size:13px;outline:none">
          <option value="">继续上次进度 / 默认公园</option>
          ${lvOpts}
        </select>
        <button class="rct-btn" id="__sp" style="font-size:14px;padding:8px">单人经营</button>
        <button class="rct-btn" id="__mp" style="font-size:14px;padding:8px">多人联机(同一服务器同一座公园)</button>
        <div class="hint" style="font-size:11px">多人:把本页 URL 发给朋友,他们也点"多人联机"即可</div>
      </div>`;
    wrap.appendChild(card);
    ui.appendChild(wrap);
    const name = () => (card.querySelector('#__nickname').value.trim() || '玩家' + Math.floor(Math.random() * 900 + 100));
    card.querySelector('#__sp').addEventListener('click', () => {
      const lv = card.querySelector('#__lv').value;
      if (lv && peekSave() && !confirm('开始新关卡将覆盖当前存档,继续?')) return;
      wrap.remove(); resolve({ mode: 'sp', lv });
    });
    card.querySelector('#__mp').addEventListener('click', () => { wrap.remove(); resolve({ mode: 'mp', name: name() }); });
  });
}

// ---------- 构建游戏(世界就绪后调用) ----------
function buildGame(world, isMP) {
  const terrain = new Terrain(world, scene);
  const isoCam = new IsoCamera(renderer);
  const picker = new Picker(world, terrain, isoCam);
  isoCam.centerOnTile(world.entrance.x, world.entrance.y + 10);
  isoCam.zoomIdx = 1;

  const game = {
    renderer, scene, world, terrain, camera: isoCam, picker,
    paused: false, time: 0, mp: isMP,
  };
  isoCam.game = game;   // 触屏平移需感知当前工具
  game.economy = new Economy(game);
  game.research = new Research(game);
  game.messages = new Messages();
  game.thoughts = new Thoughts();
  game.weather = new Weather(game);
  game.weather.initVisuals();
  game.paths = new Paths(world, scene);
  game.scenery = new Scenery(world, scene);
  game.rides = new Rides(game);
  game.peeps = isMP ? new RemotePeeps(game) : new Peeps(game);
  try {   // 游客上限偏好
    const pc = parseInt(localStorage.getItem('rct2js-peepcap') || '260', 10);
    if (game.peeps.cap !== undefined) game.peeps.cap = Math.max(40, Math.min(260, pc || 260));
  } catch { /* 忽略 */ }
  game.staff = new Staff(game);
  game.tools = new Tools(game);
  game.audio = new Sfx();
  game.fp = new FirstPersonView(game);
  game.ui = new UI(game);
  // 动作分发:单机=本地权威;联机=交给网络层覆盖
  game.dispatchAction = (a) => applyAction(game, a, true);
  activeCam = isoCam;
  window.game = game; // 调试/测试钩子
  game.tileScreenPos = (x, y) => {
    const c = world.tileCenter(x, y);
    return isoCam.groundToScreen(new THREE.Vector3(c.x, world.surfaceY(x, y), c.z));
  };
  return game;
}

function installLoop(game) {
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const simDt = game.mp ? dt : dt * (game.speedMul || 1);   // 单机可调速(联机服务器权威)
    game.time += dt;
    if (game.fp?.active) game.fp.update(dt);       // 第一视角模式接管相机
    else game.camera.update(dt);
    if (game.mp) {
      game.rides.update(simDt);         // 仅动画(队列/收益由服务端管)
      game.peeps.update(simDt);         // 远端插值渲染
      game.staff.update(simDt);         // 远端插值渲染
    } else if (!game.paused) {
      game.economy.update(simDt);
      game.rides.update(simDt);
      game.peeps.update(simDt);
      game.staff.update(simDt);
    } else {
      game.staff.update(simDt);         // 暂停时垃圾/员工渲染帧仍需要
    }
    game.ui.update(dt);
    game.weather.updateVisual(dt, sun, hemi);
    updateNight(game, sun, hemi);
    game.scenery.updateAnims?.(game.time);   // 喷泉水柱等装饰动画
    game.terrain.waterTex.offset.x = game.time * 0.02;
    game.terrain.waterTex.offset.y = Math.sin(game.time * 0.4) * 0.015;
    renderer.render(scene, game.fp?.active ? game.fp.camera : game.camera.camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- 昼夜循环:180s 一轮(120s 白天 + 60s 夜,各 15s 过渡),路灯光点夜间亮起 ----------
const DAY_LEN = 180, NIGHT_START = 120, DUSK = 15;
let lampPts = null, lampCount = -1;
const _bgDay = new THREE.Color(0x0e1a2e), _bgNight = new THREE.Color(0x04060d);
function nightFactor(t) {
  const c = t % DAY_LEN;
  if (c < NIGHT_START) return 0;
  if (c < NIGHT_START + DUSK) return (c - NIGHT_START) / DUSK;
  if (c < DAY_LEN - DUSK) return 1;
  return (DAY_LEN - c) / DUSK;
}
function updateNight(game, sun, hemi) {
  const nf = nightFactor(game.time);
  if (nf <= 0 && !lampPts) return;
  sun.intensity = sun.intensity * (1 - nf * 0.82) + 0.015 * nf;   // 在天气结果上叠加夜色
  hemi.intensity = hemi.intensity * (1 - nf * 0.7);
  scene.background.copy(_bgDay).lerp(_bgNight, nf);
  // 路灯光点(每 ~90 帧扫一次 addon 数组)
  game._lampScanT = (game._lampScanT || 0) - 1;
  if (game._lampScanT > 0) { if (lampPts) lampPts.material.opacity = nf * 0.9; return; }
  game._lampScanT = 90;
  const w = game.world;
  const lamps = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (w.addon[w.idx(x, y)] === ADDON.LAMP) lamps.push([x, y]);
  }
  if (lamps.length !== lampCount) {   // 数量变了重建点云
    lampCount = lamps.length;
    if (lampPts) { scene.remove(lampPts); lampPts.geometry.dispose(); lampPts = null; }
    if (lamps.length) {
      const pos = new Float32Array(lamps.length * 3);
      lamps.forEach(([x, y], i) => {
        const c = w.tileCenter(x, y);
        const top = Math.max(...w.corners(x, y)) * H_UNIT + 0.035;
        pos[i * 3] = c.x; pos[i * 3 + 1] = top + 1.42; pos[i * 3 + 2] = c.z;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      lampPts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffc868, size: 7, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false,
      }));
      scene.add(lampPts);
    }
  }
  if (lampPts) lampPts.material.opacity = nf * 0.9;
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  activeCam?.onResize(window.innerWidth, window.innerHeight);
}
let activeCam = null;
window.addEventListener('resize', resize);
resize();
document.getElementById('loading').style.display = 'none';

// ---------- 启动 ----------
const params = new URLSearchParams(location.search);

async function bootSingle(fromMP = false, lvId = null) {
  const sc = SCENARIO_BY_ID[lvId || params.get('lv')] || null;
  const saveData = sc ? null : peekSave();      // 指定关卡 = 全新开局,不读旧档
  const world = new World();
  if (saveData && !params.get('new')) applyWorldData(world, saveData.world);
  else generateTerrain(world, sc?.seed);
  const game = buildGame(world, false);
  game.saves = new Saves(game);
  if (saveData && !params.get('new')) {
    game.saves.apply(saveData);
    game.messages.add('已载入上次的公园');
  } else if (sc) {
    game.saves.clear();                          // 清掉旧档,防止下次启动误读
    applyScenario(game, sc);
  } else {
    game.messages.add('欢迎来到 RCT2.js!修路 → 建设施 → 开放,吸引游客吧');
    let seen = null;
    try { seen = localStorage.getItem('rct2js-tut'); } catch { /* 忽略 */ }
    if (!seen) {   // 首次开局:新手指引三连
      try { localStorage.setItem('rct2js-tut', '1'); } catch { /* 忽略 */ }
      game.messages.add('新手指引:工具栏「路径」在草地上铺路,再建「游乐设施」接游客');
      game.messages.add('新手指引:设施窗口里「设入口/设出口」接到路径,然后点「开放」');
      game.messages.add('新手指引:点游客可以看状态;「研发」解锁更多设施;奖杯图标是关卡');
    }
  }
  if (fromMP) game.messages.add('多人服务器未连接(纯静态托管不支持联机),已转单人模式');
  installLoop(game);
}

async function bootMulti(name) {
  // 1. 裸握手:等 welcome,缓冲其间到达的其他消息
  const hs = await connectAndJoin(name).catch(() => null);
  if (!hs) {
    // 连接失败(常见于 GitHub Pages 等纯静态托管:没有 WS 服务器)→ 自动转单机
    return bootSingle(true);
  }
  const { ws, welcome, buffered } = hs;
  // 2. 用服务端世界建游戏
  const world = new World();
  applyWorldData(world, welcome.world);
  const game = buildGame(world, true);
  const net = new NetClient(game);
  game.net = net;
  game.dispatchAction = (a) => net.sendAction(a);
  net.ws = ws;
  net.myName = name;
  net.connected = true;
  net.players = welcome.players || [];
  // 3. 全量状态 → 再播缓冲增量 → 接管消息
  applyFullState(game, welcome);
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    net._onMessage(m);
  };
  ws.onclose = () => {
    net.connected = false;
    game.messages.add('与服务器断开连接。刷新页面重连。');
  };
  for (const m of buffered) net._onMessage(m);
  game.messages.add(`多人公园:以「${name}」加入,与伙伴一起经营吧`);
  installLoop(game);
}

function connectAndJoin(name) {
  return new Promise((resolve, reject) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    const buffered = [];
    const timer = setTimeout(() => reject(new Error('timeout')), 8000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'welcome') {
        clearTimeout(timer);
        resolve({ ws, welcome: m, buffered });
      } else buffered.push(m);
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('ws error')); };
  });
}

// welcome 包含 save 结构(scenery/rides/economy+players)—— 复用读档路径
function applyFullState(game, welcome) {
  // 景观
  for (const [id, items] of Object.entries(welcome.scenery || {})) {
    const rec = game.scenery.types.get(id);
    if (!rec) continue;
    for (const [x, y, rot, scale, tint] of items) rec.items.push({ x, y, rot, scale, tint });
    game.scenery.reindex(rec);
    game.scenery._dirty.add(id);
  }
  game.scenery.rebuildDirty();
  game.rides.nextId = welcome.rideNextId || 1;
  for (const s of welcome.rides || []) game.rides.restoreRide(s);
  const e = welcome.economy || {};
  Object.assign(game.economy, {
    cash: e.cash ?? 10000, monthIdx: e.monthIdx ?? 0, year: e.year ?? 1,
    parkRating: e.rating ?? 400, entranceFee: e.entranceFee ?? 0,
    totalGuests: e.totalGuests ?? 0, history: e.history ?? [],
    loan: e.loan ?? 0, parkOpen: e.parkOpen ?? true,
  });
  if (e.weatherMode) game.weather.mode = e.weatherMode;
  game.economy.goal.won = !!e.goalWon;
  game.economy.goal.lost = !!e.goalLost;
  if (welcome.research) game.research.restore(welcome.research);
  if (welcome.staffArea) game.staff.restoreArea(welcome.staffArea);
  if (welcome.paused !== undefined) game.paused = !!welcome.paused;
}

if (params.get('mp')) bootMulti(params.get('name') || '玩家' + Math.floor(Math.random() * 900 + 100));
else if (params.get('sp') || params.get('new')) bootSingle();
else showStartOverlay().then(c => c.mode === 'mp' ? bootMulti(c.name) : bootSingle(false, c.lv));
