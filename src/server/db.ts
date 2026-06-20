// Vercel Serverless 内存数据库（实例热存续期间有效）
interface DbSchema {
  users: UserRecord[];
  saves: SaveRecord[];
  orders: OrderRecord[];
  leaderboard: LeaderboardRecord[];
}

export interface UserRecord {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface SaveRecord {
  userId: number;
  data: Record<string, unknown>;
  updatedAt: number;
}

export interface OrderRecord {
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

export interface LeaderboardRecord {
  id: number;
  userId: number;
  username: string;
  score: number;
  distance: number;
  maxCombo: number;
  perfectDodges: number;
  createdAt: number;
}

// 全局内存数据库（在 serverless 实例热存续期间保持）
declare global {
  // eslint-disable-next-line no-var
  var __NEON_DB__: DbSchema | undefined;
}

const db: DbSchema = globalThis.__NEON_DB__ ?? {
  users: [],
  saves: [],
  orders: [],
  leaderboard: [],
};
globalThis.__NEON_DB__ = db;

function nextId(arr: { id: number }[]): number {
  return arr.length === 0 ? 1 : Math.max(...arr.map((x) => x.id)) + 1;
}

export const store = {
  findUserByName(username: string): UserRecord | undefined {
    return db.users.find((u) => u.username === username);
  },
  findUserById(id: number): UserRecord | undefined {
    return db.users.find((u) => u.id === id);
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

  getSave(userId: number): SaveRecord | undefined {
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
  findOrder(id: string, userId: number): OrderRecord | undefined {
    return db.orders.find((o) => o.id === id && o.userId === userId);
  },
  confirmOrder(id: string): OrderRecord | undefined {
    const o = db.orders.find((x) => x.id === id);
    if (o && o.status === "pending") {
      o.status = "confirmed";
      o.confirmedAt = Date.now();
    }
    return o;
  },
  getUserOrders(userId: number, limit = 50): OrderRecord[] {
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
  ): { rank: number } {
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
  getLeaderboard(limit = 100): LeaderboardRecord[] {
    const userBest = new Map<number, LeaderboardRecord>();
    for (const r of db.leaderboard) {
      const cur = userBest.get(r.userId);
      if (!cur || r.score > cur.score) {
        userBest.set(r.userId, { ...r });
      }
    }
    return [...userBest.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
  getUserRank(userId: number): { rank: number | null; bestScore: number } {
    const myScores = db.leaderboard.filter((r) => r.userId === userId);
    if (myScores.length === 0) return { rank: null, bestScore: 0 };
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

export default db;
