export type DifficultyId = 'easy' | 'medium' | 'hard';
export type SubLevelNumber = 1 | 2 | 3 | 4 | 5;
export type RadarId = 'mk1' | 'aegis' | 'valkyrie' | 'solaris';

export interface LevelConfig {
  id: string;
  difficulty: DifficultyId;
  subLevel: SubLevelNumber;
  name: string;
  subtitle: string;
  enemyCount: number;
  hitsRequired: number;
  lockThreshold: number;
  signalFalloffPerDeg: number;
  enemySpeedRad: number;
  radialAmpMin: number;
  radialAmpMax: number;
  flipChance: number;
  turnMinSec: number;
  turnMaxSec: number;
  hitTolerance: number;
  coinReward: number;
}

export interface RadarConfig {
  id: RadarId;
  name: string;
  tagline: string;
  cost: number;
  rotationSpeedMult: number;
  signalFalloffMult: number; // < 1 means wider detection cone / stronger signal
  missileSpeedMult: number;
  playerMaxHp: number;
  accentHex: string;
  accentRgb: string;
  lockHex: string;
  lockRgb: string;
  ringRgb: string;
}

export const DIFFICULTIES: readonly {
  id: DifficultyId;
  label: string;
  summary: string;
}[] = [
  {
    id: 'easy',
    label: 'Easy',
    summary: '5 sectors · starts with 2 slow UFOs, rising to 3 brisk raiders.',
  },
  {
    id: 'medium',
    label: 'Medium',
    summary: '5 tactical sectors · 3 to 4 agile UFOs with steady enemy fire.',
  },
  {
    id: 'hard',
    label: 'Hard',
    summary: '5 extreme sectors · 4 to 5 fast stealth UFOs & relentless salvos.',
  },
] as const;

export const LEVELS: readonly LevelConfig[] = [
  // ================= EASY (5 SUB-LEVELS) =================
  {
    id: 'easy-1',
    difficulty: 'easy',
    subLevel: 1,
    name: 'Twin Scouts',
    subtitle: '2 slow recon UFOs orbiting at far range.',
    enemyCount: 2,
    hitsRequired: 2,
    lockThreshold: 72,
    signalFalloffPerDeg: 2.2,
    enemySpeedRad: 0.32,
    radialAmpMin: 6,
    radialAmpMax: 12,
    flipChance: 0.4,
    turnMinSec: 2.6,
    turnMaxSec: 4.2,
    hitTolerance: 23,
    coinReward: 30,
  },
  {
    id: 'easy-2',
    difficulty: 'easy',
    subLevel: 2,
    name: 'Weave Pair',
    subtitle: '2 drifting UFOs with gentle radial weaving.',
    enemyCount: 2,
    hitsRequired: 2,
    lockThreshold: 76,
    signalFalloffPerDeg: 2.35,
    enemySpeedRad: 0.38,
    radialAmpMin: 8,
    radialAmpMax: 15,
    flipChance: 0.52,
    turnMinSec: 2.2,
    turnMaxSec: 3.6,
    hitTolerance: 21,
    coinReward: 40,
  },
  {
    id: 'easy-3',
    difficulty: 'easy',
    subLevel: 3,
    name: 'Outer Triad',
    subtitle: '3 elusive UFO saucers guarding the outer perimeter.',
    enemyCount: 3,
    hitsRequired: 2,
    lockThreshold: 79,
    signalFalloffPerDeg: 2.5,
    enemySpeedRad: 0.44,
    radialAmpMin: 10,
    radialAmpMax: 18,
    flipChance: 0.62,
    turnMinSec: 1.85,
    turnMaxSec: 3.1,
    hitTolerance: 20,
    coinReward: 55,
  },
  {
    id: 'easy-4',
    difficulty: 'easy',
    subLevel: 4,
    name: 'Ironclad Trio',
    subtitle: '3 armored UFOs picking up orbital pace.',
    enemyCount: 3,
    hitsRequired: 2,
    lockThreshold: 81,
    signalFalloffPerDeg: 2.6,
    enemySpeedRad: 0.5,
    radialAmpMin: 11,
    radialAmpMax: 20,
    flipChance: 0.68,
    turnMinSec: 1.55,
    turnMaxSec: 2.8,
    hitTolerance: 19,
    coinReward: 70,
  },
  {
    id: 'easy-5',
    difficulty: 'easy',
    subLevel: 5,
    name: 'Vanguard Flight',
    subtitle: '3 brisk saucers with sharper evasive turns.',
    enemyCount: 3,
    hitsRequired: 2,
    lockThreshold: 83,
    signalFalloffPerDeg: 2.75,
    enemySpeedRad: 0.56,
    radialAmpMin: 12,
    radialAmpMax: 22,
    flipChance: 0.72,
    turnMinSec: 1.35,
    turnMaxSec: 2.5,
    hitTolerance: 18,
    coinReward: 90,
  },

  // ================= MEDIUM (5 SUB-LEVELS) =================
  {
    id: 'medium-1',
    difficulty: 'medium',
    subLevel: 1,
    name: 'Vector Squadron',
    subtitle: '3 tactical UFO saucers crisscrossing outer orbit.',
    enemyCount: 3,
    hitsRequired: 2,
    lockThreshold: 82,
    signalFalloffPerDeg: 2.65,
    enemySpeedRad: 0.58,
    radialAmpMin: 11,
    radialAmpMax: 20,
    flipChance: 0.74,
    turnMinSec: 1.4,
    turnMaxSec: 2.7,
    hitTolerance: 19,
    coinReward: 80,
  },
  {
    id: 'medium-2',
    difficulty: 'medium',
    subLevel: 2,
    name: 'Evasive Formation',
    subtitle: '3 fast strikers weaving across deep-space lanes.',
    enemyCount: 3,
    hitsRequired: 2,
    lockThreshold: 84,
    signalFalloffPerDeg: 2.8,
    enemySpeedRad: 0.64,
    radialAmpMin: 12,
    radialAmpMax: 22,
    flipChance: 0.78,
    turnMinSec: 1.25,
    turnMaxSec: 2.4,
    hitTolerance: 18,
    coinReward: 100,
  },
  {
    id: 'medium-3',
    difficulty: 'medium',
    subLevel: 3,
    name: 'Ghost Quartet',
    subtitle: '4 agile UFOs attacking from shifting bearings.',
    enemyCount: 4,
    hitsRequired: 2,
    lockThreshold: 85,
    signalFalloffPerDeg: 2.95,
    enemySpeedRad: 0.7,
    radialAmpMin: 13,
    radialAmpMax: 23,
    flipChance: 0.82,
    turnMinSec: 1.1,
    turnMaxSec: 2.1,
    hitTolerance: 17,
    coinReward: 125,
  },
  {
    id: 'medium-4',
    difficulty: 'medium',
    subLevel: 4,
    name: 'Twin-Core Pack',
    subtitle: '4 coordinated saucers with steady counter-fire.',
    enemyCount: 4,
    hitsRequired: 2,
    lockThreshold: 86,
    signalFalloffPerDeg: 3.1,
    enemySpeedRad: 0.76,
    radialAmpMin: 14,
    radialAmpMax: 24,
    flipChance: 0.85,
    turnMinSec: 1.0,
    turnMaxSec: 1.9,
    hitTolerance: 16,
    coinReward: 150,
  },
  {
    id: 'medium-5',
    difficulty: 'medium',
    subLevel: 5,
    name: 'Mirage Wing',
    subtitle: '4 high-speed UFOs executing rapid reversals.',
    enemyCount: 4,
    hitsRequired: 2,
    lockThreshold: 88,
    signalFalloffPerDeg: 3.2,
    enemySpeedRad: 0.82,
    radialAmpMin: 14,
    radialAmpMax: 25,
    flipChance: 0.88,
    turnMinSec: 0.9,
    turnMaxSec: 1.75,
    hitTolerance: 15,
    coinReward: 185,
  },

  // ================= HARD (5 SUB-LEVELS) =================
  {
    id: 'hard-1',
    difficulty: 'hard',
    subLevel: 1,
    name: 'Redline Swarm',
    subtitle: '4 stealth UFO raiders with tight lock thresholds.',
    enemyCount: 4,
    hitsRequired: 2,
    lockThreshold: 87,
    signalFalloffPerDeg: 3.15,
    enemySpeedRad: 0.84,
    radialAmpMin: 14,
    radialAmpMax: 24,
    flipChance: 0.86,
    turnMinSec: 0.9,
    turnMaxSec: 1.85,
    hitTolerance: 16,
    coinReward: 160,
  },
  {
    id: 'hard-2',
    difficulty: 'hard',
    subLevel: 2,
    name: 'Apex Raiders',
    subtitle: '4 high-velocity saucers with erratic directional flips.',
    enemyCount: 4,
    hitsRequired: 2,
    lockThreshold: 89,
    signalFalloffPerDeg: 3.3,
    enemySpeedRad: 0.9,
    radialAmpMin: 15,
    radialAmpMax: 25,
    flipChance: 0.88,
    turnMinSec: 0.8,
    turnMaxSec: 1.65,
    hitTolerance: 15,
    coinReward: 195,
  },
  {
    id: 'hard-3',
    difficulty: 'hard',
    subLevel: 3,
    name: 'Shadow Armada',
    subtitle: '5 cloaked UFOs surging across outer space.',
    enemyCount: 5,
    hitsRequired: 2,
    lockThreshold: 90,
    signalFalloffPerDeg: 3.45,
    enemySpeedRad: 0.96,
    radialAmpMin: 16,
    radialAmpMax: 26,
    flipChance: 0.9,
    turnMinSec: 0.75,
    turnMaxSec: 1.5,
    hitTolerance: 14.5,
    coinReward: 230,
  },
  {
    id: 'hard-4',
    difficulty: 'hard',
    subLevel: 4,
    name: 'Void Tempest',
    subtitle: '5 relentless saucers firing rapid intercepts.',
    enemyCount: 5,
    hitsRequired: 2,
    lockThreshold: 91,
    signalFalloffPerDeg: 3.6,
    enemySpeedRad: 1.04,
    radialAmpMin: 16,
    radialAmpMax: 27,
    flipChance: 0.92,
    turnMinSec: 0.65,
    turnMaxSec: 1.3,
    hitTolerance: 14,
    coinReward: 280,
  },
  {
    id: 'hard-5',
    difficulty: 'hard',
    subLevel: 5,
    name: 'Omega Fleet',
    subtitle: '5 elite UFOs, 92% lock, maximum orbital speed.',
    enemyCount: 5,
    hitsRequired: 2,
    lockThreshold: 92,
    signalFalloffPerDeg: 3.75,
    enemySpeedRad: 1.14,
    radialAmpMin: 18,
    radialAmpMax: 28,
    flipChance: 0.94,
    turnMinSec: 0.58,
    turnMaxSec: 1.15,
    hitTolerance: 13.5,
    coinReward: 350,
  },
] as const;

export const RADARS: readonly RadarConfig[] = [
  {
    id: 'mk1',
    name: 'MK-I Pulse',
    tagline: 'Standard 3-hit hull armor & balanced amber array.',
    cost: 0,
    rotationSpeedMult: 1.0,
    signalFalloffMult: 1.0,
    missileSpeedMult: 1.0,
    playerMaxHp: 3,
    accentHex: '#F59E0B',
    accentRgb: '245, 158, 11',
    lockHex: '#10B981',
    lockRgb: '16, 185, 129',
    ringRgb: '245, 158, 11',
  },
  {
    id: 'aegis',
    name: 'Aegis Wideband',
    tagline: '4-hit reinforced hull, +12% wider beam & +8% sweep.',
    cost: 60,
    rotationSpeedMult: 1.08,
    signalFalloffMult: 0.88,
    missileSpeedMult: 1.02,
    playerMaxHp: 4,
    accentHex: '#38BDF8',
    accentRgb: '56, 189, 248',
    lockHex: '#34D399',
    lockRgb: '52, 211, 153',
    ringRgb: '56, 189, 248',
  },
  {
    id: 'valkyrie',
    name: 'Valkyrie Hyper',
    tagline: '5-hit titanium hull, +24% sweep & +15% missile thrust.',
    cost: 140,
    rotationSpeedMult: 1.24,
    signalFalloffMult: 0.94,
    missileSpeedMult: 1.15,
    playerMaxHp: 5,
    accentHex: '#C084FC',
    accentRgb: '192, 132, 252',
    lockHex: '#2DD4BF',
    lockRgb: '45, 212, 191',
    ringRgb: '192, 132, 252',
  },
  {
    id: 'solaris',
    name: 'Solaris Apex',
    tagline: '6-hit dreadnought hull, +16% beam, +20% sweep & +18% thrust.',
    cost: 240,
    rotationSpeedMult: 1.2,
    signalFalloffMult: 0.84,
    missileSpeedMult: 1.18,
    playerMaxHp: 6,
    accentHex: '#FACC15',
    accentRgb: '250, 204, 21',
    lockHex: '#4ADE80',
    lockRgb: '74, 222, 128',
    ringRgb: '250, 204, 21',
  },
] as const;

export function getLevelsForDifficulty(difficulty: DifficultyId): LevelConfig[] {
  return LEVELS.filter((lvl) => lvl.difficulty === difficulty);
}

export function getLevelConfig(
  difficulty: DifficultyId,
  subLevel: SubLevelNumber
): LevelConfig {
  return (
    LEVELS.find(
      (lvl) => lvl.difficulty === difficulty && lvl.subLevel === subLevel
    ) ?? LEVELS[0]
  );
}

export function getRadarConfig(radarId: RadarId): RadarConfig {
  return RADARS.find((r) => r.id === radarId) ?? RADARS[0];
}

export function getNextLevel(
  difficulty: DifficultyId,
  subLevel: SubLevelNumber
): { difficulty: DifficultyId; subLevel: SubLevelNumber } | null {
  if (subLevel < 5) {
    return { difficulty, subLevel: (subLevel + 1) as SubLevelNumber };
  }
  if (difficulty === 'easy') {
    return { difficulty: 'medium', subLevel: 1 };
  }
  if (difficulty === 'medium') {
    return { difficulty: 'hard', subLevel: 1 };
  }
  return null;
}
