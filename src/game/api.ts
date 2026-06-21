// 纯前端 API 封装
// - 认证 / 存档 / 充值: 浏览器 localStorage 本地存储
// - 排行榜: GitHub Gist 在线 JSON 存储（免实名免费，中国大陆可访问）
//
// 说明: 所有方法签名与返回类型与原 HTTP 版本完全一致，
// 调用方（Login / Leaderboard / Recharge / Result / store）无需任何改动。

const TOKEN_KEY = "neon-dash-token";
const USERS_KEY = "neon-dash-users"; // 用户列表
const SAVE_KEY_PREFIX = "neon-dash-save-"; // 存档前缀 + userId
const ORDERS_KEY_PREFIX = "neon-dash-orders-"; // 订单前缀 + userId

// GitHub Gist 配置（从环境变量读取）
const GIST_API_BASE = "https://api.github.com/gists";
const GIST_ID =
  (import.meta as unknown as { env: { VITE_GIST_ID?: string } }).env
    .VITE_GIST_ID || "";
const GITHUB_TOKEN =
  (import.meta as unknown as { env: { VITE_GITHUB_TOKEN?: string } }).env
    .VITE_GITHUB_TOKEN || "";
const GIST_FILENAME = "leaderboard.json";

// Token 管理（保持原接口不变，仍用 localStorage 存 token）
export const token = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(t: string) {
    localStorage.setItem(TOKEN_KEY, t);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

// === 类型定义（与原版本完全一致）===
export interface AuthResponse {
  token: string;
  user: { id: number; username: string };
}

export interface SaveData {
  gold: number;
  diamond: number;
  keys: number;
  highScore: number;
  totalRuns: number;
  totalDistance: number;
  skins: string[];
  equippedId: string;
  powerUpLevels: Record<string, number>;
  pityCounter: { rare: number; epic: number; legendary: number };
  fragments: Record<string, number>;
  dailySignDays: number;
  lastSignDate: string;
  membership: { tier: string; expireAt: number; dailyDiamondClaimed: string };
  totalCharged: number;
  [key: string]: unknown;
}

export interface SaveResponse {
  data: SaveData;
  updatedAt: number;
}

export interface OrderResponse {
  orderId: string;
  packageId: string;
  amount: number;
  diamond: number;
  bonus: number;
  payParams: { mock: boolean; message: string };
}

export interface ConfirmResponse {
  success: boolean;
  diamondGained: number;
  memberBonus: number;
  newDiamond: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  score: number;
  distance: number;
  maxCombo: number;
  perfectDodges: number;
  createdAt: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface MyRankResponse {
  rank: number | null;
  bestScore: number;
}

// === 本地存储辅助类型 ===
interface StoredUser {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: number;
  lastLoginAt: number | null;
}

interface StoredOrder {
  id: string;
  userId: number;
  packageId: string;
  amount: number;
  diamond: number;
  bonus: number;
  status: "pending" | "confirmed" | "failed";
  createdAt: number;
  confirmedAt: number | null;
}

// === 充值套餐表（与后端 PACKAGES 保持一致）===
const PACKAGES: Record<string, { price: number; diamond: number; bonus: number }> = {
  rc_6: { price: 6, diamond: 60, bonus: 0 },
  rc_30: { price: 30, diamond: 300, bonus: 30 },
  rc_68: { price: 68, diamond: 680, bonus: 100 },
  rc_128: { price: 128, diamond: 1280, bonus: 280 },
  rc_328: { price: 328, diamond: 3280, bonus: 800 },
  rc_648: { price: 648, diamond: 6480, bonus: 2000 },
};

// 会员等级对应的钻石获取倍率（与 store.ts MEMBERSHIP_CONFIG 保持一致）
const MEMBERSHIP_MULTIPLIERS: Record<string, number> = {
  none: 1,
  bronze: 1.1,
  silver: 1.2,
  gold: 1.3,
  diamond: 1.5,
};

// === 初始存档数据（与后端 INITIAL_SAVE_DATA 保持一致）===
const INITIAL_SAVE_DATA: SaveData = {
  gold: 1000,
  diamond: 50,
  keys: 1,
  highScore: 0,
  totalRuns: 0,
  totalDistance: 0,
  skins: ["default"],
  equippedId: "default",
  powerUpLevels: {
    jetpack: 1,
    magnet: 1,
    superShoes: 1,
    scoreMultiplier: 1,
    shield: 1,
  },
  pityCounter: { rare: 0, epic: 0, legendary: 0 },
  fragments: {},
  dailySignDays: 0,
  lastSignDate: "",
  membership: { tier: "none", expireAt: 0, dailyDiamondClaimed: "" },
  totalCharged: 0,
};

// === 工具函数 ===

// UTF-8 安全的 base64 编码（支持中文用户名）
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

// UTF-8 安全的 base64 解码
function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// 简单密码 hash（非安全级别，仅避免明文存储）
function hashPassword(password: string): string {
  // 加盐后 base64，简单可逆但避免明文落盘
  const salted = `neon-dash-salt::${password}::v1`;
  return utf8ToBase64(salted);
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// 生成 JWT-like token（base64 编码 JSON 载荷，7 天有效期）
function generateToken(userId: number, username: string): string {
  const payload = {
    id: userId,
    username,
    exp: Date.now() + 7 * 24 * 3600 * 1000,
  };
  return utf8ToBase64(JSON.stringify(payload));
}

// 解析 token，失败或过期抛错（模拟后端 401 行为）
function parseToken(t: string): {
  id: number;
  username: string;
  exp: number;
} {
  let payload: { id: number; username: string; exp: number };
  try {
    payload = JSON.parse(base64ToUtf8(t));
  } catch {
    throw new Error("无效的 token");
  }
  if (
    !payload ||
    typeof payload.id !== "number" ||
    typeof payload.username !== "string"
  ) {
    throw new Error("无效的 token");
  }
  if (payload.exp && Date.now() > payload.exp) {
    throw new Error("token 已过期，请重新登录");
  }
  return payload;
}

// 获取当前登录用户 ID（从 token 解析）
function getCurrentUserId(): number {
  const t = token.get();
  if (!t) throw new Error("未登录");
  return parseToken(t).id;
}

// localStorage 读写辅助
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// 生成订单号
function generateOrderId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ORD${ts}${rand}`.toUpperCase();
}

// === GitHub Gist 排行榜封装 ===

interface GistLeaderboardData {
  entries: LeaderboardEntry[];
}

// 排行榜提交串行锁（防止同一会话内并发读-改-写）
let leaderboardLock: Promise<unknown> = Promise.resolve();

function withLeaderboardLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = leaderboardLock.then(fn, fn);
  // 无论成功失败都释放锁
  leaderboardLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run as Promise<T>;
}

// 检查 Gist 是否已配置
function checkGistConfig(): void {
  if (!GIST_ID || !GITHUB_TOKEN) {
    throw new Error(
      "排行榜未配置：请在 .env 中设置 VITE_GIST_ID 和 VITE_GITHUB_TOKEN",
    );
  }
}

// 从 Gist 读取排行榜
async function gistGet(): Promise<GistLeaderboardData> {
  checkGistConfig();
  let res: Response;
  try {
    res = await fetch(`${GIST_API_BASE}/${GIST_ID}`, {
      method: "GET",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
  } catch {
    throw new Error("网络错误：无法连接排行榜服务，请检查网络后重试");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `读取排行榜失败 (${res.status})：${text || res.statusText}。请稍后重试`,
    );
  }
  const body = await res.json();
  // GitHub Gist 返回 { files: { "leaderboard.json": { content: "..." } } }
  const file = (body as { files?: Record<string, { content?: string }> }).files
    ?.[GIST_FILENAME];
  if (!file || !file.content) {
    return { entries: [] };
  }
  try {
    const parsed = JSON.parse(file.content) as GistLeaderboardData;
    if (!Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    return parsed;
  } catch {
    return { entries: [] };
  }
}

// 写入排行榜到 Gist
async function gistPut(data: GistLeaderboardData): Promise<void> {
  checkGistConfig();
  let res: Response;
  try {
    res = await fetch(`${GIST_API_BASE}/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) },
        },
      }),
    });
  } catch {
    throw new Error("网络错误：提交排行榜失败，请检查网络后重试");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `提交排行榜失败 (${res.status})：${text || res.statusText}。请稍后重试`,
    );
  }
}

// 对排行榜条目按分数降序排序并重算 rank
function sortAndRank(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = entries.slice().sort((a, b) => b.score - a.score);
  sorted.forEach((e, i) => {
    e.rank = i + 1;
  });
  return sorted;
}

// === API 方法（签名与返回类型与原 HTTP 版本完全一致）===
export const api = {
  // 认证
  auth: {
    // 注册：本地 localStorage
    register: async (
      username: string,
      password: string,
    ): Promise<AuthResponse> => {
      if (!username || username.length < 3) {
        throw new Error("用户名至少3个字符");
      }
      if (!password || password.length < 6) {
        throw new Error("密码至少6个字符");
      }
      const users = readJSON<StoredUser[]>(USERS_KEY, []);
      if (users.some((u) => u.username === username)) {
        throw new Error("用户名已存在");
      }
      // 用户 ID 自增
      const id =
        users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
      const now = Date.now();
      const newUser: StoredUser = {
        id,
        username,
        passwordHash: hashPassword(password),
        createdAt: now,
        lastLoginAt: now,
      };
      users.push(newUser);
      writeJSON(USERS_KEY, users);
      const t = generateToken(id, username);
      return { token: t, user: { id, username } };
    },

    // 登录：本地校验
    login: async (
      username: string,
      password: string,
    ): Promise<AuthResponse> => {
      const users = readJSON<StoredUser[]>(USERS_KEY, []);
      const user = users.find((u) => u.username === username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw new Error("用户名或密码错误");
      }
      user.lastLoginAt = Date.now();
      writeJSON(USERS_KEY, users);
      const t = generateToken(user.id, user.username);
      return { token: t, user: { id: user.id, username: user.username } };
    },

    // 获取当前用户：从 token 解析
    me: async (): Promise<{ user: { id: number; username: string } }> => {
      const t = token.get();
      if (!t) throw new Error("未登录");
      const payload = parseToken(t);
      return { user: { id: payload.id, username: payload.username } };
    },
  },

  // 存档
  save: {
    // 读取本地存档，没有则返回默认初始存档
    get: async (): Promise<SaveResponse> => {
      const userId = getCurrentUserId();
      const key = `${SAVE_KEY_PREFIX}${userId}`;
      const stored = readJSON<{ data: SaveData; updatedAt: number } | null>(
        key,
        null,
      );
      if (stored && stored.data) {
        return { data: stored.data, updatedAt: stored.updatedAt };
      }
      // 新用户返回默认初始存档
      return { data: { ...INITIAL_SAVE_DATA }, updatedAt: 0 };
    },

    // 写入本地存档
    upload: async (
      data: SaveData,
    ): Promise<{ success: boolean; updatedAt: number }> => {
      const userId = getCurrentUserId();
      const key = `${SAVE_KEY_PREFIX}${userId}`;
      const updatedAt = Date.now();
      writeJSON(key, { data, updatedAt });
      return { success: true, updatedAt };
    },
  },

  // 充值（本地 Mock）
  recharge: {
    // 创建订单
    createOrder: async (packageId: string): Promise<OrderResponse> => {
      const pkg = PACKAGES[packageId];
      if (!pkg) {
        throw new Error("无效的充值套餐");
      }
      const userId = getCurrentUserId();
      const orderId = generateOrderId();
      const order: StoredOrder = {
        id: orderId,
        userId,
        packageId,
        amount: pkg.price,
        diamond: pkg.diamond,
        bonus: pkg.bonus,
        status: "pending",
        createdAt: Date.now(),
        confirmedAt: null,
      };
      const ordersKey = `${ORDERS_KEY_PREFIX}${userId}`;
      const orders = readJSON<StoredOrder[]>(ordersKey, []);
      orders.push(order);
      writeJSON(ordersKey, orders);
      return {
        orderId,
        packageId,
        amount: pkg.price,
        diamond: pkg.diamond,
        bonus: pkg.bonus,
        payParams: { mock: true, message: "本地模拟支付，确认即到账" },
      };
    },

    // 确认订单：标记已支付并更新本地存档钻石
    confirm: async (orderId: string): Promise<ConfirmResponse> => {
      const userId = getCurrentUserId();
      const ordersKey = `${ORDERS_KEY_PREFIX}${userId}`;
      const orders = readJSON<StoredOrder[]>(ordersKey, []);
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        throw new Error("订单不存在");
      }
      if (order.status === "confirmed") {
        throw new Error("订单已支付，请勿重复操作");
      }
      // 标记已支付
      order.status = "confirmed";
      order.confirmedAt = Date.now();
      writeJSON(ordersKey, orders);

      // 更新本地存档钻石（含会员加成）
      const saveKey = `${SAVE_KEY_PREFIX}${userId}`;
      const stored = readJSON<{ data: SaveData; updatedAt: number } | null>(
        saveKey,
        null,
      );
      const saveData: SaveData = stored?.data
        ? { ...stored.data }
        : { ...INITIAL_SAVE_DATA };

      const base = order.diamond + order.bonus;
      // 会员加成计算
      let memberBonus = 0;
      const membership = saveData.membership;
      if (membership && membership.tier && membership.tier !== "none") {
        const mult = MEMBERSHIP_MULTIPLIERS[membership.tier] || 1;
        // 检查会员是否过期（expireAt=0 表示永久）
        const active =
          membership.expireAt === 0 || Date.now() <= membership.expireAt;
        if (active && mult > 1) {
          memberBonus = Math.floor(base * (mult - 1));
        }
      }
      const diamondGained = base + memberBonus;
      saveData.diamond = (saveData.diamond || 0) + diamondGained;
      saveData.totalCharged = (saveData.totalCharged || 0) + order.amount;
      writeJSON(saveKey, { data: saveData, updatedAt: Date.now() });

      return {
        success: true,
        diamondGained,
        memberBonus,
        newDiamond: saveData.diamond,
      };
    },

    // 查询订单列表
    orders: async (): Promise<{ orders: unknown[] }> => {
      const userId = getCurrentUserId();
      const ordersKey = `${ORDERS_KEY_PREFIX}${userId}`;
      const orders = readJSON<unknown[]>(ordersKey, []);
      return { orders };
    },
  },

  // 排行榜（GitHub Gist）
  leaderboard: {
    // 提交分数：读-改-写，串行锁防并发
    submit: async (
      score: number,
      distance: number,
      maxCombo: number,
      perfectDodges: number,
    ): Promise<{ success: boolean; rank: number }> => {
      return withLeaderboardLock(async () => {
        const t = token.get();
        if (!t) throw new Error("未登录");
        const { id: userId, username } = parseToken(t);

        // 1. 读取当前排行榜
        const data = await gistGet();
        const entries: LeaderboardEntry[] = (data.entries || []).slice();
        const now = Date.now();

        // 2. 查找当前用户已有记录
        const existIdx = entries.findIndex((e) => e.userId === userId);
        if (existIdx >= 0) {
          // 已有记录：仅当新分数更高时更新
          if (score > entries[existIdx].score) {
            entries[existIdx] = {
              ...entries[existIdx],
              username, // 用户名可能变更，同步更新
              score,
              distance,
              maxCombo,
              perfectDodges,
              createdAt: now,
            };
          }
        } else {
          // 新增记录
          entries.push({
            rank: 0, // 占位，下面统一计算
            userId,
            username,
            score,
            distance,
            maxCombo,
            perfectDodges,
            createdAt: now,
          });
        }

        // 3. 按 score 降序排序，只保留 Top 100
        const top100 = sortAndRank(entries).slice(0, 100);

        // 4. 写回 Gist
        await gistPut({ entries: top100 });

        // 5. 计算当前用户排名（未进 Top100 则返回 0 表示未上榜）
        const myEntry = top100.find((e) => e.userId === userId);
        return { success: true, rank: myEntry ? myEntry.rank : 0 };
      });
    },

    // 获取排行榜列表
    list: async (limit = 100): Promise<LeaderboardResponse> => {
      const data = await gistGet();
      const entries = sortAndRank(data.entries || []);
      return { leaderboard: entries.slice(0, limit) };
    },

    // 获取当前用户排名
    me: async (): Promise<MyRankResponse> => {
      const userId = getCurrentUserId();
      const data = await gistGet();
      const entries = sortAndRank(data.entries || []);
      const idx = entries.findIndex((e) => e.userId === userId);
      if (idx < 0) {
        return { rank: null, bestScore: 0 };
      }
      return { rank: idx + 1, bestScore: entries[idx].score };
    },
  },

  // 健康检查（本地总是 ok）
  health: async (): Promise<{ status: string; time: number }> => {
    return { status: "ok", time: Date.now() };
  },
};
