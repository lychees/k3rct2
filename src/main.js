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
import { UI } from './ui/ui.js';
import { NetClient } from './mp/net.js';
import { RemotePeeps } from './mp/remotePeeps.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    card.innerHTML = `
      <div class="titlebar"><span>RCT2.js — 过山车大亨复刻</span></div>
      <div class="content" style="display:flex;flex-direction:column;gap:10px">
        <div class="hint" style="font-size:12px">等距视角 · 修路建园 · 接待游客 · 经营收支</div>
        <input id="__nickname" placeholder="昵称(联机用)" maxlength="12"
          style="background:rgba(20,24,34,0.8);border:1px solid rgba(255,255,255,0.25);color:#e8e6d0;padding:6px 8px;border-radius:3px;font-size:13px;outline:none">
        <button class="rct-btn" id="__sp" style="font-size:14px;padding:8px">单人经营</button>
        <button class="rct-btn" id="__mp" style="font-size:14px;padding:8px">多人联机(同一服务器同一座公园)</button>
        <div class="hint" style="font-size:11px">多人:把本页 URL 发给朋友,他们也点"多人联机"即可</div>
      </div>`;
    wrap.appendChild(card);
    ui.appendChild(wrap);
    const name = () => (card.querySelector('#__nickname').value.trim() || '玩家' + Math.floor(Math.random() * 900 + 100));
    card.querySelector('#__sp').addEventListener('click', () => { wrap.remove(); resolve({ mode: 'sp' }); });
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
  game.staff = new Staff(game);
  game.tools = new Tools(game);
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
    game.time += dt;
    game.camera.update(dt);
    if (game.mp) {
      game.rides.update(dt);          // 仅动画(队列/收益由服务端管)
      game.peeps.update(dt);          // 远端插值渲染
      game.staff.update(dt);          // 远端插值渲染
    } else if (!game.paused) {
      game.economy.update(dt);
      game.rides.update(dt);
      game.peeps.update(dt);
      game.staff.update(dt);
    } else {
      game.staff.update(dt);          // 暂停时垃圾/员工渲染帧仍需要
    }
    game.ui.update(dt);
    game.weather.updateVisual(dt, sun, hemi);
    game.terrain.waterTex.offset.x = game.time * 0.02;
    game.terrain.waterTex.offset.y = Math.sin(game.time * 0.4) * 0.015;
    renderer.render(scene, game.camera.camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
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

async function bootSingle(fromMP = false) {
  const saveData = peekSave();
  const world = new World();
  if (saveData && !params.get('new')) applyWorldData(world, saveData.world);
  else generateTerrain(world);
  const game = buildGame(world, false);
  game.saves = new Saves(game);
  if (saveData && !params.get('new')) {
    game.saves.apply(saveData);
    game.messages.add('已载入上次的公园');
  } else {
    game.messages.add('欢迎来到 RCT2.js!修路 → 建设施 → 开放,吸引游客吧');
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
else showStartOverlay().then(c => c.mode === 'mp' ? bootMulti(c.name) : bootSingle());
