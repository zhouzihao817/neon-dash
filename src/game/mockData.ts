// 碰撞逻辑测试 Mock 数据
// 每个场景预设一组实体，用于验证碰撞检测是否正确

import type { ObstacleType, PowerUpType } from "./config";

export interface MockEntity {
  z: number; // 距离玩家(米)
  lane: number; // 车道 0/1/2
  type: ObstacleType | "coin" | "powerup";
  subtype?: PowerUpType;
  x?: number; // 横向偏移
}

export interface MockScenario {
  id: string;
  name: string;
  description: string;
  // 期望的测试结果
  expect: {
    // 推荐操作
    action: "jump" | "slide" | "left" | "right" | "none" | "collect";
    // 操作后应该的结果
    result: "pass" | "crash" | "collect";
    // 说明
    note: string;
  };
  entities: MockEntity[];
}

export const MOCK_SCENARIOS: MockScenario[] = [
  {
    id: "jump_barrier",
    name: "场景1：跳跃越过路障",
    description: "前方5米中央车道有一个静态路障(高1.5米)，需跳跃越过",
    expect: {
      action: "jump",
      result: "pass",
      note: "跳跃高度2.5米 > 路障1.5米，应安全通过",
    },
    entities: [
      { z: 5, lane: 1, type: "barrier" },
    ],
  },
  {
    id: "slide_laser",
    name: "场景2：滑铲穿过激光",
    description: "前方5米中央车道有激光栅栏(高1.5米)，需滑铲穿过",
    expect: {
      action: "slide",
      result: "pass",
      note: "滑铲可穿过高悬激光栅栏",
    },
    entities: [
      { z: 5, lane: 1, type: "laser" },
    ],
  },
  {
    id: "dodge_patrol",
    name: "场景3：变道躲避机器人",
    description: "前方5米中央车道有巡逻机器人，需变道躲避",
    expect: {
      action: "left",
      result: "pass",
      note: "变道到0车道躲避，机器人无法跳跃/滑铲",
    },
    entities: [
      { z: 5, lane: 1, type: "patrol" },
    ],
  },
  {
    id: "coin_line",
    name: "场景4：金币线拾取",
    description: "前方3-11米中央车道有一排金币，测试拾取",
    expect: {
      action: "collect",
      result: "collect",
      note: "直行应拾取全部5枚金币",
    },
    entities: [
      { z: 3, lane: 1, type: "coin" },
      { z: 5, lane: 1, type: "coin" },
      { z: 7, lane: 1, type: "coin" },
      { z: 9, lane: 1, type: "coin" },
      { z: 11, lane: 1, type: "coin" },
    ],
  },
  {
    id: "powerup_magnet",
    name: "场景5：道具拾取",
    description: "前方8米右侧车道有磁铁道具，变道拾取",
    expect: {
      action: "right",
      result: "collect",
      note: "变道到2车道拾取磁铁道具",
    },
    entities: [
      { z: 8, lane: 2, type: "powerup", subtype: "magnet" },
    ],
  },
  {
    id: "mixed_combo",
    name: "场景6：组合-障碍+金币+道具",
    description: "前方依次有路障(跳过)、金币线、激光(滑铲)、道具",
    expect: {
      action: "jump",
      result: "pass",
      note: "先跳跃越过路障，再拾取金币，滑铲穿过激光，拾取道具",
    },
    entities: [
      { z: 4, lane: 1, type: "barrier" },
      { z: 8, lane: 1, type: "coin" },
      { z: 10, lane: 1, type: "coin" },
      { z: 12, lane: 1, type: "coin" },
      { z: 16, lane: 1, type: "laser" },
      { z: 20, lane: 0, type: "powerup", subtype: "shield" },
    ],
  },
  {
    id: "multi_lane",
    name: "场景7：多车道障碍",
    description: "前方5米0车道和2车道都有路障，必须走中央车道",
    expect: {
      action: "none",
      result: "pass",
      note: "保持中央车道(1)直行通过，无需操作",
    },
    entities: [
      { z: 5, lane: 0, type: "barrier" },
      { z: 5, lane: 2, type: "barrier" },
    ],
  },
  {
    id: "trap_jump",
    name: "场景8：陷阱地板跳跃",
    description: "前方6米中央车道有陷阱地板，需跳跃越过",
    expect: {
      action: "jump",
      result: "pass",
      note: "陷阱地板需跳跃越过",
    },
    entities: [
      { z: 6, lane: 1, type: "trap" },
    ],
  },
  {
    id: "drone_dodge",
    name: "场景9：无人机变道",
    description: "前方7米左侧车道有无人机，需变道到中央或右侧",
    expect: {
      action: "right",
      result: "pass",
      note: "从0车道变道到1或2躲避无人机",
    },
    entities: [
      { z: 7, lane: 0, type: "drone" },
    ],
  },
  {
    id: "crash_test",
    name: "场景10：碰撞测试(不操作)",
    description: "前方5米中央车道有路障，不操作应碰撞结束",
    expect: {
      action: "none",
      result: "crash",
      note: "不跳跃直接撞路障，应游戏结束",
    },
    entities: [
      { z: 5, lane: 1, type: "barrier" },
    ],
  },
];

// 获取场景的初始玩家车道(部分场景玩家不在中央)
export function getInitialLane(scenarioId: string): number {
  if (scenarioId === "drone_dodge") return 0;
  return 1;
}
