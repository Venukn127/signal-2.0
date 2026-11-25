import React from 'react';
import { DifficultyId, SubLevelNumber } from '../game/levels';
import { CoinIcon } from './TitleOverlay';

export interface HudSnapshot {
  signal: number;
  timeRemainingSec: number;
  elapsedSec: number;
  missilesLeft: number;
  maxMissiles: number;
  shotsFired: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemiesLeft: number;
  enemiesTotal: number;
  lockThreshold: number;
  difficulty: DifficultyId;
  subLevel: SubLevelNumber;
  radarAccentHex: string;
  shotActive: boolean;
  locked: boolean;
}

interface GameHudProps {
  hud: HudSnapshot;
  coins: number;
  muted: boolean;
  hudRef: React.RefObject<HTMLDivElement | null>;
  damageFlashRef: React.RefObject<HTMLDivElement | null>;
  signalFillRef: React.RefObject<HTMLDivElement | null>;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onTouchLeftStart: () => void;
  onTouchLeftEnd: () => void;
  onTouchRightStart: () => void;
  onTouchRightEnd: () => void;
  onTouchFire: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  coins,
  muted,
  hudRef,
  damageFlashRef,
  signalFillRef,
  onToggleMute,
  onTogglePause,
  onRestart,
  onTouchLeftStart,
  onTouchLeftEnd,
  onTouchRightStart,
  onTouchRightEnd,
  onTouchFire,
}) => {
  const playerLow = hud.playerHp <= 1;
  const playerWarn = !playerLow && hud.playerHp <= Math.ceil(hud.playerMaxHp * 0.5);
  const timerUrgent = hud.timeRemainingSec <= 5;
  const timerWarn = !timerUrgent && hud.timeRemainingSec <= 10;
  const bulletsLow = hud.missilesLeft <= 1;
  const bulletsWarn = !bulletsLow && hud.missilesLeft <= Math.max(2, hud.enemiesLeft * 2);

  return (
    <>
      {/* Peripheral impact flash vignette when player is hit */}
      <div
        ref={damageFlashRef}
        data-testid="hud-damage-flash"
        aria-hidden="true"
        className="fixed inset-0 z-10 pointer-events-none opacity-0"
        style={{
          boxShadow: 'inset 0 0 90px rgba(239, 68, 68, 0.85)',
          backgroundColor: 'rgba(239, 68, 68, 0.14)',
        }}
      />
      <div
        ref={hudRef}
        data-testid="game-hud"
        className="fixed inset-0 z-10 flex flex-col justify-between pointer-events-none p-3 sm:p-5 will-change-transform"
      >
        {/* Top Perimeter Telemetry Bar */}
        <div className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3.5 sm:px-4 py-2.5 rounded-lg bg-[#0A101C]/88 border border-slate-800/90 shadow-lg">
          {/* Left Cluster: Hazard Signal Bar (BarBack + BarFill with dynamic Lock Marker) */}
          <div className="flex items-center gap-3 min-w-[170px] sm:min-w-[210px] flex-1 max-w-[235px]">
            <div className="flex flex-col flex-1 gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono-tabular text-[11px] font-semibold tracking-wider text-slate-400 uppercase whitespace-nowrap">
                  Hazard
                </span>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono-tabular text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap ${
                      hud.locked
                        ? 'text-emerald-400'
                        : hud.signal > 0
                          ? 'text-amber-300'
                          : 'text-slate-400'
                    }`}
                  >
                    {hud.locked
                      ? 'HAZARD LOCKED'
                      : hud.signal > 0
                        ? 'DETECTED'
                        : 'SCANNING'}
                  </span>
                  <span
                    data-testid="hud-signal"
                    className={`font-mono-tabular text-base font-bold leading-none ${
                      hud.locked ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {hud.signal}%
                  </span>
                </div>
              </div>

              {/* BarBack */}
              <div
                className="relative h-3.5 w-full rounded-sm bg-slate-800 border border-slate-700/80 overflow-hidden"
                role="progressbar"
                aria-label="Radar Signal Strength"
                aria-valuenow={hud.signal}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {/* BarFill: anchored left, scaled via GPU transform */}
                <div
                  ref={signalFillRef}
                  className={`h-full w-full origin-left transition-colors duration-150 ${
                    hud.locked ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  style={{
                    backgroundColor: hud.locked ? undefined : hud.radarAccentHex,
                    transform: `scaleX(${
                      hud.signal <= 0 ? 0 : Math.max(0.02, hud.signal / 100)
                    })`,
                  }}
                />
                {/* Lock Threshold Tick */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-100/80"
                  style={{ left: `${hud.lockThreshold}%` }}
                  title={`${hud.lockThreshold}% Lock Threshold`}
                />
              </div>
            </div>
          </div>

          {/* Center Cluster: Ship Health, Target Health, Enemies Left, Sector & Elapsed Time */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            {/* Our Ship Health Bar */}
            <div className="flex flex-col gap-1 min-w-[92px] sm:min-w-[108px]">
              <div className="flex items-baseline justify-between gap-1.5">
                <span className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase whitespace-nowrap">
                  Ship HP
                </span>
                <span
                  data-testid="hud-player-hp"
                  className={`font-mono-tabular text-[11px] font-bold ${
                    playerLow
                      ? 'text-red-400'
                      : playerWarn
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                  }`}
                >
                  {hud.playerHp}/{hud.playerMaxHp}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Our Ship Health"
                aria-valuenow={hud.playerHp}
                aria-valuemin={0}
                aria-valuemax={hud.playerMaxHp}
                className="relative h-2.5 w-full rounded-sm bg-slate-800 border border-slate-700/80 overflow-hidden"
              >
                <div
                  className={`h-full transition-all duration-150 ${
                    playerLow
                      ? 'bg-red-500'
                      : playerWarn
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  style={{
                    width: `${
                      hud.playerMaxHp > 0
                        ? (hud.playerHp / hud.playerMaxHp) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Active Opponent UFO Health Bar */}
            <div className="flex flex-col gap-1 min-w-[92px] sm:min-w-[108px]">
              <div className="flex items-baseline justify-between gap-1.5">
                <span className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase whitespace-nowrap">
                  UFO HP
                </span>
                <span
                  data-testid="hud-enemy-hp"
                  className="font-mono-tabular text-[11px] font-bold text-red-400"
                >
                  {hud.enemyHp}/{hud.enemyMaxHp}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Opponent Ship Health"
                aria-valuenow={hud.enemyHp}
                aria-valuemin={0}
                aria-valuemax={hud.enemyMaxHp}
                className="relative h-2.5 w-full rounded-sm bg-slate-800 border border-slate-700/80 overflow-hidden"
              >
                <div
                  className="h-full bg-red-500 transition-all duration-150"
                  style={{
                    width: `${
                      hud.enemyMaxHp > 0
                        ? (hud.enemyHp / hud.enemyMaxHp) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="h-7 w-px bg-slate-800" aria-hidden="true" />

            {/* Bullets Remaining Counter (4 per enemy ship) */}
            <div className="flex flex-col items-center">
              <span className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase whitespace-nowrap">
                Bullets
              </span>
              <span
                data-testid="hud-missiles"
                className={`font-mono-tabular text-lg sm:text-xl font-bold leading-tight ${
                  bulletsLow
                    ? 'text-red-400 animate-pulse'
                    : bulletsWarn
                      ? 'text-amber-300'
                      : 'text-sky-300'
                }`}
              >
                {hud.missilesLeft}/{hud.maxMissiles}
              </span>
            </div>

            <div className="h-7 w-px bg-slate-800" aria-hidden="true" />

            {/* Enemies Remaining Counter */}
            <div className="flex flex-col items-center">
              <span className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase whitespace-nowrap">
                Enemies Left
              </span>
              <span
                data-testid="hud-enemies-left"
                className="font-mono-tabular text-lg sm:text-xl font-bold leading-tight text-amber-300"
              >
                {hud.enemiesLeft}/{hud.enemiesTotal}
              </span>
            </div>

            <div className="hidden lg:block h-7 w-px bg-slate-800" aria-hidden="true" />

            <div className="hidden lg:flex flex-col items-center">
              <span className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Sector
              </span>
              <span
                data-testid="hud-level"
                className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-amber-300 mt-1"
              >
                {hud.difficulty} {hud.subLevel}
              </span>
            </div>

            <div className="h-7 w-px bg-slate-800" aria-hidden="true" />

            {/* 40-Second Countdown Timer */}
            <div className="flex flex-col items-center">
              <span className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Time
              </span>
              <span
                data-testid="hud-time"
                className={`font-mono-tabular text-lg sm:text-xl font-bold leading-tight ${
                  timerUrgent
                    ? 'text-red-400 animate-pulse'
                    : timerWarn
                      ? 'text-amber-300'
                      : 'text-slate-100'
                }`}
              >
                {hud.timeRemainingSec}s
              </span>
            </div>
          </div>

          {/* Right Cluster: Coins & Utility Icon Controls */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div
              data-testid="hud-coins"
              className="hidden md:flex items-center gap-1.5 px-2.5 h-10 rounded-md bg-slate-900/90 border border-slate-800 mr-1"
              title="Coins"
            >
              <CoinIcon className="w-3.5 h-3.5" />
              <span className="font-mono-tabular text-xs font-bold text-amber-300">
                {coins}
              </span>
            </div>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              title={muted ? 'Unmute (M)' : 'Mute (M)'}
              className="w-10 h-10 flex items-center justify-center rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors duration-150 cursor-pointer"
            >
              {muted ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePause();
              }}
              aria-label="Pause game (P)"
              title="Pause (P)"
              className="w-10 h-10 flex items-center justify-center rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors duration-150 cursor-pointer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              aria-label="Restart hunt (R)"
              title="Restart (R)"
              className="w-10 h-10 flex items-center justify-center rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors duration-150 cursor-pointer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Desktop Highlighted Controls Legend */}
        <div
          data-testid="hud-controls-legend"
          className="hidden md:flex items-center justify-center pointer-events-none"
        >
          <div className="inline-flex items-center gap-4 px-4 py-1.5 rounded-lg bg-[#0A101C]/86 border border-amber-500/35 text-xs font-mono-tabular text-slate-200 shadow-md">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-400/60 text-amber-300 font-bold">
                ← / →
              </kbd>
              <span className="text-slate-400">or</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-400/60 text-amber-300 font-bold">
                A / D
              </kbd>
              <span>Orbit Ship</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-emerald-400/60 text-emerald-300 font-bold">
                SPACE
              </kbd>
              <span>Fire (Hazard ≥ {hud.lockThreshold}%)</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-200 font-bold">
                P
              </kbd>
              <span className="text-slate-400">Pause</span>
            </span>
          </div>
        </div>

        {/* Touch / Mobile Action Controls: Left & Right on same row, Fire Missile directly below */}
        <div
          data-testid="mobile-controls"
          className="md:hidden w-full max-w-xs mx-auto flex flex-col gap-2.5 pointer-events-auto pb-1"
        >
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              tabIndex={-1}
              data-testid="touch-left"
              aria-label="Orbit Ship Counter-Clockwise"
              onPointerDown={onTouchLeftStart}
              onPointerUp={onTouchLeftEnd}
              onPointerLeave={onTouchLeftEnd}
              onPointerCancel={onTouchLeftEnd}
              className="h-12 w-full rounded-lg bg-[#0A101C]/90 border border-amber-500/50 text-slate-100 font-display font-bold text-lg active:bg-slate-800 select-none flex items-center justify-center gap-1.5"
            >
              <span aria-hidden="true" className="text-amber-300">
                ↺
              </span>
              <span className="text-xs uppercase tracking-wider">Left</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              data-testid="touch-right"
              aria-label="Orbit Ship Clockwise"
              onPointerDown={onTouchRightStart}
              onPointerUp={onTouchRightEnd}
              onPointerLeave={onTouchRightEnd}
              onPointerCancel={onTouchRightEnd}
              className="h-12 w-full rounded-lg bg-[#0A101C]/90 border border-amber-500/50 text-slate-100 font-display font-bold text-lg active:bg-slate-800 select-none flex items-center justify-center gap-1.5"
            >
              <span className="text-xs uppercase tracking-wider">Right</span>
              <span aria-hidden="true" className="text-amber-300">
                ↻
              </span>
            </button>
          </div>
          <button
            type="button"
            tabIndex={-1}
            data-testid="touch-fire"
            aria-label="Fire Missile"
            disabled={hud.shotActive || hud.missilesLeft <= 0}
            onPointerDown={(e) => {
              e.preventDefault();
              onTouchFire();
            }}
            className="h-12 w-full rounded-lg bg-amber-500 active:bg-amber-400 disabled:opacity-40 text-slate-950 font-display font-bold text-sm tracking-wide select-none whitespace-nowrap"
          >
            {hud.missilesLeft <= 0 ? 'Out of Bullets' : 'Fire Missile'}
          </button>
        </div>
      </div>
    </>
  );
};
