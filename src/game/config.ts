// 游戏核心配置常量 - 源自GDD

export type ObstacleType = "barrier" | "patrol" | "trap" | "laser" | "drone";
export type PowerUpType =
  | "jetpack"
  | "magnet"
  | "superShoes"
  | "scoreMultiplier"
  | "shield";
export type Rarity = 0 | 1 | 2 | 3; // 普通/稀有/史诗/传说
export type GameState = "ready" | "running" | "slowmotion" | "revivable" | "gameover";

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

// 续命配置
export const REVIVE_CONFIG = {
  maxRevives: 3,
  costs: [
    { diamond: 50, keys: 1 },
    { diamond: 100, keys: 2 },
    { diamond: 200, keys: 4 },
  ],
  invincibleDuration: 2, // 秒
  clearObstacleDistance: 50, // 清除前方50米障碍物
} as const;

// 抽奖奖励类型
export type LotteryRewardType = "skin" | "gold" | "diamond" | "keys";

export interface LotteryRewardConfig {
  type: LotteryRewardType;
  weight: number; // 权重
  // 非皮肤奖励的数值范围
  minAmount?: number;
  maxAmount?: number;
}

// 抽奖奖励池配置(皮肤总概率约20%)
export const LOTTERY_REWARDS: LotteryRewardConfig[] = [
  { type: "gold", weight: 35, minAmount: 500, maxAmount: 5000 },
  { type: "diamond", weight: 25, minAmount: 10, maxAmount: 100 },
  { type: "keys", weight: 20, minAmount: 1, maxAmount: 3 },
  { type: "skin", weight: 20 }, // 皮肤总概率20%,内部再按稀有度分
];

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

// 皮肤被动效果类型
export type SkinEffectType =
  | "jumpBoost" // 跳跃高度加成(百分比)
  | "coinBonus" // 金币获取加成(百分比)
  | "scoreBonus" // 得分加成(百分比)
  | "startPowerUp" // 开局自带道具
  | "speedBoost" // 速度加成(百分比)
  | "comboProtection" // Combo保持时间加成(百分比)
  | "freeRevive" // 免费复活次数
  | "magnetBoost"; // 磁铁持续时间加成(百分比)

// 单个皮肤效果
export interface SkinEffect {
  type: SkinEffectType;
  // 数值(百分比用小数,如0.2表示20%; startPowerUp为道具数量; freeRevive为次数)
  value: number;
  powerUpType?: PowerUpType; // 仅 startPowerUp 使用
}

// 皮肤效果配置(按皮肤id索引)
export type SkinEffectsMap = Record<string, SkinEffect[]>;

// 原有基础皮肤(5个)
const BASE_SKINS: SkinData[] = [
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

// === 程序化生成皮肤 ===
// 赛博朋克风格词汇库(按稀有度区分前缀)
const SKIN_NAME_PREFIXES: Record<Rarity, string[]> = {
  0: [
    "霓虹", "街头", "数据", "电流", "脉冲", "回路", "像素", "网格",
    "终端", "信号", "比特", "频段", "光弧", "霓虹", "电涌", "代码",
  ],
  1: [
    "暗影", "量子", "幻影", "极光", "霜刃", "炽焰", "疾风", "深渊",
    "裂隙", "幽影", "夜枭", "雷鸣", "苍狼", "赤焰",
  ],
  2: [
    "虚空", "星尘", "湮灭", "永夜", "苍穹", "混沌", "纪元", "穹顶",
    "幻域", "深渊", "星渊", "寂灭",
  ],
  3: [
    "觉醒", "终极", "永恒", "至尊", "神谕", "天启", "圣裁", "创世",
    "超载", "无限",
  ],
};

const SKIN_NAME_SUFFIXES = [
  "新兵", "跑者", "游侠", "猎手", "行者", "使者", "舞者", "先锋",
  "守卫", "刺客", "幽灵", "风暴", "之刃", "之心", "之翼", "骑士",
  "法师", "战神", "游隼", "猎鹰", "幻影", "裁决", "守望", "逐光",
];

// 简单的确定性伪随机数生成器(LCG),保证每次生成相同的皮肤列表
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// HSL转Hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// 程序化生成95个新皮肤(确定性)
function generateSkins(): SkinData[] {
  const rng = makeRng(20240620); // 固定种子,确保deterministic
  const skins: SkinData[] = [];
  const rarityLabels = ["普通", "稀有", "史诗", "传说"];
  // 各稀有度需要生成的数量(不含原有5个: 2普通/1稀有/1史诗/1传说)
  // 目标分布: 普通40/稀有30/史诗20/传说10
  const counts: Record<Rarity, number> = { 0: 38, 1: 29, 2: 19, 3: 9 };
  const idCounters: Record<Rarity, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  // 记录已使用名称避免重复
  const usedNames = new Set<string>();

  for (const rarity of [0, 1, 2, 3] as Rarity[]) {
    for (let i = 0; i < counts[rarity]; i++) {
      idCounters[rarity]++;
      // 生成唯一名称
      let name = "";
      let attempts = 0;
      do {
        const prefixPool = SKIN_NAME_PREFIXES[rarity];
        const prefix = prefixPool[Math.floor(rng() * prefixPool.length)];
        const suffix = SKIN_NAME_SUFFIXES[Math.floor(rng() * SKIN_NAME_SUFFIXES.length)];
        name = `${prefix}${suffix}`;
        attempts++;
        // 超过尝试次数则追加编号保证唯一
        if (attempts > 20) {
          name = `${prefix}${suffix}${idCounters[rarity]}`;
          break;
        }
      } while (usedNames.has(name));
      usedNames.add(name);

      // HSL色环均匀分布生成颜色
      const hue = Math.floor(rng() * 360);
      const saturation = 70 + Math.floor(rng() * 30); // 70-100%
      const lightness = 50 + Math.floor(rng() * 20); // 50-70%
      const color = hslToHex(hue, saturation, lightness);
      const trailColor = hslToHex((hue + 30) % 360, saturation, lightness);

      // 价格按稀有度递增
      let priceGold = 0;
      let priceDiamond = 0;
      if (rarity === 0) {
        // 普通: gold 3000-8000 或 diamond 30-80
        if (rng() < 0.5) priceGold = 3000 + Math.floor(rng() * 5001);
        else priceDiamond = 30 + Math.floor(rng() * 51);
      } else if (rarity === 1) {
        priceDiamond = 150 + Math.floor(rng() * 251); // 150-400
      } else if (rarity === 2) {
        priceDiamond = 600 + Math.floor(rng() * 601); // 600-1200
      } else {
        priceDiamond = 0; // 传说仅限抽奖
      }

      const id = `gen_${rarity}_${idCounters[rarity]}`;
      skins.push({
        id,
        name,
        rarity,
        priceGold,
        priceDiamond,
        color,
        trailColor,
        description: `${rarityLabels[rarity]}级皮肤，${name}系列涂装`,
      });
    }
  }
  return skins;
}

// 完整皮肤列表 = 原有5个 + 程序化生成95个 = 100个
export const SKINS: SkinData[] = [...BASE_SKINS, ...generateSkins()];

// === 皮肤被动效果生成 ===
// 各数值效果在不同稀有度下的数值范围(小数百分比, [min, max])
const EFFECT_RANGES: Record<
  Exclude<SkinEffectType, "startPowerUp" | "freeRevive">,
  Record<Rarity, [number, number]>
> = {
  jumpBoost: { 0: [0.05, 0.08], 1: [0.1, 0.15], 2: [0.18, 0.25], 3: [0.3, 0.4] },
  coinBonus: { 0: [0.05, 0.1], 1: [0.12, 0.2], 2: [0.25, 0.35], 3: [0.4, 0.5] },
  scoreBonus: { 0: [0.03, 0.05], 1: [0.08, 0.15], 2: [0.18, 0.28], 3: [0.3, 0.4] },
  speedBoost: { 0: [0.03, 0.05], 1: [0.05, 0.1], 2: [0.1, 0.15], 3: [0.15, 0.2] },
  comboProtection: { 0: [0.1, 0.15], 1: [0.2, 0.3], 2: [0.4, 0.5], 3: [0.6, 0.8] },
  magnetBoost: { 0: [0.1, 0.15], 1: [0.2, 0.3], 2: [0.4, 0.5], 3: [0.6, 0.8] },
};

// 可随机选取的数值效果类型
const NUMERIC_EFFECT_TYPES = Object.keys(EFFECT_RANGES) as Exclude<
  SkinEffectType,
  "startPowerUp" | "freeRevive"
>[];

// 在[min,max]范围内生成一个保留两位小数的随机值
function randomEffectValue(rng: () => number, min: number, max: number): number {
  return Math.round((min + rng() * (max - min)) * 100) / 100;
}

// 从未使用的数值效果中随机选取一个
function pickNumericEffect(
  rng: () => number,
  rarity: Rarity,
  used: Set<SkinEffectType>,
): SkinEffect | null {
  const available = NUMERIC_EFFECT_TYPES.filter((t) => !used.has(t));
  if (available.length === 0) return null;
  const type = available[Math.floor(rng() * available.length)];
  const [min, max] = EFFECT_RANGES[type][rarity];
  return { type, value: randomEffectValue(rng, min, max) };
}

// 为单个皮肤按稀有度生成被动效果(确定性)
function generateEffectsForSkin(
  skin: SkinData,
  rng: () => number,
): SkinEffect[] {
  const effects: SkinEffect[] = [];
  const used = new Set<SkinEffectType>();
  const rarity = skin.rarity;

  if (rarity === 0) {
    // 普通: 1个轻微效果
    const eff = pickNumericEffect(rng, rarity, used);
    if (eff) {
      effects.push(eff);
      used.add(eff.type);
    }
  } else if (rarity === 1) {
    // 稀有: 1-2个中等效果
    const count = rng() < 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const eff = pickNumericEffect(rng, rarity, used);
      if (eff) {
        effects.push(eff);
        used.add(eff.type);
      }
    }
  } else if (rarity === 2) {
    // 史诗: 2个较强效果 或 1个效果+自带道具
    if (rng() < 0.4) {
      // 自带道具(护盾或磁铁)
      const powerUpType: PowerUpType = rng() < 0.5 ? "shield" : "magnet";
      effects.push({ type: "startPowerUp", value: 1, powerUpType });
      const eff = pickNumericEffect(rng, rarity, used);
      if (eff) {
        effects.push(eff);
        used.add(eff.type);
      }
    } else {
      // 2个数值效果
      for (let i = 0; i < 2; i++) {
        const eff = pickNumericEffect(rng, rarity, used);
        if (eff) {
          effects.push(eff);
          used.add(eff.type);
        }
      }
    }
  } else {
    // 传说: 3个强效果 + 可能含免费复活 + 可能含自带道具
    if (rng() < 0.6) {
      effects.push({ type: "freeRevive", value: 1 });
    }
    if (rng() < 0.4) {
      const powerUpType: PowerUpType = rng() < 0.5 ? "shield" : "magnet";
      effects.push({ type: "startPowerUp", value: 1, powerUpType });
    }
    // 填充数值效果至3个
    while (effects.length < 3) {
      const eff = pickNumericEffect(rng, rarity, used);
      if (eff) {
        effects.push(eff);
        used.add(eff.type);
      } else break;
    }
  }
  return effects;
}

// 程序化生成所有皮肤的被动效果(确定性, 与皮肤生成使用不同种子)
function generateSkinEffects(): SkinEffectsMap {
  const rng = makeRng(20240621); // 固定种子, 确保每次生成一致
  const effects: SkinEffectsMap = {};

  for (const skin of SKINS) {
    if (skin.id === "default") {
      // 默认皮肤无效果(保证新手平衡)
      effects[skin.id] = [];
      continue;
    }
    if (skin.id === "legendary_kai") {
      // 传说皮肤"觉醒·凯"给最强效果组合
      effects[skin.id] = [
        { type: "scoreBonus", value: 0.3 },
        { type: "coinBonus", value: 0.3 },
        { type: "freeRevive", value: 1 },
      ];
      continue;
    }
    effects[skin.id] = generateEffectsForSkin(skin, rng);
  }
  return effects;
}

// 皮肤被动效果配置表(按皮肤id索引)
export const SKIN_EFFECTS: SkinEffectsMap = generateSkinEffects();

// 获取指定皮肤的被动效果列表
export function getSkinEffects(skinId: string): SkinEffect[] {
  return SKIN_EFFECTS[skinId] ?? [];
}

// 皮肤效果展示信息
export interface SkinEffectDisplay {
  icon: string;
  label: string;
  desc: string;
  color: string;
}

// 获取皮肤效果的展示信息(用于商店/抽奖页面展示)
export function getSkinEffectDisplay(effect: SkinEffect): SkinEffectDisplay {
  const pct = Math.round(effect.value * 100);
  switch (effect.type) {
    case "jumpBoost":
      return {
        icon: "⬆",
        label: "跳跃增强",
        desc: `跳跃高度+${pct}%`,
        color: "#00D4FF",
      };
    case "coinBonus":
      return {
        icon: "●",
        label: "金币加成",
        desc: `金币获取+${pct}%`,
        color: "#FFD700",
      };
    case "scoreBonus":
      return {
        icon: "★",
        label: "得分加成",
        desc: `最终得分+${pct}%`,
        color: "#FF2D95",
      };
    case "startPowerUp": {
      const pu = effect.powerUpType ? POWERUPS[effect.powerUpType] : null;
      return {
        icon: pu?.icon ?? "🎁",
        label: "自带道具",
        desc: `开局自带${pu?.name ?? "道具"}`,
        color: pu?.color ?? "#B44CFF",
      };
    }
    case "speedBoost":
      return {
        icon: "⚡",
        label: "速度加成",
        desc: `基础速度+${pct}%`,
        color: "#FF2D95",
      };
    case "comboProtection":
      return {
        icon: "🔗",
        label: "Combo保护",
        desc: `Combo保持+${pct}%`,
        color: "#B44CFF",
      };
    case "freeRevive":
      return {
        icon: "💖",
        label: "免费复活",
        desc: `每局免费复活${effect.value}次`,
        color: "#00FFAA",
      };
    case "magnetBoost":
      return {
        icon: "🧲",
        label: "磁铁增强",
        desc: `磁铁时长+${pct}%`,
        color: "#FF2D95",
      };
  }
}

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
