import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../game/store";
import { audio } from "../game/audio";
import {
  SKINS,
  LOTTERY,
  RARITY_NAMES,
  RARITY_COLORS,
  type Rarity,
} from "../game/config";

interface LotteryResult {
  rarity: Rarity;
  skinId: string;
  isNew: boolean;
}

export default function Lottery() {
  const navigate = useNavigate();
  const keys = useGameStore((s) => s.keys);
  const gold = useGameStore((s) => s.gold);
  const diamond = useGameStore((s) => s.diamond);
  const pityCounter = useGameStore((s) => s.pityCounter);
  const lottery = useGameStore((s) => s.lottery);
  const skins = useGameStore((s) => s.skins);
  const fragments = useGameStore((s) => s.fragments);
  const synthesizeSkin = useGameStore((s) => s.synthesizeSkin);

  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState<LotteryResult[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [chestPhase, setChestPhase] = useState<
    "idle" | "key" | "charge" | "shake" | "explode"
  >("idle");

  const handleBack = () => {
    audio.sfxClick();
    navigate("/");
  };

  const handleLottery = async (count: 1 | 10) => {
    if (spinning) return;
    const cost = count === 1 ? LOTTERY.cost.single : LOTTERY.cost.ten;
    if (keys < cost) {
      audio.sfxComboBreak();
      return;
    }

    setSpinning(true);
    setResults(null);
    setShowResults(false);

    // 宝箱动画序列
    setChestPhase("key");
    audio.sfxLotterySpin();
    await delay(500);

    setChestPhase("charge");
    audio.sfxLotterySpin();
    await delay(800);

    setChestPhase("shake");
    for (let i = 0; i < 5; i++) {
      audio.sfxLotterySpin();
      await delay(100);
    }
    await delay(300);

    setChestPhase("explode");
    audio.sfxLotteryOpen();

    // 执行抽奖
    const res = lottery(count);
    if (!res) {
      setSpinning(false);
      setChestPhase("idle");
      return;
    }

    await delay(600);

    // 检查是否有传说
    const hasLegendary = res.some((r) => r.rarity === 3);
    if (hasLegendary) {
      audio.sfxLegendary();
    }

    setResults(res);
    setShowResults(true);
    setChestPhase("idle");
    setSpinning(false);
  };

  const handleCloseResults = () => {
    audio.sfxClick();
    setShowResults(false);
    setResults(null);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-neon-bg scanlines flex flex-col">
      <div className="absolute inset-0 grid-bg opacity-20" />

      {/* 顶栏 */}
      <div className="relative z-10 flex items-center justify-between p-4 border-b border-neon-purple/30">
        <button
          onClick={handleBack}
          className="px-4 py-2 rounded-lg holo-button font-orbitron text-sm neon-text-blue"
        >
          ← 返回
        </button>
        <h2 className="font-orbitron text-2xl font-black neon-text-purple">
          幸运抽奖
        </h2>
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg holo-button flex items-center gap-2">
            <span className="text-neon-purple">🔑</span>
            <span className="font-orbitron text-sm neon-text-purple tabular-nums">
              {keys}
            </span>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        {/* 宝箱 */}
        <div className="relative mb-8">
          <Chest phase={chestPhase} />
          {spinning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full animate-ping border-2 border-neon-purple opacity-30" />
            </div>
          )}
        </div>

        {/* 抽奖按钮 */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => handleLottery(1)}
            disabled={spinning || keys < 1}
            className="px-6 py-3 rounded-xl holo-button font-orbitron text-sm neon-text-blue disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <div>单抽</div>
            <div className="font-mono text-xs">🔑 ×1</div>
          </button>
          <button
            onClick={() => handleLottery(10)}
            disabled={spinning || keys < 9}
            className="px-6 py-3 rounded-xl holo-button font-orbitron text-sm neon-text-purple disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <div>十连抽</div>
            <div className="font-mono text-xs">🔑 ×9 (9折)</div>
          </button>
        </div>

        {/* 保底进度 */}
        <div className="w-full max-w-md space-y-2">
          <div className="font-orbitron text-sm neon-text-blue mb-2">
            ▸ 保底进度
          </div>
          {[
            { label: "稀有保底", current: pityCounter.rare, max: LOTTERY.pity[0], color: "blue" },
            { label: "史诗保底", current: pityCounter.epic, max: LOTTERY.pity[1], color: "purple" },
            { label: "传说保底", current: pityCounter.legendary, max: LOTTERY.pity[2], color: "gold" },
          ].map((p) => (
            <div key={p.label} className="flex items-center gap-2">
              <span className="font-mono text-xs text-neon-blue/60 w-20">
                {p.label}
              </span>
              <div className="flex-1 h-2 bg-neon-gray/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(p.current / p.max) * 100}%`,
                    background: RARITY_COLORS[
                      p.color === "blue" ? 1 : p.color === "purple" ? 2 : 3
                    ],
                    boxShadow: `0 0 8px ${
                      RARITY_COLORS[
                        p.color === "blue" ? 1 : p.color === "purple" ? 2 : 3
                      ]
                    }`,
                  }}
                />
              </div>
              <span className="font-mono text-xs neon-text-blue/60 w-12 text-right">
                {p.current}/{p.max}
              </span>
            </div>
          ))}
        </div>

        {/* 奖池概率 */}
        <div className="mt-6 w-full max-w-md">
          <div className="font-orbitron text-sm neon-text-blue mb-2">
            ▸ 奖池概率
          </div>
          <div className="grid grid-cols-4 gap-2">
            {RARITY_NAMES.map((name, i) => (
              <div
                key={i}
                className="p-2 rounded-lg text-center"
                style={{
                  border: `1px solid ${RARITY_COLORS[i]}40`,
                  background: `${RARITY_COLORS[i]}10`,
                }}
              >
                <div
                  className="font-orbitron text-xs"
                  style={{ color: RARITY_COLORS[i] }}
                >
                  {name}
                </div>
                <div className="font-mono text-xs text-neon-blue/60">
                  {(LOTTERY.probs[i] * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 碎片合成 */}
        <div className="mt-6 w-full max-w-md">
          <div className="font-orbitron text-sm neon-text-blue mb-2">
            ▸ 碎片合成
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {SKINS.filter((s) => s.rarity >= 1 && !skins.includes(s.id)).map(
              (skin) => {
                const have = fragments[skin.id] || 0;
                const need = LOTTERY.fragmentNeed[skin.rarity];
                const canSyn = have >= need;
                return (
                  <div
                    key={skin.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-neon-gray/30"
                  >
                    <span
                      className="font-mono text-xs"
                      style={{ color: RARITY_COLORS[skin.rarity] }}
                    >
                      {skin.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-neon-blue/60">
                        {have}/{need}
                      </span>
                      <button
                        onClick={() => {
                          if (synthesizeSkin(skin.id)) audio.sfxLegendary();
                          else audio.sfxComboBreak();
                        }}
                        disabled={!canSyn}
                        className="px-2 py-0.5 rounded font-mono text-xs neon-text-gold bg-neon-gold/10 disabled:opacity-30"
                      >
                        合成
                      </button>
                    </div>
                  </div>
                );
              },
            )}
            {SKINS.filter((s) => s.rarity >= 1 && !skins.includes(s.id))
              .length === 0 && (
              <div className="font-mono text-xs text-neon-blue/40 text-center py-2">
                所有可合成皮肤已拥有
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 抽奖结果弹窗 */}
      {showResults && results && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-2xl w-full mx-4 p-6 rounded-2xl neon-border-purple bg-neon-bg/90">
            <h3 className="font-orbitron text-2xl font-black neon-text-purple text-center mb-4">
              抽奖结果
            </h3>
            <div
              className={`grid gap-3 ${
                results.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-2 md:grid-cols-5"
              }`}
            >
              {results.map((r, i) => {
                const skin = SKINS.find((s) => s.id === r.skinId)!;
                const color = RARITY_COLORS[r.rarity];
                return (
                  <div
                    key={i}
                    className="p-3 rounded-xl text-center animate-float"
                    style={{
                      border: `2px solid ${color}`,
                      boxShadow: `0 0 20px ${color}`,
                      background: `${color}10`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  >
                    {r.isNew && (
                      <div className="font-orbitron text-xs neon-text-gold mb-1">
                        NEW!
                      </div>
                    )}
                    <div
                      className="w-12 h-12 mx-auto rounded-full mb-2"
                      style={{
                        background: skin.color,
                        boxShadow: `0 0 15px ${skin.color}`,
                      }}
                    />
                    <div
                      className="font-orbitron text-xs mb-1"
                      style={{ color: color }}
                    >
                      {RARITY_NAMES[r.rarity]}
                    </div>
                    <div
                      className="font-mono text-xs"
                      style={{ color: skin.color }}
                    >
                      {skin.name}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleCloseResults}
              className="mt-4 w-full py-2 rounded-lg holo-button font-orbitron neon-text-blue"
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function Chest({
  phase,
}: {
  phase: "idle" | "key" | "charge" | "shake" | "explode";
}) {
  const glowIntensity =
    phase === "idle"
      ? 20
      : phase === "key"
        ? 30
        : phase === "charge"
          ? 50
          : phase === "shake"
            ? 80
            : 120;

  const shake =
    phase === "shake"
      ? `translate(${Math.random() * 8 - 4}px, ${Math.random() * 8 - 4}px)`
      : phase === "explode"
        ? "scale(1.3)"
        : "translate(0, 0)";

  return (
    <div
      className="relative transition-transform duration-100"
      style={{
        transform: shake,
      }}
    >
      <svg
        width="160"
        height="140"
        viewBox="0 0 160 140"
        style={{
          filter: `drop-shadow(0 0 ${glowIntensity}px #B44CFF)`,
        }}
      >
        {/* 宝箱主体 */}
        <rect
          x="30"
          y="60"
          width="100"
          height="60"
          rx="4"
          fill="#2A2A3E"
          stroke="#B44CFF"
          strokeWidth="2"
        />
        {/* 宝箱盖 */}
        <path
          d="M 30 60 Q 30 30 80 30 Q 130 30 130 60"
          fill="#1a1a2e"
          stroke="#B44CFF"
          strokeWidth="2"
        />
        {/* 全息纹路 */}
        <line x1="30" y1="80" x2="130" y2="80" stroke="#00D4FF" strokeWidth="1" opacity="0.6" />
        <line x1="30" y1="100" x2="130" y2="100" stroke="#00D4FF" strokeWidth="1" opacity="0.4" />
        {/* 锁孔 */}
        <circle cx="80" cy="60" r="6" fill="#FFD700" opacity="0.8" />
        <rect x="78" y="60" width="4" height="8" fill="#FFD700" opacity="0.8" />
        {/* 装饰光点 */}
        <circle cx="50" cy="90" r="2" fill="#FF2D95" opacity={phase !== "idle" ? 1 : 0.5} />
        <circle cx="110" cy="90" r="2" fill="#00D4FF" opacity={phase !== "idle" ? 1 : 0.5} />
        <circle cx="80" cy="110" r="2" fill="#FFD700" opacity={phase !== "idle" ? 1 : 0.5} />
      </svg>
      {phase === "explode" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 rounded-full bg-neon-gold/40 animate-ping" />
        </div>
      )}
    </div>
  );
}
