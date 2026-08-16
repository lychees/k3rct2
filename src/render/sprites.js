// 程序化 canvas 纹理:草地/泥土/沙地/岩石/水面 —— 全部手绘风格,零版权素材。
import * as THREE from 'three';
import { RNG } from '../core/random.js';

function painterCanvas(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  paint(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function mottle(g, size, rng, base, spots, counts) {
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (const [color, count, rMin, rMax] of spots) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const r = rng.range(rMin, rMax);
      const x = rng.range(0, size), y = rng.range(0, size);
      g.beginPath();
      g.ellipse(x, y, r, r * rng.range(0.5, 1), rng.range(0, Math.PI), 0, Math.PI * 2);
      g.fill();
    }
  }
}

// 2×2 图集:左下=草 右下=泥土 左上=沙 右上=岩石
export function makeTerrainAtlas() {
  const S = 256, half = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rng = new RNG(42);

  // 草:亮绿底 + 深浅斑块(对应 SURF.GRASS=0 → uv 从 (0,0) 开始;注意 canvas y 翻转)
  mottleRegion(g, rng, 0, half, half, '#4ea93a', [
    ['#57b944', 500, 1, 3.5], ['#429233', 420, 1, 3], ['#67c654', 200, 0.6, 1.8], ['#3b8230', 160, 0.8, 2],
  ]);
  // 泥土 SURF.DIRT=1
  mottleRegion(g, rng, half, 0, half, '#9a6b3f', [
    ['#8a5c34', 400, 1, 3], ['#a97c4c', 350, 1, 2.6], ['#7a4e2c', 120, 0.8, 2],
  ]);
  // 沙 SURF.SAND=2
  mottleRegion(g, rng, 0, 0, half, '#d8c47c', [
    ['#e2cf8c', 400, 1, 2.5], ['#c8b46c', 350, 1, 2.2],
  ]);
  // 岩石 SURF.ROCK=3
  mottleRegion(g, rng, half, half, half, '#8a8d8f', [
    ['#7d8082', 350, 1, 3], ['#989b9d', 300, 1, 2.4], ['#6e7173', 100, 0.8, 2],
  ]);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}
function mottleRegion(g, rng, ox, oy, size, base, spots) {
  g.save();
  g.beginPath(); g.rect(ox, oy, size, size); g.clip();
  g.fillStyle = base; g.fillRect(ox, oy, size, size);
  for (const [color, count, rMin, rMax] of spots) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const r = rng.range(rMin, rMax);
      const x = ox + rng.range(0, size), y = oy + rng.range(0, size);
      g.beginPath();
      g.ellipse(x, y, r, r * rng.range(0.5, 1), rng.range(0, Math.PI), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// 图集 uv 子区域(Three 的 uv 原点在左下;canvas y 向下,CanvasTexture flipY 后,
// canvas 上半(sand/dirt)落在高 v,下半(grass/rock)落在低 v)
export const ATLAS_UV = {
  grass: [0.005, 0.005, 0.495, 0.495],   // [u0,v0,u1,v1]
  rock: [0.505, 0.005, 0.995, 0.495],
  sand: [0.005, 0.505, 0.495, 0.995],
  dirt: [0.505, 0.505, 0.995, 0.995],
};

export function makeWaterTexture() {
  return painterCanvas(128, (g, size) => {
    const rng = new RNG(7);
    g.fillStyle = '#2f6fd0'; g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(255,255,255,0.20)';
    g.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) {
      const y = rng.range(0, size), x = rng.range(-20, size), len = rng.range(14, 46);
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + len * 0.3, y - 2.5, x + len * 0.7, y + 2.5, x + len, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(20,60,140,0.25)';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.ellipse(rng.range(0, size), rng.range(0, size), rng.range(2, 8), rng.range(1, 3), 0, 0, Math.PI * 2);
      g.fill();
    }
  });
}
