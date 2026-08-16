// 可种子化随机数 + 常用随机工具
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1337) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); } // 闭区间
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
}

// 简单 2D 值噪声,带 fbm —— 用于地形生成与纹理
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * (3 - 2 * t);
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  function noise(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(v,
      lerp(u, grad(perm[a], x, y), grad(perm[b], x - 1, y)),
      lerp(u, grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1)));
  }
  function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let s = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      s += amp * noise(x * freq, y * freq);
      norm += amp; amp *= gain; freq *= lac;
    }
    return s / norm;
  }
  return { noise, fbm };
}

function lerp(t, a, b) { return a + t * (b - a); }
