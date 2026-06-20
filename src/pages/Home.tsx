import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, MEMBERSHIP_CONFIG } from "../game/store";
import { audio } from "../game/audio";
import { SKINS } from "../game/config";

export default function Home() {
  const navigate = useNavigate();
  const gold = useGameStore((s) => s.gold);
  const diamond = useGameStore((s) => s.diamond);
  const keys = useGameStore((s) => s.keys);
  const highScore = useGameStore((s) => s.highScore);
  const equippedId = useGameStore((s) => s.equippedId);
  const canSignToday = useGameStore((s) => s.canSignToday);
  const dailySign = useGameStore((s) => s.dailySign);
  const dailySignDays = useGameStore((s) => s.dailySignDays);
  const account = useGameStore((s) => s.account);
  const membership = useGameStore((s) => s.membership);
  const isMembershipActive = useGameStore((s) => s.isMembershipActive);

  const skin = SKINS.find((s) => s.id === equippedId) || SKINS[0];
  const memberActive = isMembershipActive();
  const memberConfig = MEMBERSHIP_CONFIG[membership.tier];

  useEffect(() => {
    audio.init();
    audio.startBGM("menu");
    return () => audio.stopBGM();
  }, []);

  const handleStart = () => {
    audio.resume();
    audio.sfxClick();
    navigate("/play");
  };

  const handleNav = (path: string) => {
    audio.sfxClick();
    navigate(path);
  };

  const handleSign = () => {
    if (canSignToday()) {
      dailySign();
      audio.sfxPowerUp();
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-neon-bg scanlines">
      {/* 背景网格 */}
      <div className="absolute inset-0 grid-bg opacity-30" />

      {/* 远景城市剪影 */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none">
        <CityScape />
      </div>

      {/* 全息广告滚动 */}
      <div className="absolute top-8 right-8 pointer-events-none">
        <div className="font-orbitron text-xs neon-text-pink animate-neon-flicker opacity-60">
          OmniCorp 禁速令生效中
        </div>
        <div className="font-mono text-xs text-neon-blue/40 mt-1">
          v2077.06.19
        </div>
      </div>

      {/* 玩家信息 */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg holo-button">
          <span className="text-neon-gold text-lg">●</span>
          <span className="font-orbitron text-sm neon-text-gold tabular-nums">
            {gold.toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => handleNav("/recharge")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg holo-button transition-transform hover:scale-105"
          title="点击充值"
        >
          <span className="text-neon-blue text-lg">◆</span>
          <span className="font-orbitron text-sm neon-text-blue tabular-nums">
            {diamond}
          </span>
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg holo-button">
          <span className="text-neon-purple text-lg">🔑</span>
          <span className="font-orbitron text-sm neon-text-purple tabular-nums">
            {keys}
          </span>
        </div>
        {memberActive && (
          <button
            onClick={() => handleNav("/membership")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-orbitron text-xs"
            style={{
              background: `${memberConfig.color}20`,
              border: `1px solid ${memberConfig.color}`,
              color: memberConfig.color,
            }}
          >
            <span>{memberConfig.icon}</span>
            <span>{memberConfig.name}</span>
          </button>
        )}
      </div>

      {/* 账号入口 */}
      <button
        onClick={() => handleNav("/login")}
        className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-lg holo-button font-mono text-xs neon-text-blue/80 flex items-center gap-2"
      >
        <span>{account.isLoggedIn ? (account.isGuest ? "👤" : "🎮") : "🔐"}</span>
        <span>{account.isLoggedIn ? account.username : "登录"}</span>
      </button>

      {/* 签到按钮 */}
      {canSignToday() && (
        <button
          onClick={handleSign}
          className="absolute top-20 left-4 z-30 px-4 py-2 rounded-lg holo-button font-orbitron text-sm neon-text-gold animate-pulse"
        >
          每日签到 Day {dailySignDays + 1}
        </button>
      )}

      {/* 中央角色+开始按钮 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        {/* 角色立绘 */}
        <div className="relative mb-8 animate-float">
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle, ${skin.color}40, transparent)`,
              boxShadow: `0 0 40px ${skin.color}, 0 0 80px ${skin.color}80`,
            }}
          >
            <div
              className="w-20 h-20 rounded-full"
              style={{
                background: skin.color,
                boxShadow: `0 0 30px ${skin.color}`,
              }}
            />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-orbitron text-sm neon-text-blue whitespace-nowrap">
            {skin.name}
          </div>
        </div>

        {/* 标题 */}
        <h1 className="font-orbitron text-6xl font-black mb-2 neon-text-blue tracking-wider">
          霓虹冲刺
        </h1>
        <p className="font-mono text-sm text-neon-pink/80 mb-8 tracking-widest">
          NEON DASH
        </p>

        {/* 开始按钮 */}
        <button
          onClick={handleStart}
          className="relative px-12 py-4 rounded-xl font-orbitron text-2xl font-bold neon-text-gold animate-pulse-glow transition-transform hover:scale-105"
          style={{
            background: "rgba(255, 215, 0, 0.1)",
            border: "2px solid #FFD700",
          }}
        >
          开 始 跑 酷
        </button>

        {/* 最高分 */}
        {highScore > 0 && (
          <div className="mt-6 font-mono text-sm text-neon-blue/60">
            最高分: <span className="neon-text-blue tabular-nums">{highScore.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 功能按钮 */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3">
        <FuncButton icon="🛒" label="商城" onClick={() => handleNav("/shop")} />
        <FuncButton icon="🎁" label="抽奖" onClick={() => handleNav("/lottery")} />
        <FuncButton icon="🏆" label="排行" onClick={() => handleNav("/leaderboard")} />
        <FuncButton icon="👤" label="角色" onClick={() => handleNav("/shop")} />
        <FuncButton icon="💎" label="会员" onClick={() => handleNav("/membership")} />
        <FuncButton icon="⚙️" label="设置" onClick={() => audio.sfxClick()} />
        <FuncButton icon="🧪" label="测试" onClick={() => handleNav("/test")} />
      </div>

      {/* 底部操作提示 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 font-mono text-xs text-neon-blue/40">
        在霓虹都市极速穿梭，用跑酷对抗体制
      </div>
    </div>
  );
}

function FuncButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-16 h-16 rounded-xl holo-button flex flex-col items-center justify-center gap-1 group"
    >
      <span className="text-2xl group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="font-mono text-xs neon-text-blue">{label}</span>
    </button>
  );
}

function CityScape() {
  const buildings = Array.from({ length: 30 }, (_, i) => i);
  return (
    <svg
      viewBox="0 0 1200 400"
      preserveAspectRatio="none"
      className="w-full h-full"
    >
      {buildings.map((i) => {
        const x = i * 42;
        const h = 80 + Math.sin(i * 1.7) * 60 + (i % 4) * 30;
        const colors = ["#00D4FF", "#FF2D95", "#B44CFF", "#FFD700"];
        const color = colors[i % 4];
        return (
          <g key={i}>
            <rect
              x={x}
              y={400 - h}
              width={38}
              height={h}
              fill="rgba(20, 20, 40, 0.9)"
            />
            {Array.from({ length: Math.floor(h / 12) }).map((_, wy) => (
              <rect
                key={wy}
                x={x + 4 + (wy % 2) * 16}
                y={400 - h + 8 + wy * 12}
                width={4}
                height={4}
                fill={color}
                opacity={0.3 + Math.sin(i + wy) * 0.2}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
