// 部件着色槽:构建器用 SLOT_MAIN/SLOT_SUB 占位色标记可涂部件;
// 网格化(meshOf)时替换为设施当前配色(ride.paintMain/paintSub;未设置用默认配色 → 外观不变)。
// 之后改色由 paintSlots 按记录的槽位索引直接重写顶点色,不用重建几何。
import * as THREE from 'three';

export const SLOT_MAIN = 0xff00ff, SLOT_SUB = 0x00ffff;

// 各设施默认(主色, 副色) —— 与引入槽位前的原始外观一致
export const DEFAULT_PAINT = {
  carousel: [0xe33d30, 0xe8b830], ferris: [0xe8b830, 0xc8c8d0], twist: [0xd84a3a, 0xc8c8d0],
  haunted: [0x4a4048, 0x7a50c8], bumper: [0xd8a030, 0x6a7078], pirate: [0x8a3020, 0x8a4a2a],
  tower: [0xd8d8e0, 0xd84a3a], slide: [0xd8d0c0, 0x88c8e8], teacups: [0xd8c8a8, 0xe8b830],
  chairs: [0xd84a3a, 0xc8c8d0], droptower: [0x8a6ad8, 0xd84a3a], frisbee: [0x3a6ad8, 0xd84a3a],
  topspin: [0x48b050, 0xc86ad8], maze: [0x2a6a26, 0x2a6a26], golf: [0x58a848, 0x58a848],
  cablecar: [0x3a6ad8, 0xb0a890], boats: [0xd84a3a, 0x9a7350],
  burger: [0xd8a038, 0xa03028], drinks: [0x3a7ad8, 0xd8e8f0], balloon: [0xc86ad8, 0xf0e0f8],
  coffee: [0x8a5a30, 0xe8d8c0], toilet: [0x7a8a9a, 0xd8dde0], umbrella: [0x3a4a6a, 0xc8d4e8],
  mycoaster: [0xa03028, 0x8a5a30], woodie: [0xa03028, 0x7a4a28], train: [0x4a4a52, 0x5a4632], flume: [0xb8b0a0, 0xb8b0a0], monorail: [0xc8c8d0, 0x8a8d8f],
};

function slotScan(geo) {   // 顶点色里找占位色(容差匹配,顶点带明暗系数),记录槽位索引与明暗
  const colAttr = geo.attributes.color;
  const mainIdx = [], mainShade = [], subIdx = [], subShade = [];
  for (let i = 0; i < colAttr.count; i++) {
    const r = colAttr.getX(i), g = colAttr.getY(i), b = colAttr.getZ(i);
    if (g < 0.06 && Math.abs(r - b) < 0.06 && r > 0.2) { mainIdx.push(i); mainShade.push(r); }        // (sh,0,sh) = 主槽×明暗
    else if (r < 0.06 && Math.abs(g - b) < 0.06 && g > 0.2) { subIdx.push(i); subShade.push(g); }     // (0,sh,sh) = 副槽×明暗
  }
  return {
    main: mainIdx.length ? { idx: mainIdx, sh: Float32Array.from(mainShade) } : null,
    sub: subIdx.length ? { idx: subIdx, sh: Float32Array.from(subShade) } : null,
  };
}

export function paintSlots(mesh, ride) {   // 按设施当前配色(或默认/中性色)重写槽位顶点色
  const colAttr = mesh.geometry.attributes.color;
  const [dMain, dSub] = (ride && ride.def) ? (DEFAULT_PAINT[ride.def.id] || [0x707070, 0xa0a0a0]) : [0x707070, 0xa0a0a0];
  const c = new THREE.Color();
  if (mesh.userData.slotMain) {
    c.setHex(ride?.paintMain ?? dMain);
    const { idx, sh } = mesh.userData.slotMain;
    for (let k = 0; k < idx.length; k++) colAttr.setXYZ(idx[k], c.r * sh[k], c.g * sh[k], c.b * sh[k]);
  }
  if (mesh.userData.slotSub) {
    c.setHex(ride?.paintSub ?? dSub);
    const { idx, sh } = mesh.userData.slotSub;
    for (let k = 0; k < idx.length; k++) colAttr.setXYZ(idx[k], c.r * sh[k], c.g * sh[k], c.b * sh[k]);
  }
  colAttr.needsUpdate = true;
}

// GeomBuilder → Mesh;ride 为 null 时(幽灵预览)槽位用中性灰
export function meshOf(builder, mat, ride = null) {
  const mesh = new THREE.Mesh(builder.build(), mat);
  const { main, sub } = slotScan(mesh.geometry);
  if (main) mesh.userData.slotMain = main;
  if (sub) mesh.userData.slotSub = sub;
  if (main || sub) paintSlots(mesh, ride);
  return mesh;
}
