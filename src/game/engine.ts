import { LevelConfig, RadarConfig, getLevelConfig, getRadarConfig } from './levels';
import {
  GAME_CONFIG,
  GameOutcome,
  GameState,
  InputState,
  LossReason,
  RunSelection,
  ShipState,
  SimEvent,
} from './types';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TWO_PI = Math.PI * 2;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function wrapAngle(angle: number): number {
  let a = (angle + Math.PI) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a - Math.PI;
}

export function computeShakeOffset(
  trauma: number,
  timeSec: number,
  maxOffsetPx = 14
): { x: number; y: number; rotDeg: number } {
  const clamped = clamp(trauma, 0, 1);
  if (clamped <= 0.01) {
    return { x: 0, y: 0, rotDeg: 0 };
  }
  const intensity = clamped * clamped;
  const x =
    intensity *
    maxOffsetPx *
    (Math.sin(timeSec * 57) * 0.65 + Math.cos(timeSec * 93) * 0.35);
  const y =
    intensity *
    maxOffsetPx *
    (Math.cos(timeSec * 61) * 0.65 + Math.sin(timeSec * 87) * 0.35);
  const rotDeg = intensity * 0.9 * Math.sin(timeSec * 43);
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    rotDeg: Math.round(rotDeg * 100) / 100,
  };
}

export function computePolarSignal(
  radarAngle: number,
  shipX: number,
  shipY: number,
  falloffPerDeg: number = GAME_CONFIG.SIGNAL_FALLOFF_PER_DEG
): {
  angularDistanceDeg: number;
  signal: number;
} {
  // 0 rad = UP (0, 1), clockwise positive: atan2(x, y)
  const shipAngle = Math.atan2(shipX, shipY);
  const diff = Math.abs(wrapAngle(shipAngle - radarAngle));
  const angularDistanceDeg = diff * RAD_TO_DEG;
  const rawSignal = 100 - angularDistanceDeg * falloffPerDeg;
  const signal = clamp(rawSignal, 0, 100);
  return { angularDistanceDeg, signal };
}

export function getProtectingShipPosition(
  angle: number,
  orbitRadius: number = GAME_CONFIG.PLAYER_ORBIT_RADIUS
): { x: number; y: number } {
  return {
    x: Math.sin(angle) * orbitRadius,
    y: Math.cos(angle) * orbitRadius,
  };
}

function shipCoordsFromOrbit(orbitAngle: number, orbitRadius: number): {
  x: number;
  y: number;
} {
  return {
    x: Math.sin(orbitAngle) * orbitRadius,
    y: Math.cos(orbitAngle) * orbitRadius,
  };
}

function nextFlightRand(ship: ShipState): number {
  ship.flightSeed = (Math.imul(ship.flightSeed, 1664525) + 1013904223) >>> 0;
  return ship.flightSeed / 4294967296;
}

function computeInstantHeading(
  orbitAngle: number,
  orbitRadius: number,
  angularVel: number,
  radialVel: number
): number {
  const sinA = Math.sin(orbitAngle);
  const cosA = Math.cos(orbitAngle);
  const vx = radialVel * sinA + orbitRadius * cosA * angularVel;
  const vy = radialVel * cosA - orbitRadius * sinA * angularVel;
  if (Math.hypot(vx, vy) < 1e-4) {
    return wrapAngle(
      orbitAngle + (angularVel >= 0 ? 1 : -1) * (Math.PI * 0.5)
    );
  }
  return Math.atan2(vx, vy);
}

function createEnemyShip(
  id: number,
  index: number,
  totalCount: number,
  levelConfig: LevelConfig,
  radarConfig: RadarConfig,
  rng: () => number
): ShipState {
  const effectiveFalloff =
    levelConfig.signalFalloffPerDeg * radarConfig.signalFalloffMult;

  const sectorSpan = TWO_PI / Math.max(1, totalCount);
  const baseSector = -Math.PI + sectorSpan * (index + 0.5);
  const jitter = (rng() - 0.5) * sectorSpan * 0.45;
  const orbitAngle = wrapAngle(baseSector + jitter);

  // Stagger orbital bands across multiple enemies so they occupy distinct outer lanes
  const radiusSpan = GAME_CONFIG.SHIP_ORBIT_BASE_MAX - GAME_CONFIG.SHIP_ORBIT_BASE_MIN;
  const laneFrac = totalCount > 1 ? index / (totalCount - 1) : rng();
  const baseRadius = clamp(
    GAME_CONFIG.SHIP_ORBIT_BASE_MIN +
      (laneFrac * 0.55 + rng() * 0.45) * radiusSpan,
    GAME_CONFIG.SHIP_ORBIT_BASE_MIN,
    GAME_CONFIG.SHIP_ORBIT_BASE_MAX
  );

  const radialAmp =
    levelConfig.radialAmpMin +
    rng() * (levelConfig.radialAmpMax - levelConfig.radialAmpMin);
  const radialFreq = 0.65 + rng() * 0.75;
  const radialPhase = rng() * TWO_PI;
  const orbitRadius = clamp(
    baseRadius + Math.sin(radialPhase) * radialAmp,
    GAME_CONFIG.SHIP_ORBIT_MIN_RADIUS,
    GAME_CONFIG.SHIP_ORBIT_MAX_RADIUS
  );

  const orbitDir: 1 | -1 =
    index % 2 === 0 ? (rng() >= 0.4 ? 1 : -1) : rng() >= 0.6 ? 1 : -1;
  const angularSpeed = levelConfig.enemySpeedRad * (0.85 + rng() * 0.3);
  const angularVel = orbitDir * angularSpeed;
  const turnTimer =
    levelConfig.turnMinSec +
    rng() * (levelConfig.turnMaxSec - levelConfig.turnMinSec);
  const flightSeed = Math.floor(rng() * 0xffffffff) >>> 0 || id * 977 + 17;
  const radialVel = radialAmp * radialFreq * Math.cos(radialPhase);
  const headingAngle = computeInstantHeading(
    orbitAngle,
    orbitRadius,
    angularVel,
    radialVel
  );
  const { x, y } = shipCoordsFromOrbit(orbitAngle, orbitRadius);
  const { angularDistanceDeg, signal } = computePolarSignal(
    0,
    x,
    y,
    effectiveFalloff
  );

  return {
    id,
    x,
    y,
    orbitAngle,
    orbitRadius,
    baseRadius,
    radialAmp,
    radialFreq,
    radialPhase,
    orbitDir,
    angularVel,
    targetAngularVel: angularVel,
    turnTimer,
    headingAngle,
    flightSeed,
    visible: signal >= levelConfig.lockThreshold,
    hp: levelConfig.hitsRequired,
    maxHp: levelConfig.hitsRequired,
    alive: true,
    flashTimer: 0,
    signal,
    angularDistanceDeg,
  };
}

function selectPrimaryEnemy(enemies: ShipState[], fallback: ShipState): ShipState {
  let best: ShipState | null = null;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;
    if (!best || e.signal > best.signal) {
      best = e;
    }
  }
  return best ?? fallback;
}

export function createInitialState(
  rng: () => number = Math.random,
  autostart = false,
  selection: RunSelection = {}
): GameState {
  const difficulty = selection.difficulty ?? 'medium';
  const subLevel = selection.subLevel ?? 1;
  const radarId = selection.radarId ?? 'mk1';
  const levelConfig = getLevelConfig(difficulty, subLevel);
  const radarConfig = getRadarConfig(radarId);

  const enemies: ShipState[] = [];
  for (let i = 0; i < levelConfig.enemyCount; i++) {
    enemies.push(
      createEnemyShip(
        i + 1,
        i,
        levelConfig.enemyCount,
        levelConfig,
        radarConfig,
        rng
      )
    );
  }

  const primary = selectPrimaryEnemy(enemies, enemies[0]);
  const playerMaxHp = radarConfig.playerMaxHp;
  const maxMissiles = enemies.length * GAME_CONFIG.MISSILES_PER_ENEMY;

  return {
    phase: autostart ? 'playing' : 'title',
    outcome: null,
    lossReason: null,
    difficulty,
    subLevel,
    levelConfig,
    radarConfig,
    playerAlive: true,
    playerHp: playerMaxHp,
    playerMaxHp,
    pendingWinRemaining: null,
    pendingLoseRemaining: null,
    pendingLoseReason: null,
    enemyStrike: null,
    enemyAttacks: [],
    enemyAttackTimer: GAME_CONFIG.ENEMY_ATTACK_INITIAL_DELAY,
    nextEnemyAttackId: 1,
    nextAttackSenderCursor: 0,
    radar: {
      angle: 0,
      angularVel: 0,
    },
    enemies,
    ship: primary,
    enemiesLeft: enemies.length,
    enemiesTotal: enemies.length,
    missile: {
      active: false,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      flightTime: 0,
    },
    launchShockwave: {
      active: false,
      x: 0,
      y: 0,
      angle: 0,
      elapsed: 0,
      duration: 0.22,
    },
    blast: {
      active: false,
      x: 0,
      y: 0,
      elapsed: 0,
      duration: GAME_CONFIG.BLAST_DURATION,
    },
    signal: primary.signal,
    angularDistanceDeg: primary.angularDistanceDeg,
    enemyHp: primary.hp,
    enemyMaxHp: primary.maxHp,
    missilesLeft: maxMissiles,
    maxMissiles,
    shotsFired: 0,
    timeRemaining: GAME_CONFIG.ROUND_DURATION_SEC,
    roundElapsed: 0,
    peakSignal: Math.round(primary.signal),
    promptTimer: GAME_CONFIG.PROMPT_DURATION,
    hitstopTimer: 0,
    trauma: 0,
    shipFlashTimer: 0,
    playerFlashTimer: 0,
    lastSnapshot: null,
  };
}

export function startRun(
  prev: GameState | null,
  rng: () => number = Math.random,
  selection?: RunSelection
): GameState {
  const resolvedSelection: RunSelection = {
    difficulty: selection?.difficulty ?? prev?.difficulty ?? 'medium',
    subLevel: selection?.subLevel ?? prev?.subLevel ?? 1,
    radarId: selection?.radarId ?? prev?.radarConfig.id ?? 'mk1',
  };

  const fresh = createInitialState(rng, true, resolvedSelection);
  const effectiveFalloff =
    fresh.levelConfig.signalFalloffPerDeg * fresh.radarConfig.signalFalloffMult;

  // Ensure no enemy starts already dead-center in front of the initial 0-deg radar
  for (let i = 0; i < fresh.enemies.length; i++) {
    const enemy = fresh.enemies[i];
    if (enemy.angularDistanceDeg < 35) {
      enemy.orbitAngle = wrapAngle(
        enemy.orbitAngle + (enemy.orbitAngle >= 0 ? 1 : -1) * (Math.PI * 0.45)
      );
      const coords = shipCoordsFromOrbit(enemy.orbitAngle, enemy.orbitRadius);
      enemy.x = coords.x;
      enemy.y = coords.y;
      const radialVel =
        enemy.radialAmp * enemy.radialFreq * Math.cos(enemy.radialPhase);
      enemy.headingAngle = computeInstantHeading(
        enemy.orbitAngle,
        enemy.orbitRadius,
        enemy.angularVel,
        radialVel
      );
      const sig = computePolarSignal(
        fresh.radar.angle,
        enemy.x,
        enemy.y,
        effectiveFalloff
      );
      enemy.angularDistanceDeg = sig.angularDistanceDeg;
      enemy.signal = sig.signal;
      enemy.visible = sig.signal >= fresh.levelConfig.lockThreshold;
    }
  }

  const primary = selectPrimaryEnemy(fresh.enemies, fresh.enemies[0]);
  fresh.ship = primary;
  fresh.signal = primary.signal;
  fresh.angularDistanceDeg = primary.angularDistanceDeg;
  fresh.enemyHp = primary.hp;
  fresh.enemyMaxHp = primary.maxHp;
  fresh.peakSignal = Math.round(primary.signal);

  if (prev) {
    fresh.lastSnapshot = null;
  }
  return fresh;
}

export function fireMissile(state: GameState, events: SimEvent[]): boolean {
  if (state.phase !== 'playing') return false;
  if (
    state.pendingWinRemaining !== null ||
    state.pendingLoseRemaining !== null ||
    state.enemyStrike !== null
  ) {
    return false;
  }
  if (state.missile.active || state.missilesLeft <= 0) return false;

  const angle = state.radar.angle;
  const dirX = Math.sin(angle);
  const dirY = Math.cos(angle);
  const speed = GAME_CONFIG.MISSILE_SPEED * state.radarConfig.missileSpeedMult;

  state.missilesLeft -= 1;
  state.shotsFired += 1;
  state.missile.active = true;
  state.missile.angle = angle;
  // Launch from the protecting ship's nose as it revolves around Earth
  const launchDist = GAME_CONFIG.PLAYER_ORBIT_RADIUS + 20;
  state.missile.startX = dirX * launchDist;
  state.missile.startY = dirY * launchDist;
  state.missile.x = state.missile.startX;
  state.missile.y = state.missile.startY;
  state.missile.vx = dirX * speed;
  state.missile.vy = dirY * speed;
  state.missile.flightTime = 0;

  state.launchShockwave = {
    active: true,
    x: state.missile.startX,
    y: state.missile.startY,
    angle,
    elapsed: 0,
    duration: 0.22,
  };

  state.trauma = Math.min(1, state.trauma + 0.44);

  events.push({
    type: 'missile_fired',
    x: state.missile.x,
    y: state.missile.y,
  });

  return true;
}

function finalizeOutcome(
  state: GameState,
  outcome: Exclude<GameOutcome, null>,
  lossReason: LossReason,
  events: SimEvent[]
): void {
  state.phase = 'gameover';
  state.outcome = outcome;
  state.lossReason = lossReason;
  state.pendingWinRemaining = null;
  state.pendingLoseRemaining = null;
  state.pendingLoseReason = null;
  state.enemyStrike = null;
  state.enemyAttacks = [];
  state.lastSnapshot = {
    outcome,
    lossReason,
    difficulty: state.difficulty,
    subLevel: state.subLevel,
    levelName: state.levelConfig.name,
    radarId: state.radarConfig.id,
    timeElapsed: Math.round(state.roundElapsed * 10) / 10,
    timeRemaining: Math.max(0, Math.round(state.timeRemaining * 10) / 10),
    shotsFired: state.shotsFired,
    missilesLeft: state.missilesLeft,
    maxMissiles: state.maxMissiles,
    enemiesRemaining: state.enemiesLeft,
    enemiesTotal: state.enemiesTotal,
    enemiesDefeated: state.enemiesTotal - state.enemiesLeft,
    peakSignal: Math.round(state.peakSignal),
    lockThreshold: state.levelConfig.lockThreshold,
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    playerDestroyed: !state.playerAlive,
  };

  events.push({
    type: outcome === 'win' ? 'win' : 'lose',
    x: outcome === 'win' ? state.ship.x : 0,
    y: outcome === 'win' ? state.ship.y : 0,
  });
}

export function stepSimulation(
  state: GameState,
  rawDt: number,
  input: InputState
): SimEvent[] {
  const events: SimEvent[] = [];
  const dt = Math.min(Math.max(rawDt, 0), 0.05);

  if (state.phase !== 'playing' || dt <= 0) {
    return events;
  }

  // Decay visual trauma, hit flashes, launch shockwave, and active blast even during hitstop
  state.trauma = Math.max(0, state.trauma - dt * 1.9);
  state.shipFlashTimer = Math.max(0, state.shipFlashTimer - dt);
  state.playerFlashTimer = Math.max(0, state.playerFlashTimer - dt);
  for (let i = 0; i < state.enemies.length; i++) {
    if (state.enemies[i].flashTimer > 0) {
      state.enemies[i].flashTimer = Math.max(
        0,
        state.enemies[i].flashTimer - dt
      );
    }
  }

  if (state.launchShockwave.active) {
    state.launchShockwave.elapsed += dt;
    if (state.launchShockwave.elapsed >= state.launchShockwave.duration) {
      state.launchShockwave.active = false;
    }
  }

  if (state.blast.active) {
    state.blast.elapsed += dt;
    if (state.blast.elapsed >= state.blast.duration) {
      state.blast.active = false;
    }
  }

  // Hitstop pauses simulation physics briefly for impact weight
  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return events;
  }

  // Pending win resolution beat (watching final opponent blast expand)
  if (state.pendingWinRemaining !== null) {
    state.pendingWinRemaining -= dt;
    if (state.pendingWinRemaining <= 0) {
      finalizeOutcome(state, 'win', null, events);
    }
    return events;
  }

  // Pending lose resolution beat (watching player ship explosion after final hit)
  if (state.pendingLoseRemaining !== null) {
    state.pendingLoseRemaining -= dt;
    if (state.pendingLoseRemaining <= 0) {
      finalizeOutcome(
        state,
        'lose',
        state.pendingLoseReason ?? 'destroyed',
        events
      );
    }
    return events;
  }

  // 1. Prompt timer, elapsed survival time, & 40-second countdown timer
  if (state.promptTimer > 0) {
    state.promptTimer = Math.max(0, state.promptTimer - dt);
  }
  state.roundElapsed += dt;
  state.timeRemaining = Math.max(0, state.timeRemaining - dt);
  if (state.timeRemaining <= 0) {
    finalizeOutcome(state, 'lose', 'timeout', events);
    return events;
  }

  // 2. Center radar / protecting ship orbit rotation scaled by equipped radar gimbal speed
  const turnAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const rotateSpeedRad =
    GAME_CONFIG.RADAR_ROTATE_SPEED_DEG *
    state.radarConfig.rotationSpeedMult *
    DEG_TO_RAD;
  state.radar.angularVel = turnAxis * rotateSpeedRad;
  state.radar.angle = wrapAngle(
    state.radar.angle + state.radar.angularVel * dt
  );

  // 3. Step all alive opponent UFOs + compute per-ship signal and lock-on visibility
  const prevAnyLocked = state.signal >= state.levelConfig.lockThreshold;
  const effectiveFalloff =
    state.levelConfig.signalFalloffPerDeg * state.radarConfig.signalFalloffMult;

  const aliveEnemies: ShipState[] = [];
  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    if (!enemy.alive) continue;
    aliveEnemies.push(enemy);

    const prevX = enemy.x;
    const prevY = enemy.y;

    enemy.turnTimer -= dt;
    if (enemy.turnTimer <= 0) {
      const flipRoll = nextFlightRand(enemy);
      const speedRoll = nextFlightRand(enemy);
      const timerRoll = nextFlightRand(enemy);
      if (flipRoll < state.levelConfig.flipChance) {
        enemy.orbitDir = enemy.orbitDir === 1 ? -1 : 1;
      }
      const speedMult = 0.72 + speedRoll * 0.7;
      enemy.targetAngularVel =
        enemy.orbitDir * state.levelConfig.enemySpeedRad * speedMult;
      enemy.turnTimer =
        state.levelConfig.turnMinSec +
        timerRoll * (state.levelConfig.turnMaxSec - state.levelConfig.turnMinSec);
    }

    const damp = Math.min(1, dt * 3.8);
    enemy.angularVel += (enemy.targetAngularVel - enemy.angularVel) * damp;
    enemy.orbitAngle = wrapAngle(enemy.orbitAngle + enemy.angularVel * dt);

    const radialWave =
      Math.sin(state.roundElapsed * enemy.radialFreq + enemy.radialPhase) *
      enemy.radialAmp;
    enemy.orbitRadius = clamp(
      enemy.baseRadius + radialWave,
      GAME_CONFIG.SHIP_ORBIT_MIN_RADIUS,
      GAME_CONFIG.SHIP_ORBIT_MAX_RADIUS
    );

    const nextPos = shipCoordsFromOrbit(enemy.orbitAngle, enemy.orbitRadius);
    enemy.x = nextPos.x;
    enemy.y = nextPos.y;

    const moveDx = enemy.x - prevX;
    const moveDy = enemy.y - prevY;
    if (Math.hypot(moveDx, moveDy) > 0.001) {
      enemy.headingAngle = Math.atan2(moveDx, moveDy);
    }

    const { angularDistanceDeg, signal } = computePolarSignal(
      state.radar.angle,
      enemy.x,
      enemy.y,
      effectiveFalloff
    );
    enemy.angularDistanceDeg = angularDistanceDeg;
    enemy.signal = signal;
    enemy.visible = signal >= state.levelConfig.lockThreshold;
  }

  state.enemiesLeft = aliveEnemies.length;
  const primary = selectPrimaryEnemy(state.enemies, state.ship);
  state.ship = primary;
  state.signal = primary.alive ? primary.signal : 0;
  state.angularDistanceDeg = primary.alive ? primary.angularDistanceDeg : 180;
  state.enemyHp = primary.alive ? primary.hp : 0;
  state.enemyMaxHp = primary.maxHp;

  if (state.signal > state.peakSignal) {
    state.peakSignal = Math.round(state.signal);
  }

  const nowAnyLocked = state.signal >= state.levelConfig.lockThreshold;
  if (!prevAnyLocked && nowAnyLocked) {
    events.push({ type: 'lock_acquired', x: primary.x, y: primary.y });
  } else if (prevAnyLocked && !nowAnyLocked) {
    events.push({ type: 'lock_lost', x: primary.x, y: primary.y });
  }

  // 4. Edge-triggered firing from protecting ship
  if (input.fireJustPressed) {
    fireMissile(state, events);
  }

  // 5. Active player missile flight & collision against all alive enemies
  if (state.missile.active) {
    state.missile.flightTime += dt;
    state.missile.x += state.missile.vx * dt;
    state.missile.y += state.missile.vy * dt;

    let hitEnemy: ShipState | null = null;
    let closestDist = state.levelConfig.hitTolerance;
    for (let i = 0; i < aliveEnemies.length; i++) {
      const enemy = aliveEnemies[i];
      const d = Math.hypot(
        state.missile.x - enemy.x,
        state.missile.y - enemy.y
      );
      if (d < closestDist) {
        closestDist = d;
        hitEnemy = enemy;
      }
    }

    const rangeFromCenter = Math.hypot(state.missile.x, state.missile.y);

    if (hitEnemy) {
      state.missile.active = false;
      hitEnemy.visible = true;
      hitEnemy.flashTimer = 0.09;
      state.shipFlashTimer = 0.09;
      state.hitstopTimer = GAME_CONFIG.HITSTOP_DURATION;
      hitEnemy.hp = Math.max(0, hitEnemy.hp - 1);

      if (hitEnemy.hp > 0) {
        // Damaged UFO jolts into an evasive counter-jink
        state.trauma = Math.min(1, state.trauma + 0.48);
        hitEnemy.orbitDir = hitEnemy.orbitDir === 1 ? -1 : 1;
        hitEnemy.targetAngularVel =
          hitEnemy.orbitDir * state.levelConfig.enemySpeedRad * 1.4;
        hitEnemy.turnTimer = state.levelConfig.turnMinSec * 0.75;
        state.enemyHp = hitEnemy.hp;
        events.push({ type: 'shield_hit', x: hitEnemy.x, y: hitEnemy.y });

        if (state.missilesLeft <= 0 && state.enemiesLeft > 0) {
          state.pendingLoseRemaining = 0.25;
          state.pendingLoseReason = 'out_of_ammo';
        }
      } else {
        hitEnemy.alive = false;
        hitEnemy.visible = false;
        state.enemiesLeft = Math.max(0, state.enemiesLeft - 1);
        state.trauma = 0.88;
        state.blast = {
          active: true,
          x: hitEnemy.x,
          y: hitEnemy.y,
          elapsed: 0,
          duration: GAME_CONFIG.BLAST_DURATION,
        };
        events.push({ type: 'missile_hit', x: hitEnemy.x, y: hitEnemy.y });

        if (state.enemiesLeft <= 0) {
          state.enemyHp = 0;
          state.pendingWinRemaining = GAME_CONFIG.BLAST_DURATION;
        } else {
          const nextPrimary = selectPrimaryEnemy(state.enemies, state.ship);
          state.ship = nextPrimary;
          state.enemyHp = nextPrimary.hp;
          if (state.missilesLeft <= 0) {
            state.pendingLoseRemaining = 0.25;
            state.pendingLoseReason = 'out_of_ammo';
          }
        }
      }
    } else if (rangeFromCenter >= GAME_CONFIG.MISSILE_MAX_RANGE) {
      const missX = state.missile.x;
      const missY = state.missile.y;
      state.missile.active = false;
      state.trauma = Math.min(1, state.trauma + 0.16);
      events.push({ type: 'missile_miss', x: missX, y: missY });

      if (state.missilesLeft <= 0 && state.enemiesLeft > 0) {
        state.pendingLoseRemaining = 0.25;
        state.pendingLoseReason = 'out_of_ammo';
      }
    }
  }

  // 6. Live enemy missile attacks targeting our protecting ship while hunting & firing
  const baseInterval =
    state.difficulty === 'easy'
      ? GAME_CONFIG.ENEMY_ATTACK_INTERVAL_EASY
      : state.difficulty === 'hard'
        ? GAME_CONFIG.ENEMY_ATTACK_INTERVAL_HARD
        : GAME_CONFIG.ENEMY_ATTACK_INTERVAL_MEDIUM;
  // Slightly brisker volley cadence when 3+ UFOs are still alive, easing off as you thin the wave
  const attackInterval = Math.max(
    1.15,
    baseInterval - Math.max(0, state.enemiesLeft - 2) * 0.16
  );
  const attackSpeed =
    state.difficulty === 'easy'
      ? GAME_CONFIG.ENEMY_ATTACK_SPEED_EASY
      : state.difficulty === 'hard'
        ? GAME_CONFIG.ENEMY_ATTACK_SPEED_HARD
        : GAME_CONFIG.ENEMY_ATTACK_SPEED_MEDIUM;

  const playerShipPos = getProtectingShipPosition(state.radar.angle);

  if (state.enemiesLeft > 0 && state.pendingWinRemaining === null) {
    state.enemyAttackTimer -= dt;
    if (state.enemyAttackTimer <= 0 && state.playerAlive) {
      state.enemyAttackTimer = attackInterval;
      const attackers = state.enemies.filter((e) => e.alive);
      if (attackers.length > 0) {
        const sender =
          attackers[state.nextAttackSenderCursor % attackers.length];
        state.nextAttackSenderCursor =
          (state.nextAttackSenderCursor + 1) % attackers.length;
        const dx = playerShipPos.x - sender.x;
        const dy = playerShipPos.y - sender.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        state.enemyAttacks.push({
          id: state.nextEnemyAttackId++,
          x: sender.x,
          y: sender.y,
          vx: (dx / dist) * attackSpeed,
          vy: (dy / dist) * attackSpeed,
          angle: Math.atan2(dx, dy),
          life: 0,
        });
        events.push({
          type: 'enemy_attack_fired',
          x: sender.x,
          y: sender.y,
        });
      }
    }
  }

  if (state.enemyAttacks.length > 0) {
    const remaining: typeof state.enemyAttacks = [];
    for (let i = 0; i < state.enemyAttacks.length; i++) {
      const atk = state.enemyAttacks[i];
      atk.x += atk.vx * dt;
      atk.y += atk.vy * dt;
      atk.life += dt;

      const distToPlayer = Math.hypot(
        atk.x - playerShipPos.x,
        atk.y - playerShipPos.y
      );
      if (distToPlayer <= GAME_CONFIG.PLAYER_SHIP_HIT_RADIUS) {
        state.playerHp = Math.max(0, state.playerHp - 1);
        state.playerFlashTimer = 0.16;
        state.hitstopTimer = GAME_CONFIG.HITSTOP_DURATION;

        if (state.playerHp <= 0) {
          state.playerAlive = false;
          state.trauma = 1.0;
          state.blast = {
            active: true,
            x: playerShipPos.x,
            y: playerShipPos.y,
            elapsed: 0,
            duration: GAME_CONFIG.BLAST_DURATION,
          };
          state.pendingLoseRemaining = GAME_CONFIG.BLAST_DURATION;
          state.pendingLoseReason = 'destroyed';
          events.push({
            type: 'player_destroyed',
            x: playerShipPos.x,
            y: playerShipPos.y,
          });
          state.enemyAttacks = [];
          return events;
        } else {
          state.trauma = Math.min(1, state.trauma + 0.56);
          events.push({
            type: 'player_hit',
            x: playerShipPos.x,
            y: playerShipPos.y,
          });
        }
        continue;
      }

      const distToCenter = Math.hypot(atk.x, atk.y);
      if (atk.life > 4.2 || distToCenter > 260) {
        continue;
      }
      remaining.push(atk);
    }
    state.enemyAttacks = remaining;
  }

  return events;
}
