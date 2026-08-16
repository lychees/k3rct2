// 轻量几何构建器:累计 quad/tri/box,输出带平面法线+顶点色的 BufferGeometry。
// 供地形、路径、景观、设施共用(RCT 风格平涂 low-poly)。
import * as THREE from 'three';

const _c = new THREE.Color();

export class GeomBuilder {
  constructor() {
    this.pos = []; this.nrm = []; this.uv = []; this.col = [];
  }
  vertex(x, y, z, nx, ny, nz, u, v, r, g, b) {
    this.pos.push(x, y, z); this.nrm.push(nx, ny, nz); this.uv.push(u, v); this.col.push(r, g, b);
  }
  // a,b,c,d 逆时针(从法线侧看)。uvrect=[u0,v0,u1,v1];shade 乘到颜色上做假 AO。
  // nOverride: 可选 [nx,ny,nz],强制法线方向(用于悬崖面保持一致受光)。
  quad(a, b, c, d, uvrect, colorHex, shade = 1, nOverride = null) {
    let nx, ny, nz;
    if (nOverride) {
      [nx, ny, nz] = nOverride;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
    } else {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
    }
    _c.setHex(colorHex);
    // 允许 quad 四角各带亮度(坡面明暗):shade 可为数或 [sa,sb,sc,sd]
    const s = Array.isArray(shade) ? shade : [shade, shade, shade, shade];
    const [u0, v0, u1, v1] = uvrect;
    const vs = [a, b, c, d], uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const order = [0, 1, 2, 0, 2, 3];
    for (const oi of order) {
      const p = vs[oi], uv = uvs[oi], sh = s[oi];
      this.vertex(p[0], p[1], p[2], nx, ny, nz, uv[0], uv[1], _c.r * sh, _c.g * sh, _c.b * sh);
    }
  }
  tri(a, b, c, uvs, colorHex, shade = 1) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    _c.setHex(colorHex);
    const s = Array.isArray(shade) ? shade : [shade, shade, shade];
    const vs = [a, b, c];
    for (let i = 0; i < 3; i++) {
      const p = vs[i], sh = s[i];
      this.vertex(p[0], p[1], p[2], nx, ny, nz, uvs[i][0], uvs[i][1], _c.r * sh, _c.g * sh, _c.b * sh);
    }
  }
  box(cx, cy, cz, sx, sy, sz, colorHex, shade = 1) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const z = [0, 0];
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], z, colorHex, shade * 1.0);   // 顶
    this.quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], z, colorHex, shade * 0.55); // 底(一般不可见)
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], z, colorHex, shade * 0.9);  // +z 面
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], z, colorHex, shade * 0.75); // -z 面
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], z, colorHex, shade * 0.82); // +x 面
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], z, colorHex, shade * 0.7);  // -x 面
  }
  // 竖直圆柱(简化 6 棱柱),用于树干/柱子
  post(cx, yBase, cz, r, h, colorHex, shade = 1, sides = 6) {
    this.frustum(cx, yBase, cz, r, r * 0.8, h, colorHex, shade, sides);
  }
  // 锥台:r0 底半径,r1 顶半径
  frustum(cx, yBase, cz, r0, r1, h, colorHex, shade = 1, sides = 6) {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r0, yBase, cz + Math.sin(a0) * r0];
      const p1 = [cx + Math.cos(a1) * r0, yBase, cz + Math.sin(a1) * r0];
      const p2 = [cx + Math.cos(a1) * r1, yBase + h, cz + Math.sin(a1) * r1];
      const p3 = [cx + Math.cos(a0) * r1, yBase + h, cz + Math.sin(a0) * r1];
      this.quad(p0, p1, p2, p3, [0, 0], colorHex, shade * (0.72 + 0.28 * Math.sin(a0 + 2.2)));
    }
    // 顶盖
    if (r1 > 0.01) {
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
        this.tri([cx, yBase + h, cz],
          [cx + Math.cos(a1) * r1, yBase + h, cz + Math.sin(a1) * r1],
          [cx + Math.cos(a0) * r1, yBase + h, cz + Math.sin(a0) * r1], [[0, 0], [0, 0], [0, 0]], colorHex, shade * 1.05);
      }
    }
  }
  // 两点之间的“梁”(bar):任意水平方向的盒子,用于轨道/拉杆/支架横梁
  bar(a, b, w, h, colorHex, shade = 1) {
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * w / 2, nz = dx / len * w / 2;
    const y0 = a[1], y1 = b[1];
    // 四个角:起点±n / 终点±n,顶/底两面 + 两侧
    const A0 = [a[0] - nx, y0, a[2] - nz], A1 = [a[0] + nx, y0, a[2] + nz];
    const B0 = [b[0] - nx, y1, b[2] - nz], B1 = [b[0] + nx, y1, b[2] + nz];
    const H = [0, h, 0];
    const up = (p) => [p[0] + H[0], p[1] + H[1], p[2] + H[2]];
    this.quad(up(A0), up(B0), up(B1), up(A1), [0, 0], colorHex, shade * 1.02); // 顶
    this.quad(A1, B1, up(B1), up(A1), [0, 0], colorHex, shade * 0.85);          // 侧 1
    this.quad(B0, A0, up(A0), up(B0), [0, 0], colorHex, shade * 0.92);          // 侧 2
    this.quad(A1, A0, B0, B1, [0, 0], colorHex, shade * 0.6);                   // 底
  }
  // 低多边形球(近似),用于树冠等
  blob(cx, cy, cz, r, colorHex, shade = 1) {
    const top = [cx, cy + r * 0.9, cz], bot = [cx, cy - r * 0.75, cz];
    const ring = [];
    const N = 6;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.35;
      ring.push([cx + Math.cos(a) * r, cy + r * 0.1, cz + Math.sin(a) * r]);
    }
    for (let i = 0; i < N; i++) {
      const n = (i + 1) % N;
      const s = 0.8 + 0.2 * Math.sin(i * 1.7 + 1.3);
      this.tri(top, ring[n], ring[i], [[0, 0], [0, 0], [0, 0]], colorHex, shade * s);
      this.tri(bot, ring[i], ring[n], [[0, 0], [0, 0], [0, 0]], colorHex, shade * s * 0.9);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
  get empty() { return this.pos.length === 0; }
}
