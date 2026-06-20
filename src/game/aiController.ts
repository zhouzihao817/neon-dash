// 自动操作AI决策系统
// 根据前方实体类型和距离，自动选择最佳操作序列

import { OBSTACLES, CONFIG, type ObstacleType } from "./config";
import type { GameEngine } from "./engine";

type ActionType = "jump" | "slide" | "left" | "right" | "none";

interface Decision {
  action: ActionType;
  reason: string;
  urgency: "low" | "medium" | "high";
}

// 操作触发距离阈值(米)
const TRIGGER = {
  jump: 2.2, // 跳跃类障碍物触发距离
  slide: 2.0, // 滑铲类障碍物触发距离
  dodge: 3.5, // 变道类障碍物触发距离(需提前变道)
  collect: 4.0, // 金币/道具拾取变道距离
};

// 安全距离范围(检查变道目标车道是否安全)
const SAFE_RANGE = 3.0;

// ===== 日志开关 =====
// 设为 true 开启详细AI决策日志，设为 false 关闭
const AI_DEBUG = true;

// 日志颜色样式
const LOG_STYLE = {
  scan: "color: #00D4FF; font-weight: bold",
  obstacle: "color: #FF2D95; font-weight: bold",
  jump: "color: #00D4FF",
  slide: "color: #B44CFF",
  dodge: "color: #FFD700",
  collect: "color: #FFD700",
  safe: "color: #00FFAA",
  unsafe: "color: #FF2D95",
  execute: "color: #FFD700; font-weight: bold; background: #2A2A3E",
  warn: "color: #FF2D95; font-weight: bold",
  info: "color: #888888",
};

// 记录上一次决策，避免重复日志
let lastLoggedDecision = "";

function logScan(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[AI扫描] " + msg, LOG_STYLE.scan, ...args);
}
function logObstacle(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[障碍物] " + msg, LOG_STYLE.obstacle, ...args);
}
function logJump(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[跳跃] " + msg, LOG_STYLE.jump, ...args);
}
function logSlide(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[滑铲] " + msg, LOG_STYLE.slide, ...args);
}
function logDodge(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[变道] " + msg, LOG_STYLE.dodge, ...args);
}
function logCollect(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[拾取] " + msg, LOG_STYLE.collect, ...args);
}
function logSafe(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[安全检查] " + msg, LOG_STYLE.safe, ...args);
}
function logUnsafe(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[安全检查] " + msg, LOG_STYLE.unsafe, ...args);
}
function logExecute(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[执行] " + msg, LOG_STYLE.execute, ...args);
}
function logWarn(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.warn("%c[AI警告] " + msg, LOG_STYLE.warn, ...args);
}
function logInfo(msg: string, ...args: unknown[]) {
  if (AI_DEBUG) console.log("%c[AI] " + msg, LOG_STYLE.info, ...args);
}

export function decideAction(engine: GameEngine): Decision {
  const entities = engine.getUpcomingEntities(15);
  const state = engine.getTestState();

  // 扫描日志：输出前方所有实体
  if (AI_DEBUG && entities.length > 0) {
    const entitySummary = entities
      .map(
        (e) =>
          `${e.type}${e.subtype ? `(${e.subtype})` : ""}[车道${e.lane},z=${e.z.toFixed(1)}]`,
      )
      .join(" | ");
    logScan(
      `玩家车道=${state.playerLane} 跳跃=${state.isJumping} 滑铲=${state.isSliding} | 前方${entities.length}个实体: ${entitySummary}`,
    );
  }

  if (entities.length === 0) {
    logInfo("前方无实体，保持直行");
    return { action: "none", reason: "前方无实体", urgency: "low" };
  }

  const playerLane = state.playerLane;
  const nearest = entities[0];

  // 1. 处理障碍物(优先级最高)
  if (nearest.type !== "coin" && nearest.type !== "powerup") {
    const obs = OBSTACLES[nearest.type as ObstacleType];
    const inLane = nearest.lane === playerLane;

    logObstacle(
      `最近障碍: ${obs.name}(${nearest.type}) 车道=${nearest.lane} z=${nearest.z.toFixed(2)}m 高度=${obs.height} 需操作=${obs.action} | 玩家车道=${playerLane} 在同车道=${inLane}`,
    );

    // 不在当前车道，无需操作
    if (!inLane) {
      logObstacle(`障碍不在当前车道(${nearest.lane}≠${playerLane})，检查后续实体`);
      // 检查是否需要为后续实体准备
      return checkNextEntity(engine, entities, playerLane);
    }

    // 在当前车道，根据类型决定操作
    switch (obs.action) {
      case "jump": {
        logJump(
          `判断跳跃: 障碍z=${nearest.z.toFixed(2)} 触发阈值=${TRIGGER.jump} | ${nearest.z <= TRIGGER.jump ? "在触发范围" : "未到触发范围"}`,
        );
        if (nearest.z <= TRIGGER.jump && nearest.z > 0.5) {
          if (engine.canJump()) {
            logJump(`✓ 执行跳跃 (canJump=true, 障碍高度${obs.height} < 跳跃高度2.5)`);
            return {
              action: "jump",
              reason: `跳跃越过${obs.name}(z=${nearest.z.toFixed(1)}m)`,
              urgency: "high",
            };
          }
          logWarn(`✗ 跳跃冷却中 (canJump=false, isJumping=${state.isJumping})`);
          return { action: "none", reason: "跳跃冷却中", urgency: "high" };
        }
        logJump(`等待时机 (z=${nearest.z.toFixed(2)} 不在 ${0.5}-${TRIGGER.jump} 范围)`);
        return {
          action: "none",
          reason: `接近${obs.name}(z=${nearest.z.toFixed(1)}m)等待跳跃时机`,
          urgency: "medium",
        };
      }

      case "slide": {
        logSlide(
          `判断滑铲: 障碍z=${nearest.z.toFixed(2)} 触发阈值=${TRIGGER.slide} | ${nearest.z <= TRIGGER.slide ? "在触发范围" : "未到触发范围"}`,
        );
        if (nearest.z <= TRIGGER.slide && nearest.z > 0.5) {
          if (engine.canSlide()) {
            logSlide(`✓ 执行滑铲 (canSlide=true)`);
            return {
              action: "slide",
              reason: `滑铲穿过${obs.name}(z=${nearest.z.toFixed(1)}m)`,
              urgency: "high",
            };
          }
          logWarn(`✗ 滑铲冷却中 (canSlide=false, isSliding=${state.isSliding}, isJumping=${state.isJumping})`);
          return { action: "none", reason: "滑铲冷却中", urgency: "high" };
        }
        logSlide(`等待时机 (z=${nearest.z.toFixed(2)} 不在 ${0.5}-${TRIGGER.slide} 范围)`);
        return {
          action: "none",
          reason: `接近${obs.name}(z=${nearest.z.toFixed(1)}m)等待滑铲时机`,
          urgency: "medium",
        };
      }

      case "dodge": {
        logDodge(
          `判断变道: 障碍z=${nearest.z.toFixed(2)} 触发阈值=${TRIGGER.dodge} | ${nearest.z <= TRIGGER.dodge ? "在触发范围" : "未到触发范围"}`,
        );
        // 变道类障碍物，需要提前变道
        if (nearest.z <= TRIGGER.dodge && nearest.z > 0.5) {
          if (!engine.canChangeLane()) {
            logWarn(`✗ 变道冷却中 (canChangeLane=false, laneProgress需≥0.8, isJumping=${state.isJumping})`);
            return { action: "none", reason: "变道冷却中", urgency: "high" };
          }
          // 选择安全车道
          logDodge(`开始寻找安全车道 (当前车道=${playerLane}, 障碍z=${nearest.z.toFixed(2)})`);
          const target = findSafeLane(engine, playerLane, nearest.z);
          if (target === null) {
            logUnsafe(`✗ 无安全车道可躲避 ${obs.name}`);
            // 无安全车道，尝试跳跃(部分障碍物可跳)
            if (obs.height < 2 && engine.canJump()) {
              logDodge(`→ 无安全车道但障碍高度${obs.height}<2，尝试跳跃`);
              return {
                action: "jump",
                reason: `无安全车道，跳跃越过${obs.name}`,
                urgency: "high",
              };
            }
            logWarn(`✗ 无法躲避 ${obs.name} (高度${obs.height}≥2或无法跳跃)`);
            return {
              action: "none",
              reason: `无安全车道躲避${obs.name}`,
              urgency: "high",
            };
          }
          const direction = target < playerLane ? "left" : "right";
          logSafe(`✓ 找到安全车道${target}，变道${direction === "left" ? "左" : "右"}`);
          return {
            action: direction,
            reason: `变道${direction === "left" ? "左" : "右"}躲避${obs.name}(z=${nearest.z.toFixed(1)}m)→车道${target}`,
            urgency: "high",
          };
        }
        logDodge(`等待时机 (z=${nearest.z.toFixed(2)} 不在 ${0.5}-${TRIGGER.dodge} 范围)`);
        return {
          action: "none",
          reason: `接近${obs.name}(z=${nearest.z.toFixed(1)}m)准备变道`,
          urgency: "medium",
        };
      }

      default:
        logWarn(`未知障碍类型: ${obs.action}`);
        return { action: "none", reason: "未知障碍类型", urgency: "low" };
    }
  }

  // 2. 处理金币和道具
  return checkCollectibles(engine, entities, playerLane);
}

// 检查后续实体(当前车道无障碍时)
function checkNextEntity(
  engine: GameEngine,
  entities: GameEngine["getUpcomingEntities"] extends () => infer R ? R : never,
  playerLane: number,
): Decision {
  // 找到下一个在当前车道的障碍物
  const nextObstacle = entities.find(
    (e) =>
      e.type !== "coin" &&
      e.type !== "powerup" &&
      e.lane === playerLane,
  );

  if (nextObstacle) {
    const obs = OBSTACLES[nextObstacle.type as ObstacleType];
    logInfo(`后续检查: 同车道下一个障碍 ${obs.name}(z=${nextObstacle.z.toFixed(2)}) 需${obs.action}`);

    if (nextObstacle.z < TRIGGER.dodge) {
      if (obs.action === "dodge" && engine.canChangeLane()) {
        logDodge(`提前变道准备: 寻找安全车道躲避前方${obs.name}`);
        const target = findSafeLane(engine, playerLane, nextObstacle.z);
        if (target !== null) {
          const direction = target < playerLane ? "left" : "right";
          logSafe(`✓ 提前变道到车道${target}`);
          return {
            action: direction,
            reason: `提前变道躲避前方${obs.name}(z=${nextObstacle.z.toFixed(1)}m)`,
            urgency: "medium",
          };
        }
        logUnsafe(`✗ 提前变道失败: 无安全车道`);
      } else {
        logInfo(`后续障碍${obs.name}需${obs.action}，暂不提前变道 (z=${nextObstacle.z.toFixed(2)}≥${TRIGGER.dodge} 或不可变道)`);
      }
    }
  } else {
    logInfo(`后续检查: 当前车道${playerLane}前方无障碍`);
  }

  // 检查金币道具
  return checkCollectibles(engine, entities, playerLane);
}

// 检查金币和道具拾取
function checkCollectibles(
  engine: GameEngine,
  entities: GameEngine["getUpcomingEntities"] extends () => infer R ? R : never,
  playerLane: number,
): Decision {
  // 找到最近的金币或道具
  const collectible = entities.find(
    (e) => e.type === "coin" || e.type === "powerup",
  );

  if (!collectible) {
    logInfo("无收集物，保持直行");
    return { action: "none", reason: "前方无障碍无收集物", urgency: "low" };
  }

  logCollect(
    `最近收集物: ${collectible.type}${collectible.subtype ? `(${collectible.subtype})` : ""} 车道=${collectible.lane} z=${collectible.z.toFixed(2)} | 玩家车道=${playerLane}`,
  );

  // 在当前车道，直行拾取
  if (collectible.lane === playerLane) {
    logCollect(`✓ 同车道，直行拾取 (车道${collectible.lane}=${playerLane})`);
    return {
      action: "none",
      reason: `直行拾取${collectible.type === "coin" ? "金币" : "道具"}(z=${collectible.z.toFixed(1)}m)`,
      urgency: "low",
    };
  }

  // 不在当前车道，评估是否值得变道拾取
  logCollect(
    `收集物在车道${collectible.lane}，玩家在车道${playerLane} | z=${collectible.z.toFixed(2)} 触发范围=${TRIGGER.collect}`,
  );
  if (collectible.z <= TRIGGER.collect && collectible.z > 1.0) {
    if (!engine.canChangeLane()) {
      logWarn(`✗ 放弃拾取: 变道冷却中 (canChangeLane=false)`);
      return { action: "none", reason: "变道冷却中，放弃拾取", urgency: "low" };
    }

    // 检查目标车道是否安全
    const safeRangeFrom = collectible.z - SAFE_RANGE;
    const safeRangeTo = collectible.z + SAFE_RANGE;
    logCollect(`检查目标车道${collectible.lane}安全性 (范围 ${safeRangeFrom.toFixed(1)}-${safeRangeTo.toFixed(1)}m)`);

    const safe = engine.isLaneSafe(
      collectible.lane,
      safeRangeFrom,
      safeRangeTo,
    );

    if (safe) {
      logSafe(`✓ 车道${collectible.lane}在${safeRangeFrom.toFixed(1)}-${safeRangeTo.toFixed(1)}m范围安全`);
      // 道具优先级高于金币
      if (collectible.type === "powerup") {
        const direction = collectible.lane < playerLane ? "left" : "right";
        logCollect(`→ 变道${direction === "left" ? "左" : "右"}拾取道具(高优先级)`);
        return {
          action: direction,
          reason: `变道拾取道具(z=${collectible.z.toFixed(1)}m)→车道${collectible.lane}`,
          urgency: "medium",
        };
      }

      // 金币：检查是否是一排金币(值得变道)
      const coinLine = entities.filter(
        (e) => e.type === "coin" && e.lane === collectible.lane,
      );
      logCollect(`金币线检查: 车道${collectible.lane}有${coinLine.length}枚金币 (需≥3才变道)`);

      if (coinLine.length >= 3) {
        const direction = collectible.lane < playerLane ? "left" : "right";
        logCollect(`→ 变道${direction === "left" ? "左" : "右"}拾取金币线(${coinLine.length}枚)`);
        return {
          action: direction,
          reason: `变道拾取金币线(${coinLine.length}枚,z=${collectible.z.toFixed(1)}m)→车道${collectible.lane}`,
          urgency: "medium",
        };
      }
      // 单枚金币不值得变道
      logInfo(`单枚金币不值得变道 (仅${coinLine.length}枚)`);
      return { action: "none", reason: "单枚金币不值得变道", urgency: "low" };
    }
    logUnsafe(`✗ 车道${collectible.lane}在${safeRangeFrom.toFixed(1)}-${safeRangeTo.toFixed(1)}m范围不安全，放弃拾取`);
    return { action: "none", reason: "目标车道不安全，放弃拾取", urgency: "low" };
  }

  logInfo(`收集物未到拾取范围 (z=${collectible.z.toFixed(2)} 不在 ${1.0}-${TRIGGER.collect})`);
  return { action: "none", reason: "等待收集物接近", urgency: "low" };
}

// 寻找安全车道(用于变道躲避)
function findSafeLane(
  engine: GameEngine,
  currentLane: number,
  obstacleZ: number,
): number | null {
  const candidates: number[] = [];
  const checkRangeFrom = obstacleZ - 2;
  const checkRangeTo = obstacleZ + 2;

  logDodge(`寻找安全车道: 当前车道=${currentLane} 障碍z=${obstacleZ.toFixed(2)} 检查范围=${checkRangeFrom.toFixed(1)}-${checkRangeTo.toFixed(1)}m`);

  // 检查所有车道
  for (let lane = 0; lane < CONFIG.LANES; lane++) {
    if (lane === currentLane) {
      logDodge(`  车道${lane}: 跳过(当前车道)`);
      continue;
    }
    // 检查该车道在障碍物附近是否安全
    const safe = engine.isLaneSafe(lane, checkRangeFrom, checkRangeTo);
    if (safe) {
      logSafe(`  车道${lane}: ✓ 安全`);
      candidates.push(lane);
    } else {
      logUnsafe(`  车道${lane}: ✗ 有障碍`);
    }
  }

  if (candidates.length === 0) {
    logUnsafe(`✗ 无安全车道 (所有非当前车道在${checkRangeFrom.toFixed(1)}-${checkRangeTo.toFixed(1)}m都有障碍)`);
    return null;
  }

  // 选择距离当前车道最近的安全车道
  candidates.sort((a, b) => Math.abs(a - currentLane) - Math.abs(b - currentLane));
  logSafe(`✓ 候选车道: [${candidates.join(",")}] → 选择最近的车道${candidates[0]} (距当前车道${Math.abs(candidates[0] - currentLane)})`);
  return candidates[0];
}

// 执行决策
export function executeDecision(
  engine: GameEngine,
  decision: Decision,
): boolean {
  // 只在执行实际操作时记录日志，避免重复
  if (decision.action !== "none") {
    const decisionKey = `${decision.action}-${decision.reason}`;
    if (decisionKey !== lastLoggedDecision) {
      logExecute(`▶ 执行操作: ${decision.action.toUpperCase()} | ${decision.reason} | 紧急度=${decision.urgency}`);
      lastLoggedDecision = decisionKey;
    }
  } else {
    lastLoggedDecision = "";
  }

  switch (decision.action) {
    case "jump":
      engine.jump();
      return true;
    case "slide":
      engine.slide();
      return true;
    case "left":
      engine.moveLeft();
      return true;
    case "right":
      engine.moveRight();
      return true;
    default:
      return false;
  }
}

// 重置日志状态(切换场景时调用)
export function resetAILog() {
  lastLoggedDecision = "";
  if (AI_DEBUG) console.log("%c[AI] 日志状态已重置", LOG_STYLE.info);
}
