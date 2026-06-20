// 游戏核心配置常量 - 源自GDD

export type ObstacleType = "barrier" | "patrol" | "trap" | "laser" | "drone";
export type PowerUpType =
  | "jetpack"
  | "magnet"
  | "superShoes"
  | "scoreMultiplier"
  | "shield";
export type Rarity = 0 | 1 | 2 | 3; // 普通/稀有/史诗/传说
export type GameState = "ready" | "running" | "slowmotion" | "gameover";

export interface DifficultyTier {
  distance: number;
  speed: number;
  density: number; // 每多少米一个障碍
  obstacles: ObstacleType[];
}

export interface PowerUpConfig {
  duration: number; // 秒
  dropRate: number; // 掉落率
  name: string;
  color: string;
  icon: string;
}

export const CONFIG = {
  LANES: 3,
  LANE_WIDTH: 2.5, // 米
  BASE_SPEED: 20, // m/s
  JUMP_HEIGHT: 2.5, // 米
  JUMP_DURATION: 0.6, // 秒
  SLIDE_DURATION: 0.8, // 秒
  LANE_CHANGE_TIME: 0.15, // 秒
  PERFECT_DODGE_WINDOW: 0.3, // 极限闪避判定窗口(秒)
  COMBO_TIMEOUT: 3, // Combo保持时间(秒)
  MAX_POWERUP_SLOTS: 3,
  POWERUP_COOLDOWN: 15, // 秒

  // 透视渲染参数
  CAMERA_HEIGHT: 3,
  CAMERA_DEPTH: 0.84, // 焦距相关
  ROAD_LENGTH: 200, // 可见跑道长度(米)
  DRAW_DISTANCE: 100, // 绘制距离
  FIELD_OF_VIEW: 100,
  FOG_DENSITY: 0.015,

  // 颜色
  COLORS: {
    bg: "#0A0A14",
    blue: "#00D4FF",
    pink: "#FF2D95",
    purple: "#B44CFF",
    gold: "#FFD700",
    gray: "#2A2A3E",
    road: "#1a1a2e",
    roadLine: "#00D4FF",
  },
} as const;

// Combo倍率表
export const COMBO_TIERS = [
  { min: 0, max: 4, multiplier: 1.0, color: "#ffffff" },
  { min: 5, max: 9, multiplier: 1.5, color: "#00D4FF" },
  { min: 10, max: 19, multiplier: 2.5, color: "#B44CFF" },
  { min: 20, max: 29, multiplier: 5.0, color: "#FFD700" },
  { min: 30, max: Infinity, multiplier: 10.0, color: "#FF2D95" },
] as const;

// 难度曲线
export const DIFFICULTY: DifficultyTier[] = [
  { distance: 0, speed: 20, density: 10, obstacles: ["barrier"] },
  {
    distance: 500,
    speed: 25,
    density: 8,
    obstacles: ["barrier", "patrol"],
  },
  {
    distance: 1500,
    speed: 30,
    density: 6,
    obstacles: ["barrier", "patrol", "trap"],
  },
  {
    distance: 3000,
    speed: 35,
    density: 4,
    obstacles: ["barrier", "patrol", "trap", "laser", "drone"],
  },
];

// 道具体系
export const POWERUPS: Record<PowerUpType, PowerUpConfig> = {
  jetpack: {
    duration: 5,
    dropRate: 0.02,
    name: "喷射器",
    color: "#00D4FF",
    icon: "🚀",
  },
  magnet: {
    duration: 8,
    dropRate: 0.05,
    name: "磁铁",
    color: "#FF2D95",
    icon: "🧲",
  },
  superShoes: {
    duration: 10,
    dropRate: 0.05,
    name: "超级跑鞋",
    color: "#B44CFF",
    icon: "👟",
  },
  scoreMultiplier: {
    duration: 8,
    dropRate: 0.03,
    name: "得分倍增",
    color: "#FFD700",
    icon: "✨",
  },
  shield: {
    duration: 6,
    dropRate: 0.02,
    name: "护盾",
    color: "#00FFAA",
    icon: "🛡️",
  },
};

// 障碍物配置
export const OBSTACLES: Record<
  ObstacleType,
  {
    name: string;
    color: string;
    height: number; // 米
    action: "jump" | "slide" | "dodge" | "jumpOrDodge";
    width: number; // 占用车道数 1-3
  }
> = {
  barrier: {
    name: "静态路障",
    color: "#FFD700",
    height: 1.5,
    action: "jump",
    width: 1,
  },
  patrol: {
    name: "巡逻机器人",
    color: "#FF2D95",
    height: 2.0,
    action: "dodge",
    width: 1,
  },
  trap: {
    name: "陷阱地板",
    color: "#00D4FF",
    height: 0,
    action: "jump",
    width: 1,
  },
  laser: {
    name: "激光栅栏",
    color: "#FF2D95",
    height: 1.5,
    action: "slide",
    width: 1,
  },
  drone: {
    name: "无人机",
    color: "#B44CFF",
    height: 2.5,
    action: "dodge",
    width: 1,
  },
};

// 抽奖配置
export const LOTTERY = {
  probs: [0.7, 0.2, 0.08, 0.02] as const, // 普通/稀有/史诗/传说
  pity: [10, 50, 100] as const, // 保底次数
  cost: { single: 1, ten: 9 },
  fragmentNeed: [0, 30, 100, 200], // 合成所需碎片
  fragmentGain: [1, 5, 20, 50], // 重复获得碎片
} as const;

// 皮肤配置
export interface SkinData {
  id: string;
  name: string;
  rarity: Rarity;
  priceGold: number;
  priceDiamond: number;
  color: string;
  trailColor: string;
  description: string;
}

export const SKINS: SkinData[] = [
  {
    id: "default",
    name: "联盟新兵",
    rarity: 0,
    priceGold: 0,
    priceDiamond: 0,
    color: "#00D4FF",
    trailColor: "#00D4FF",
    description: "凯的默认装束，蓝灰色调联盟制服",
  },
  {
    id: "neon_rider",
    name: "霓虹骑手",
    rarity: 0,
    priceGold: 5000,
    priceDiamond: 50,
    color: "#00FFAA",
    trailColor: "#00FFAA",
    description: "街头风格，绿色霓虹涂装",
  },
  {
    id: "shadow_ops",
    name: "暗影特工",
    rarity: 1,
    priceGold: 0,
    priceDiamond: 200,
    color: "#FF2D95",
    trailColor: "#FF2D95",
    description: "潜行作战套装，粉色警示光效",
  },
  {
    id: "data_ghost",
    name: "数据幽灵",
    rarity: 2,
    priceGold: 0,
    priceDiamond: 800,
    color: "#B44CFF",
    trailColor: "#B44CFF",
    description: "半透明数据流形态，紫色流光",
  },
  {
    id: "legendary_kai",
    name: "觉醒·凯",
    rarity: 3,
    priceGold: 0,
    priceDiamond: 0,
    color: "#FFD700",
    trailColor: "#FFD700",
    description: "传说形态，金色脉冲+彩虹流光",
  },
];

export const RARITY_NAMES = ["普通", "稀有", "史诗", "传说"];
export const RARITY_COLORS = ["#888888", "#00D4FF", "#B44CFF", "#FFD700"];
export const RARITY_BORDERS = [
  "border-gray-600",
  "neon-border-blue",
  "neon-border-purple",
  "neon-border-gold",
];

// 获取当前难度档位
export function getDifficulty(distance: number): DifficultyTier {
  let current = DIFFICULTY[0];
  for (const tier of DIFFICULTY) {
    if (distance >= tier.distance) current = tier;
  }
  // 3000+ 速度递增
  if (distance >= 3000) {
    const extra = Math.floor((distance - 3000) / 500);
    return {
      ...current,
      speed: current.speed + extra,
      density: Math.max(4, current.density - extra * 0.2),
    };
  }
  return current;
}

// 获取Combo倍率
export function getComboMultiplier(combo: number) {
  for (const tier of COMBO_TIERS) {
    if (combo >= tier.min && combo <= tier.max) {
      return { multiplier: tier.multiplier, color: tier.color };
    }
  }
  return { multiplier: 10.0, color: "#FF2D95" };
}

// 计算最终得分
export function calculateScore(
  distance: number,
  coins: number,
  dodges: number,
  perfectDodges: number,
  combo: number,
  hasScoreMultiplier: boolean,
) {
  const base =
    distance * 10 + coins * 5 + dodges * 50 + perfectDodges * 200;
  const { multiplier } = getComboMultiplier(combo);
  const itemMultiplier = hasScoreMultiplier ? 2 : 1;
  return Math.floor(base * multiplier * itemMultiplier);
}
