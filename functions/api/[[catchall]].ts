import { Hono } from "hono";
import bcrypt from "bcryptjs";
import * as jose from "jose";

// ==================== 类型定义 ====================
interface UserRecord {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: number;
  lastLoginAt: number | null;
}
interface SaveRecord {
  userId: number;
  data: Record<string, unknown>;
  updatedAt: number;
}
interface OrderRecord {
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
interface LeaderboardRecord {
  id: number;
  userId: number;
  username: string;
  score: number;
  distance: number;
  maxCombo: number;
  perfectDodges: number;
  createdAt: number;
}

interface Env {
  JWT_SECRET?: string;
}

// ==================== 数据库（内存数据库，isolate 热存续期间保持）====================
declare global {
  // eslint-disable-next-line no-var
  var __NEON_DB__:
    | {
        users: UserRecord[];
        saves: SaveRecord[];
        orders: OrderRecord[];
        leaderboard: LeaderboardRecord[];
      }
    | undefined;
}

const db = globalThis.__NEON_DB__ ?? {
  users: [],
  saves: [],
  orders: [],
  leaderboard: [],
};
globalThis.__NEON_DB__ = db;

function nextId(arr: { id: number }[]): number {
  return arr.length === 0 ? 1 : Math.max(...arr.map((x) => x.id)) + 1;
}

const store = {
  findUserByName(username: string) {
    return db.users.find((u) => u.username === username);
  },
  createUser(username: string, passwordHash: string): UserRecord {
    const user: UserRecord = {
      id: nextId(db.users),
      username,
      passwordHash,
      createdAt: Date.now(),
      lastLoginAt: null,
    };
    db.users.push(user);
    return user;
  },
  updateUserLogin(id: number) {
    const u = db.users.find((x) => x.id === id);
    if (u) u.lastLoginAt = Date.now();
  },
  getSave(userId: number) {
    return db.saves.find((s) => s.userId === userId);
  },
  upsertSave(userId: number, data: Record<string, unknown>) {
    const existing = db.saves.find((s) => s.userId === userId);
    if (existing) {
      existing.data = data;
      existing.updatedAt = Date.now();
    } else {
      db.saves.push({ userId, data, updatedAt: Date.now() });
    }
  },
  createOrder(
    id: string,
    userId: number,
    packageId: string,
    amount: number,
    diamond: number,
    bonus: number,
  ): OrderRecord {
    const order: OrderRecord = {
      id,
      userId,
      packageId,
      amount,
      diamond,
      bonus,
      status: "pending",
      createdAt: Date.now(),
      confirmedAt: null,
    };
    db.orders.push(order);
    return order;
  },
  findOrder(id: string, userId: number) {
    return db.orders.find((o) => o.id === id && o.userId === userId);
  },
  confirmOrder(id: string) {
    const o = db.orders.find((x) => x.id === id);
    if (o && o.status === "pending") {
      o.status = "confirmed";
      o.confirmedAt = Date.now();
    }
    return o;
  },
  getUserOrders(userId: number, limit = 50) {
    return db.orders
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },
  submitScore(
    userId: number,
    username: string,
    score: number,
    distance: number,
    maxCombo: number,
    perfectDodges: number,
  ) {
    db.leaderboard.push({
      id: nextId(db.leaderboard),
      userId,
      username,
      score,
      distance,
      maxCombo,
      perfectDodges,
      createdAt: Date.now(),
    });
    const userBests = new Map<number, number>();
    for (const r of db.leaderboard) {
      const cur = userBests.get(r.userId) || 0;
      if (r.score > cur) userBests.set(r.userId, r.score);
    }
    const sortedScores = [...userBests.values()].sort((a, b) => b - a);
    const rank = sortedScores.indexOf(score) + 1;
    return { rank: rank || sortedScores.length };
  },
  getLeaderboard(limit = 100) {
    const userBest = new Map<number, LeaderboardRecord>();
    for (const r of db.leaderboard) {
      const cur = userBest.get(r.userId);
      if (!cur || r.score > cur.score) userBest.set(r.userId, { ...r });
    }
    return [...userBest.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
  getUserRank(userId: number) {
    const myScores = db.leaderboard.filter((r) => r.userId === userId);
    if (myScores.length === 0) return { rank: null as number | null, bestScore: 0 };
    const bestScore = Math.max(...myScores.map((r) => r.score));
    const userBests = new Map<number, number>();
    for (const r of db.leaderboard) {
      const cur = userBests.get(r.userId) || 0;
      if (r.score > cur) userBests.set(r.userId, r.score);
    }
    const sortedScores = [...userBests.values()].sort((a, b) => b - a);
    const rank = sortedScores.indexOf(bestScore) + 1;
    return { rank: rank || null, bestScore };
  },
};

// ==================== JWT（使用 jose 库，基于 Web Crypto API）====================
interface JwtPayload {
  userId: number;
  username: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "neon-dash-dev-secret";

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

async function signToken(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey());
    return { userId: payload.userId as number, username: payload.username as string };
  } catch {
    return null;
  }
}

// ==================== 充值套餐 ====================
const PACKAGES: Record<string, { price: number; diamond: number; bonus: number }> = {
  rc_6: { price: 6, diamond: 60, bonus: 0 },
  rc_30: { price: 30, diamond: 300, bonus: 30 },
  rc_68: { price: 68, diamond: 680, bonus: 100 },
  rc_128: { price: 128, diamond: 1280, bonus: 280 },
  rc_328: { price: 328, diamond: 3280, bonus: 800 },
  rc_648: { price: 648, diamond: 6480, bonus: 2000 },
};

// ==================== Hono App ====================
const app = new Hono<{ Bindings: Env }>();

// 认证中间件
const authRequired = async (c: any, next: any) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "未登录" }, 401);
  }
  const payload = await verifyToken(authHeader.slice(7));
  if (!payload) {
    return c.json({ error: "登录已过期" }, 401);
  }
  c.set("user", payload);
  await next();
};

// 健康检查
app.get("/api/health", (c) => {
  return c.json({ status: "ok", time: Date.now() });
});

// --- 认证路由 ---
app.post("/api/auth/register", async (c) => {
  const body = await c.req.json();
  const { username, password } = body;
  if (!username || !password) {
    return c.json({ error: "用户名和密码不能为空" }, 400);
  }
  if (username.length < 3 || username.length > 20) {
    return c.json({ error: "用户名长度需3-20个字符" }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: "密码至少6个字符" }, 400);
  }
  if (store.findUserByName(username)) {
    return c.json({ error: "用户名已存在" }, 409);
  }
  const hash = bcrypt.hashSync(password, 10);
  const user = store.createUser(username, hash);
  store.upsertSave(user.id, {
    gold: 1000,
    diamond: 50,
    keys: 1,
    highScore: 0,
    totalRuns: 0,
    totalDistance: 0,
    skins: ["default"],
    equippedId: "default",
    powerUpLevels: { jetpack: 1, magnet: 1, superShoes: 1, scoreMultiplier: 1, shield: 1 },
    pityCounter: { rare: 0, epic: 0, legendary: 0 },
    fragments: {},
    dailySignDays: 0,
    lastSignDate: "",
    membership: { tier: "none", expireAt: 0, dailyDiamondClaimed: "" },
    totalCharged: 0,
  });
  const token = await signToken({ userId: user.id, username: user.username });
  return c.json({ token, user: { id: user.id, username: user.username } });
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json();
  const { username, password } = body;
  if (!username || !password) {
    return c.json({ error: "用户名和密码不能为空" }, 400);
  }
  const user = store.findUserByName(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return c.json({ error: "用户名或密码错误" }, 401);
  }
  store.updateUserLogin(user.id);
  const token = await signToken({ userId: user.id, username: user.username });
  return c.json({ token, user: { id: user.id, username: user.username } });
});

app.get("/api/auth/me", authRequired, (c) => {
  const user = c.get("user") as JwtPayload;
  return c.json({ user: { id: user.userId, username: user.username } });
});

// --- 存档路由 ---
app.get("/api/save", authRequired, (c) => {
  const user = c.get("user") as JwtPayload;
  const save = store.getSave(user.userId);
  if (!save) {
    return c.json({ error: "存档不存在" }, 404);
  }
  return c.json({ data: save.data, updatedAt: save.updatedAt });
});

app.post("/api/save", authRequired, async (c) => {
  const user = c.get("user") as JwtPayload;
  const body = await c.req.json();
  const { data } = body;
  if (!data || typeof data !== "object") {
    return c.json({ error: "存档数据无效" }, 400);
  }
  store.upsertSave(user.userId, data);
  return c.json({ success: true, updatedAt: Date.now() });
});

// --- 充值路由 ---
app.post("/api/recharge/order", authRequired, async (c) => {
  const user = c.get("user") as JwtPayload;
  const body = await c.req.json();
  const { packageId } = body;
  const pkg = PACKAGES[packageId];
  if (!pkg) {
    return c.json({ error: "无效的套餐" }, 400);
  }
  const orderId = "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  store.createOrder(orderId, user.userId, packageId, pkg.price, pkg.diamond, pkg.bonus);
  return c.json({
    orderId,
    packageId,
    amount: pkg.price,
    diamond: pkg.diamond,
    bonus: pkg.bonus,
    payParams: { mock: true, message: "模拟支付 - 直接调用 /confirm 完成支付" },
  });
});

app.post("/api/recharge/confirm", authRequired, async (c) => {
  const user = c.get("user") as JwtPayload;
  const body = await c.req.json();
  const { orderId } = body;
  if (!orderId) {
    return c.json({ error: "缺少订单ID" }, 400);
  }
  const order = store.findOrder(orderId, user.userId);
  if (!order) {
    return c.json({ error: "订单不存在" }, 404);
  }
  if (order.status === "confirmed") {
    return c.json({ error: "订单已确认" }, 400);
  }
  store.confirmOrder(orderId);
  const save = store.getSave(user.userId);
  if (!save) {
    return c.json({ error: "存档不存在" }, 500);
  }
  const data = save.data;
  const diamondBefore = data.diamond as number;
  const totalDiamond = order.diamond + order.bonus;
  const membership = data.membership as { tier: string } | undefined;
  const memberMultMap: Record<string, number> = { bronze: 1.1, silver: 1.2, gold: 1.3, diamond: 1.5 };
  const memberMult = membership && membership.tier !== "none" ? memberMultMap[membership.tier] || 1 : 1;
  const memberBonus = Math.floor(totalDiamond * (memberMult - 1));
  data.diamond = diamondBefore + totalDiamond + memberBonus;
  data.totalCharged = (data.totalCharged as number) + order.amount;
  store.upsertSave(user.userId, data);
  return c.json({ success: true, diamondGained: totalDiamond + memberBonus, memberBonus, newDiamond: data.diamond });
});

app.get("/api/recharge/orders", authRequired, (c) => {
  const user = c.get("user") as JwtPayload;
  const orders = store.getUserOrders(user.userId);
  return c.json({ orders });
});

// --- 排行榜路由 ---
app.post("/api/leaderboard/submit", authRequired, async (c) => {
  const user = c.get("user") as JwtPayload;
  const body = await c.req.json();
  const { score, distance, maxCombo, perfectDodges } = body;
  if (typeof score !== "number" || typeof distance !== "number" || typeof maxCombo !== "number" || typeof perfectDodges !== "number") {
    return c.json({ error: "参数无效" }, 400);
  }
  const { rank } = store.submitScore(user.userId, user.username, score, distance, maxCombo, perfectDodges);
  return c.json({ success: true, rank });
});

app.get("/api/leaderboard", (c) => {
  const limit = Math.min(parseInt(String(c.req.query("limit"))) || 100, 200);
  const rows = store.getLeaderboard(limit);
  return c.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      score: r.score,
      distance: r.distance,
      maxCombo: r.maxCombo,
      perfectDodges: r.perfectDodges,
      createdAt: r.createdAt,
    })),
  });
});

app.get("/api/leaderboard/me", authRequired, (c) => {
  const user = c.get("user") as JwtPayload;
  const { rank, bestScore } = store.getUserRank(user.userId);
  return c.json({ rank, bestScore });
});

// 错误处理
app.onError((err, c) => {
  console.error("服务器错误:", err);
  return c.json({ error: "服务器内部错误" }, 500);
});

export const onRequest = app.fetch;
