// RCT2 风格相机:等距正交视角,四向旋转、三档缩放、右键/中键拖拽平移、键盘移动。
import * as THREE from 'three';
import { CAM_PITCH, CAM_YAWS, CAM_ZOOMS, MAP_W, MAP_H, TILE } from '../config.js';
import { World } from '../world/world.js';

export class IsoCamera {
  constructor(renderer) {
    this.dom = renderer.domElement;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    this.target = new THREE.Vector3(0, 0, 0);
    this.yawIdx = 0; this.zoomIdx = 1;
    this.yaw = CAM_YAWS[0]; this.half = CAM_ZOOMS[1];
    this.keys = new Set();
    this._drag = null;
    this.aspect = 1;
    this._bind();
    this.onResize = (w, h) => { this.aspect = w / h; this._apply(); };
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.button === 2 || e.button === 1) {
        this._drag = { x: e.clientX, y: e.clientY };
        el.setPointerCapture(e.pointerId);
      }
    });
    el.addEventListener('pointermove', e => {
      if (this._drag) {
        const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
        this._drag = { x: e.clientX, y: e.clientY };
        this.panScreen(dx, dy);
      }
    });
    const end = e => { this._drag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', e => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;   // 上滚放大
      this.setZoom(this.zoomIdx + dir, e.clientX, e.clientY);
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if (e.code === 'KeyQ') this.rotate(-1);
      if (e.code === 'KeyE') this.rotate(1);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  rotate(d) { this.yawIdx = (this.yawIdx + d + 4) % 4; }
  setZoom(zi, cx, cy) {
    zi = Math.max(0, Math.min(CAM_ZOOMS.length - 1, zi));
    if (zi === this.zoomIdx) return;
    // 围绕光标缩放:保持光标下的地面点不动
    let before = null;
    if (cx !== undefined) before = this.screenToGround(cx, cy);
    this.zoomIdx = zi;
    if (before) {
      const after = this.screenToGround(cx, cy, true);
      if (after) { this.target.add(before.clone().sub(after)); this._clamp(); }
    }
  }
  panScreen(dxPx, dyPx) {
    const scale = this.half * 2 / this.dom.clientHeight;
    const yaw = this.yaw;
    // 屏幕上移 = 视角前推
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = -fz, rz = fx;                       // 地面右向
    this.target.x += (-dxPx * rx + -dyPx * fx) * scale;
    this.target.z += (-dxPx * rz + -dyPx * fz) * scale;
    this._clamp();
  }
  _clamp() {
    const mx = MAP_W * TILE / 2 + 8, mz = MAP_H * TILE / 2 + 8;
    this.target.x = Math.max(-mx, Math.min(mx, this.target.x));
    this.target.z = Math.max(-mz, Math.min(mz, this.target.z));
  }
  centerOnTile(x, y) {
    this.target.set(World.tileToWorldX(x) + TILE / 2, 0, World.tileToWorldZ(y) + TILE / 2);
    this._clamp();
  }
  // 测试用:跳过平滑动画,立即到位
  snap() {
    this.yaw = CAM_YAWS[this.yawIdx];
    this.half = CAM_ZOOMS[this.zoomIdx];
    this._apply();
  }

  update(dt) {
    // 键盘平移
    let kx = 0, ky = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) kx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) kx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) ky += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) ky -= 1;
    if (kx || ky) {
      const v = this.half * 1.6 * dt;
      const yaw = this.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = -fz, rz = fx;
      this.target.x += (kx * rx + ky * fx) * v;
      this.target.z += (kx * rz + ky * fz) * v;
      this._clamp();
    }
    // 平滑趋近目标 yaw/zoom
    const yawGoal = CAM_YAWS[this.yawIdx] + Math.round((this.yaw - CAM_YAWS[this.yawIdx]) / (2 * Math.PI)) * 2 * Math.PI;
    this.yaw += (yawGoal - this.yaw) * Math.min(1, dt * 10);
    const halfGoal = CAM_ZOOMS[this.zoomIdx];
    this.half += (halfGoal - this.half) * Math.min(1, dt * 9);
    this._apply();
  }

  _apply() {
    const c = this.camera;
    const pitch = CAM_PITCH, yaw = this.yaw;
    const dist = 200;
    c.position.set(
      this.target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      this.target.y + Math.sin(pitch) * dist,
      this.target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    c.lookAt(this.target);
    const hh = this.half;
    c.left = -hh * this.aspect; c.right = hh * this.aspect; c.top = hh; c.bottom = -hh;
    c.updateProjectionMatrix();
  }

  // 屏幕坐标 → 地面平面(target.y)交点;predict=true 用目标 zoom 值算
  screenToGround(cx, cy, predict = false) {
    const rect = this.dom.getBoundingClientRect();
    const ndcX = ((cx - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((cy - rect.top) / rect.height) * 2 + 1;
    const half = predict ? CAM_ZOOMS[this.zoomIdx] : this.half;
    const hw = half * this.aspect;
    const yaw = this.yaw, pitch = CAM_PITCH;
    // 相机空间 → 世界:x 右、y 上
    const rx = -Math.cos(yaw), rz2 = Math.sin(yaw);
    const upx = Math.sin(yaw) * Math.sin(pitch), upy = Math.cos(pitch), upz = Math.cos(yaw) * Math.sin(pitch);
    // 正交相机:发射点为 target 平面上偏移 (r*px + u*py),方向为视线方向,与地面 y=0 求交
    const px = ndcX * hw, py = ndcY * half;
    const fx = -Math.sin(yaw) * Math.cos(pitch), fy = -Math.sin(pitch), fz2 = -Math.cos(yaw) * Math.cos(pitch);
    const sx = this.target.x + rx * px + upx * py;
    const sy = this.target.y + upy * py;
    const sz = this.target.z + rz2 * px + upz * py;
    if (Math.abs(fy) < 1e-6) return null;
    const t = (this.target.y - 0 - sy) / fy;   // 与地面 y=0 求交 → 用 0 平面即可(不精确处由 picker 修正)
    const g = new THREE.Vector3(sx + fx * t, 0, sz + fz2 * t);
    return g;
  }

  // 把地面点投回屏幕(给 UI 悬浮提示等用)
  groundToScreen(v) {
    const p = v.clone().project(this.camera);
    const rect = this.dom.getBoundingClientRect();
    return {
      x: (p.x + 1) / 2 * rect.width + rect.left,
      y: (1 - p.y) / 2 * rect.height + rect.top,
    };
  }
}
