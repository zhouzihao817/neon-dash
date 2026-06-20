import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GameEngine } from "../game/engine";
import { MOCK_SCENARIOS, getInitialLane, type MockScenario } from "../game/mockData";
import { OBSTACLES, POWERUPS, type PowerUpType } from "../game/config";
import { audio } from "../game/audio";
import { decideAction, executeDecision, resetAILog } from "../game/aiController";

export default function Test() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const navigate = useNavigate();

  const [selectedScenario, setSelectedScenario] = useState<MockScenario>(MOCK_SCENARIOS[0]);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [testState, setTestState] = useState<ReturnType<GameEngine["getTestState"]> | null>(null);
  const [autoAction, setAutoAction] = useState(false);
  const [aiDecision, setAiDecision] = useState<{
    action: string;
    reason: string;
    urgency: string;
  } | null>(null);
  const [aiLog, setAiLog] = useState<string[]>([]);

  const initEngine = useCallback(() => {
    if (!canvasRef.current) return;
    audio.init();

    const engine = new GameEngine(
      canvasRef.current,
      {
        onScoreUpdate: () => {},
        onComboUpdate: () => {},
        onDistanceUpdate: () => {},
        onCoinsUpdate: () => {},
        onSpeedUpdate: () => {},
        onPowerUpSlotsChange: () => {},
        onActivePowerUpsChange: () => {},
        onGameOver: () => {
          setRunning(false);
        },
        onSlowMotion: () => {},
      },
      "#00D4FF",
      "#00D4FF",
    );
    engineRef.current = engine;

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      engine.stop();
    };
  }, []);

  useEffect(() => {
    const cleanup = initEngine();
    return cleanup;
  }, [initEngine]);

  // 更新日志和状态
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      if (engineRef.current) {
        setLogs([...engineRef.current.getTestLog()]);
        setTestState(engineRef.current.getTestState());
      }
    }, 100);
    return () => clearInterval(interval);
  }, [running]);

  // AI自动决策执行
  useEffect(() => {
    if (!autoAction || !running || !engineRef.current) return;

    const interval = setInterval(() => {
      if (!engineRef.current) return;
      const state = engineRef.current.getTestState();
      if (state.state !== "running") return;

      // AI决策
      const decision = decideAction(engineRef.current);
      setAiDecision({
        action: decision.action,
        reason: decision.reason,
        urgency: decision.urgency,
      });

      // 执行操作(高紧急度才执行，避免误操作)
      if (decision.urgency === "high" || decision.urgency === "medium") {
        const executed = executeDecision(engineRef.current, decision);
        if (executed) {
          const logEntry = `[${state.distance}m] ${decision.reason}`;
          setAiLog((prev) => [...prev.slice(-15), logEntry]);
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [autoAction, running]);

  const handleStartScenario = () => {
    if (!engineRef.current) return;
    audio.resume();
    setLogs([]);
    setAiLog([]);
    setAiDecision(null);
    resetAILog();
    console.clear();
    console.log(
      "%c===== 开始测试场景: " + selectedScenario.name + " =====",
      "color: #FFD700; font-weight: bold; font-size: 14px",
    );
    setRunning(true);
    engineRef.current.startTestMode(
      selectedScenario.entities,
      getInitialLane(selectedScenario.id),
    );
  };

  const handleStop = () => {
    engineRef.current?.stop();
    setRunning(false);
  };

  const handleBack = () => {
    engineRef.current?.stop();
    audio.sfxClick();
    navigate("/");
  };

  // 手动操作
  const handleAction = (action: string) => {
    if (!engineRef.current || !running) return;
    audio.sfxClick();
    switch (action) {
      case "left":
        engineRef.current.moveLeft();
        break;
      case "right":
        engineRef.current.moveRight();
        break;
      case "jump":
        engineRef.current.jump();
        break;
      case "slide":
        engineRef.current.slide();
        break;
    }
  };

  // 键盘控制
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!running) return;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
          handleAction("left");
          break;
        case "ArrowRight":
        case "d":
          handleAction("right");
          break;
        case "ArrowUp":
        case "w":
          e.preventDefault();
          handleAction("jump");
          break;
        case "ArrowDown":
        case "s":
          e.preventDefault();
          handleAction("slide");
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [running]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-neon-bg scanlines flex">
      {/* 左侧: Canvas + 控制 */}
      <div className="flex-1 flex flex-col">
        {/* 顶栏 */}
        <div className="flex items-center justify-between p-3 border-b border-neon-blue/30 z-10">
          <button
            onClick={handleBack}
            className="px-3 py-1.5 rounded-lg holo-button font-orbitron text-xs neon-text-blue"
          >
            ← 返回
          </button>
          <h2 className="font-orbitron text-lg font-black neon-text-purple">
            碰撞逻辑测试
          </h2>
          <div className="flex gap-2">
            <button
              onClick={running ? handleStop : handleStartScenario}
              className={`px-4 py-1.5 rounded-lg font-orbitron text-xs ${
                running
                  ? "neon-border-pink text-neon-pink"
                  : "holo-button neon-text-blue"
              }`}
            >
              {running ? "停止" : "开始测试"}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          {!running && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
              <div className="text-center">
                <div className="font-orbitron text-2xl neon-text-blue mb-2">
                  选择场景后点击"开始测试"
                </div>
                <div className="font-mono text-xs text-neon-blue/60">
                  键盘: ←→变道 / ↑跳跃 / ↓滑铲
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="p-3 border-t border-neon-blue/30 grid grid-cols-4 gap-2">
          <button
            onClick={() => handleAction("left")}
            disabled={!running}
            className="py-2 rounded-lg holo-button font-orbitron text-sm neon-text-blue disabled:opacity-30"
          >
            ← 变道左
          </button>
          <button
            onClick={() => handleAction("jump")}
            disabled={!running}
            className="py-2 rounded-lg holo-button font-orbitron text-sm neon-text-blue disabled:opacity-30"
          >
            ↑ 跳跃
          </button>
          <button
            onClick={() => handleAction("slide")}
            disabled={!running}
            className="py-2 rounded-lg holo-button font-orbitron text-sm neon-text-blue disabled:opacity-30"
          >
            ↓ 滑铲
          </button>
          <button
            onClick={() => handleAction("right")}
            disabled={!running}
            className="py-2 rounded-lg holo-button font-orbitron text-sm neon-text-blue disabled:opacity-30"
          >
            → 变道右
          </button>
        </div>
      </div>

      {/* 右侧: 场景选择 + 日志 + 状态 */}
      <div className="w-96 border-l border-neon-blue/30 flex flex-col bg-neon-bg/80">
        {/* 场景选择 */}
        <div className="p-3 border-b border-neon-blue/30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-orbitron text-sm neon-text-blue">测试场景</h3>
            <label className="flex items-center gap-1 font-mono text-xs text-neon-blue/60 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAction}
                onChange={(e) => setAutoAction(e.target.checked)}
                className="accent-neon-blue"
              />
              自动操作
            </label>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {MOCK_SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedScenario(s);
                  setLogs([]);
                  setTestState(null);
                }}
                className={`w-full text-left p-2 rounded-lg font-mono text-xs transition-all ${
                  selectedScenario.id === s.id
                    ? "holo-button neon-text-blue"
                    : "bg-neon-gray/30 text-neon-blue/60 hover:bg-neon-gray/50"
                }`}
              >
                <div className="font-orbitron text-xs">{s.name}</div>
                <div className="text-neon-blue/40 mt-0.5">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 场景详情 */}
        <div className="p-3 border-b border-neon-blue/30">
          <h3 className="font-orbitron text-sm neon-text-purple mb-2">场景详情</h3>
          <div className="space-y-1 font-mono text-xs">
            <div className="text-neon-blue/60">
              期望操作: <span className="neon-text-blue">{selectedScenario.expect.action}</span>
            </div>
            <div className="text-neon-blue/60">
              期望结果:{" "}
              <span
                className={
                  selectedScenario.expect.result === "pass"
                    ? "neon-text-blue"
                    : selectedScenario.expect.result === "crash"
                      ? "neon-text-pink"
                      : "neon-text-gold"
                }
              >
                {selectedScenario.expect.result}
              </span>
            </div>
            <div className="text-neon-blue/40">{selectedScenario.expect.note}</div>
          </div>
          <div className="mt-2 pt-2 border-t border-neon-blue/20">
            <div className="font-mono text-xs text-neon-blue/60 mb-1">实体列表:</div>
            {selectedScenario.entities.map((e, i) => (
              <div key={i} className="font-mono text-xs text-neon-blue/50 flex gap-2">
                <span className="neon-text-gold">#{i + 1}</span>
                <span>z={e.z}m</span>
                <span>车道={e.lane}</span>
                <span>
                  {e.type === "coin"
                    ? "金币"
                    : e.type === "powerup"
                      ? `道具:${e.subtype}`
                      : OBSTACLES[e.type as keyof typeof OBSTACLES]?.name || e.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 实时状态 */}
        {testState && (
          <div className="p-3 border-b border-neon-blue/30">
            <h3 className="font-orbitron text-sm neon-text-gold mb-2">实时状态</h3>
            <div className="grid grid-cols-2 gap-1 font-mono text-xs">
              <StateItem label="状态" value={testState.state} color={testState.state === "gameover" ? "pink" : "blue"} />
              <StateItem label="距离" value={`${testState.distance}m`} color="blue" />
              <StateItem label="金币" value={`${testState.coins}`} color="gold" />
              <StateItem label="Combo" value={`${testState.combo}`} color="purple" />
              <StateItem label="闪避" value={`${testState.dodges}`} color="blue" />
              <StateItem label="极限闪避" value={`${testState.perfectDodges}`} color="pink" />
              <StateItem label="车道" value={`${testState.playerLane}`} color="blue" />
              <StateItem label="高度" value={`${testState.playerY.toFixed(1)}`} color="blue" />
              <StateItem label="跳跃" value={testState.isJumping ? "是" : "否"} color="blue" />
              <StateItem label="滑铲" value={testState.isSliding ? "是" : "否"} color="blue" />
              <StateItem label="剩余实体" value={`${testState.entitiesCount}`} color="blue" />
            </div>
          </div>
        )}

        {/* AI决策面板 */}
        {autoAction && aiDecision && (
          <div className="p-3 border-b border-neon-purple/30">
            <h3 className="font-orbitron text-sm neon-text-purple mb-2">AI决策</h3>
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between px-2 py-1 rounded bg-neon-gray/30">
                <span className="text-neon-blue/50">操作</span>
                <span
                  className={
                    aiDecision.action === "jump"
                      ? "neon-text-blue"
                      : aiDecision.action === "slide"
                        ? "neon-text-purple"
                        : aiDecision.action === "left" || aiDecision.action === "right"
                          ? "neon-text-pink"
                          : "text-neon-blue/60"
                  }
                >
                  {aiDecision.action === "jump"
                    ? "↑ 跳跃"
                    : aiDecision.action === "slide"
                      ? "↓ 滑铲"
                      : aiDecision.action === "left"
                        ? "← 左变道"
                        : aiDecision.action === "right"
                          ? "→ 右变道"
                          : "— 无操作"}
                </span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded bg-neon-gray/30">
                <span className="text-neon-blue/50">紧急度</span>
                <span
                  className={
                    aiDecision.urgency === "high"
                      ? "neon-text-pink"
                      : aiDecision.urgency === "medium"
                        ? "neon-text-gold"
                        : "text-neon-blue/60"
                  }
                >
                  {aiDecision.urgency === "high" ? "高" : aiDecision.urgency === "medium" ? "中" : "低"}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-neon-gray/30 text-neon-blue/70 text-xs">
                {aiDecision.reason}
              </div>
            </div>
            {aiLog.length > 0 && (
              <div className="mt-2 pt-2 border-t border-neon-purple/20">
                <div className="font-mono text-xs text-neon-purple/60 mb-1">操作记录:</div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {aiLog.map((log, i) => (
                    <div key={i} className="font-mono text-xs text-neon-purple/70 px-1">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 日志 */}
        <div className="flex-1 p-3 overflow-hidden flex flex-col">
          <h3 className="font-orbitron text-sm neon-text-pink mb-2">碰撞日志</h3>
          <div className="flex-1 overflow-y-auto space-y-0.5 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-neon-blue/30 text-center py-4">暂无日志</div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`px-2 py-0.5 rounded ${
                    log.includes("碰撞")
                      ? "bg-neon-pink/20 neon-text-pink"
                      : log.includes("拾取")
                        ? "bg-neon-gold/20 neon-text-gold"
                        : log.includes("闪避")
                          ? "bg-neon-blue/20 neon-text-blue"
                          : "text-neon-blue/60"
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StateItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "pink" | "gold" | "purple";
}) {
  const colorClass = {
    blue: "neon-text-blue",
    pink: "neon-text-pink",
    gold: "neon-text-gold",
    purple: "neon-text-purple",
  }[color];
  return (
    <div className="flex justify-between px-2 py-1 rounded bg-neon-gray/30">
      <span className="text-neon-blue/50">{label}</span>
      <span className={colorClass}>{value}</span>
    </div>
  );
}
