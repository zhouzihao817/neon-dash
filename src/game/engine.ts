import {
  CONFIG,
  DIFFICULTY,
  OBSTACLES,
  POWERUPS,
  REVIVE_CONFIG,
  getDifficulty,
  getComboMultiplier,
  calculateScore,
  type ObstacleType,
  type PowerUpType,
  type GameState,
  type SkinEffect,
} from "./config";
import { audio } from "./audio";

interface Entity {
  z: number;
  lane: number;
  x: number;
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
  onReviveRequest?: (reviveCount: number) => void;
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

  state: GameState = "ready";
  private distance = 0;
  private speed: number = CONFIG.BASE_SPEED;
  private coins = 0;
  private combo = 0;
  private maxCombo = 0;
  private dodges = 0;
  private perfectDodges = 0;
  private comboTimer = 0;

  reviveCount = 0;
  private invincibleTimer = 0;

  private playerLane = 1;
  private playerTargetLane = 1;
  private playerLaneProgress = 1;
  private playerY = 0;
  private playerVY = 0;
  private isJumping = false;
  private isSliding = false;
  private slideTimer = 0;
  private jumpTimer = 0;
  private canDoubleJump = false;
  private trailPositions: { x: number; y: number; alpha: number }[] = [];

  private entities: Entity[] = [];
  private particles: Particle[] = [];
  private nextSpawnZ = 30;
  private nextCoinLineZ = 20;

  private powerUpSlots: (PowerUpType | null)[] = [null, null, null];
  private activePowerUps: Record<PowerUpType, number> = {
    jetpack: 0, magnet: 0, superShoes: 0, scoreMultiplier: 0, shield: 0,
  };
  private powerUpCooldowns: Record<PowerUpType, number> = {
    jetpack: 0, magnet: 0, superShoes: 0, scoreMultiplier: 0, shield: 0,
  };
  private hasShield = false;

  private slowMotionTimer = 0;
  private timeScale = 1;

  private skinColor: string = CONFIG.COLORS.blue;
  private trailColor: string = CONFIG.COLORS.blue;

  private jumpBoost = 0;
  private coinBonus = 0;
  private scoreBonus = 0;
  private startPowerUp: PowerUpType | null = null;
  private speedBoost = 0;
  private comboProtection = 0;
  private freeReviveCount = 0;
  private magnetBoost = 0;
  private freeReviveLeft = 0;
  private coinFraction = 0;

  private testMode = false;
  private testEntities: Entity[] = [];
  private testLog: string[] = [];

  private triggeredAchievements = new Set<string>();
  private distanceMilestones = [500, 1000, 2000, 3000, 5000];
  private perfectDodgeMilestones = [10, 20, 30];
  private comboMilestones = [20, 30, 50];
  private coinMilestones = [50, 100];

  private lastLaneChangeTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    skinColor: string,
    trailColor: string,
    skinEffects: SkinEffect[] = [],
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = callbacks;
    this.skinColor = skinColor;
    this.trailColor = trailColor;
    for (const eff of skinEffects) {
      switch (eff.type) {
        case "jumpBoost": this.jumpBoost += eff.value; break;
        case "coinBonus": this.coinBonus += eff.value; break;
        case "scoreBonus": this.scoreBonus += eff.value; break;
        case "startPowerUp": this.startPowerUp = eff.powerUpType ?? null; break;
        case "speedBoost": this.speedBoost += eff.value; break;
        case "comboProtection": this.comboProtection += eff.value; break;
        case "freeRevive": this.freeReviveCount += eff.value; break;
        case "magnetBoost": this.magnetBoost += eff.value; break;
      }
    }
    this.freeReviveLeft = this.freeReviveCount;
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
    this.reviveCount = 0;
    this.invincibleTimer = 0;
    this.freeReviveLeft = this.freeReviveCount;
    this.coinFraction = 0;
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
    if (this.startPowerUp) {
      this.powerUpSlots[0] = this.startPowerUp;
    }
    this.activePowerUps = { jetpack: 0, magnet: 0, superShoes: 0, scoreMultiplier: 0, shield: 0 };
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

  startTestMode(mockEntities: { z: number; lane: number; type: string; subtype?: string }[], initialLane = 1) {
    this.testMode = true;
    this.testLog = [];
    this.state = "running";
    this.distance = 0;
    this.speed = 8;
    this.coins = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.dodges = 0;
    this.perfectDodges = 0;
    this.comboTimer = 0;
    this.reviveCount = 0;
    this.invincibleTimer = 0;
    this.freeReviveLeft = this.freeReviveCount;
    this.coinFraction = 0;
    this.playerLane = initialLane;
    this.playerTargetLane = initialLane;
    this.playerLaneProgress = 1;
    this.playerY = 0;
    this.playerVY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.particles = [];
    this.powerUpSlots = [null, null, null];
    this.activePowerUps = { jetpack: 0, magnet: 0, superShoes: 0, scoreMultiplier: 0, shield: 0 };
    this.hasShield = false;
    this.timeScale = 1;
    this.slowMotionTimer = 0;
    this.triggeredAchievements.clear();
    this.entities = mockEntities.map((e) => ({
      z: e.z, lane: e.lane, x: 0,
      type: e.type as Entity["type"],
      subtype: e.subtype as PowerUpType | undefined,
      active: true, collected: false, spawnZ: e.z,
    }));
    this.testEntities = [...this.entities];
    this.lastTime = performance.now();
    this.loop();
    this.cb.onPowerUpSlotsChange(this.powerUpSlots);
    this.cb.onActivePowerUpsChange(this.activePowerUps);
  }

  getTestLog(): string[] { return this.testLog; }
  private log(msg: string) {
    const dist = this.distance.toFixed(1);
    this.testLog.push(`[${dist}m] ${msg}`);
    if (this.testLog.length > 50) this.testLog.shift();
  }
  getTestState() {
    return {
      state: this.state, distance: Math.floor(this.distance), coins: this.coins,
      combo: this.combo, dodges: this.dodges, perfectDodges: this.perfectDodges,
      playerLane: this.playerLane, playerY: this.playerY,
      isJumping: this.isJumping, isSliding: this.isSliding,
      entitiesCount: this.entities.filter((e) => e.active && !e.collected).length,
    };
  }

  getUpcomingEntities(maxDist = 15) {
    return this.entities
      .filter((e) => e.active && !e.collected && e.z > -1 && e.z < maxDist)
      .sort((a, b) => a.z - b.z);
  }
  isLaneSafe(lane: number, fromZ: number, toZ: number): boolean {
    for (const e of this.entities) {
      if (!e.active || e.collected) continue;
      if (e.type === "coin" || e.type === "powerup") continue;
      if (e.lane !== lane) continue;
      if (e.z >= fromZ && e.z <= toZ) return false;
    }
    return true;
  }
  canChangeLane(): boolean { return this.playerLaneProgress >= 0.8 && !this.isJumping; }
  canJump(): boolean { return !this.isJumping || this.canDoubleJump; }
  canSlide(): boolean { return !this.isSliding && !this.isJumping; }

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
      if (this.isJumping && this.canDoubleJump) { this.canDoubleJump = false; }
      this.isJumping = true;
      const heightMult = this.activePowerUps.superShoes > 0 ? 1.5 : 1;
      const jumpHeight = CONFIG.JUMP_HEIGHT * heightMult * (1 + this.jumpBoost);
      this.playerVY = Math.sqrt(2 * 30 * jumpHeight);
      audio.sfxJump();
      this.addTrail();
    }
  }
  slide() {
    if (this.state !== "running") return;
    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = CONFIG.SLIDE_DURATION;
      if (this.isJumping) { this.isJumping = false; this.playerY = 0; this.playerVY = 0; }
      audio.sfxSlide();
    }
  }
  usePowerUp(slot: number) {
    if (this.state !== "running") return;
    const type = this.powerUpSlots[slot];
    if (!type) return;
    if (this.powerUpCooldowns[type] > 0) return;
    this.powerUpSlots[slot] = null;
    const duration = type === "magnet" ? POWERUPS[type].duration * (1 + this.magnetBoost) : POWERUPS[type].duration;
    this.activePowerUps[type] = duration;
    this.powerUpCooldowns[type] = CONFIG.POWERUP_COOLDOWN;
    if (type === "shield") this.hasShield = true;
    if (type === "jetpack") audio.sfxJetpack(); else audio.sfxPowerUp();
    this.cb.onPowerUpSlotsChange(this.powerUpSlots);
    this.cb.onActivePowerUpsChange(this.activePowerUps);
  }

  private checkPerfectDodge(newLane: number) {
    const playerZ = 0;
    for (const e of this.entities) {
      if (!e.active || e.collected) continue;
      if (e.type === "coin" || e.type === "powerup") continue;
      const dist = e.z - playerZ;
      const timeToHit = dist / this.speed;
      if (timeToHit > 0 && timeToHit < CONFIG.PERFECT_DODGE_WINDOW) {
        if (e.lane === this.playerTargetLane && e.lane !== newLane) {
          this.perfectDodges++;
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.comboTimer = this.comboTimeout;
          this.triggerSlowMotion();
          audio.sfxPerfectDodge();
          this.checkPerfectDodgeAchievements();
          this.checkComboAchievements();
          const pos1 = this.getPlayerScreenPos();
          this.spawnParticles(pos1.x, pos1.y, CONFIG.COLORS.purple, 30);
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
    const currentLane = this.playerLaneProgress < 1
      ? this.playerLane + (this.playerTargetLane - this.playerLane) * this.playerLaneProgress
      : this.playerLane;
    return this.project(0, currentLane, this.playerY, w, h);
  }
  private get comboTimeout(): number { return CONFIG.COMBO_TIMEOUT * (1 + this.comboProtection); }
  private collectCoin() {
    this.coinFraction += 1 + this.coinBonus;
    const gained = Math.floor(this.coinFraction);
    this.coinFraction -= gained;
    this.coins += gained;
  }
  private getCurrentScore(): number {
    const base = calculateScore(this.distance, this.coins, this.dodges, this.perfectDodges, this.combo, this.activePowerUps.scoreMultiplier > 0);
    return Math.floor(base * (1 + this.scoreBonus));
  }

  getReviveInfo(): { isFree: boolean; paidReviveCount: number; freeReviveLeft: number; freeReviveCount: number; } {
    const freeReviveUsed = this.freeReviveCount - this.freeReviveLeft;
    const paidReviveCount = Math.max(0, this.reviveCount - freeReviveUsed);
    return { isFree: this.freeReviveLeft > 0, paidReviveCount, freeReviveLeft: this.freeReviveLeft, freeReviveCount: this.freeReviveCount };
  }

  private loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.state === "gameover" || this.state === "revivable") return;
    const scaledDt = dt * this.timeScale;
    if (this.slowMotionTimer > 0) {
      this.slowMotionTimer -= dt;
      if (this.slowMotionTimer <= 0) { this.timeScale = 1; this.state = "running"; this.cb.onSlowMotion(false); }
    }
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= scaledDt;
      if (this.invincibleTimer < 0) this.invincibleTimer = 0;
    }
    const diff = getDifficulty(this.distance);
    this.speed = diff.speed * (1 + this.speedBoost);
    this.distance += this.speed * scaledDt;
    this.cb.onDistanceUpdate(Math.floor(this.distance));
    this.cb.onSpeedUpdate(this.speed);
    this.checkDistanceAchievements();
    if (this.combo > 0) {
      this.comboTimer -= scaledDt;
      if (this.comboTimer <= 0) { this.combo = 0; audio.sfxComboBreak(); this.cb.onComboUpdate(this.combo, getComboMultiplier(this.combo).multiplier); }
    }
    if (this.playerLaneProgress < 1) {
      this.playerLaneProgress = Math.min(1, this.playerLaneProgress + scaledDt / CONFIG.LANE_CHANGE_TIME);
      if (this.playerLaneProgress >= 1) this.playerLane = this.playerTargetLane;
    }
    if (this.isJumping) {
      this.playerY += this.playerVY * scaledDt;
      this.playerVY -= 30 * scaledDt;
      if (this.playerY <= 0) { this.playerY = 0; this.playerVY = 0; this.isJumping = false; if (this.activePowerUps.superShoes > 0) this.canDoubleJump = true; }
    }
    if (this.isSliding) { this.slideTimer -= scaledDt; if (this.slideTimer <= 0) this.isSliding = false; }
    let powerUpsChanged = false;
    for (const key of Object.keys(this.activePowerUps) as PowerUpType[]) {
      if (this.activePowerUps[key] > 0) {
        this.activePowerUps[key] -= scaledDt;
        if (this.activePowerUps[key] <= 0) { this.activePowerUps[key] = 0; if (key === "shield") this.hasShield = false; powerUpsChanged = true; }
      }
      if (this.powerUpCooldowns[key] > 0) { this.powerUpCooldowns[key] -= scaledDt; if (this.powerUpCooldowns[key] < 0) this.powerUpCooldowns[key] = 0; }
    }
    if (powerUpsChanged) this.cb.onActivePowerUpsChange(this.activePowerUps);
    this.spawnEntities(diff);
    for (const e of this.entities) {
      if (!e.active) continue;
      e.z -= this.speed * scaledDt;
      if (e.type === "patrol") { e.x = Math.sin((this.distance + e.spawnZ) * 0.05) * 0.8; }
      if (e.z < -5) e.active = false;
    }
    if (this.activePowerUps.jetpack > 0) {
      for (const e of this.entities) {
        if (!e.active || e.collected) continue;
        if (e.type === "coin") {
          const dist = Math.abs(e.z);
          if (dist < 15) { e.collected = true; this.collectCoin(); this.combo++; this.comboTimer = this.comboTimeout; audio.sfxCoin(); }
        }
      }
    }
    if (this.activePowerUps.magnet > 0) {
      for (const e of this.entities) {
        if (!e.active || e.collected) continue;
        if (e.type === "coin") {
          const dist = Math.abs(e.z);
          if (dist < 10 * (1 + this.magnetBoost) && e.lane !== this.playerLane) { e.lane = this.playerLane; }
        }
      }
    }
    this.checkCollisions();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * scaledDt; p.y += p.vy * scaledDt; p.vy += 200 * scaledDt; p.life -= scaledDt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.trailPositions.length - 1; i >= 0; i--) {
      this.trailPositions[i].alpha -= scaledDt * 2;
      if (this.trailPositions[i].alpha <= 0) this.trailPositions.splice(i, 1);
    }
    const score = this.getCurrentScore();
    this.cb.onScoreUpdate(score);
    this.cb.onCoinsUpdate(this.coins);
    this.cb.onComboUpdate(this.combo, getComboMultiplier(this.combo).multiplier);
  }

  private spawnEntities(diff: ReturnType<typeof getDifficulty>) {
    if (this.testMode) return;
    if (this.distance + 200 > this.nextSpawnZ) {
      const lane = Math.floor(Math.random() * CONFIG.LANES);
      const obstacleType = diff.obstacles[Math.floor(Math.random() * diff.obstacles.length)];
      this.entities.push({ z: this.nextSpawnZ, lane, x: 0, type: obstacleType, active: true, collected: false, spawnZ: this.nextSpawnZ });
      this.nextSpawnZ += diff.density + Math.random() * 2;
      if (this.distance > 1500 && Math.random() < 0.3) {
        const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % CONFIG.LANES;
        this.entities.push({ z: this.nextSpawnZ - diff.density * 0.5, lane: lane2, x: 0, type: diff.obstacles[Math.floor(Math.random() * diff.obstacles.length)], active: true, collected: false, spawnZ: this.nextSpawnZ });
      }
    }
    if (this.distance + 200 > this.nextCoinLineZ) {
      const lane = Math.floor(Math.random() * CONFIG.LANES);
      const count = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        this.entities.push({ z: this.nextCoinLineZ + i * 2, lane, x: 0, type: "coin", active: true, collected: false, spawnZ: this.nextCoinLineZ });
      }
      this.nextCoinLineZ += 30 + Math.random() * 20;
    }
    if (Math.random() < 0.002 && this.distance > 50) {
      const types = Object.keys(POWERUPS) as PowerUpType[];
      const type = types[Math.floor(Math.random() * types.length)];
      const lane = Math.floor(Math.random() * CONFIG.LANES);
      this.entities.push({ z: 80 + Math.random() * 50, lane, x: 0, type: "powerup", subtype: type, active: true, collected: false, spawnZ: 80 });
    }
  }

  private checkCollisions() {
    const playerZ = 0;
    const COLLISION_RANGE = 0.7;
    const PICKUP_RANGE = 1.0;
    for (const e of this.entities) {
      if (!e.active || e.collected) continue;
      let inLane: boolean;
      const inOriginalLane = e.lane === this.playerLane;
      const inTargetLane = e.lane === this.playerTargetLane;
      if (this.playerLane === this.playerTargetLane) { inLane = inOriginalLane; }
      else if (this.playerLaneProgress < 0.4) { inLane = inOriginalLane; }
      else if (this.playerLaneProgress > 0.6) { inLane = inTargetLane; }
      else { inLane = inOriginalLane || inTargetLane; }
      if (e.type === "coin" || e.type === "powerup") {
        const dist = Math.abs(e.z - playerZ);
        if (dist > PICKUP_RANGE) continue;
        if (inLane && this.playerY < 1.8) {
          e.collected = true;
          if (e.type === "coin") {
            this.collectCoin();
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            this.comboTimer = this.comboTimeout;
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
      if (e.z < -COLLISION_RANGE) {
        e.collected = true;
        this.dodges++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.comboTimer = this.comboTimeout;
        audio.sfxComboUp(this.combo);
        if (this.testMode) this.log(`闪避成功:${e.type}(车道${e.lane}) → 闪避${this.dodges}`);
        continue;
      }
      const dist = Math.abs(e.z - playerZ);
      if (dist > COLLISION_RANGE) continue;
      if (!inLane) continue;
      const obs = OBSTACLES[e.type as ObstacleType];
      let hit = false;
      if (this.activePowerUps.jetpack > 0) { hit = false; if (this.testMode) this.log(`喷射器无敌穿过:${e.type}`); }
      else if (obs.action === "jump") { if (this.playerY < obs.height - 0.1) hit = true; }
      else if (obs.action === "slide") { if (!this.isSliding) hit = true; }
      else if (obs.action === "dodge") { hit = true; }
      if (hit) {
        if (this.invincibleTimer > 0) continue;
        if (this.testMode) this.log(`碰撞! ${e.type}(车道${e.lane}) 玩家高度${this.playerY.toFixed(1)}`);
        if (this.hasShield) {
          this.hasShield = false;
          this.activePowerUps.shield = 0;
          e.collected = true;
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

  private spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 100 + Math.random() * 200;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 100, life: 0.5 + Math.random() * 0.5, maxLife: 1, color, size: 2 + Math.random() * 3 });
    }
  }

  private gameOver() {
    if (this.testMode) { this.confirmGameOver(); return; }
    if (this.reviveCount < REVIVE_CONFIG.maxRevives + this.freeReviveCount) {
      this.state = "revivable";
      audio.sfxCrash();
      const pos3 = this.getPlayerScreenPos();
      this.spawnParticles(pos3.x, pos3.y, CONFIG.COLORS.pink, 40);
      this.cb.onReviveRequest?.(this.reviveCount);
      return;
    }
    this.confirmGameOver();
  }

  revive() {
    if (this.freeReviveLeft > 0) { this.freeReviveLeft--; }
    this.reviveCount++;
    this.state = "running";
    this.invincibleTimer = REVIVE_CONFIG.invincibleDuration;
    for (const e of this.entities) {
      if (!e.active) continue;
      if (e.type === "coin" || e.type === "powerup") continue;
      if (e.z > -2 && e.z < REVIVE_CONFIG.clearObstacleDistance) { e.active = false; }
    }
    this.combo = 0;
    this.comboTimer = 0;
    audio.startBGM("play");
  }

  confirmGameOver() {
    this.state = "gameover";
    audio.sfxCrash();
    audio.stopBGM();
    const pos3 = this.getPlayerScreenPos();
    this.spawnParticles(pos3.x, pos3.y, CONFIG.COLORS.pink, 40);
    const score = this.getCurrentScore();
    const rewardGold = Math.floor(this.distance / 5) + this.coins;
    const rewardDiamond = Math.floor(this.distance / 500) + (this.maxCombo >= 30 ? 5 : 0) + Math.floor(this.perfectDodges / 5);
    const rewardKeys = (this.distance >= 1000 ? 1 : 0) + (this.distance >= 3000 ? 1 : 0) + (this.maxCombo >= 50 ? 1 : 0);
    this.cb.onGameOver({ score, distance: Math.floor(this.distance), coins: this.coins, maxCombo: this.maxCombo, dodges: this.dodges, perfectDodges: this.perfectDodges, rewardGold, rewardDiamond, rewardKeys });
  }

  private triggerAchievement(ach: Achievement) {
    if (this.triggeredAchievements.has(ach.id)) return;
    this.triggeredAchievements.add(ach.id);
    this.cb.onAchievement?.(ach);
  }
  private checkDistanceAchievements() {
    const d = Math.floor(this.distance);
    if (d >= 500) this.triggerAchievement({ id: "dist_500", name: "都市新秀", desc: "突破500米", rewardDiamond: 2 });
    if (d >= 1000) this.triggerAchievement({ id: "dist_1000", name: "霓虹猎手", desc: "突破1000米", rewardDiamond: 5, rewardKeys: 1 });
    if (d >= 2000) this.triggerAchievement({ id: "dist_2000", name: "极速穿梭", desc: "突破2000米", rewardDiamond: 10 });
    if (d >= 3000) this.triggerAchievement({ id: "dist_3000", name: "数据风暴", desc: "突破3000米", rewardDiamond: 15, rewardKeys: 1 });
    if (d >= 5000) this.triggerAchievement({ id: "dist_5000", name: "传奇跑者", desc: "突破5000米", rewardDiamond: 30, rewardKeys: 2 });
  }
  private checkPerfectDodgeAchievements() {
    if (this.perfectDodges >= 10) this.triggerAchievement({ id: "pd_10", name: "极限反应", desc: "10次极限闪避", rewardDiamond: 5 });
    if (this.perfectDodges >= 20) this.triggerAchievement({ id: "pd_20", name: "时间凝滞", desc: "20次极限闪避", rewardDiamond: 10 });
    if (this.perfectDodges >= 30) this.triggerAchievement({ id: "pd_30", name: "矩阵舞者", desc: "30次极限闪避", rewardDiamond: 20, rewardKeys: 1 });
  }
  private checkComboAchievements() {
    if (this.combo >= 20) this.triggerAchievement({ id: "combo_20", name: "连击大师", desc: "Combo达到20", rewardDiamond: 5 });
    if (this.combo >= 30) this.triggerAchievement({ id: "combo_30", name: "霓虹之舞", desc: "Combo达到30", rewardDiamond: 10 });
    if (this.combo >= 50) this.triggerAchievement({ id: "combo_50", name: "数据洪流", desc: "Combo达到50", rewardDiamond: 20, rewardKeys: 1 });
  }
  private checkCoinAchievements() {
    if (this.coins >= 50) this.triggerAchievement({ id: "coin_50", name: "金币收集者", desc: "收集50枚金币", rewardDiamond: 3 });
    if (this.coins >= 100) this.triggerAchievement({ id: "coin_100", name: "财富猎手", desc: "收集100枚金币", rewardDiamond: 8 });
  }

  private render() {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.fillStyle = CONFIG.COLORS.bg;
    this.ctx.fillRect(0, 0, w, h);
    const grad = this.ctx.createLinearGradient(0, 0, 0, h * 0.6);
    grad.addColorStop(0, "rgba(180, 76, 255, 0.15)");
    grad.addColorStop(0.5, "rgba(0, 212, 255, 0.05)");
    grad.addColorStop(1, "rgba(10, 10, 20, 0)");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h * 0.6);
    this.drawSkyline(w, h);
    this.drawRoad(w, h);
    const sortedEntities = [...this.entities].filter((e) => e.active && !e.collected && e.z > -2 && e.z < 100).sort((a, b) => b.z - a.z);
    for (const e of sortedEntities) { this.drawEntity(e, w, h); }
    this.drawPlayer(w, h);
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
    if (this.state === "slowmotion") { this.ctx.fillStyle = "rgba(180, 76, 255, 0.1)"; this.ctx.fillRect(0, 0, w, h); }
  }

  private drawSkyline(w: number, h: number) {
    this.ctx.save();
    const horizonY = h * 0.45;
    const buildings = 20;
    for (let i = 0; i < buildings; i++) {
      const x = (i / buildings) * w;
      const bw = w / buildings;
      const bh = 50 + Math.sin(i * 2.3 + this.distance * 0.001) * 30 + (i % 3) * 20;
      this.ctx.fillStyle = "rgba(20, 20, 40, 0.8)";
      this.ctx.fillRect(x, horizonY - bh, bw - 2, bh);
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

  private project(z: number, lane: number, y: number, w: number, h: number) {
    const horizonY = h * 0.45;
    const roadBottomY = h * 0.92;
    const roadHeight = roadBottomY - horizonY;
    const CAMERA_DEPTH = 4;
    const depth = z + CAMERA_DEPTH;
    const scale = CAMERA_DEPTH / depth;
    const screenY = horizonY + roadHeight * scale;
    const laneOffset = (lane - 1) * CONFIG.LANE_WIDTH * scale * 50;
    const screenX = w / 2 + laneOffset;
    const screenYFinal = screenY - y * scale * 50;
    return { x: screenX, y: screenYFinal, scale };
  }

  private drawRoad(w: number, h: number) {
    const horizonY = h * 0.45;
    const roadBottomY = h * 0.92;
    this.ctx.fillStyle = CONFIG.COLORS.road;
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.35, horizonY);
    this.ctx.lineTo(w * 0.65, horizonY);
    this.ctx.lineTo(w, roadBottomY);
    this.ctx.lineTo(0, roadBottomY);
    this.ctx.closePath();
    this.ctx.fill();
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
    for (let lane = 0; lane <= CONFIG.LANES; lane++) {
      const lanePos = lane - 0.5;
      this.ctx.strokeStyle = lane === 0 || lane === CONFIG.LANES ? CONFIG.COLORS.blue : "rgba(0, 212, 255, 0.4)";
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
      this.ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = p.x + Math.cos(angle) * size;
        const py = p.y - size + Math.sin(angle) * size;
        if (i === 0) this.ctx.moveTo(px, py); else this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.font = `${size}px sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(config.icon, p.x, p.y - size);
      this.ctx.shadowBlur = 0;
    } else {
      const obs = OBSTACLES[e.type as ObstacleType];
      const size = 30 * p.scale;
      const height = obs.height * 15 * p.scale;
      this.ctx.fillStyle = obs.color;
      this.ctx.shadowBlur = 15 * p.scale;
      this.ctx.shadowColor = obs.color;
      if (e.type === "barrier") {
        this.ctx.fillRect(p.x - size / 2, p.y - height, size, height);
        this.ctx.fillStyle = "#000";
        for (let i = 0; i < 3; i++) { this.ctx.fillRect(p.x - size / 2, p.y - height + (i * height) / 3, size, height / 6); }
      } else if (e.type === "patrol") {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y - height / 2, size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = "#FFF";
        this.ctx.fillRect(p.x - size / 4, p.y - height / 2 - 2, size / 2, 4);
      } else if (e.type === "trap") {
        this.ctx.strokeStyle = obs.color;
        this.ctx.lineWidth = 2 * p.scale;
        this.ctx.strokeRect(p.x - size / 2, p.y - 5, size, 5);
        this.ctx.fillStyle = `rgba(0, 212, 255, ${0.3 + Math.sin(this.distance * 0.1) * 0.2})`;
        this.ctx.fillRect(p.x - size / 2, p.y - 5, size, 5);
      } else if (e.type === "laser") {
        this.ctx.fillRect(p.x - size / 2, p.y - height, size, 4 * p.scale);
        this.ctx.fillStyle = "#FFF";
        this.ctx.fillRect(p.x - size / 2, p.y - height, size, 1);
      } else if (e.type === "drone") {
        this.ctx.beginPath();
        this.ctx.ellipse(p.x, p.y - height, size / 2, size / 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
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
    if (this.activePowerUps.jetpack > 0) {
      this.ctx.fillStyle = CONFIG.COLORS.blue;
      this.ctx.shadowBlur = 30;
      this.ctx.shadowColor = CONFIG.COLORS.blue;
      this.ctx.beginPath();
      this.ctx.ellipse(p.x, p.y + 10, 8, 20 + Math.random() * 10, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    if (this.activePowerUps.magnet > 0) {
      this.ctx.strokeStyle = CONFIG.COLORS.pink;
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = CONFIG.COLORS.pink;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size / 2, size + Math.sin(this.distance) * 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    if (this.hasShield) {
      this.ctx.strokeStyle = "#00FFAA";
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = "#00FFAA";
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size / 2, size + 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    if (this.activePowerUps.scoreMultiplier > 0) {
      this.ctx.strokeStyle = CONFIG.COLORS.gold;
      this.ctx.lineWidth = 1;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = CONFIG.COLORS.gold;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size / 2, size + 8 + Math.sin(this.distance * 2) * 3, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.fillStyle = this.skinColor;
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = this.skinColor;
    if (this.invincibleTimer > 0) {
      this.ctx.globalAlpha = 0.4 + Math.abs(Math.sin(performance.now() * 0.015)) * 0.6;
    }
    if (this.isSliding) {
      this.ctx.beginPath();
      this.ctx.ellipse(p.x, p.y - 5, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size / 2, size * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y - size, size * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.fillStyle = CONFIG.COLORS.pink;
    this.ctx.shadowColor = CONFIG.COLORS.pink;
    this.ctx.fillRect(p.x - size * 0.25, p.y - size - 2, size * 0.5, 3);
    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;
  }
}
