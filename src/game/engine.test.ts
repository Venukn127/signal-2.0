import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePolarSignal,
  computeShakeOffset,
  createInitialState,
  getProtectingShipPosition,
  startRun,
  stepSimulation,
  wrapAngle,
} from './engine';
import { GAME_CONFIG, InputState } from './types';

const NO_INPUT: InputState = {
  left: false,
  right: false,
  fireJustPressed: false,
};

test('computePolarSignal wraps 360 degrees cleanly and clamps 0..100', () => {
  const deadOn = computePolarSignal(0, 0, 120);
  assert.equal(Math.round(deadOn.signal), 100);
  assert.equal(Math.round(deadOn.angularDistanceDeg), 0);

  const radarRad = (175 * Math.PI) / 180;
  const shipAngle = (-175 * Math.PI) / 180;
  const shipX = Math.sin(shipAngle) * 120;
  const shipY = Math.cos(shipAngle) * 120;
  const wrapped = computePolarSignal(radarRad, shipX, shipY);
  assert.ok(Math.abs(wrapped.angularDistanceDeg - 10) < 0.01);
  assert.ok(Math.abs(wrapped.signal - 75) < 0.05);

  const opposite = computePolarSignal(0, 0, -120);
  assert.equal(opposite.signal, 0);
});

test('center radar rotates smoothly 360 degrees left and right', () => {
  const state = startRun(null, () => 0.5);
  const startAngle = state.radar.angle;
  for (let i = 0; i < 40; i++) {
    stepSimulation(state, 0.05, { left: false, right: true, fireJustPressed: false });
  }
  assert.notEqual(state.radar.angle, startAngle);
  assert.ok(state.radar.angle >= -Math.PI && state.radar.angle <= Math.PI);
});

test('opponent UFOs orbit far outside player guard ring within outer bounds', () => {
  const state = startRun(null, () => 0.4, { difficulty: 'easy', subLevel: 1 });
  assert.equal(state.enemies.length, 2);
  for (let i = 0; i < 30; i++) {
    stepSimulation(state, 0.05, NO_INPUT);
  }
  for (const enemy of state.enemies) {
    const r = Math.hypot(enemy.x, enemy.y);
    assert.ok(r >= GAME_CONFIG.SHIP_ORBIT_MIN_RADIUS - 0.5);
    assert.ok(r <= GAME_CONFIG.SHIP_ORBIT_MAX_RADIUS + 0.5);
    assert.ok(r > GAME_CONFIG.PLAYER_ORBIT_RADIUS + 50);
  }
});

test('individual opponent reveals only when beam points within lock threshold', () => {
  const state = startRun(null, () => 0.5, { difficulty: 'easy', subLevel: 1 });
  // Place all enemies on opposite side of radar
  state.radar.angle = 0;
  for (const enemy of state.enemies) {
    enemy.orbitAngle = Math.PI;
    enemy.x = Math.sin(Math.PI) * 130;
    enemy.y = Math.cos(Math.PI) * 130;
  }
  stepSimulation(state, 0.016, NO_INPUT);
  assert.equal(state.enemies[0].visible, false);
  assert.equal(state.signal, 0);

  // Align radar with first enemy's current orbitAngle
  state.radar.angle = state.enemies[0].orbitAngle;
  const events = stepSimulation(state, 0.016, NO_INPUT);
  assert.ok(state.signal >= state.levelConfig.lockThreshold);
  assert.equal(state.enemies[0].visible, true);
  assert.ok(events.some((e) => e.type === 'lock_acquired'));
});

test('ShotActive guard prevents simultaneous shots and scales ammo at 4 bullets per enemy', () => {
  const easy1 = startRun(null, () => 0.5, { difficulty: 'easy', subLevel: 1 });
  const hard5 = startRun(null, () => 0.5, { difficulty: 'hard', subLevel: 5 });
  assert.equal(easy1.maxMissiles, 8);
  assert.equal(easy1.missilesLeft, 8);
  assert.equal(hard5.maxMissiles, 20);
  assert.equal(hard5.missilesLeft, 20);
  assert.equal(easy1.timeRemaining, 40);

  const ev1 = stepSimulation(easy1, 0.016, {
    left: false,
    right: false,
    fireJustPressed: true,
  });
  assert.equal(easy1.shotsFired, 1);
  assert.equal(easy1.missilesLeft, 7);
  assert.equal(easy1.missile.active, true);
  assert.ok(ev1.some((e) => e.type === 'missile_fired'));

  const ev2 = stepSimulation(easy1, 0.016, {
    left: false,
    right: false,
    fireJustPressed: true,
  });
  assert.equal(easy1.shotsFired, 1);
  assert.equal(easy1.missilesLeft, 7);
  assert.equal(ev2.some((e) => e.type === 'missile_fired'), false);
});

test('destroying all UFOs (2 hits per ship) wins the wave and tracks enemiesLeft', () => {
  const state = startRun(null, () => 0.5, {
    difficulty: 'easy',
    subLevel: 1,
    radarId: 'mk1',
  });
  assert.equal(state.enemiesTotal, 2);
  assert.equal(state.enemiesLeft, 2);

  // Destroy each UFO with 2 aligned shots
  for (const target of state.enemies) {
    for (let hit = 0; hit < 2; hit++) {
      state.hitstopTimer = 0;
      state.radar.angle = wrapAngle(
        target.orbitAngle + target.orbitDir * 0.08
      );
      stepSimulation(state, 0.016, {
        left: false,
        right: false,
        fireJustPressed: true,
      });
      for (let i = 0; i < 60; i++) {
        stepSimulation(state, 0.025, NO_INPUT);
        if (!state.missile.active) break;
      }
    }
  }

  assert.equal(state.enemiesLeft, 0);
  // Wait for blast completion
  for (let i = 0; i < 30; i++) {
    stepSimulation(state, 0.03, NO_INPUT);
    if (state.outcome !== null) break;
  }

  assert.equal(state.phase, 'gameover');
  assert.equal(state.outcome, 'win');
  assert.equal(state.playerAlive, true);
  assert.equal(state.lastSnapshot?.enemiesDefeated, 2);
  assert.equal(state.lastSnapshot?.enemiesTotal, 2);
});

test('40-second timer expiration triggers timeout loss when enemies remain', () => {
  const state = startRun(null, () => 0.5, {
    difficulty: 'easy',
    subLevel: 1,
    radarId: 'solaris',
  });

  // Orbit continuously for 40s to evade enemy fire until timer runs out
  for (let i = 0; i < 820; i++) {
    stepSimulation(state, 0.05, {
      left: false,
      right: true,
      fireJustPressed: false,
    });
    if (state.outcome !== null) break;
  }

  assert.equal(state.timeRemaining, 0);
  assert.equal(state.phase, 'gameover');
  assert.equal(state.outcome, 'lose');
  assert.equal(state.lossReason, 'timeout');
});

test('expending all 4-per-enemy bullets without clearing enemies triggers out_of_ammo loss', () => {
  const state = startRun(null, () => 0.5, {
    difficulty: 'easy',
    subLevel: 1,
    radarId: 'solaris',
  });
  assert.equal(state.maxMissiles, 8);

  // Fire all 8 shots intentionally away from every enemy
  for (let shot = 0; shot < 8; shot++) {
    // Pick an angle at least 90 degrees away from all alive enemies
    let safeAngle = 0;
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const clear = state.enemies.every(
        (e) => Math.abs(wrapAngle(Math.atan2(e.x, e.y) - rad)) > 0.7
      );
      if (clear) {
        safeAngle = rad;
        break;
      }
    }
    state.radar.angle = safeAngle;
    stepSimulation(state, 0.016, {
      left: false,
      right: false,
      fireJustPressed: true,
    });
    for (let i = 0; i < 40; i++) {
      stepSimulation(state, 0.025, NO_INPUT);
      if (!state.missile.active) break;
    }
  }

  // Wait out the brief 0.25s post-miss resolution beat
  for (let i = 0; i < 20; i++) {
    stepSimulation(state, 0.025, NO_INPUT);
    if (state.outcome !== null) break;
  }

  assert.equal(state.missilesLeft, 0);
  assert.equal(state.phase, 'gameover');
  assert.equal(state.outcome, 'lose');
  assert.equal(state.lossReason, 'out_of_ammo');
});

test('destroying the final enemy with the very last bullet still wins', () => {
  const state = startRun(null, () => 0.5, {
    difficulty: 'easy',
    subLevel: 1,
    radarId: 'mk1',
  });
  // Leave only 1 enemy at 1 HP and 1 bullet left
  state.enemies[0].alive = false;
  state.enemies[0].visible = false;
  state.enemies[1].hp = 1;
  state.enemiesLeft = 1;
  state.missilesLeft = 1;

  state.radar.angle = wrapAngle(
    state.enemies[1].orbitAngle + state.enemies[1].orbitDir * 0.08
  );
  stepSimulation(state, 0.016, {
    left: false,
    right: false,
    fireJustPressed: true,
  });
  assert.equal(state.missilesLeft, 0);

  for (let i = 0; i < 80; i++) {
    stepSimulation(state, 0.025, NO_INPUT);
    if (state.outcome !== null) break;
  }

  assert.equal(state.phase, 'gameover');
  assert.equal(state.outcome, 'win');
  assert.equal(state.lossReason, null);
});

test('title, armory, and levels menu phases stay idle unless autostart=true', () => {
  const menuState = createInitialState(() => 0.5, false);
  assert.equal(menuState.phase, 'title');
  const events = stepSimulation(menuState, 0.05, {
    left: false,
    right: true,
    fireJustPressed: true,
  });
  assert.equal(events.length, 0);
  assert.equal(menuState.radar.angle, 0);

  for (const menuPhase of ['armory', 'levels'] as const) {
    menuState.phase = menuPhase;
    const menuEvents = stepSimulation(menuState, 0.05, {
      left: false,
      right: true,
      fireJustPressed: true,
    });
    assert.equal(menuEvents.length, 0);
    assert.equal(menuState.radar.angle, 0);
  }
});

test('computeShakeOffset scales quadratically with trauma and zeroes at rest', () => {
  assert.deepEqual(computeShakeOffset(0, 1.2), { x: 0, y: 0, rotDeg: 0 });
  assert.deepEqual(computeShakeOffset(0.01, 1.2), { x: 0, y: 0, rotDeg: 0 });

  const light = computeShakeOffset(0.4, 0.5, 14);
  const heavy = computeShakeOffset(1.0, 0.5, 14);
  assert.ok(Math.abs(light.x) > 0 || Math.abs(light.y) > 0);
  assert.ok(Math.hypot(heavy.x, heavy.y) > Math.hypot(light.x, light.y) * 3);
});

test('opponent count and speed increase smoothly from Easy 1 to Hard 5', () => {
  const easy1 = startRun(null, () => 0.5, {
    difficulty: 'easy',
    subLevel: 1,
    radarId: 'mk1',
  });
  const easy3 = startRun(null, () => 0.5, {
    difficulty: 'easy',
    subLevel: 3,
    radarId: 'mk1',
  });
  const medium1 = startRun(null, () => 0.5, {
    difficulty: 'medium',
    subLevel: 1,
    radarId: 'mk1',
  });
  const hard5 = startRun(null, () => 0.5, {
    difficulty: 'hard',
    subLevel: 5,
    radarId: 'solaris',
  });

  assert.equal(easy1.enemiesTotal, 2);
  assert.ok(easy3.enemiesTotal >= 3);
  assert.ok(medium1.enemiesTotal >= 3);
  assert.equal(hard5.enemiesTotal, 5);

  assert.ok(easy1.levelConfig.enemySpeedRad < easy3.levelConfig.enemySpeedRad);
  assert.ok(easy3.levelConfig.enemySpeedRad < medium1.levelConfig.enemySpeedRad);
  assert.ok(medium1.levelConfig.enemySpeedRad < hard5.levelConfig.enemySpeedRad);
  assert.ok(hard5.levelConfig.enemySpeedRad > easy1.levelConfig.enemySpeedRad * 3.2);
});

test('higher radar/armory tiers increase ship hull health (more enemy hits required to die)', () => {
  const mk1 = startRun(null, () => 0.5, { radarId: 'mk1' });
  const aegis = startRun(null, () => 0.5, { radarId: 'aegis' });
  const valkyrie = startRun(null, () => 0.5, { radarId: 'valkyrie' });
  const solaris = startRun(null, () => 0.5, { radarId: 'solaris' });

  assert.equal(mk1.playerMaxHp, 3);
  assert.equal(aegis.playerMaxHp, 4);
  assert.equal(valkyrie.playerMaxHp, 5);
  assert.equal(solaris.playerMaxHp, 6);

  // Solaris takes 6 live enemy hits before being destroyed
  let hits = 0;
  let destroyed = false;
  for (let i = 0; i < 800; i++) {
    const events = stepSimulation(solaris, 0.04, NO_INPUT);
    if (events.some((e) => e.type === 'player_hit')) hits++;
    if (events.some((e) => e.type === 'player_destroyed')) {
      hits++;
      destroyed = true;
    }
    if (solaris.outcome !== null) break;
  }

  assert.equal(hits, 6);
  assert.equal(destroyed, true);
  assert.equal(solaris.playerHp, 0);
  assert.equal(solaris.playerAlive, false);
  assert.equal(solaris.outcome, 'lose');
  assert.equal(solaris.lossReason, 'destroyed');
});

test('protecting ship revolves 360 degrees around Earth outside planet radius and inside enemy orbit', () => {
  const top = getProtectingShipPosition(0);
  const right = getProtectingShipPosition(Math.PI * 0.5);
  const bottom = getProtectingShipPosition(Math.PI);
  const left = getProtectingShipPosition(-Math.PI * 0.5);

  assert.ok(Math.abs(top.x) < 0.01 && Math.abs(top.y - GAME_CONFIG.PLAYER_ORBIT_RADIUS) < 0.01);
  assert.ok(Math.abs(right.x - GAME_CONFIG.PLAYER_ORBIT_RADIUS) < 0.01 && Math.abs(right.y) < 0.01);
  assert.ok(Math.abs(bottom.x) < 0.01 && Math.abs(bottom.y + GAME_CONFIG.PLAYER_ORBIT_RADIUS) < 0.01);
  assert.ok(Math.abs(left.x + GAME_CONFIG.PLAYER_ORBIT_RADIUS) < 0.01 && Math.abs(left.y) < 0.01);
  assert.ok(GAME_CONFIG.PLAYER_ORBIT_RADIUS > GAME_CONFIG.EARTH_RADIUS + 10);
  assert.ok(GAME_CONFIG.PLAYER_ORBIT_RADIUS < GAME_CONFIG.SHIP_ORBIT_MIN_RADIUS - 45);
});
