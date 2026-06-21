import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GameEngine, type GameResult, type Achievement } from "../game/engine";
import { useGameStore } from "../game/store";
import { SKINS, POWERUPS, REVIVE_CONFIG, getComboMultiplier, getSkinEffects, type PowerUpType } from "../game/config";
import { audio } from "../game/audio";

export default function Play() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const navigate = useNavigate();

  const equippedId = useGameStore((s) => s.equippedId);
  const setLastRun = useGameStore((s) => s.setLastRun);
  const updateHighScore = useGameStore((s) => s.updateHighScore);
  const addGold = useGameStore((s) => s.addGold);
  const addDiamond = useGameStore((s) => s.addDiamond);
  const addKeys = useGameStore((s) => s.addKeys);
  const getMembershipMultiplier = useGameStore((s) => s.getMembershipMultiplier);
  const submitScoreToServer = useGameStore((s) => s.submitScoreToServer);
  const syncToServer = useGameStore((s) => s.syncToServer);
  // 续命所需: 钻石/钥匙余额与扣减方法
  const diamond = useGameStore((s) => s.diamond);
  const keys = useGameStore((s) => s.keys);
  const spendForRevive = useGameStore((s) => s.spendForRevive);

  const skin = SKINS.find((s) => s.id === equippedId) || SKINS[0];

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboMult, setComboMult] = useState(1);
  const [distance, setDistance] = useState(0);
  const [coins, setCoins] = useState(0);
  const [speed, setSpeed] = useState(20);
  const [powerUpSlots, setPowerUpSlots] = useState<(PowerUpType | null)[]>([
    null,
    null,
    null,
  ]);
  const [activePowerUps, setActivePowerUps] = useState<
    Record<PowerUpType, number>
  >({
    jetpack: 0,
    magnet: 0,
    superShoes: 0,
    scoreMultiplier: 0,
    shield: 0,
  });
  const [slowMotion, setSlowMotion] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [started, setStarted] = useState(false);
  const [achievementToast, setAchievementToast] = useState<Achievement | null>(null);
  // 续命对话框状态
  const [showReviveDialog, setShowReviveDialog] = useState(false);
  const [currentReviveCount, setCurrentReviveCount] = useState(0);
  // 续命信息(是否免费/付费索引/剩余免费次数)
  const [reviveInfo, setReviveInfo] = useState<{
    isFree: boolean;
    paidReviveCount: number;
    freeReviveLeft: number;
    freeReviveCount: number;
  } | null>(null);

  const handleGameOver = useCallback(
    (result: GameResult) => {
      const mult = getMembershipMultiplier();
      const bonusDiamond = Math.floor(result.rewardDiamond * (mult - 1));
      setLastRun({
        ...result,
        rewardDiamond: result.rewardDiamond + bonusDiamond,
        isNewRecord: result.score > useGameStore.getState().highScore,
      });
      updateHighScore(result.score);
      addGold(result.rewardGold);
      const totalDiamond = result.rewardDiamond + bonusDiamond;
      if (totalDiamond > 0) addDiamond(totalDiamond);
      if (result.rewardKeys > 0) addKeys(result.rewardKeys);
      // 异步提交分数到排行榜 + 上传存档
      submitScoreToServer(
        result.score,
        result.distance,
        result.maxCombo,
        result.perfectDodges,
      ).then((rank) => {
        if (rank !== null) console.log(`[排行榜] 本局排名: 第${rank}名`);
      });
      syncToServer();
      setTimeout(() => navigate("/result"), 1500);
    },
    [navigate, setLastRun, updateHighScore, addGold, addDiamond, addKeys, getMembershipMultiplier, submitScoreToServer, syncToServer],
  );

  const handleAchievement = useCallback((ach: Achievement) => {
    // 实时发放成就奖励(应用会员倍率)
    const mult = getMembershipMultiplier();
    const diamond = Math.floor(ach.rewardDiamond * mult);
    if (diamond > 0) addDiamond(diamond);
    if (ach.rewardKeys && ach.rewardKeys > 0) addKeys(ach.rewardKeys);
    setAchievementToast({ ...ach, rewardDiamond: diamond });
    audio.sfxLegendary();
    // 3秒后隐藏提示
    window.setTimeout(() => {
      setAchievementToast((cur) => (cur?.id === ach.id ? null : cur));
    }, 3000);
  }, [addDiamond, addKeys, getMembershipMultiplier]);

  // 续命请求回调: 引擎在玩家死亡且可续命时触发
  const handleReviveRequest = useCallback((reviveCount: number) => {
    setCurrentReviveCount(reviveCount);
    setReviveInfo(engineRef.current?.getReviveInfo() ?? null);
    setShowReviveDialog(true);
  }, []);

  // 免费续命(皮肤效果)
  const handleReviveFree = () => {
    audio.sfxPowerUp();
    engineRef.current?.revive();
    setShowReviveDialog(false);
  };

  // 用钻石续命
  const handleReviveWithDiamond = () => {
    const paidIdx = reviveInfo?.paidReviveCount ?? currentReviveCount;
    const cost = REVIVE_CONFIG.costs[paidIdx]?.diamond ?? 0;
    if (!spendForRevive("diamond", cost)) {
      audio.sfxComboBreak();
      return;
    }
    audio.sfxPowerUp();
    engineRef.current?.revive();
    setShowReviveDialog(false);
  };

  // 用钥匙续命
  const handleReviveWithKeys = () => {
    const paidIdx = reviveInfo?.paidReviveCount ?? currentReviveCount;
    const cost = REVIVE_CONFIG.costs[paidIdx]?.keys ?? 0;
    if (!spendForRevive("keys", cost)) {
      audio.sfxComboBreak();
      return;
    }
    audio.sfxPowerUp();
    engineRef.current?.revive();
    setShowReviveDialog(false);
  };

  // 放弃续命,直接结算
  const handleGiveUpRevive = () => {
    audio.sfxClick();
    setShowReviveDialog(false);
    engineRef.current?.confirmGameOver();
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    audio.init();
    audio.resume();

    const engine = new GameEngine(
      canvasRef.current,
      {
        onScoreUpdate: setScore,
        onComboUpdate: (c, m) => {
          setCombo(c);
          setComboMult(m);
        },
        onDistanceUpdate: setDistance,
        onCoinsUpdate: setCoins,
        onSpeedUpdate: setSpeed,
        onPowerUpSlotsChange: setPowerUpSlots,
        onActivePowerUpsChange: setActivePowerUps,
        onGameOver: handleGameOver,
        onSlowMotion: setSlowMotion,
        onAchievement: handleAchievement,
        onReviveRequest: handleReviveRequest,
      },
      skin.color,
      skin.trailColor,
      getSkinEffects(equippedId),
    );
    engineRef.current = engine;

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    // 倒计时
    let count = 3;
    setCountdown(count);
    const countInterval = setInterval(() => {
      count--;
      setCountdown(count);
      audio.sfxClick();
      if (count <= 0) {
        clearInterval(countInterval);
        setStarted(true);
        engine.start();
        audio.startBGM("play");
      }
    }, 800);

    return () => {
      clearInterval(countInterval);
      window.removeEventListener("resize", handleResize);
      engine.stop();
      audio.stopBGM();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 键盘输入
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!engineRef.current || !started) return;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          engineRef.current.moveLeft();
          break;
        case "ArrowRight":
        case "d":
        case "D":
          engineRef.current.moveRight();
          break;
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          engineRef.current.jump();
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          engineRef.current.slide();
          break;
        case " ":
          e.preventDefault();
          engineRef.current.usePowerUp(0);
          break;
        case "1":
          engineRef.current.usePowerUp(0);
          break;
        case "2":
          engineRef.current.usePowerUp(1);
          break;
        case "3":
          engineRef.current.usePowerUp(2);
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [started]);

  // 触屏输入
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || !engineRef.current || !started) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const threshold = 30;

    if (absDx > absDy && absDx > threshold) {
      if (dx > 0) engineRef.current.moveRight();
      else engineRef.current.moveLeft();
    } else if (absDy > absDx && absDy > threshold) {
      if (dy < 0) engineRef.current.jump();
      else engineRef.current.slide();
    }
    touchStart.current = null;
  };

  const comboInfo = getComboMultiplier(combo);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-neon-bg scanlines"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* 倒计时 */}
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <div
            key={countdown}
            className="text-9xl font-orbitron font-black neon-text-gold animate-pulse"
            style={{ animation: "pulse-glow 0.8s ease-out" }}
          >
            {countdown > 0 ? countdown : "GO!"}
          </div>
        </div>
      )}

      {/* HUD */}
      {started && (
        <>
          {/* 左上: 分数+金币 */}
          <div className="absolute top-4 left-4 z-40 space-y-2">
            <div className="font-orbitron text-4xl font-black neon-text-blue tabular-nums">
              {score.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 font-mono text-lg neon-text-gold">
              <span className="text-2xl">●</span>
              <span className="tabular-nums">{coins}</span>
            </div>
            <div className="font-mono text-sm text-neon-blue/70">
              {distance}m
            </div>
          </div>

          {/* 居中: Combo */}
          {combo > 0 && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 text-center">
              <div
                className="font-orbitron text-6xl font-black tabular-nums"
                style={{
                  color: comboInfo.color,
                  textShadow: `0 0 20px ${comboInfo.color}, 0 0 40px ${comboInfo.color}`,
                  transform: `scale(${1 + Math.min(combo * 0.02, 0.3)})`,
                }}
              >
                {combo}
              </div>
              <div
                className="font-orbitron text-2xl font-bold"
                style={{ color: comboInfo.color }}
              >
                ×{comboMult} COMBO
              </div>
            </div>
          )}

          {/* 右上: 道具槽 */}
          <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
            {powerUpSlots.map((slot, i) => (
              <button
                key={i}
                onClick={() => engineRef.current?.usePowerUp(i)}
                className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${
                  slot
                    ? "holo-button"
                    : "border border-neon-gray/50 bg-neon-gray/20 opacity-40"
                }`}
                style={
                  slot
                    ? {
                        borderColor: POWERUPS[slot].color,
                        boxShadow: `0 0 12px ${POWERUPS[slot].color}80`,
                      }
                    : {}
                }
              >
                {slot ? POWERUPS[slot].icon : <span className="text-xs">空</span>}
              </button>
            ))}
          </div>

          {/* 激活中的道具 */}
          <div className="absolute top-44 right-4 z-40 flex flex-col gap-1">
            {(Object.keys(activePowerUps) as PowerUpType[]).map((type) =>
              activePowerUps[type] > 0 ? (
                <div
                  key={type}
                  className="flex items-center gap-2 font-mono text-xs"
                  style={{ color: POWERUPS[type].color }}
                >
                  <span>{POWERUPS[type].icon}</span>
                  <span>{activePowerUps[type].toFixed(1)}s</span>
                </div>
              ) : null,
            )}
          </div>

          {/* 底部: 速度条 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-64">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-neon-blue/70">SPEED</span>
              <span className="font-orbitron text-sm neon-text-blue tabular-nums">
                {speed.toFixed(0)} m/s
              </span>
            </div>
            <div className="h-2 bg-neon-gray/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min((speed / 50) * 100, 100)}%`,
                  background: `linear-gradient(90deg, ${CONFIG_COLORS.blue}, ${CONFIG_COLORS.pink}, ${CONFIG_COLORS.gold})`,
                  boxShadow: `0 0 10px ${CONFIG_COLORS.blue}`,
                }}
              />
            </div>
          </div>

          {/* 慢镜头提示 */}
          {slowMotion && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="font-orbitron text-4xl font-black neon-text-purple animate-pulse">
                PERFECT DODGE!
              </div>
            </div>
          )}

          {/* 成就触发提示 */}
          {achievementToast && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-float">
              <div
                className="px-6 py-4 rounded-xl text-center"
                style={{
                  background: "rgba(255, 215, 0, 0.15)",
                  border: "2px solid #FFD700",
                  boxShadow: "0 0 30px #FFD700, 0 0 60px #FFD70080",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div className="font-mono text-xs text-neon-gold/80 mb-1">
                  ★ ACHIEVEMENT UNLOCKED ★
                </div>
                <div className="font-orbitron text-2xl font-black neon-text-gold mb-1">
                  {achievementToast.name}
                </div>
                <div className="font-mono text-sm text-neon-blue/80 mb-2">
                  {achievementToast.desc}
                </div>
                <div className="font-orbitron text-sm font-bold flex items-center justify-center gap-3">
                  {achievementToast.rewardDiamond > 0 && (
                    <span className="neon-text-blue">
                      ◆ +{achievementToast.rewardDiamond}
                    </span>
                  )}
                  {achievementToast.rewardKeys && achievementToast.rewardKeys > 0 && (
                    <span className="neon-text-purple">
                      🔑 +{achievementToast.rewardKeys}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 操作提示(前5秒) */}
          {distance < 30 && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 font-mono text-xs text-neon-blue/60 text-center">
              <p>← → 变道 / ↑ 跳跃 / ↓ 滑铲 / 1-3 使用道具</p>
            </div>
          )}
        </>
      )}

      {/* 续命对话框 */}
      {showReviveDialog && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div
            className="relative max-w-sm w-full mx-4 p-6 rounded-2xl"
            style={{
              background: "rgba(10, 10, 20, 0.95)",
              border: "2px solid #FF2D95",
              boxShadow: "0 0 40px #FF2D95, 0 0 80px #FF2D9580",
            }}
          >
            {/* 标题 */}
            <div className="text-center mb-1">
              <div className="font-mono text-xs text-neon-pink/70 mb-1">
                ★ SYSTEM ALERT ★
              </div>
              <h3 className="font-orbitron text-3xl font-black neon-text-pink">
                继续冲刺?
              </h3>
            </div>

            {/* 复活次数指示(含免费复活次数) */}
            <div className="flex items-center justify-center gap-2 my-4 flex-wrap">
              {Array.from({ length: REVIVE_CONFIG.maxRevives }).map((_, i) => {
                // 付费复活槽: 已使用的付费次数高亮
                const paidUsed = reviveInfo?.paidReviveCount ?? 0;
                const used = i < paidUsed;
                return (
                  <div
                    key={`paid-${i}`}
                    className="w-3 h-3 rounded-full transition-all"
                    style={{
                      background: used ? "#FF2D95" : "transparent",
                      border: "1px solid #FF2D95",
                      boxShadow: used ? "0 0 8px #FF2D95" : "none",
                    }}
                  />
                );
              })}
              {Array.from({
                length: reviveInfo?.freeReviveCount ?? 0,
              }).map((_, i) => {
                // 免费复活槽: 剩余的高亮绿色
                const freeLeft = reviveInfo?.freeReviveLeft ?? 0;
                const used = i >= freeLeft;
                return (
                  <div
                    key={`free-${i}`}
                    className="w-3 h-3 rounded-full transition-all"
                    style={{
                      background: used ? "transparent" : "#00FFAA",
                      border: "1px solid #00FFAA",
                      boxShadow: used ? "none" : "0 0 8px #00FFAA",
                    }}
                  />
                );
              })}
              <span className="font-mono text-xs text-neon-pink/70 ml-2">
                第 {currentReviveCount + 1}/
                {REVIVE_CONFIG.maxRevives +
                  (reviveInfo?.freeReviveCount ?? 0)}{" "}
                次复活
              </span>
            </div>

            {/* 当前资产 */}
            <div className="flex items-center justify-center gap-4 mb-4 font-mono text-sm">
              <span className="neon-text-blue">◆ {diamond}</span>
              <span className="neon-text-purple">🔑 {keys}</span>
            </div>

            {/* 免费复活按钮(皮肤效果, 仅有免费次数时显示) */}
            {reviveInfo?.isFree ? (
              <button
                onClick={handleReviveFree}
                className="w-full py-3 mb-3 rounded-xl font-orbitron text-sm transition-all"
                style={{
                  background: "rgba(0, 255, 170, 0.15)",
                  border: "1px solid #00FFAA",
                  boxShadow: "0 0 20px #00FFAA80",
                  color: "#00FFAA",
                }}
              >
                <div>💖 免费复活</div>
                <div className="font-mono text-xs">
                  剩余 {reviveInfo.freeReviveLeft} 次
                </div>
              </button>
            ) : (
              <>
                {/* 钻石复活按钮 */}
                <button
                  onClick={handleReviveWithDiamond}
                  disabled={
                    diamond <
                    (REVIVE_CONFIG.costs[
                      reviveInfo?.paidReviveCount ?? currentReviveCount
                    ]?.diamond ?? 0)
                  }
                  className="w-full py-3 mb-2 rounded-xl font-orbitron text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(0, 212, 255, 0.15)",
                    border: "1px solid #00D4FF",
                    boxShadow: "0 0 15px #00D4FF60",
                    color: "#00D4FF",
                  }}
                >
                  <div>用钻石复活</div>
                  <div className="font-mono text-xs">
                    ◆{" "}
                    {
                      REVIVE_CONFIG.costs[
                        reviveInfo?.paidReviveCount ?? currentReviveCount
                      ]?.diamond
                    }
                  </div>
                </button>

                {/* 钥匙复活按钮 */}
                <button
                  onClick={handleReviveWithKeys}
                  disabled={
                    keys <
                    (REVIVE_CONFIG.costs[
                      reviveInfo?.paidReviveCount ?? currentReviveCount
                    ]?.keys ?? 0)
                  }
                  className="w-full py-3 mb-3 rounded-xl font-orbitron text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(180, 76, 255, 0.15)",
                    border: "1px solid #B44CFF",
                    boxShadow: "0 0 15px #B44CFF60",
                    color: "#B44CFF",
                  }}
                >
                  <div>用钥匙复活</div>
                  <div className="font-mono text-xs">
                    🔑{" "}
                    {
                      REVIVE_CONFIG.costs[
                        reviveInfo?.paidReviveCount ?? currentReviveCount
                      ]?.keys
                    }
                  </div>
                </button>
              </>
            )}

            {/* 放弃按钮 */}
            <button
              onClick={handleGiveUpRevive}
              className="w-full py-2 rounded-xl font-orbitron text-xs neon-text-pink/70 bg-neon-gray/30 hover:bg-neon-gray/50 transition-all"
            >
              放弃 (结算)
            </button>

            <div className="font-mono text-[10px] text-neon-blue/40 text-center mt-3">
              复活后短暂无敌 {REVIVE_CONFIG.invincibleDuration} 秒
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CONFIG_COLORS = {
  blue: "#00D4FF",
  pink: "#FF2D95",
  gold: "#FFD700",
};
