import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

// ==================== 数据库 ====================
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

// ==================== JWT ====================
const JWT_SECRET = process.env.JWT_SECRET || "neon-dash-dev-secret";

interface JwtPayload {
  userId: number;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "登录已过期" });
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

// ==================== Express App ====================
const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// 健康检查
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: Date.now() });
});

// --- 认证路由 ---
app.post("/api/auth/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "用户名和密码不能为空" });
    return;
  }
  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ error: "用户名长度需3-20个字符" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "密码至少6个字符" });
    return;
  }
  if (store.findUserByName(username)) {
    res.status(409).json({ error: "用户名已存在" });
    return;
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
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "用户名和密码不能为空" });
    return;
  }
  const user = store.findUserByName(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ error: "用户名或密码错误" });
    return;
  }
  store.updateUserLogin(user.id);
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ user: { id: req.user!.userId, username: req.user!.username } });
});

// --- 存档路由 ---
app.get("/api/save", authRequired, (req, res) => {
  const save = store.getSave(req.user!.userId);
  if (!save) {
    res.status(404).json({ error: "存档不存在" });
    return;
  }
  res.json({ data: save.data, updatedAt: save.updatedAt });
});

app.post("/api/save", authRequired, (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "存档数据无效" });
    return;
  }
  store.upsertSave(req.user!.userId, data);
  res.json({ success: true, updatedAt: Date.now() });
});

// --- 充值路由 ---
app.post("/api/recharge/order", authRequired, (req, res) => {
  const { packageId } = req.body;
  const pkg = PACKAGES[packageId];
  if (!pkg) {
    res.status(400).json({ error: "无效的套餐" });
    return;
  }
  const orderId = "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  store.createOrder(orderId, req.user!.userId, packageId, pkg.price, pkg.diamond, pkg.bonus);
  res.json({
    orderId,
    packageId,
    amount: pkg.price,
    diamond: pkg.diamond,
    bonus: pkg.bonus,
    payParams: { mock: true, message: "模拟支付 - 直接调用 /confirm 完成支付" },
  });
});

app.post("/api/recharge/confirm", authRequired, (req, res) => {
  const { orderId } = req.body;
  const userId = req.user!.userId;
  if (!orderId) {
    res.status(400).json({ error: "缺少订单ID" });
    return;
  }
  const order = store.findOrder(orderId, userId);
  if (!order) {
    res.status(404).json({ error: "订单不存在" });
    return;
  }
  if (order.status === "confirmed") {
    res.status(400).json({ error: "订单已确认" });
    return;
  }
  store.confirmOrder(orderId);
  const save = store.getSave(userId);
  if (!save) {
    res.status(500).json({ error: "存档不存在" });
    return;
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
  store.upsertSave(userId, data);
  res.json({ success: true, diamondGained: totalDiamond + memberBonus, memberBonus, newDiamond: data.diamond });
});

app.get("/api/recharge/orders", authRequired, (req, res) => {
  const orders = store.getUserOrders(req.user!.userId);
  res.json({ orders });
});

// --- 排行榜路由 ---
app.post("/api/leaderboard/submit", authRequired, (req, res) => {
  const { score, distance, maxCombo, perfectDodges } = req.body;
  if (typeof score !== "number" || typeof distance !== "number" || typeof maxCombo !== "number" || typeof perfectDodges !== "number") {
    res.status(400).json({ error: "参数无效" });
    return;
  }
  const { rank } = store.submitScore(req.user!.userId, req.user!.username, score, distance, maxCombo, perfectDodges);
  res.json({ success: true, rank });
});

app.get("/api/leaderboard", (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit)) || 100, 200);
  const rows = store.getLeaderboard(limit);
  res.json({
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

app.get("/api/leaderboard/me", authRequired, (req, res) => {
  const { rank, bestScore } = store.getUserRank(req.user!.userId);
  res.json({ rank, bestScore });
});

// 错误处理
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("服务器错误:", err);
  res.status(500).json({ error: "服务器内部错误" });
});

export default app;
