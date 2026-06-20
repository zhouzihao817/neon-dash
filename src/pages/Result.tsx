import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../game/store";
import { audio } from "../game/audio";

export default function Result() {
  const navigate = useNavigate();
  const lastRun = useGameStore((s) => s.lastRun);
  const highScore = useGameStore((s) => s.highScore);

  const [showItems, setShowItems] = useState(0);

  useEffect(() => {
    audio.startBGM("result");
    const timers: number[] = [];
    [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => {
      timers.push(
        window.setTimeout(() => {
          setShowItems(i + 1);
          if (i < 4) audio.sfxPopup();
          else if (i === 4 && lastRun?.isNewRecord) audio.sfxLegendary();
          else if (i === 4) audio.sfxPowerUp();
          else if (i >= 5) audio.sfxPopup();
        }, 300 + i * 250),
      );
    });
    return () => {
      timers.forEach(clearTimeout);
      audio.stopBGM();
    };
  }, [lastRun]);

  if (!lastRun) {
    navigate("/");
    return null;
  }

  const items = [
    { label: "奔跑距离", value: `${lastRun.distance} m`, color: "blue" },
    { label: "收集金币", value: `${lastRun.coins}`, color: "gold" },
    { label: "最高Combo", value: `${lastRun.maxCombo}`, color: "purple" },
    { label: "极限闪避", value: `${lastRun.perfectDodges}`, color: "pink" },
  ];

  return (
    <div className="relative w-full h-full overflow-hidden bg-neon-bg scanlines flex flex-col items-center justify-center">
      <div className="absolute inset-0 grid-bg opacity-20" />

      {/* 新纪录提示 */}
      {lastRun.isNewRecord && showItems >= 5 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30">
          <div className="font-orbitron text-3xl font-black neon-text-gold animate-pulse-glow">
            ★ NEW RECORD ★
          </div>
        </div>
      )}

      {/* 标题 */}
      <div className="mb-8 z-10">
        <h2 className="font-orbitron text-4xl font-black neon-text-pink text-center">
          跑酷结束
        </h2>
        <p className="font-mono text-xs text-neon-blue/50 text-center mt-2">
          RUN COMPLETE
        </p>
      </div>

      {/* 最终得分 */}
      {showItems >= 5 && (
        <div className="mb-8 z-10 text-center animate-float">
          <div className="font-mono text-sm text-neon-blue/60 mb-2">最终得分</div>
          <div className="font-orbitron text-7xl font-black neon-text-gold tabular-nums">
            {lastRun.score.toLocaleString()}
          </div>
        </div>
      )}

      {/* 数据明细 */}
      <div className="grid grid-cols-2 gap-4 mb-8 z-10">
        {items.map((item, i) => (
          <div
            key={i}
            className={`px-6 py-3 rounded-lg holo-button transition-all duration-500 ${
              showItems > i
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <div className="font-mono text-xs text-neon-blue/60">
              {item.label}
            </div>
            <div
              className={`font-orbitron text-2xl font-bold tabular-nums neon-text-${item.color}`}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* 奖励 */}
      {showItems >= 6 && (
        <div className="mb-6 z-10 flex gap-3 flex-wrap justify-center">
          <div className="px-4 py-2 rounded-lg neon-border-gold bg-neon-gold/10 flex items-center gap-2">
            <span className="font-mono text-xs text-neon-gold/80">金币</span>
            <span className="font-orbitron text-lg font-bold neon-text-gold tabular-nums">
              +{lastRun.rewardGold}
            </span>
          </div>
          {lastRun.rewardDiamond > 0 && (
            <div className="px-4 py-2 rounded-lg neon-border-blue bg-neon-blue/10 flex items-center gap-2">
              <span className="font-mono text-xs text-neon-blue/80">钻石</span>
              <span className="font-orbitron text-lg font-bold neon-text-blue tabular-nums">
                +{lastRun.rewardDiamond}
              </span>
            </div>
          )}
          {lastRun.rewardKeys > 0 && (
            <div className="px-4 py-2 rounded-lg neon-border-purple bg-neon-purple/10 flex items-center gap-2">
              <span className="font-mono text-xs text-neon-purple/80">钥匙</span>
              <span className="font-orbitron text-lg font-bold neon-text-purple tabular-nums">
                +{lastRun.rewardKeys}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 按钮 */}
      {showItems >= 8 && (
        <div className="flex gap-4 z-10">
          <button
            onClick={() => {
              audio.sfxClick();
              navigate("/");
            }}
            className="px-8 py-3 rounded-xl holo-button font-orbitron text-lg neon-text-blue"
          >
            返回主界面
          </button>
          <button
            onClick={() => {
              audio.sfxClick();
              navigate("/play");
            }}
            className="px-8 py-3 rounded-xl font-orbitron text-lg font-bold neon-text-gold animate-pulse-glow"
            style={{
              background: "rgba(255, 215, 0, 0.1)",
              border: "2px solid #FFD700",
            }}
          >
            再战一局
          </button>
        </div>
      )}

      {/* 最高分对比 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-xs text-neon-blue/40 z-10">
        历史最高: {highScore.toLocaleString()}
      </div>
    </div>
  );
}
