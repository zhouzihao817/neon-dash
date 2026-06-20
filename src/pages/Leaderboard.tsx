import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../game/store";
import { audio } from "../game/audio";
import { api, type LeaderboardEntry } from "../game/api";

export default function Leaderboard() {
  const navigate = useNavigate();
  const account = useGameStore((s) => s.account);
  const highScore = useGameStore((s) => s.highScore);

  const [list, setList] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myBest, setMyBest] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [lbRes, meRes] = await Promise.all([
        api.leaderboard.list(100),
        account.isLoggedIn && !account.isGuest
          ? api.leaderboard.me()
          : Promise.resolve({ rank: null, bestScore: highScore }),
      ]);
      setList(lbRes.leaderboard);
      setMyRank(meRes.rank);
      setMyBest(meRes.bestScore);
    } catch (e) {
      setError("加载失败: " + (e as Error).message + " (请确认后端服务已启动)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    audio.startBGM("menu");
    loadData();
    return () => audio.stopBGM();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRankStyle = (rank: number): { color: string; icon: string } => {
    if (rank === 1) return { color: "#FFD700", icon: "👑" };
    if (rank === 2) return { color: "#C0C0C0", icon: "🥈" };
    if (rank === 3) return { color: "#CD7F32", icon: "🥉" };
    if (rank <= 10) return { color: "#00D4FF", icon: "⭐" };
    return { color: "#888888", icon: `${rank}` };
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-neon-bg scanlines">
      <div className="absolute inset-0 grid-bg opacity-20" />

      {/* 顶部栏 */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between">
        <button
          onClick={() => { audio.sfxClick(); navigate("/"); }}
          className="px-4 py-2 rounded-lg holo-button font-mono text-xs neon-text-blue/70"
        >
          ← 返回
        </button>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 rounded-lg holo-button font-mono text-xs neon-text-blue/70 disabled:opacity-50"
        >
          {loading ? "加载中..." : "🔄 刷新"}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto pt-20 pb-8 px-6 overflow-y-auto h-full">
        {/* 标题 */}
        <div className="text-center mb-6">
          <h1 className="font-orbitron text-4xl font-black neon-text-gold mb-2">
            全球排行榜
          </h1>
          <p className="font-mono text-xs text-neon-pink/70 tracking-widest">
            LEADERBOARD · 顶尖跑者
          </p>
        </div>

        {/* 我的排名 */}
        <div className="mb-6 px-6 py-4 rounded-xl holo-button">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-xs text-neon-blue/60">
                {account.isLoggedIn ? account.username : "游客"}
              </div>
              <div className="font-orbitron text-2xl neon-text-blue">
                {myRank ? `第 ${myRank} 名` : "未上榜"}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs text-neon-blue/60">个人最佳</div>
              <div className="font-orbitron text-2xl neon-text-gold tabular-nums">
                {myBest.toLocaleString()}
              </div>
            </div>
          </div>
          {!account.isLoggedIn || account.isGuest ? (
            <div className="mt-3 pt-3 border-t border-neon-blue/20 font-mono text-xs text-neon-gold/70 text-center">
              💡 登录正式账号后，游戏结束时可自动提交分数到排行榜
            </div>
          ) : null}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-neon-pink/10 border border-neon-pink/50 font-mono text-xs text-neon-pink">
            ⚠ {error}
          </div>
        )}

        {/* 排行榜列表 */}
        {loading ? (
          <div className="text-center py-12 font-mono text-sm text-neon-blue/50">
            加载中...
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏆</div>
            <div className="font-orbitron text-lg neon-text-blue mb-2">
              暂无排行数据
            </div>
            <div className="font-mono text-xs text-neon-blue/50">
              成为第一个上榜的跑者!
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((entry) => {
              const isMe = account.userId === String(entry.userId);
              const rankStyle = getRankStyle(entry.rank);
              return (
                <div
                  key={`${entry.userId}-${entry.createdAt}`}
                  className={`px-4 py-3 rounded-xl flex items-center gap-4 transition-all ${
                    isMe
                      ? "neon-border-gold bg-neon-gold/10"
                      : entry.rank <= 3
                        ? "holo-button"
                        : "bg-neon-gray/20 border border-neon-blue/10"
                  }`}
                >
                  {/* 排名 */}
                  <div
                    className="w-12 text-center font-orbitron text-xl font-bold"
                    style={{ color: rankStyle.color }}
                  >
                    {rankStyle.icon}
                  </div>
                  {/* 用户名 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-orbitron text-sm neon-text-blue truncate flex items-center gap-2">
                      {entry.username}
                      {isMe && (
                        <span className="px-1.5 py-0.5 rounded bg-neon-gold text-neon-bg text-xs font-bold">
                          我
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-neon-blue/50">
                      {entry.distance.toLocaleString()}m · Combo {entry.maxCombo} · {entry.perfectDodges}闪避
                    </div>
                  </div>
                  {/* 分数 */}
                  <div className="text-right">
                    <div className="font-orbitron text-lg neon-text-gold tabular-nums">
                      {entry.score.toLocaleString()}
                    </div>
                    <div className="font-mono text-xs text-neon-blue/40">
                      {new Date(entry.createdAt).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
