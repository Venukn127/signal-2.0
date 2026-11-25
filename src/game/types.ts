import {
  DifficultyId,
  LevelConfig,
  RadarConfig,
  RadarId,
  SubLevelNumber,
} from './levels';

export type GamePhase =
  | 'title'
  | 'armory'
  | 'levels'
  | 'playing'
  | 'paused'
  | 'gameover';

export type GameOutcome = 'win' | 'lose' | null;

export type LossReason = 'destroyed' | 'timeout' | 'out_of_ammo' | null;

export interface RadarState {
  angle: number; // radians, 0 = UP, positive = clockwise
  angularVel: number;
}

export interface ShipState {
  id: number;
  x: number;
  y: number;
  orbitAngle: number; // radians around (0, 0)
  orbitRadius: number;
  baseRadius: number;
  radialAmp: number;
  radialFreq: number;
  radialPhase: number;
  orbitDir: 1 | -1;
  angularVel: number;
  targetAngularVel: number;
  turnTimer: number;
  headingAngle: number;
  flightSeed: number;
  visible: boolean;
  hp: number;
  maxHp: number;
  alive: boolean;
  flashTimer: number;
  signal: number;
  angularDistanceDeg: number;
}

export interface MissileState {
  active: boolean;
  x: number;
  y: number;
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  angle: number;
  flightTime: number;
}

export interface LaunchShockwave {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  elapsed: number;
  duration: number;
}

export interface EnemyStrikeState {
  active: boolean;
  phase: 'incoming' | 'impact';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  impactRemaining: number;
  reason: Exclude<LossReason, null>;
}

export interface EnemyAttackMissile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  life: number;
}

export interface BlastState {
  active: boolean;
  x: number;
  y: number;
  elapsed: number;
  duration: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  fireJustPressed: boolean;
}

export interface SimEvent {
  type:
    | 'lock_acquired'
    | 'lock_lost'
    | 'missile_fired'
    | 'shield_hit'
    | 'missile_hit'
    | 'missile_miss'
    | 'enemy_attack_fired'
    | 'enemy_counter_fire'
    | 'player_hit'
    | 'player_destroyed'
    | 'win'
    | 'lose';
  x?: number;
  y?: number;
}

export interface RunSnapshot {
  outcome: Exclude<GameOutcome, null>;
  lossReason: LossReason;
  difficulty: DifficultyId;
  subLevel: SubLevelNumber;
  levelName: string;
  radarId: RadarId;
  timeElapsed: number;
  timeRemaining: number;
  shotsFired: number;
  missilesLeft: number;
  maxMissiles: number;
  enemiesRemaining: number;
  enemiesTotal: number;
  enemiesDefeated: number;
  peakSignal: number;
  lockThreshold: number;
  playerHp: number;
  playerMaxHp: number;
  playerDestroyed: boolean;
}

export interface RunSelection {
  difficulty?: DifficultyId;
  subLevel?: SubLevelNumber;
  radarId?: RadarId;
}

export interface GameState {
  phase: GamePhase;
  outcome: GameOutcome;
  lossReason: LossReason;
  difficulty: DifficultyId;
  subLevel: SubLevelNumber;
  levelConfig: LevelConfig;
  radarConfig: RadarConfig;
  playerAlive: boolean;
  playerHp: number;
  playerMaxHp: number;
  pendingWinRemaining: number | null;
  pendingLoseRemaining: number | null;
  pendingLoseReason: LossReason;
  enemyStrike: EnemyStrikeState | null;
  enemyAttacks: EnemyAttackMissile[];
  enemyAttackTimer: number;
  nextEnemyAttackId: number;
  nextAttackSenderCursor: number;
  radar: RadarState;
  enemies: ShipState[];
  ship: ShipState; // primary/highest-signal active opponent reference
  enemiesLeft: number;
  enemiesTotal: number;
  missile: MissileState;
  launchShockwave: LaunchShockwave;
  blast: BlastState;
  signal: number;
  angularDistanceDeg: number;
  enemyHp: number; // HP of currently targeted/highest-signal enemy
  enemyMaxHp: number;
  missilesLeft: number;
  maxMissiles: number;
  shotsFired: number;
  timeRemaining: number;
  roundElapsed: number;
  peakSignal: number;
  promptTimer: number;
  hitstopTimer: number;
  trauma: number;
  shipFlashTimer: number;
  playerFlashTimer: number;
  lastSnapshot: RunSnapshot | null;
}

export const STAGE_BOUNDS = {
  MIN_X: -240,
  MAX_X: 240,
  MIN_Y: -180,
  MAX_Y: 180,
  WIDTH: 480,
  HEIGHT: 360,
  RADAR_RADIUS: 204,
} as const;

export const GAME_CONFIG = {
  ROUND_DURATION_SEC: 40,
  MISSILES_PER_ENEMY: 4,
  EARTH_RADIUS: 34,
  PLAYER_ORBIT_RADIUS: 64,
  PLAYER_MAX_HP: 3,
  ENEMY_MAX_HP: 2,
  PLAYER_SHIP_HIT_RADIUS: 19,
  ENEMY_ATTACK_INITIAL_DELAY: 2.8,
  ENEMY_ATTACK_INTERVAL_EASY: 3.1,
  ENEMY_ATTACK_INTERVAL_MEDIUM: 2.4,
  ENEMY_ATTACK_INTERVAL_HARD: 1.85,
  ENEMY_ATTACK_SPEED_EASY: 135,
  ENEMY_ATTACK_SPEED_MEDIUM: 160,
  ENEMY_ATTACK_SPEED_HARD: 185,
  RADAR_ROTATE_SPEED_DEG: 140, // base degrees per second
  SHIP_ORBIT_MIN_RADIUS: 158,
  SHIP_ORBIT_MAX_RADIUS: 204,
  SHIP_ORBIT_BASE_MIN: 168,
  SHIP_ORBIT_BASE_MAX: 196,
  SHIP_ORBIT_SPEED_RAD: 0.45, // base radians per second
  MISSILE_SPEED: 620,
  MISSILE_MAX_RANGE: 245,
  ENEMY_MISSILE_SPEED: 310,
  HIT_TOLERANCE: 20,
  PLAYER_HIT_RADIUS: 22,
  LOCK_SIGNAL_THRESHOLD: 80,
  SIGNAL_FALLOFF_PER_DEG: 2.5, // 80% at 8 deg, 0% at 40 deg
  PROMPT_DURATION: 4,
  BLAST_DURATION: 0.44,
  HITSTOP_DURATION: 0.055,
} as const;
