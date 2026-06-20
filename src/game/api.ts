// 后端 API 封装

const API_BASE =
  (import.meta as unknown as { env: { VITE_API_BASE?: string } }).env
    .VITE_API_BASE || "http://localhost:3001/api";

const TOKEN_KEY = "neon-dash-token";

// Token 管理
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

// 统一请求函数
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const t = token.get();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `请求失败 ${res.status}`);
  }
  return data as T;
}

// === 类型定义 ===
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

// === API 方法 ===
export const api = {
  // 认证
  auth: {
    register: (username: string, password: string) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    login: (username: string, password: string) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    me: () => request<{ user: { id: number; username: string } }>("/auth/me"),
  },

  // 存档
  save: {
    get: () => request<SaveResponse>("/save"),
    upload: (data: SaveData) =>
      request<{ success: boolean; updatedAt: number }>("/save", {
        method: "POST",
        body: JSON.stringify({ data }),
      }),
  },

  // 充值
  recharge: {
    createOrder: (packageId: string) =>
      request<OrderResponse>("/recharge/order", {
        method: "POST",
        body: JSON.stringify({ packageId }),
      }),
    confirm: (orderId: string) =>
      request<ConfirmResponse>("/recharge/confirm", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      }),
    orders: () =>
      request<{ orders: unknown[] }>("/recharge/orders"),
  },

  // 排行榜
  leaderboard: {
    submit: (score: number, distance: number, maxCombo: number, perfectDodges: number) =>
      request<{ success: boolean; rank: number }>("/leaderboard/submit", {
        method: "POST",
        body: JSON.stringify({ score, distance, maxCombo, perfectDodges }),
      }),
    list: (limit = 100) =>
      request<LeaderboardResponse>(`/leaderboard?limit=${limit}`),
    me: () => request<MyRankResponse>("/leaderboard/me"),
  },

  // 健康检查
  health: () => request<{ status: string; time: number }>("/health"),
};
