import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PowerUpType, Rarity } from "./config";
import { LOTTERY, SKINS } from "./config";
import { api, token, type SaveData } from "./api";

interface LastRunResult {
  score: number;
  distance: number;
  coins: number;
  maxCombo: number;
  dodges: number;
  perfectDodges: number;
  isNewRecord: boolean;
  rewardGold: number;
  rewardDiamond: number;
  rewardKeys: number;
}

// 会员等级
export type MembershipTier = "none" | "bronze" | "silver" | "gold" | "diamond";

export interface MembershipInfo {
  tier: MembershipTier;
  expireAt: number; // 过期时间戳(0=永久)
  dailyDiamondClaimed: string; // 上次领取日期
}

// 账号信息
export interface AccountInfo {
  isLoggedIn: boolean;
  userId: string;
  username: string;
  isGuest: boolean;
  loginAt: number;
}

interface PlayerData {
  gold: number;
  diamond: number;
  keys: number;
  highScore: number;
  totalRuns: number;
  totalDistance: number;
  skins: string[];
  equippedId: string;
  powerUpLevels: Record<PowerUpType, number>;
  pityCounter: { rare: number; epic: number; legendary: number };
  fragments: Record<string, number>;
  lastRun: LastRunResult | null;
  dailySignDays: number;
  lastSignDate: string;
  membership: MembershipInfo;
  account: AccountInfo;
  totalCharged: number; // 累计充值金额(元)
}

interface GameStore extends PlayerData {
  // 货币操作
  addGold: (amount: number) => void;
  addDiamond: (amount: number) => void;
  addKeys: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  spendDiamond: (amount: number) => boolean;
  spendKeys: (amount: number) => boolean;

  // 皮肤操作
  buySkin: (skinId: string) => boolean;
  equipSkin: (skinId: string) => void;
  hasSkin: (skinId: string) => boolean;

  // 道具升级
  upgradePowerUp: (type: PowerUpType) => boolean;
  getPowerUpLevel: (type: PowerUpType) => number;

  // 抽奖
  lottery: (count: 1 | 10) => { rarity: Rarity; skinId: string; isNew: boolean }[] | null;
  getFragmentCount: (skinId: string) => number;
  synthesizeSkin: (skinId: string) => boolean;

  // 游戏结果
  setLastRun: (result: LastRunResult) => void;
  updateHighScore: (score: number) => void;

  // 签到
  dailySign: () => boolean;
  canSignToday: () => boolean;

  // 账号系统
  loginAsGuest: () => void;
  loginWithAccount: (username: string, password: string) => boolean;
  logout: () => void;
  registerAccount: (username: string, password: string) => boolean;

  // 会员系统
  activateMembership: (tier: MembershipTier, days: number) => void;
  getMembershipMultiplier: () => number; // 钻石/金币获取倍率
  claimDailyMemberDiamond: () => boolean;
  canClaimDailyMemberDiamond: () => boolean;
  isMembershipActive: () => boolean;

  // 充值系统
  recharge: (packageId: string) => boolean;

  // 后端同步
  serverLogin: (username: string, password: string) => Promise<boolean>;
  serverRegister: (username: string, password: string) => Promise<boolean>;
  serverLogout: () => void;
  syncFromServer: () => Promise<boolean>;
  syncToServer: () => Promise<boolean>;
  submitScoreToServer: (
    score: number,
    distance: number,
    maxCombo: number,
    perfectDodges: number,
  ) => Promise<number | null>;

  // 重置
  reset: () => void;
}

const initialPowerUpLevels: Record<PowerUpType, number> = {
  jetpack: 1,
  magnet: 1,
  superShoes: 1,
  scoreMultiplier: 1,
  shield: 1,
};

const initialState: PlayerData = {
  gold: 1000,
  diamond: 50,
  keys: 1,
  highScore: 0,
  totalRuns: 0,
  totalDistance: 0,
  skins: ["default"],
  equippedId: "default",
  powerUpLevels: { ...initialPowerUpLevels },
  pityCounter: { rare: 0, epic: 0, legendary: 0 },
  fragments: {},
  lastRun: null,
  dailySignDays: 0,
  lastSignDate: "",
  membership: {
    tier: "none",
    expireAt: 0,
    dailyDiamondClaimed: "",
  },
  account: {
    isLoggedIn: false,
    userId: "",
    username: "",
    isGuest: false,
    loginAt: 0,
  },
  totalCharged: 0,
};

// 会员特权配置
export const MEMBERSHIP_CONFIG: Record<
  MembershipTier,
  {
    name: string;
    price: number; // 价格(元/月)
    diamondBonus: number; // 开通即送钻石
    dailyDiamond: number; // 每日领取钻石
    multiplier: number; // 游戏内获取倍率
    color: string;
    icon: string;
    perks: string[];
  }
> = {
  none: {
    name: "非会员",
    price: 0,
    diamondBonus: 0,
    dailyDiamond: 0,
    multiplier: 1,
    color: "#888888",
    icon: "👤",
    perks: ["基础游戏体验"],
  },
  bronze: {
    name: "青铜会员",
    price: 18,
    diamondBonus: 100,
    dailyDiamond: 10,
    multiplier: 1.1,
    color: "#CD7F32",
    icon: "🥉",
    perks: ["游戏内钻石获取+10%", "每日领取10钻石", "专属青铜标识"],
  },
  silver: {
    name: "白银会员",
    price: 38,
    diamondBonus: 250,
    dailyDiamond: 25,
    multiplier: 1.2,
    color: "#C0C0C0",
    icon: "🥈",
    perks: ["游戏内钻石获取+20%", "每日领取25钻石", "专属白银标识", "签到奖励+20%"],
  },
  gold: {
    name: "黄金会员",
    price: 68,
    diamondBonus: 500,
    dailyDiamond: 50,
    multiplier: 1.3,
    color: "#FFD700",
    icon: "🥇",
    perks: ["游戏内钻石获取+30%", "每日领取50钻石", "专属黄金标识", "签到奖励+50%", "专属皮肤9折"],
  },
  diamond: {
    name: "钻石会员",
    price: 128,
    diamondBonus: 1200,
    dailyDiamond: 100,
    multiplier: 1.5,
    color: "#00D4FF",
    icon: "💎",
    perks: ["游戏内钻石获取+50%", "每日领取100钻石", "专属钻石标识", "签到奖励翻倍", "专属皮肤8折", "每月赠送3钥匙"],
  },
};

// 充值套餐配置
export interface RechargePackage {
  id: string;
  name: string;
  price: number; // 价格(元)
  diamond: number; // 获得钻石
  bonus: number; // 额外赠送钻石
  icon: string;
  popular?: boolean;
}

export const RECHARGE_PACKAGES: RechargePackage[] = [
  {
    id: "rc_6",
    name: "小额体验",
    price: 6,
    diamond: 60,
    bonus: 0,
    icon: "💸",
  },
  {
    id: "rc_30",
    name: "超值礼包",
    price: 30,
    diamond: 300,
    bonus: 30,
    icon: "💎",
    popular: true,
  },
  {
    id: "rc_68",
    name: "豪华礼包",
    price: 68,
    diamond: 680,
    bonus: 100,
    icon: "🎁",
  },
  {
    id: "rc_128",
    name: "至尊礼包",
    price: 128,
    diamond: 1280,
    bonus: 280,
    icon: "👑",
  },
  {
    id: "rc_328",
    name: "富豪礼包",
    price: 328,
    diamond: 3280,
    bonus: 800,
    icon: "🏆",
  },
  {
    id: "rc_648",
    name: "传奇礼包",
    price: 648,
    diamond: 6480,
    bonus: 2000,
    icon: "⭐",
  },
];

// 简易账号存储(实际项目应使用后端)
interface StoredAccount {
  userId: string;
  username: string;
  password: string; // 实际项目应加密存储
  createdAt: number;
}

const ACCOUNTS_KEY = "neon-dash-accounts";

function loadAccounts(): StoredAccount[] {
  try {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addGold: (amount) => set((s) => ({ gold: s.gold + amount })),
      addDiamond: (amount) => set((s) => ({ diamond: s.diamond + amount })),
      addKeys: (amount) => set((s) => ({ keys: s.keys + amount })),

      spendGold: (amount) => {
        if (get().gold < amount) return false;
        set((s) => ({ gold: s.gold - amount }));
        return true;
      },
      spendDiamond: (amount) => {
        if (get().diamond < amount) return false;
        set((s) => ({ diamond: s.diamond - amount }));
        return true;
      },
      spendKeys: (amount) => {
        if (get().keys < amount) return false;
        set((s) => ({ keys: s.keys - amount }));
        return true;
      },

      buySkin: (skinId) => {
        const skin = SKINS.find((s) => s.id === skinId);
        if (!skin || get().skins.includes(skinId)) return false;
        if (skin.priceGold > 0 && !get().spendGold(skin.priceGold)) return false;
        if (skin.priceDiamond > 0 && !get().spendDiamond(skin.priceDiamond))
          return false;
        set((s) => ({ skins: [...s.skins, skinId] }));
        return true;
      },

      equipSkin: (skinId) => {
        if (get().skins.includes(skinId)) {
          set({ equippedId: skinId });
        }
      },

      hasSkin: (skinId) => get().skins.includes(skinId),

      upgradePowerUp: (type) => {
        const level = get().powerUpLevels[type];
        const cost = level * 500;
        if (get().spendGold(cost)) {
          set((s) => ({
            powerUpLevels: { ...s.powerUpLevels, [type]: level + 1 },
          }));
          return true;
        }
        return false;
      },

      getPowerUpLevel: (type) => get().powerUpLevels[type],

      lottery: (count) => {
        const cost = count === 1 ? LOTTERY.cost.single : LOTTERY.cost.ten;
        if (!get().spendKeys(cost)) return null;

        const results: { rarity: Rarity; skinId: string; isNew: boolean }[] = [];
        const newPity = { ...get().pityCounter };
        const newFragments = { ...get().fragments };
        const newSkins = [...get().skins];

        for (let i = 0; i < count; i++) {
          let rarity: Rarity = 0;
          const roll = Math.random();
          let acc = 0;
          for (let r = 0; r < LOTTERY.probs.length; r++) {
            acc += LOTTERY.probs[r];
            if (roll < acc) {
              rarity = r as Rarity;
              break;
            }
          }

          // 保底检查
          if (count === 10 && i === 9 && rarity < 1) rarity = 1;
          newPity.rare++;
          newPity.epic++;
          newPity.legendary++;

          if (newPity.rare >= LOTTERY.pity[0] && rarity < 1) {
            rarity = 1;
            newPity.rare = 0;
          } else if (rarity >= 1) newPity.rare = 0;

          if (newPity.epic >= LOTTERY.pity[1] && rarity < 2) {
            rarity = 2;
            newPity.epic = 0;
          } else if (rarity >= 2) newPity.epic = 0;

          if (newPity.legendary >= LOTTERY.pity[2] && rarity < 3) {
            rarity = 3;
            newPity.legendary = 0;
          } else if (rarity >= 3) newPity.legendary = 0;

          // 选择皮肤
          const pool = SKINS.filter((s) => s.rarity === rarity);
          const skin = pool[Math.floor(Math.random() * pool.length)];
          const isNew = !newSkins.includes(skin.id);

          if (isNew) {
            newSkins.push(skin.id);
          } else {
            const gain = LOTTERY.fragmentGain[rarity];
            newFragments[skin.id] = (newFragments[skin.id] || 0) + gain;
          }

          results.push({ rarity, skinId: skin.id, isNew });
        }

        set({
          pityCounter: newPity,
          fragments: newFragments,
          skins: newSkins,
        });
        return results;
      },

      getFragmentCount: (skinId) => get().fragments[skinId] || 0,

      synthesizeSkin: (skinId) => {
        const skin = SKINS.find((s) => s.id === skinId);
        if (!skin || get().skins.includes(skinId)) return false;
        const need = LOTTERY.fragmentNeed[skin.rarity];
        const have = get().fragments[skinId] || 0;
        if (have < need) return false;
        set((s) => ({
          fragments: { ...s.fragments, [skinId]: have - need },
          skins: [...s.skins, skinId],
        }));
        return true;
      },

      setLastRun: (result) => set({ lastRun: result }),

      updateHighScore: (score) => {
        if (score > get().highScore) {
          set({ highScore: score });
        }
      },

      dailySign: () => {
        if (!get().canSignToday()) return false;
        const today = new Date().toDateString();
        const days = get().dailySignDays + 1;
        const rewards = [
          { gold: 5000, keys: 1 },
          { diamond: 50 },
          { keys: 3 },
          { fragments: 5 },
          { diamond: 100 },
          { fragments: 20 },
          { diamond: 200, keys: 5 },
        ];
        const reward = rewards[Math.min(days - 1, 6)];
        // 会员签到加成
        const memberMult = get().getMembershipMultiplier();
        const bonusGold = reward.gold ? Math.floor(reward.gold * (memberMult - 1)) : 0;
        const bonusDiamond = reward.diamond
          ? Math.floor(reward.diamond * (memberMult - 1))
          : 0;
        set((s) => ({
          dailySignDays: days,
          lastSignDate: today,
          gold: s.gold + (reward.gold || 0) + bonusGold,
          diamond: s.diamond + (reward.diamond || 0) + bonusDiamond,
          keys: s.keys + (reward.keys || 0),
        }));
        return true;
      },

      canSignToday: () => {
        const today = new Date().toDateString();
        return get().lastSignDate !== today;
      },

      // === 账号系统 ===
      loginAsGuest: () => {
        const guestId = "guest_" + Math.random().toString(36).slice(2, 10);
        set({
          account: {
            isLoggedIn: true,
            userId: guestId,
            username: "游客玩家",
            isGuest: true,
            loginAt: Date.now(),
          },
        });
      },

      loginWithAccount: (username, password) => {
        const accounts = loadAccounts();
        const acc = accounts.find(
          (a) => a.username === username && a.password === password,
        );
        if (!acc) return false;
        set({
          account: {
            isLoggedIn: true,
            userId: acc.userId,
            username: acc.username,
            isGuest: false,
            loginAt: Date.now(),
          },
        });
        return true;
      },

      registerAccount: (username, password) => {
        if (!username || !password || username.length < 3 || password.length < 6) {
          return false;
        }
        const accounts = loadAccounts();
        if (accounts.some((a) => a.username === username)) return false;
        const newAcc: StoredAccount = {
          userId: "user_" + Math.random().toString(36).slice(2, 10),
          username,
          password,
          createdAt: Date.now(),
        };
        accounts.push(newAcc);
        saveAccounts(accounts);
        set({
          account: {
            isLoggedIn: true,
            userId: newAcc.userId,
            username: newAcc.username,
            isGuest: false,
            loginAt: Date.now(),
          },
        });
        return true;
      },

      logout: () => {
        set({
          account: {
            isLoggedIn: false,
            userId: "",
            username: "",
            isGuest: false,
            loginAt: 0,
          },
        });
      },

      // === 会员系统 ===
      activateMembership: (tier, days) => {
        const config = MEMBERSHIP_CONFIG[tier];
        if (tier === "none") {
          set({ membership: { ...get().membership, tier: "none", expireAt: 0 } });
          return;
        }
        const now = Date.now();
        const expireAt = days === 0 ? 0 : now + days * 24 * 60 * 60 * 1000;
        set((s) => ({
          membership: {
            tier,
            expireAt,
            dailyDiamondClaimed: s.membership.dailyDiamondClaimed,
          },
          diamond: s.diamond + config.diamondBonus,
          // 钻石会员每月赠送3钥匙
          keys: tier === "diamond" ? s.keys + 3 : s.keys,
        }));
      },

      getMembershipMultiplier: () => {
        const m = get().membership;
        if (m.tier === "none") return 1;
        if (m.expireAt > 0 && Date.now() > m.expireAt) return 1;
        return MEMBERSHIP_CONFIG[m.tier].multiplier;
      },

      isMembershipActive: () => {
        const m = get().membership;
        if (m.tier === "none") return false;
        if (m.expireAt > 0 && Date.now() > m.expireAt) return false;
        return true;
      },

      canClaimDailyMemberDiamond: () => {
        const m = get().membership;
        if (m.tier === "none") return false;
        if (m.expireAt > 0 && Date.now() > m.expireAt) return false;
        const today = new Date().toDateString();
        return m.dailyDiamondClaimed !== today;
      },

      claimDailyMemberDiamond: () => {
        if (!get().canClaimDailyMemberDiamond()) return false;
        const m = get().membership;
        const amount = MEMBERSHIP_CONFIG[m.tier].dailyDiamond;
        const today = new Date().toDateString();
        set((s) => ({
          diamond: s.diamond + amount,
          membership: { ...s.membership, dailyDiamondClaimed: today },
        }));
        return true;
      },

      // === 充值系统 ===
      recharge: (packageId) => {
        const pkg = RECHARGE_PACKAGES.find((p) => p.id === packageId);
        if (!pkg) return false;
        // 模拟充值: 实际项目应调用支付SDK
        const total = pkg.diamond + pkg.bonus;
        // 会员额外加成
        const memberMult = get().getMembershipMultiplier();
        const memberBonus = Math.floor(total * (memberMult - 1));
        set((s) => ({
          diamond: s.diamond + total + memberBonus,
          totalCharged: s.totalCharged + pkg.price,
        }));
        return true;
      },

      // === 后端同步 ===
      serverLogin: async (username, password) => {
        console.log("%c[同步] 开始登录...", "color: #00D4FF; font-weight: bold");
        try {
          const res = await api.auth.login(username, password);
          token.set(res.token);
          console.log(`[同步] ✓ 登录成功: ${res.user.username}(ID:${res.user.id})`);
          set({
            account: {
              isLoggedIn: true,
              userId: String(res.user.id),
              username: res.user.username,
              isGuest: false,
              loginAt: Date.now(),
            },
          });
          // 登录后从服务器拉取存档
          await get().syncFromServer();
          return true;
        } catch (e) {
          console.log("%c[同步] ✗ 登录失败:", "color: #FF2D95; font-weight: bold", (e as Error).message);
          return false;
        }
      },

      serverRegister: async (username, password) => {
        console.log("%c[同步] 开始注册...", "color: #00D4FF; font-weight: bold");
        try {
          const res = await api.auth.register(username, password);
          token.set(res.token);
          console.log(`[同步] ✓ 注册成功: ${res.user.username}(ID:${res.user.id})`);
          set({
            account: {
              isLoggedIn: true,
              userId: String(res.user.id),
              username: res.user.username,
              isGuest: false,
              loginAt: Date.now(),
            },
          });
          // 新注册账号:上传当前本地存档到服务器
          await get().syncToServer();
          return true;
        } catch (e) {
          console.log("%c[同步] ✗ 注册失败:", "color: #FF2D95; font-weight: bold", (e as Error).message);
          return false;
        }
      },

      serverLogout: () => {
        console.log("%c[同步] 退出登录，清除Token", "color: #FFD700; font-weight: bold");
        token.clear();
        set({
          account: {
            isLoggedIn: false,
            userId: "",
            username: "",
            isGuest: false,
            loginAt: 0,
          },
        });
      },

      syncFromServer: async () => {
        if (!token.get()) {
          console.log("[同步] 跳过: 未登录");
          return false;
        }
        console.log("%c[同步] 从服务器拉取存档...", "color: #00D4FF");
        try {
          const res = await api.save.get();
          const d = res.data;
          const before = {
            gold: get().gold,
            diamond: get().diamond,
            keys: get().keys,
            highScore: get().highScore,
          };
          console.log("[同步] 本地存档:", before);
          console.log("[同步] 服务器存档:", { gold: d.gold, diamond: d.diamond, keys: d.keys, highScore: d.highScore });
          // 合并服务器存档到本地(服务器优先)
          set({
            gold: d.gold ?? get().gold,
            diamond: d.diamond ?? get().diamond,
            keys: d.keys ?? get().keys,
            highScore: Math.max(d.highScore ?? 0, get().highScore),
            totalRuns: d.totalRuns ?? get().totalRuns,
            totalDistance: d.totalDistance ?? get().totalDistance,
            skins: d.skins ?? get().skins,
            equippedId: d.equippedId ?? get().equippedId,
            powerUpLevels: d.powerUpLevels ?? get().powerUpLevels,
            pityCounter: d.pityCounter ?? get().pityCounter,
            fragments: d.fragments ?? get().fragments,
            dailySignDays: d.dailySignDays ?? get().dailySignDays,
            lastSignDate: d.lastSignDate ?? get().lastSignDate,
            membership: (d.membership as MembershipInfo) ?? get().membership,
            totalCharged: d.totalCharged ?? get().totalCharged,
          });
          console.log("%c[同步] ✓ 存档已同步到本地", "color: #00FFAA");
          return true;
        } catch (e) {
          console.log("%c[同步] ✗ 拉取存档失败:", "color: #FF2D95", (e as Error).message);
          return false;
        }
      },

      syncToServer: async () => {
        if (!token.get()) {
          console.log("[同步] 跳过上传: 未登录");
          return false;
        }
        const s = get();
        console.log("%c[同步] 上传存档到服务器...", "color: #00D4FF");
        console.log("[同步] 上传数据:", { gold: s.gold, diamond: s.diamond, keys: s.keys, highScore: s.highScore, totalCharged: s.totalCharged });
        try {
          const data: SaveData = {
            gold: s.gold,
            diamond: s.diamond,
            keys: s.keys,
            highScore: s.highScore,
            totalRuns: s.totalRuns,
            totalDistance: s.totalDistance,
            skins: s.skins,
            equippedId: s.equippedId,
            powerUpLevels: s.powerUpLevels,
            pityCounter: s.pityCounter,
            fragments: s.fragments,
            dailySignDays: s.dailySignDays,
            lastSignDate: s.lastSignDate,
            membership: s.membership,
            totalCharged: s.totalCharged,
          };
          await api.save.upload(data);
          console.log("%c[同步] ✓ 存档已上传", "color: #00FFAA");
          return true;
        } catch (e) {
          console.log("%c[同步] ✗ 上传存档失败:", "color: #FF2D95", (e as Error).message);
          return false;
        }
      },

      submitScoreToServer: async (score, distance, maxCombo, perfectDodges) => {
        if (!token.get()) {
          console.log("[排行榜] 跳过: 未登录");
          return null;
        }
        console.log("%c[排行榜] 提交分数...", "color: #FFD700; font-weight: bold");
        console.log(`[排行榜] 分数=${score} 距离=${distance}m Combo=${maxCombo} 闪避=${perfectDodges}`);
        try {
          const res = await api.leaderboard.submit(score, distance, maxCombo, perfectDodges);
          console.log(`%c[排行榜] ✓ 提交成功，本局排名: 第${res.rank}名`, "color: #00FFAA; font-weight: bold");
          return res.rank;
        } catch (e) {
          console.log("%c[排行榜] ✗ 提交失败:", "color: #FF2D95", (e as Error).message);
          return null;
        }
      },

      reset: () => set({ ...initialState }),
    }),
    {
      name: "neon-dash-save",
    },
  ),
);
