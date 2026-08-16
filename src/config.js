// 全局常量与调色板 —— 所有模块共享的契约文件。
export const TILE = 2;            // 一格的世界宽度
export const H_UNIT = 0.55;       // 一个高度层级的世界高度
export const MAP_W = 100;         // 地图宽(tile 数)
export const MAP_H = 100;
export const CHUNK = 25;          // 地形分块边长(tile)
export const WATER_H = 4.5;       // 水面高度层级(低于此的 tile 被淹)

// slope 位掩码:bit0 SW(x,y) bit1 SE(x+1,y) bit2 NE(x+1,y+1) bit3 NW(x,y+1)
export const slopeCornerH = (base, slope, i) => base + ((slope >> i) & 1);

export const SURF = { GRASS: 0, DIRT: 1, SAND: 2, ROCK: 3 };
export const PATH = { NONE: 0, TARMAC: 1, QUEUE: 2 };
export const ADDON = { NONE: 0, BENCH: 1, LAMP: 2, BIN: 3 };

export const START_CASH = 10000;
export const MIN_H = 1, MAX_H = 40;   // 高度层级范围

// 相机:四向方位角(RCT2 的四个视角)、俯仰角与缩放档
export const CAM_PITCH = Math.PI / 6;          // 30°
export const CAM_YAWS = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
export const CAM_ZOOMS = [26, 17, 10];          // 正交相机半高(世界单位),大→小

export const MONTH_NAMES = ['3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月'];
export const MONTH_SECONDS = 45;                // 现实秒/游戏月

// 价格
export const PRICE = {
  landRaise: 28, landLower: 20,      // 每 tile
  path: 12, queue: 8, bench: 5, lamp: 8, bin: 4,
  tree: 18, bush: 10, flower: 8,
  removeScenery: -10, removePath: -6,
};

// 游客参数
export const PEEP = {
  MAX: 260,
  walkSpeed: 2.1,          // 单位/秒
  spawnBase: 4.0,          // 基础生成间隔(秒),随评分/吸引力变化
  hungerRate: 1 / 90,      // 每秒增加
  thirstRate: 1 / 75,
  energyRate: 1 / 240,
  bladderRate: 1 / 150,
  happyDecay: 1 / 300,
};

// 调色板(向 RCT2 观感靠拢)
export const COL = {
  grass: 0x4aa83c, dirt: 0x9a6b3f, sand: 0xd8c47c, rock: 0x8a8d8f,
  cliff: 0x9a7350, cliffRock: 0x8d8f91,
  water: 0x2f6fd0,
  tarmac: 0x9aa2a8, tarmacEdge: 0xdadde0, queue: 0x3f6fd8, queueEdge: 0xdadde0,
  rail: 0xc8b060,
  fence: 0x8a4a2a,
  wood: 0x8a5a30, woodDark: 0x6d4522,
  railTrack: 0xa03028,
};
