import {
  CONFIG,
  DIFFICULTY,
  OBSTACLES,
  POWERUPS,
  getDifficulty,
  getComboMultiplier,
  calculateScore,
  type ObstacleType,
  type PowerUpType,
  type GameState,
} from "./config";
import { audio } from "./audio";

interface Entity {
  z: number; // 距离(米) - 沿跑道方向
  lane: number; // 车道 0/1/2
  x: number; // 横向偏移(用于移动障碍)
  type: ObstacleType | "coin" | "powerup";
  subtype?: PowerUpType;
  active: boolean;
  collected: boolean;
  spawnZ: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  rewardDiamond: number;
  rewardKeys?: number;
}

export interface GameCallbacks {
  onScoreUpdate: (score: number) => void;
  onComboUpdate: (combo: number, multiplier: number) => void;
  onDistanceUpdate: (distance: number) => void;
  onCoinsUpdate: (coins: number) => void;
  onSpeedUpdate: (speed: number) => void;
  onPowerUpSlotsChange: (slots: (PowerUpType | null)[]) => void;
  onActivePowerUpsChange: (active: Record<PowerUpType, number>) => void;
  onGameOver: (result: GameResult) => void;
  onSlowMotion: (active: boolean) => void;
  onAchievement?: (achievement: Achievement) => void;
}

export interface GameResult {
  score: number;
  distance: number;
  coins: number;
  maxCombo: number;
  dodges: number;
  perfectDodges: number;
  rewardGold: number;
  rewardDiamond: number;
  rewardKeys: number;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: GameCallbacks;
  private rafId: number | null = null;
  private lastTime = 0;

  // 游戏状态
  state: GameState = "ready";
  private distance = 0;
  private speed: number = CONFIG.BASE_SPEED;
  private coins = 0;
  private combo = 0;
  private maxCombo = 0;
  private dodges = 0;
  private perfectDodges = 0;
  private comboTimer = 0;

  // 玩家
  private playerLane = 1;
  private playerTargetLane = 1;
  private playerLaneProgress = 1; // 0-1 变道进度
  private playerY = 0; // 跳跃高度
  private playerVY = 0;
  private isJumping = false;
  private isSliding = false;
  private slideTimer = 0;
  private jumpTimer = 0;
  private canDoubleJump = false;
  private trailPositions: { x: number; y: number; alpha: number }[] = [];

  // 实体
  private entities: Entity[] = [];
  private particles: Particle[] = [];
  private nextSpawnZ = 30;
  private nextCoinLineZ = 20;

  // 道具
  private powerUpSlots: (PowerUpType | null)[] = [null, null, null];
  private activePowerUps: Record<PowerUpType, number> = {
    jetpack: 0,
    magnet: 0,
    superShoes: 0,
    scoreMultiplier: 0,
    shield: 0,
  };
  private powerUpCooldowns: Record<PowerUpType, number> = {
    jetpack: 0,
    magnet: 0,
    superShoes: 0,
    scoreMultiplier: 0,
    shield: 0,
  };
  private hasShield = false;

  // 慢镜头
  private slowMotionTimer = 0;
  private timeScale = 1;

  // 皮肤颜色
  private skinColor: string = CONFIG.COLORS.blue;
  private trailColor: string = CONFIG.COLORS.blue;

  // 测试模式
  private testMode = false;
  private testEntities: Entity[] = [];
  private testLog: string[] = [];

  // 成就触发记录(本局已触发)
  private triggeredAchievements = new Set<string>();
  private distanceMilestones = [500, 1000, 2000, 3000, 5000];
  private perfectDodgeMilestones = [10, 20, 30];
  private comboMilestones = [20, 30, 50];
  private coinMilestones = [50, 100];

  // 输入状态
  private lastLaneChangeTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    skinColor: string,
    trailColor: string,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = callbacks;
    this.skinColor = skinColor;
    this.trailColor = trailColor;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  start() {
    this.state = "running";
    this.distance = 0;
    this.speed = CONFIG.BASE_SPEED;
    this.coins = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.dodges = 0;
    this.perfectDodges = 0;
    this.comboTimer = 0;
    this.playerLane = 1;
    this.playerTargetLane = 1;
    this.playerLaneProgress = 1;
    this.playerY = 0;
    this.playerVY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.entities = [];
    this.particles = [];
    this.nextSpawnZ = 30;
    this.nextCoinLineZ = 20;
    this.powerUpSlots = [null, null, null];
    this.activePowerUps = {
      jetpack: 0,
      magnet: 0,
      superShoes: 0,
      scoreMultiplier: 0,
      shield: 0,
    };
    this.hasShield = false;
    this.timeScale = 1;
    this.slowMotionTimer = 0;
    this.triggeredAchievements.clear();
    this.lastTime = performance.now();
    this.loop();
    this.cb.onPowerUpSlotsChange(this.powerUpSlots);
    this.cb.onActivePowerUpsChange(this.activePowerUps);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // === 测试模式 ===
  startTestMode(
    mockEntities: { z: number; lane: number; type: string; subtype?: string }[],
    initialLane = 1,
  ) {
    this.testMode = true;
    this.testLog = [];
    this.state = "running";
    this.distance = 0;
    this.speed = 8; // 慢速便于观察
    this.coins = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.dodges = 0;
    this.perfectDodges = 0;
    this.comboTimer = 0;
    this.playerLane = initialLane;
    this.playerTargetLane = initialLane;
    this.playerLaneProgress = 1;
    this.playerY = 0;
    this.playerVY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.particles = [];
    this.powerUpSlots = [null, null, null];
    this.activePowerUps = {
      jetpack: 0,
      magnet: 0,
      superShoes: 0,
      scoreMultiplier: 0,
      shield: 0,
    };
    this.hasShield = false;
    this.timeScale = 1;
    this.slowMotionTimer = 0;
    this.triggeredAchievements.clear();

    // 注入Mock实体
    this.entities = mockEntities.map((e) => ({
      z: e.z,
      lane: e.lane,
      x: 0,
      type: e.type as Entity["type"],
      subtype: e.subtype as PowerUpType | undefined,
      active: true,
      collected: false,
      spawnZ: e.z,
    }));
    this.testEntities = [...this.entities];

    this.lastTime = performance.now();
    this.loop();
    this.cb.onPowerUpSlotsChange(this.powerUpSlots);
    this.cb.onActivePowerUpsChange(this.activePowerUps);
  }

  getTestLog(): string[] {
    return this.testLog;
  }

  private log(msg: string) {
    const dist = this.distance.toFixed(1);
    this.testLog.push(`[${dist}m] ${msg}`);
    if (this.testLog.length > 50) this.testLog.shift();
  }

  getTestState() {
    return {
      state: this.state,
      distance: Math.floor(this.distance),
      coins: this.coins,
      combo: this.combo,
      dodges: this.dodges,
      perfectDodges: this.perfectDodges,
      playerLane: this.playerLane,
      playerY: this.playerY,
      isJumping: this.isJumping,
      isSliding: this.isSliding,
      entitiesCount: this.entities.filter((e) => e.active && !e.collected).length,
    };
  }

  // 获取前方实体列表(用于AI决策)
  getUpcomingEntities(maxDist = 15) {
    return this.entities
      .filter((e) => e.active && !e.collected && e.z > -1 && e.z < maxDist)
      .sort((a, b) => a.z - b.z);
  }

  // 检查车道在某距离范围内是否安全(无障碍物)
  isLaneSafe(lane: number, fromZ: number, toZ: number): boolean {
    for (const e of this.entities) {
      if (!e.active || e.collected) continue;
      if (e.type === "coin" || e.type === "powerup") continue; // 金币道具不算危险
      if (e.lane !== lane) continue;
      if (e.z >= fromZ && e.z <= toZ) return false;
    }
    return true;
  }

  // 检查玩家是否可变道(变道已完成)
  canChangeLane(): boolean {
    return this.playerLaneProgress >= 0.8 && !this.isJumping;
  }

  // 检查玩家是否可跳跃(不在空中)
  canJump(): boolean {
    return !this.isJumping || this.canDoubleJump;
  }

  // 检查玩家是否可滑铲(不在滑铲中)
  canSlide(): boolean {
    return !this.isSliding && !this.isJumping;
  }

  // === 输入处理 ===
  moveLeft() {
    if (this.state !== "running") return;
    if (this.playerTargetLane > 0 && this.playerLaneProgress >= 0.5) {
      this.checkPerfectDodge(this.playerTargetLane - 1);
      this.playerTargetLane--;
      this.playerLaneProgress = 0;
      this.lastLaneChangeTime = performance.now();
      audio.sfxLaneChange();
      this.addTrail();
    }
  }

  moveRight() {
    if (this.state !== "running") return;
    if (this.playerTargetLane < CONFIG.LANES - 1 && this.playerLaneProgress >= 0.5) {
      this.checkPerfectDodge(this.playerTargetLane + 1);
      this.playerTargetLane++;
      this.playerLaneProgress = 0;
      this.lastLaneChangeTime = performance.now();
      audio.sfxLaneChange();
      this.addTrail();
    }
  }

  jump() {
    if (this.state !== "running") return;
    if (!this.isJumping || this.canDoubleJump) {
      if (this.isJumping && this.canDoubleJump) {
        this.canDoubleJump = false;
      }
      this.isJumping = true;
      const heightMult = this.activePowerUps.superShoes > 0 ? 1.5 : 1;
      this.playerVY = Math.sqrt(2 * 30 * CONFIG.JUMP_HEIGHT * heightMult);
      audio.sfxJump();
      this.addTrail();
    }
  }

  slide() {
    if (this.state !== "running") return;
    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = CONFIG.SLIDE_DURATION;
      if (this.isJumping) {
        this.isJumping = false;
        this.playerY = 0;
        this.playerVY = 0;
      }
      audio.sfxSlide();
    }
  }

  usePowerUp(slot: number) {
    if (this.state !== "running") return;
    const type = this.powerUpSlots[slot];
    if (!type) return;
    if (this.powerUpCooldowns[type] > 0) return;

    this.powerUpSlots[slot] = null;
    this.activePowerUps[type] = POWERUPS[type].duration;
    this.powerUpCooldowns[type] = CONFIG.POWERUP_COOLDOWN;

    if (type === "shield") this.hasShield = true;
    if (type === "jetpack") audio.sfxJetpack();
    else audio.sfxPowerUp();

    this.cb.onPowerUpSlotsChange(this.powerUpSlots);
    this.cb.onActivePowerUpsChange(this.activePowerUps);
  }

  // === 极限闪避判定 ===
  private checkPerfectDodge(newLane: number) {
    const playerZ = 0;
    for (const e of this.entities) {
      if (!e.active || e.collected) continue;
      if (e.type === "coin" || e.type === "powerup") continue;
      const dist = e.z - playerZ;
      // 障碍前0.3秒内变道
      const timeToHit = dist / this.speed;
      if (timeToHit > 0 && timeToHit < CONFIG.PERFECT_DODGE_WINDOW) {
        if (e.lane === this.playerTargetLane && e.lane !== newLane) {
          this.perfectDodges++;
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.comboTimer = CONFIG.COMBO_TIMEOUT;
          this.triggerSlowMotion();
          audio.sfxPerfectDodge();
          this.checkPerfectDodgeAchievements();
          this.checkComboAchievements();
          const pos1 = this.getPlayerScreenPos();
          this.spawnParticles(
            pos1.x,
            pos1.y,
            CONFIG.COLORS.purple,
            30,
          );
        }
      }
    }
  }

  private triggerSlowMotion() {
    this.slowMotionTimer = 0.5;
    this.timeScale = 0.3;
    this.state = "slowmotion";
    this.cb.onSlowMotion(true);
  }

  private addTrail() {
    const pos = this.getPlayerScreenPos();
    this.trailPositions.push({ x: pos.x, y: pos.y, alpha: 0.6 });
    if (this.trailPositions.length > 8) this.trailPositions.shift();
  }

  private getPlayerScreenPos() {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    const currentLane =
      this.playerLaneProgress < 1
        ? this.playerLane +
          (this.playerTargetLane - this.playerLane) * this.playerLaneProgress
        : this.playerLane;
    return this.project(0, currentLane, this.playerY, w, h);
  }

  // === 主循环 ===
  private loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.state === "gameover") return;

    const scaledDt = dt * this.timeScale;

    // 慢镜头恢复
    if (this.slowMotionTimer > 0) {
      this.slowMotionTimer -= dt;
      if (this.slowMotionTimer <= 0) {
        this.timeScale = 1;
        this.state = "running";
        this.cb.onSlowMotion(false);
      }
    }

    // 距离与速度
    const diff = getDifficulty(this.distance);
    this.speed = diff.speed;
    this.distance += this.speed * scaledDt;
    this.cb.onDistanceUpdate(Math.floor(this.distance));
    this.cb.onSpeedUpdate(this.speed);

    // 成就检测: 距离里程碑
    this.checkDistanceAchievements();

    // Combo计时
    if (this.combo > 0) {
      this.comboTimer -= scaledDt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        audio.sfxComboBreak();
        this.cb.onComboUpdate(this.combo, getComboMultiplier(this.combo).multiplier);
      }
    }

    // 玩家变道插值
    if (this.playerLaneProgress < 1) {
      this.playerLaneProgress = Math.min(
        1,
        this.playerLaneProgress + scaledDt / CONFIG.LANE_CHANGE_TIME,
      );
      if (this.playerLaneProgress >= 1) {
        this.playerLane = this.playerTargetLane;
      }
    }

    // 跳跃物理
    if (this.isJumping) {
      this.playerY += this.playerVY * scaledDt;
      this.playerVY -= 30 * scaledDt;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerVY = 0;
        this.isJumping = false;
        if (this.activePowerUps.superShoes > 0) this.canDoubleJump = true;
      }
    }

    // 滑铲计时
    if (this.isSliding) {
      this.slideTimer -= scaledDt;
      if (this.slideTimer <= 0) this.isSliding = false;
    }

    // 道具计时
    let powerUpsChanged = false;
    for (const key of Object.keys(this.activePowerUps) as PowerUpType[]) {
      if (this.activePowerUps[key] > 0) {
        this.activePowerUps[key] -= scaledDt;
        if (this.activePowerUps[key] <= 0) {
          this.activePowerUps[key] = 0;
          if (key === "shield") this.hasShield = false;
          powerUpsChanged = true;
        }
      }
      if (this.powerUpCooldowns[key] > 0) {
        this.powerUpCooldowns[key] -= scaledDt;
        if (this.powerUpCooldowns[key] < 0) this.powerUpCooldowns[key] = 0;
      }
    }
    if (powerUpsChanged) this.cb.onActivePowerUpsChange(this.activePowerUps);

    // 生成实体
    this.spawnEntities(diff);

    // 更新实体位置
    for (const e of this.entities) {
      if (!e.active) continue;
      e.z -= this.speed * scaledDt;
      // 移动障碍左右移动
      if (e.type === "patrol") {
        e.x = Math.sin((this.distance + e.spawnZ) * 0.05) * 0.8;
      }
      if (e.z < -5) e.active = false;
    }

    // 喷射器吸金
    if (this.activePowerUps.jetpack > 0) {
      for (const e of this.entities) {
        if (!e.active || e.collected) continue;
        if (e.type === "coin") {
          const dist = Math.abs(e.z);
          if (dist < 15) {
            e.collected = true;
            this.coins++;
            this.combo++;
            this.comboTimer = CONFIG.COMBO_TIMEOUT;
            audio.sfxCoin();
          }
        }
      }
    }

    // 磁铁吸金
    if (this.activePowerUps.magnet > 0) {
      for (const e of this.entities) {
        if (!e.active || e.collected) continue;
        if (e.type === "coin") {
          const dist = Math.abs(e.z);
          if (dist < 10 && e.lane !== this.playerLane) {
            e.lane = this.playerLane;
          }
        }
      }
    }

    // 碰撞检测
    this.checkCollisions();

    // 更新粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * scaledDt;
      p.y += p.vy * scaledDt;
      p.vy += 200 * scaledDt;
      p.life -= scaledDt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // 更新残影
    for (let i = this.trailPositions.length - 1; i >= 0; i--) {
      this.trailPositions[i].alpha -= scaledDt * 2;
      if (this.trailPositions[i].alpha <= 0) this.trailPositions.splice(i, 1);
    }

    // 更新分数
    const score = calculateScore(
      this.distance,
      this.coins,
      this.dodges,
      this.perfectDodges,
      this.combo,
      this.activePowerUps.scoreMultiplier > 0,
    );
    this.cb.onScoreUpdate(score);
    this.cb.onCoinsUpdate(this.coins);
    this.cb.onComboUpdate(
      this.combo,
      getComboMultiplier(this.combo).multiplier,
    );
  }

  private spawnEntities(diff: ReturnType<typeof getDifficulty>) {
    // 测试模式不生成新实体
    if (this.testMode) return;
    // 生成障碍
    if (this.distance + 200 > this.nextSpawnZ) {
      const lane = Math.floor(Math.random() * CONFIG.LANES);
      const obstacleType =
        diff.obstacles[Math.floor(Math.random() * diff.obstacles.length)];
      this.entities.push({
        z: this.nextSpawnZ,
        lane,
        x: 0,
        type: obstacleType,
        active: true,
        collected: false,
        spawnZ: this.nextSpawnZ,
      });
      this.nextSpawnZ += diff.density + Math.random() * 2;

      // 有概率在同距离生成其他车道的障碍(后期)
      if (this.distance > 1500 && Math.random() < 0.3) {
        const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % CONFIG.LANES;
        this.entities.push({
          z: this.nextSpawnZ - diff.density * 0.5,
          lane: lane2,
          x: 0,
          type: diff.obstacles[
            Math.floor(Math.random() * diff.obstacles.length)
          ],
          active: true,
          collected: false,
          spawnZ: this.nextSpawnZ,
        });
      }
    }

    // 生成金币线
    if (this.distance + 200 > this.nextCoinLineZ) {
      const lane = Math.floor(Math.random() * CONFIG.LANES);
      const count = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        this.entities.push({
          z: this.nextCoinLineZ + i * 2,
          lane,
          x: 0,
          type: "coin",
          active: true,
          collected: false,
          spawnZ: this.nextCoinLineZ,
        });
      }
      this.nextCoinLineZ += 30 + Math.random() * 20;
    }

    // 生成道具
    // 简化:每帧有概率生成一个道具
    if (Math.random() < 0.002 && this.distance > 50) {
      const types = Object.keys(POWERUPS) as PowerUpType[];
      const type = types[Math.floor(Math.random() * types.length)];
      const lane = Math.floor(Math.random() * CONFIG.LANES);
      this.entities.push({
        z: 80 + Math.random() * 50,
        lane,
        x: 0,
        type: "powerup",
        subtype: type,
        active: true,
        collected: false,
        spawnZ: 80,
      });
    }
  }

  private checkCollisions() {
    const playerZ = 0;
    const COLLISION_RANGE = 0.7; // 碰撞判定范围(米)
    const PICKUP_RANGE = 1.0; // 金币/道具拾取范围(米)

    for (const e of this.entities) {
      if (!e.active || e.collected) continue;

      // 计算玩家当前所在车道(变道中分阶段判定)
      let inLane: boolean;
      const inOriginalLane = e.lane === this.playerLane;
      const inTargetLane = e.lane === this.playerTargetLane;
      if (this.playerLane === this.playerTargetLane) {
        inLane = inOriginalLane;
      } else if (this.playerLaneProgress < 0.4) {
        inLane = inOriginalLane; // 变道前期，仍在原车道
      } else if (this.playerLaneProgress > 0.6) {
        inLane = inTargetLane; // 变道后期，已进入新车道
      } else {
        inLane = inOriginalLane || inTargetLane; // 变道中期，两车道都可能碰撞
      }

      // 金币和道具
      if (e.type === "coin" || e.type === "powerup") {
        const dist = Math.abs(e.z - playerZ);
        if (dist > PICKUP_RANGE) continue;
        if (inLane && this.playerY < 1.8) {
          e.collected = true;
          if (e.type === "coin") {
            this.coins++;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            this.comboTimer = CONFIG.COMBO_TIMEOUT;
            audio.sfxCoin();
            this.checkCoinAchievements();
            this.checkComboAchievements();
            if (this.testMode) this.log(`拾取金币(车道${e.lane}) → 金币${this.coins}`);
          } else {
            this.collectPowerUp(e.subtype!);
            if (this.testMode) this.log(`拾取道具:${e.subtype}(车道${e.lane})`);
          }
        }
        continue;
      }

      // 障碍物: 已通过玩家则标记闪避成功
      if (e.z < -COLLISION_RANGE) {
        e.collected = true;
        this.dodges++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.comboTimer = CONFIG.COMBO_TIMEOUT;
        audio.sfxComboUp(this.combo);
        if (this.testMode) this.log(`闪避成功:${e.type}(车道${e.lane}) → 闪避${this.dodges}`);
        continue;
      }

      // 在碰撞范围内才检查碰撞
      const dist = Math.abs(e.z - playerZ);
      if (dist > COLLISION_RANGE) continue;
      if (!inLane) continue;

      const obs = OBSTACLES[e.type as ObstacleType];
      let hit = false;

      if (this.activePowerUps.jetpack > 0) {
        hit = false; // 喷射器无敌
        if (this.testMode) this.log(`喷射器无敌穿过:${e.type}`);
      } else if (obs.action === "jump") {
        // 需要跳跃越过，玩家底部高度需超过障碍物高度(含容错)
        if (this.playerY < obs.height - 0.1) hit = true;
      } else if (obs.action === "slide") {
        // 需要滑铲穿过
        if (!this.isSliding) hit = true;
      } else if (obs.action === "dodge") {
        // 必须变道躲避，同车道即碰撞
        hit = true;
      }

      if (hit) {
        if (this.testMode) this.log(`碰撞! ${e.type}(车道${e.lane}) 玩家高度${this.playerY.toFixed(1)}`);
        if (this.hasShield) {
          this.hasShield = false;
          this.activePowerUps.shield = 0;
          e.collected = true; // 标记已处理，避免重复触发
          audio.sfxCrash();
          const pos2 = this.getPlayerScreenPos();
          this.spawnParticles(pos2.x, pos2.y, CONFIG.COLORS.blue, 20);
          this.cb.onActivePowerUpsChange(this.activePowerUps);
          if (this.testMode) this.log(`护盾抵挡:${e.type}`);
        } else {
          this.gameOver();
          return;
        }
      }
    }
  }

  private collectPowerUp(type: PowerUpType) {
    const emptySlot = this.powerUpSlots.indexOf(null);
    if (emptySlot >= 0) {
      this.powerUpSlots[emptySlot] = type;
      this.cb.onPowerUpSlotsChange(this.powerUpSlots);
      audio.sfxPowerUp();
    }
  }

  private spawnParticles(
    x: number,
    y: number,
    color: string,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 100 + Math.random() * 200;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private gameOver() {
    this.state = "gameover";
    audio.sfxCrash();
    audio.stopBGM();
    const pos3 = this.getPlayerScreenPos();
    this.spawnParticles(
      pos3.x,
      pos3.y,
      CONFIG.COLORS.pink,
      40,
    );
    const score = calculateScore(
      this.distance,
      this.coins,
      this.dodges,
      this.perfectDodges,
      this.combo,
      this.activePowerUps.scoreMultiplier > 0,
    );
    const rewardGold = Math.floor(this.distance / 5) + this.coins;
    // 结算奖励: 钻石(距离里程碑+Combo+完美闪避)
    const rewardDiamond =
      Math.floor(this.distance / 500) + // 每500米1钻石
      (this.maxCombo >= 30 ? 5 : 0) + // Combo>=30 奖励5钻石
      Math.floor(this.perfectDodges / 5); // 每5次完美闪避1钻石
    // 结算奖励: 钥匙(距离突破+Combo突破)
    const rewardKeys =
      (this.distance >= 1000 ? 1 : 0) +
      (this.distance >= 3000 ? 1 : 0) +
      (this.maxCombo >= 50 ? 1 : 0);
    this.cb.onGameOver({
      score,
      distance: Math.floor(this.distance),
      coins: this.coins,
      maxCombo: this.maxCombo,
      dodges: this.dodges,
      perfectDodges: this.perfectDodges,
      rewardGold,
      rewardDiamond,
      rewardKeys,
    });
  }

  // === 成就触发检测 ===
  private triggerAchievement(ach: Achievement) {
    if (this.triggeredAchievements.has(ach.id)) return;
    this.triggeredAchievements.add(ach.id);
    this.cb.onAchievement?.(ach);
  }

  private checkDistanceAchievements() {
    const d = Math.floor(this.distance);
    if (d >= 500) {
      this.triggerAchievement({
        id: "dist_500",
        name: "都市新秀",
        desc: "突破500米",
        rewardDiamond: 2,
      });
    }
    if (d >= 1000) {
      this.triggerAchievement({
        id: "dist_1000",
        name: "霓虹猎手",
        desc: "突破1000米",
        rewardDiamond: 5,
        rewardKeys: 1,
      });
    }
    if (d >= 2000) {
      this.triggerAchievement({
        id: "dist_2000",
        name: "极速穿梭",
        desc: "突破2000米",
        rewardDiamond: 10,
      });
    }
    if (d >= 3000) {
      this.triggerAchievement({
        id: "dist_3000",
        name: "数据风暴",
        desc: "突破3000米",
        rewardDiamond: 15,
        rewardKeys: 1,
      });
    }
    if (d >= 5000) {
      this.triggerAchievement({
        id: "dist_5000",
        name: "传奇跑者",
        desc: "突破5000米",
        rewardDiamond: 30,
        rewardKeys: 2,
      });
    }
  }

  private checkPerfectDodgeAchievements() {
    if (this.perfectDodges >= 10) {
      this.triggerAchievement({
        id: "pd_10",
        name: "极限反应",
        desc: "10次极限闪避",
        rewardDiamond: 5,
      });
    }
    if (this.perfectDodges >= 20) {
      this.triggerAchievement({
        id: "pd_20",
        name: "时间凝滞",
        desc: "20次极限闪避",
        rewardDiamond: 10,
      });
    }
    if (this.perfectDodges >= 30) {
      this.triggerAchievement({
        id: "pd_30",
        name: "矩阵舞者",
        desc: "30次极限闪避",
        rewardDiamond: 20,
        rewardKeys: 1,
      });
    }
  }

  private checkComboAchievements() {
    if (this.combo >= 20) {
      this.triggerAchievement({
        id: "combo_20",
        name: "连击大师",
        desc: "Combo达到20",
        rewardDiamond: 5,
      });
    }
    if (this.combo >= 30) {
      this.triggerAchievement({
        id: "combo_30",
        name: "霓虹之舞",
        desc: "Combo达到30",
        rewardDiamond: 10,
      });
    }
    if (this.combo >= 50) {
      this.triggerAchievement({
        id: "combo_50",
        name: "数据洪流",
        desc: "Combo达到50",
        rewardDiamond: 20,
        rewardKeys: 1,
      });
    }
  }

  private checkCoinAchievements() {
    if (this.coins >= 50) {
      this.triggerAchievement({
        id: "coin_50",
        name: "金币收集者",
        desc: "收集50枚金币",
        rewardDiamond: 3,
      });
    }
    if (this.coins >= 100) {
      this.triggerAchievement({
        id: "coin_100",
        name: "财富猎手",
        desc: "收集100枚金币",
        rewardDiamond: 8,
      });
    }
  }

  // === 渲染 ===
  private render() {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    // 背景
    this.ctx.fillStyle = CONFIG.COLORS.bg;
    this.ctx.fillRect(0, 0, w, h);

    // 远景渐变
    const grad = this.ctx.createLinearGradient(0, 0, 0, h * 0.6);
    grad.addColorStop(0, "rgba(180, 76, 255, 0.15)");
    grad.addColorStop(0.5, "rgba(0, 212, 255, 0.05)");
    grad.addColorStop(1, "rgba(10, 10, 20, 0)");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h * 0.6);

    // 远景建筑剪影
    this.drawSkyline(w, h);

    // 跑道
    this.drawRoad(w, h);

    // 实体(从远到近)
    const sortedEntities = [...this.entities]
      .filter((e) => e.active && !e.collected && e.z > -2 && e.z < 100)
      .sort((a, b) => b.z - a.z);
    for (const e of sortedEntities) {
      this.drawEntity(e, w, h);
    }

    // 玩家
    this.drawPlayer(w, h);

    // 粒子
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur = 0;

    // 慢镜头覆盖
    if (this.state === "slowmotion") {
      this.ctx.fillStyle = "rgba(180, 76, 255, 0.1)";
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  private drawSkyline(w: number, h: number) {
    this.ctx.save();
    const horizonY = h * 0.45;
    // 建筑剪影
    const buildings = 20;
    for (let i = 0; i < buildings; i++) {
      const x = (i / buildings) * w;
      const bw = w / buildings;
      const bh = 50 + Math.sin(i * 2.3 + this.distance * 0.001) * 30 + (i % 3) * 20;
      this.ctx.fillStyle = "rgba(20, 20, 40, 0.8)";
      this.ctx.fillRect(x, horizonY - bh, bw - 2, bh);
      // 窗户灯光
      for (let wy = 0; wy < bh - 10; wy += 8) {
        for (let wx = 2; wx < bw - 6; wx += 6) {
          if (Math.random() > 0.6) {
            const colors = ["#00D4FF", "#FF2D95", "#FFD700"];
            const c = colors[(i + wy) % 3];
            this.ctx.fillStyle = c;
            this.ctx.globalAlpha = 0.3 + Math.sin(this.distance * 0.05 + i + wy) * 0.2;
            this.ctx.fillRect(x + wx, horizonY - bh + wy, 2, 3);
          }
        }
      }
      this.ctx.globalAlpha = 1;
    }
    this.ctx.restore();
  }

  // 透视投影: 将3D坐标(z距离, lane车道, y高度)转为屏幕坐标
  private project(z: number, lane: number, y: number, w: number, h: number) {
    const horizonY = h * 0.45;
    const roadBottomY = h * 0.92;
    const roadHeight = roadBottomY - horizonY;

    // z越大越远, scale越小; z=0时scale=1(最近最大)
    const CAMERA_DEPTH = 4;
    const depth = z + CAMERA_DEPTH;
    const scale = CAMERA_DEPTH / depth;

    // z=0时在跑道底部, z越大越靠近地平线
    const screenY = horizonY + roadHeight * scale;
    const laneOffset = (lane - 1) * CONFIG.LANE_WIDTH * scale * 50;
    const screenX = w / 2 + laneOffset;
    const screenYFinal = screenY - y * scale * 50;

    return { x: screenX, y: screenYFinal, scale };
  }

  private drawRoad(w: number, h: number) {
    const horizonY = h * 0.45;
    const roadBottomY = h * 0.92;

    // 跑道地面
    this.ctx.fillStyle = CONFIG.COLORS.road;
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.35, horizonY);
    this.ctx.lineTo(w * 0.65, horizonY);
    this.ctx.lineTo(w, roadBottomY);
    this.ctx.lineTo(0, roadBottomY);
    this.ctx.closePath();
    this.ctx.fill();

    // 跑道网格线(横向)
    const gridSpacing = 5;
    const startZ = Math.floor(this.distance / gridSpacing) * gridSpacing;
    for (let i = 0; i < 40; i++) {
      const z = startZ - i * gridSpacing + (this.distance % gridSpacing);
      if (z < -2 || z > 100) continue;
      const p1 = this.project(z, 0, 0, w, h);
      const p2 = this.project(z, 2, 0, w, h);
      const alpha = Math.max(0, 1 - z / 80);
      this.ctx.strokeStyle = `rgba(0, 212, 255, ${alpha * 0.3})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }

    // 车道分隔线
    for (let lane = 0; lane <= CONFIG.LANES; lane++) {
      const lanePos = lane - 0.5;
      this.ctx.strokeStyle =
        lane === 0 || lane === CONFIG.LANES
          ? CONFIG.COLORS.blue
          : "rgba(0, 212, 255, 0.4)";
      this.ctx.lineWidth = lane === 0 || lane === CONFIG.LANES ? 2 : 1;
      this.ctx.shadowBlur = lane === 0 || lane === CONFIG.LANES ? 10 : 0;
      this.ctx.shadowColor = CONFIG.COLORS.blue;
      this.ctx.beginPath();
      const top = this.project(100, lanePos, 0, w, h);
      const bottom = this.project(0, lanePos, 0, w, h);
      this.ctx.moveTo(top.x, top.y);
      this.ctx.lineTo(bottom.x, bottom.y);
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;
  }

  private drawEntity(e: Entity, w: number, h: number) {
    const p = this.project(e.z, e.lane + (e.x || 0) * 0.3, 0, w, h);
    if (p.scale < 0.02) return;

    if (e.type === "coin") {
      const size = 8 * p.scale;
      this.ctx.fillStyle = CONFIG.COLORS.gold;
      this.ctx.shadowBlur = 15 * p.scale;
      this.ctx.shadowColor = CONFIG.COLORS.gold;
      this.ctx.beginPath();
      this.ctx.ellipse(p.x, p.y - size, size, size * 1.2, 0, 0, Math.PI * 2);
      this.ctx.fill();
      // 中心高光
      this.ctx.fillStyle = "#FFF8C0";
      this.ctx.beginPath();
      this.ctx.ellipse(p.x, p.y - size, size * 0.4, size * 0.5, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    } else if (e.type === "powerup") {
      const config = POWERUPS[e.subtype!];
      const size = 15 * p.scale;
      this.ctx.fillStyle = config.color;
      this.ctx.shadowBlur = 20 * p.scale;
      this.ctx.shadowColor = config.color;
      // 六边形
      this.ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = p.x + Math.cos(angle) * size;
        const py = p.y - size + Math.sin(angle) * size;
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();
      this.ctx.fill();
      // 图标文字
      this.ctx.font = `${size}px sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(config.icon, p.x, p.y - size);
      this.ctx.shadowBlur = 0;
    } else {
      // 障碍物
      const obs = OBSTACLES[e.type as ObstacleType];
      const size = 30 * p.scale;
      const height = obs.height * 15 * p.scale;

      this.ctx.fillStyle = obs.color;
      this.ctx.shadowBlur = 15 * p.scale;
      this.ctx.shadowColor = obs.color;

      if (e.type === "barrier") {
        // 警示路障
        this.ctx.fillRect(p.x - size / 2, p.y - height, size, height);
        this.ctx.fillStyle = "#000";
        for (let i = 0; i < 3; i++) {
          this.ctx.fillRect(
            p.x - size / 2,
            p.y - height + (i * height) / 3,
            size,
            height / 6,
          );
        }
      } else if (e.type === "patrol") {
        // 机器人
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y - height / 2, size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = "#FFF";
        this.ctx.fillRect(p.x - size / 4, p.y - height / 2 - 2, size / 2, 4);
      } else if (e.type === "trap") {
        // 陷阱地板
        this.ctx.strokeStyle = obs.color;
        this.ctx.lineWidth = 2 * p.scale;
        this.ctx.strokeRect(p.x - size / 2, p.y - 5, size, 5);
        this.ctx.fillStyle = `rgba(0, 212, 255, ${0.3 + Math.sin(this.distance * 0.1) * 0.2})`;
        this.ctx.fillRect(p.x - size / 2, p.y - 5, size, 5);
      } else if (e.type === "laser") {
        // 激光栅栏
        this.ctx.fillRect(p.x - size / 2, p.y - height, size, 4 * p.scale);
        this.ctx.fillStyle = "#FFF";
        this.ctx.fillRect(p.x - size / 2, p.y - height, size, 1);
      } else if (e.type === "drone") {
        // 无人机
        this.ctx.beginPath();
        this.ctx.ellipse(p.x, p.y - height, size / 2, size / 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        // 螺旋桨
        this.ctx.strokeStyle = "#FFF";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(p.x - size, p.y - height);
        this.ctx.lineTo(p.x + size, p.y - height);
        this.ctx.stroke();
      }
      this.ctx.shadowBlur = 0;
    }
  }

  private drawPlayer(w: number, h: number) {
    const p = this.getPlayerScreenPos();
    const size = 30;

    // 残影
    for (const t of this.trailPositions) {
      this.ctx.globalAlpha = t.alpha;
      this.ctx.fillStyle = this.trailColor;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = this.trailColor;
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, size * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;

    // 喷射器火焰
    if (this.activePowerUps.jetpack > 0) {
      this.ctx.fillStyle = CONFIG.COLORS.blue;
      this.ctx.shadowBlur = 30;
      this.ctx.shadowColor = CONFIG.COLORS.blue;
      this.ctx.beginPath();
      this.ctx.ellipse(p.x, p.y + 10, 8, 20 + Math.random() * 10, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 磁铁光环
    if (this.activePowerUps.magnet > 0) {
      this.ctx.strokeStyle = CONFIG.COLORS.pink;
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = CONFIG.COLORS.pink;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size / 2, size + Math.sin(this.distance) * 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // 护盾
    if (this.hasShield) {
      this.ctx.strokeStyle = "#00FFAA";
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = "#00FFAA";
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size / 2, size + 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // 得分倍增光环
    if (this.activePowerUps.scoreMultiplier > 0) {
      this.ctx.strokeStyle = CONFIG.COLORS.gold;
      this.ctx.lineWidth = 1;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = CONFIG.COLORS.gold;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size / 2, size + 8 + Math.sin(this.distance * 2) * 3, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // 角色身体
    this.ctx.fillStyle = this.skinColor;
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = this.skinColor;

    if (this.isSliding) {
      // 滑铲姿势 - 横向椭圆
      this.ctx.beginPath();
      this.ctx.ellipse(p.x, p.y - 5, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // 正常 - 圆形身体
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size / 2, size * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
      // 头部
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size, size * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 数据目镜
    this.ctx.fillStyle = CONFIG.COLORS.pink;
    this.ctx.shadowColor = CONFIG.COLORS.pink;
    this.ctx.fillRect(p.x - size * 0.25, p.y - size - 2, size * 0.5, 3);

    this.ctx.shadowBlur = 0;
  }
}
