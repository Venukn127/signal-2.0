import { GAME_CONFIG, GameState, STAGE_BOUNDS, ShipState } from './types';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
}

interface TrailPoint {
  active: boolean;
  x: number;
  y: number;
}

interface MissPulse {
  active: boolean;
  x: number;
  y: number;
  elapsed: number;
  duration: number;
}

interface NebulaCloud {
  canvas: HTMLCanvasElement;
  nx: number; // normalized anchor 0..1
  ny: number;
  scaleFactor: number;
  depth: number; // parallax weight
  driftX: number;
  driftY: number;
  alpha: number;
}

const MAX_PARTICLES = 200;
const MAX_TRAIL = 16;
const STAR_COUNT = 84;
const AIRCRAFT_SPRITE_URL = '/assets/aistudio/image_fee50dfe.png';
const EARTH_SPRITE_URL = '/assets/aistudio/image_6a7f4290.png';
const ENEMY_UFO_URL = '/assets/aistudio/image_a10e8aea.png';

function buildProceduralNebulae(): NebulaCloud[] {
  if (typeof document === 'undefined') return [];

  let seed = 8191;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const palettes: Array<[number, number, number, number, number, number]> = [
    [56, 189, 248, 20, 184, 166], // cyan-teal cosmic veil
    [99, 102, 241, 139, 92, 246], // deep indigo-violet dust
    [245, 158, 11, 190, 24, 93], // warm amber-crimson filament
    [14, 116, 144, 59, 130, 246], // abyssal blue-teal drift
  ];

  return palettes.map((pal, idx) => {
    const size = 220;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const nctx = canvas.getContext('2d');
    if (nctx) {
      const puffs = 8;
      for (let p = 0; p < puffs; p++) {
        const angle = rand() * Math.PI * 2;
        const dist = rand() * size * 0.22;
        const px = size * 0.5 + Math.cos(angle) * dist;
        const py = size * 0.5 + Math.sin(angle) * dist;
        const r = size * (0.22 + rand() * 0.24);
        const mix = rand();
        const cr = Math.round(pal[0] * (1 - mix) + pal[3] * mix);
        const cg = Math.round(pal[1] * (1 - mix) + pal[4] * mix);
        const cb = Math.round(pal[2] * (1 - mix) + pal[5] * mix);
        const peakAlpha = 0.05 + rand() * 0.045;

        const grad = nctx.createRadialGradient(px, py, 2, px, py, r);
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${peakAlpha.toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, ${(peakAlpha * 0.42).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        nctx.fillStyle = grad;
        nctx.beginPath();
        nctx.arc(px, py, r, 0, Math.PI * 2);
        nctx.fill();
      }
    }

    return {
      canvas,
      nx: (idx * 0.29 + 0.12) % 1,
      ny: (idx * 0.34 + 0.15) % 1,
      scaleFactor: 0.38 + (idx % 2) * 0.14,
      depth: 0.32 + idx * 0.16,
      driftX: (idx % 2 === 0 ? 1 : -1) * (0.004 + idx * 0.0015),
      driftY: 0.005 + idx * 0.002,
      alpha: 0.9,
    };
  });
}

function buildKeyedAircraftSprites(img: HTMLImageElement): {
  player: HTMLCanvasElement;
  enemy: HTMLCanvasElement;
} | null {
  if (typeof document === 'undefined') return null;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const playerCanvas = document.createElement('canvas');
  playerCanvas.width = w;
  playerCanvas.height = h;
  const pCtx = playerCanvas.getContext('2d');
  if (!pCtx) return null;

  pCtx.drawImage(img, 0, 0, w, h);
  const imgData = pCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample top-left pixel as solid backdrop color to key out cleanly
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];
  const bgAlpha = data[3];

  const enemyCanvas = document.createElement('canvas');
  enemyCanvas.width = w;
  enemyCanvas.height = h;
  const eCtx = enemyCanvas.getContext('2d');
  const enemyData = eCtx ? eCtx.createImageData(w, h) : null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      let a = data[idx + 3];

      // Trim stray 1-3px artifact on far right edge of source image
      if (x >= w - 4) {
        a = 0;
      } else if (bgAlpha > 200) {
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        if (dist < 14) {
          a = 0;
        } else if (dist < 34) {
          a = Math.round(a * ((dist - 14) / 20));
        }
      }

      data[idx + 3] = a;

      if (enemyData) {
        // Hostile crimson/amber color-shifted fighter variant
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        enemyData.data[idx] = Math.min(255, Math.round(lum * 1.48 + 42));
        enemyData.data[idx + 1] = Math.max(0, Math.round(g * 0.42));
        enemyData.data[idx + 2] = Math.max(0, Math.round(b * 0.36));
        enemyData.data[idx + 3] = a;
      }
    }
  }

  pCtx.putImageData(imgData, 0, 0);
  if (eCtx && enemyData) {
    eCtx.putImageData(enemyData, 0, 0);
  }

  return { player: playerCanvas, enemy: enemyCanvas };
}

function buildEarthSprites(img: HTMLImageElement): {
  globe: HTMLCanvasElement;
  strip: HTMLCanvasElement;
} | null {
  if (typeof document === 'undefined') return null;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const sCtx = srcCanvas.getContext('2d');
  if (!sCtx) return null;

  sCtx.drawImage(img, 0, 0, w, h);
  const srcData = sCtx.getImageData(0, 0, w, h);
  const px = srcData.data;

  // Detect exact bounding box of the Earth disc to remove dark outer margins
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = Math.max(px[idx], px[idx + 1], px[idx + 2]);
      if (px[idx + 3] > 20 && lum > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return null;

  const globeSize = 256;
  const srcCx = (minX + maxX) * 0.5;
  const srcCy = (minY + maxY) * 0.5;
  const srcR = Math.min(maxX - minX, maxY - minY) * 0.5;

  // 1. Clean circularly masked Earth globe matching the exact photo
  const globeCanvas = document.createElement('canvas');
  globeCanvas.width = globeSize;
  globeCanvas.height = globeSize;
  const gCtx = globeCanvas.getContext('2d');
  if (!gCtx) return null;

  gCtx.save();
  gCtx.beginPath();
  gCtx.arc(globeSize * 0.5, globeSize * 0.5, globeSize * 0.5, 0, Math.PI * 2);
  gCtx.clip();
  // Slight 2% zoom inside clip removes the thin dark halo border around the PNG limb
  const drawR = srcR * 0.985;
  gCtx.drawImage(
    srcCanvas,
    srcCx - drawR,
    srcCy - drawR,
    drawR * 2,
    drawR * 2,
    0,
    0,
    globeSize,
    globeSize
  );
  gCtx.restore();

  // 2. Tileable horizontal strip for smooth left-to-right planetary revolution
  // Uses a feathered cross-fade over the edge seam so the photo loops cleanly
  const tileW = globeSize;
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = tileW * 2;
  stripCanvas.height = globeSize;
  const stCtx = stripCanvas.getContext('2d');
  if (!stCtx) return null;

  // Project central 78% of globe horizontally into a seamless cylindrical strip
  const usableR = srcR * 0.84;
  const tempTile = document.createElement('canvas');
  tempTile.width = tileW;
  tempTile.height = globeSize;
  const tCtx = tempTile.getContext('2d');
  if (tCtx) {
    const out = tCtx.createImageData(tileW, globeSize);
    const od = out.data;
    const blendFrac = 0.22;

    const sampleColor = (u: number, v: number): [number, number, number] => {
      // Map u in [0, 1] across central chord of the disc for crisp detail without black rim
      const sx = Math.max(0, Math.min(w - 1, Math.round(srcCx + (u * 2 - 1) * usableR)));
      const chordHalfH = Math.sqrt(Math.max(0.08, 1 - Math.pow((u * 2 - 1) * 0.84, 2))) * srcR * 0.96;
      const sy = Math.max(0, Math.min(h - 1, Math.round(srcCy + (v * 2 - 1) * chordHalfH)));
      const sIdx = (sy * w + sx) * 4;
      return [px[sIdx], px[sIdx + 1], px[sIdx + 2]];
    };

    for (let y = 0; y < globeSize; y++) {
      const v = y / (globeSize - 1);
      for (let x = 0; x < tileW; x++) {
        const u = x / tileW;
        const p1 = blendFrac + u * (1 - blendFrac);
        const [r1, g1, b1] = sampleColor(p1, v);
        let r = r1;
        let g = g1;
        let b = b1;

        if (u > 1 - blendFrac) {
          const t = (u - (1 - blendFrac)) / blendFrac;
          const smooth = 0.5 - 0.5 * Math.cos(t * Math.PI);
          const [r2, g2, b2] = sampleColor(t * blendFrac, v);
          r = Math.round(r1 * (1 - smooth) + r2 * smooth);
          g = Math.round(g1 * (1 - smooth) + g2 * smooth);
          b = Math.round(b1 * (1 - smooth) + b2 * smooth);
        }

        const idx = (y * tileW + x) * 4;
        od[idx] = r;
        od[idx + 1] = g;
        od[idx + 2] = b;
        od[idx + 3] = 255;
      }
    }
    tCtx.putImageData(out, 0, 0);
    stCtx.drawImage(tempTile, 0, 0);
    stCtx.drawImage(tempTile, tileW, 0);
  }

  return { globe: globeCanvas, strip: stripCanvas };
}

function buildEnemyUfoSprite(img: HTMLImageElement): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Mask the centered saucer silhouette cleanly (main saucer disc + top dome cap)
  // while keying out misty blue-grey sky pixels near the perimeter.
  const cx = w * 0.5;
  const discCy = h * 0.525;
  const discRx = w * 0.445;
  const discRy = h * 0.255;
  const domeCy = h * 0.34;
  const domeRx = w * 0.165;
  const domeRy = h * 0.148;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const dDisc = Math.hypot((x - cx) / discRx, (y - discCy) / discRy);
      const dDome = Math.hypot((x - cx) / domeRx, (y - domeCy) / domeRy);
      const d = Math.min(dDisc, dDome);

      if (d >= 1.03) {
        data[idx + 3] = 0;
        continue;
      }

      let alpha = 255;
      if (d > 0.94) {
        alpha = Math.round(255 * Math.max(0, (1.03 - d) / 0.09));
      }

      // Suppress cool cloudy sky wisps in the outer perimeter transition zone
      if (d > 0.78 && b >= r - 2 && r < 145 && r - b < 10) {
        const skyFade = Math.max(0, Math.min(1, (0.96 - d) / 0.18));
        alpha = Math.min(alpha, Math.round(255 * skyFade));
      }

      data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export class GameRenderer {
  private particles: Particle[];
  private particleCursor = 0;
  private missileTrail: TrailPoint[];
  private missileTrailCount = 0;
  private enemyTrail: TrailPoint[];
  private enemyTrailCount = 0;
  private missPulse: MissPulse = {
    active: false,
    x: 0,
    y: 0,
    elapsed: 0,
    duration: 0.34,
  };
  private stars: Star[];
  private nebulae: NebulaCloud[];
  private ambientTime = 0;
  private bgCache: HTMLCanvasElement | null = null;
  private bgCacheW = 0;
  private bgCacheH = 0;
  private scopeCache: HTMLCanvasElement | null = null;
  private scopeCacheKey = '';
  private playerSprite: HTMLCanvasElement | null = null;
  private enemySprite: HTMLCanvasElement | null = null;
  private earthGlobeSprite: HTMLCanvasElement | null = null;
  private earthStripSprite: HTMLCanvasElement | null = null;
  private spriteDirty = false;

  constructor() {
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      r: 255,
      g: 255,
      b: 255,
    }));

    this.missileTrail = Array.from({ length: MAX_TRAIL }, () => ({
      active: false,
      x: 0,
      y: 0,
    }));

    this.enemyTrail = Array.from({ length: MAX_TRAIL }, () => ({
      active: false,
      x: 0,
      y: 0,
    }));

    let seed = 4219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    this.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: rand() * 2 - 1,
      y: rand() * 2 - 1,
      radius: 0.7 + rand() * 1.4,
      alpha: 0.16 + rand() * 0.55,
      speed: 0.008 + rand() * 0.022,
    }));

    this.nebulae = buildProceduralNebulae();

    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        const processed = buildKeyedAircraftSprites(img);
        if (processed) {
          this.playerSprite = processed.player;
          this.spriteDirty = true;
        }
      };
      img.src = AIRCRAFT_SPRITE_URL;

      const earthImg = new Image();
      earthImg.onload = () => {
        const processedEarth = buildEarthSprites(earthImg);
        if (processedEarth) {
          this.earthGlobeSprite = processedEarth.globe;
          this.earthStripSprite = processedEarth.strip;
          this.spriteDirty = true;
        }
      };
      earthImg.src = EARTH_SPRITE_URL;

      const ufoImg = new Image();
      ufoImg.onload = () => {
        const processedUfo = buildEnemyUfoSprite(ufoImg);
        if (processedUfo) {
          this.enemySprite = processedUfo;
          this.spriteDirty = true;
        }
      };
      ufoImg.src = ENEMY_UFO_URL;
    }
  }

  public consumeDirty(): boolean {
    if (!this.spriteDirty) return false;
    this.spriteDirty = false;
    return true;
  }

  public clearParticles(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles[i].active = false;
    }
    this.missileTrailCount = 0;
    this.enemyTrailCount = 0;
    this.missPulse.active = false;
  }

  public spawnMissPulse(x: number, y: number): void {
    this.missPulse.active = true;
    this.missPulse.x = x;
    this.missPulse.y = y;
    this.missPulse.elapsed = 0;
    this.missPulse.duration = 0.34;
  }

  public hasActiveVisuals(): boolean {
    if (this.missPulse.active) return true;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.particles[i].active) return true;
    }
    return false;
  }

  public spawnBurst(
    x: number,
    y: number,
    count: number,
    color: [number, number, number],
    speedMin: number,
    speedMax: number,
    lifeMin: number,
    lifeMax: number,
    sizeMin: number,
    sizeMax: number
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;

      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = lifeMin + Math.random() * (lifeMax - lifeMin);
      p.life = p.maxLife;
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.r = color[0];
      p.g = color[1];
      p.b = color[2];
    }
  }

  public spawnDirectionalExhaust(
    x: number,
    y: number,
    backVx: number,
    backVy: number,
    color: [number, number, number]
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;

    p.active = true;
    p.x = x + (Math.random() - 0.5) * 3;
    p.y = y + (Math.random() - 0.5) * 3;
    p.vx = backVx + (Math.random() - 0.5) * 28;
    p.vy = backVy + (Math.random() - 0.5) * 28;
    p.maxLife = 0.18 + Math.random() * 0.14;
    p.life = p.maxLife;
    p.size = 1.6 + Math.random() * 1.5;
    p.r = color[0];
    p.g = color[1];
    p.b = color[2];
  }

  private pushTrailPoint(
    trail: TrailPoint[],
    count: number,
    x: number,
    y: number
  ): number {
    const nextCount = Math.min(MAX_TRAIL, count + 1);
    for (let i = nextCount - 1; i > 0; i--) {
      trail[i].x = trail[i - 1].x;
      trail[i].y = trail[i - 1].y;
      trail[i].active = true;
    }
    trail[0].x = x;
    trail[0].y = y;
    trail[0].active = true;
    return nextCount;
  }

  public updateVisuals(dt: number, state: GameState): void {
    if (state.phase !== 'paused') {
      this.ambientTime += dt;
    }

    for (let i = 0; i < this.nebulae.length; i++) {
      const n = this.nebulae[i];
      n.nx += n.driftX * dt;
      n.ny += n.driftY * dt;
      if (n.nx > 1.35) n.nx = -0.35;
      if (n.nx < -0.35) n.nx = 1.35;
      if (n.ny > 1.35) n.ny = -0.35;
      if (n.ny < -0.35) n.ny = 1.35;
    }

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.y += s.speed * dt;
      if (s.y > 1.05) {
        s.y = -1.05;
      }
    }

    if (this.missPulse.active) {
      this.missPulse.elapsed += dt;
      if (this.missPulse.elapsed >= this.missPulse.duration) {
        this.missPulse.active = false;
      }
    }

    if (state.phase === 'playing' && state.missile.active) {
      const tailX =
        state.missile.x - Math.sin(state.missile.angle) * 7;
      const tailY =
        state.missile.y - Math.cos(state.missile.angle) * 7;
      this.missileTrailCount = this.pushTrailPoint(
        this.missileTrail,
        this.missileTrailCount,
        tailX,
        tailY
      );

      const bx = -Math.sin(state.missile.angle) * 95;
      const by = -Math.cos(state.missile.angle) * 95;
      this.spawnDirectionalExhaust(
        tailX,
        tailY,
        bx,
        by,
        [245, 158, 11]
      );
      this.spawnDirectionalExhaust(
        tailX,
        tailY,
        bx * 0.75,
        by * 0.75,
        [254, 240, 138]
      );
      this.spawnDirectionalExhaust(
        tailX,
        tailY,
        bx * 0.45,
        by * 0.45,
        [148, 163, 184]
      );
    } else if (this.missileTrailCount > 0) {
      // Fade trail tail smoothly once missile resolves
      this.missileTrailCount = Math.max(0, this.missileTrailCount - 1);
    }

    if (
      state.phase === 'playing' &&
      state.enemyStrike &&
      state.enemyStrike.phase === 'incoming'
    ) {
      const es = state.enemyStrike;
      const tailX = es.x - Math.sin(es.angle) * 7;
      const tailY = es.y - Math.cos(es.angle) * 7;
      this.enemyTrailCount = this.pushTrailPoint(
        this.enemyTrail,
        this.enemyTrailCount,
        tailX,
        tailY
      );
      const bx = -Math.sin(es.angle) * 85;
      const by = -Math.cos(es.angle) * 85;
      this.spawnDirectionalExhaust(tailX, tailY, bx, by, [239, 68, 68]);
      this.spawnDirectionalExhaust(tailX, tailY, bx * 0.7, by * 0.7, [249, 115, 22]);
    } else if (this.enemyTrailCount > 0) {
      this.enemyTrailCount = Math.max(0, this.enemyTrailCount - 1);
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
  }

  private ensureBgCache(width: number, height: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    if (this.bgCache && this.bgCacheW === width && this.bgCacheH === height) {
      return this.bgCache;
    }
    const offscreen = this.bgCache ?? document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const octx = offscreen.getContext('2d');
    if (octx) {
      const bgGrad = octx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.08,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, '#0D1524');
      bgGrad.addColorStop(0.65, '#080D17');
      bgGrad.addColorStop(1, '#05080F');
      octx.fillStyle = bgGrad;
      octx.fillRect(0, 0, width, height);
    }
    this.bgCache = offscreen;
    this.bgCacheW = width;
    this.bgCacheH = height;
    return offscreen;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: GameState
  ): void {
    // 1. Deep-space obsidian backdrop
    const cachedBg = this.ensureBgCache(width, height);
    if (cachedBg) {
      ctx.drawImage(cachedBg, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#070B12';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Parallax-scrolling procedurally generated cosmic nebulae
    const parallaxSrcAngle =
      state.phase === 'title' ||
      state.phase === 'armory' ||
      state.phase === 'levels'
        ? this.ambientTime * 0.45
        : state.radar.angle;
    const pSin = Math.sin(parallaxSrcAngle);
    const pCos = Math.cos(parallaxSrcAngle);
    const baseSpan = Math.max(width, height);

    for (let i = 0; i < this.nebulae.length; i++) {
      const n = this.nebulae[i];
      const drawSize = baseSpan * n.scaleFactor;
      const px =
        n.nx * width - pSin * n.depth * 34 - drawSize * 0.5;
      const py =
        n.ny * height - pCos * n.depth * 24 - drawSize * 0.5;
      ctx.globalAlpha = n.alpha;
      ctx.drawImage(n.canvas, px, py, drawSize, drawSize);
    }
    ctx.globalAlpha = 1;

    // 3. Full-bleed parallax starfield
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const sx = ((s.x * 0.5 + 0.5) * width - pSin * s.radius * 6 + width) % width;
      const sy = ((s.y * 0.5 + 0.5) * height - pCos * s.radius * 4 + height) % height;
      const twinkle = 0.78 + 0.22 * Math.sin(this.ambientTime * 1.8 + i);
      ctx.fillStyle = `rgba(226, 232, 240, ${(s.alpha * twinkle).toFixed(2)})`;
      const size = s.radius * 1.6;
      ctx.fillRect(sx, sy, size, size);
    }

    // Playfield scale ensures orbiting enemy aircraft spans generously while staying visible below HUD
    const padTop = Math.max(76, height * 0.13);
    const padBottom = Math.max(32, height * 0.06);
    const availW = Math.max(220, width - 32);
    const availH = Math.max(220, height - padTop - padBottom);
    const scale = Math.min(availW / 445, availH / 445);

    const centerX = width * 0.5;
    const centerY = padTop + availH * 0.5;
    // Full-screen radar radius spans from center all the way to the farthest screen corner
    const fullScreenRadius =
      Math.hypot(Math.max(centerX, width - centerX), Math.max(centerY, height - centerY)) *
      1.04;

    // Quadratic camera trauma shake
    const shakeMag = state.trauma * state.trauma * 11;
    const shakeX = shakeMag > 0.05 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const shakeY = shakeMag > 0.05 ? (Math.random() * 2 - 1) * shakeMag : 0;

    const toPxX = (sx: number) => centerX + shakeX + sx * scale;
    const toPxY = (sy: number) => centerY + shakeY - sy * scale;

    // 4. Menu phases ambient full-screen radar sweep (reflects selected radar theme)
    if (
      state.phase === 'title' ||
      state.phase === 'armory' ||
      state.phase === 'levels'
    ) {
      this.renderTitleAmbientRadar(
        ctx,
        toPxX,
        toPxY,
        scale,
        width,
        height,
        state
      );
      return;
    }

    // 4. Full-screen polar radar scope rings & edge-to-edge crosshairs
    this.renderFullScreenScope(
      ctx,
      toPxX(0),
      toPxY(0),
      width,
      height,
      fullScreenRadius,
      scale,
      state
    );

    // 5. Rotating full-screen radar beam & center player aircraft
    this.renderCenterRadarAndShip(
      ctx,
      toPxX(0),
      toPxY(0),
      fullScreenRadius,
      scale,
      state
    );

    // 6. Launch Shockwave Cone at center launcher
    if (state.launchShockwave.active) {
      this.renderLaunchShockwave(ctx, toPxX, toPxY, scale, state);
    }

    // 7. Opponent UFOs (each enemy reveals when its bearing matches beam >= lockThreshold or flashes on hit)
    for (let i = 0; i < state.enemies.length; i++) {
      const enemy = state.enemies[i];
      if (!enemy.alive && enemy.flashTimer <= 0) continue;
      if (enemy.visible || enemy.flashTimer > 0) {
        this.renderOpponentShip(
          ctx,
          toPxX,
          toPxY,
          scale,
          enemy,
          state.enemyStrike !== null
        );
      }
    }

    // 8. Player Missile contrail + detailed animated interceptor missile
    if (this.missileTrailCount > 1) {
      this.renderContrail(
        ctx,
        this.missileTrail,
        this.missileTrailCount,
        toPxX,
        toPxY,
        scale,
        state.radarConfig.accentRgb,
        '254, 240, 138'
      );
    }
    if (state.missile.active) {
      this.renderMissile(
        ctx,
        toPxX(state.missile.x),
        toPxY(state.missile.y),
        state.missile.angle,
        scale,
        state.radarConfig.accentHex,
        '#FEF3C7',
        '#F97316'
      );
    }

    // 9. Live Enemy Attacks targeting our protecting ship during combat
    if (state.enemyAttacks.length > 0) {
      for (let i = 0; i < state.enemyAttacks.length; i++) {
        const atk = state.enemyAttacks[i];
        this.renderMissile(
          ctx,
          toPxX(atk.x),
          toPxY(atk.y),
          atk.angle,
          scale * 0.92,
          '#EF4444',
          '#FEE2E2',
          '#FB923C'
        );
      }
    }

    // 10. Enemy Counter-Strike (sightline + contrail + incoming enemy missile targeting center)
    if (state.enemyStrike && state.enemyStrike.phase === 'incoming') {
      this.renderEnemyStrike(ctx, toPxX, toPxY, scale, state);
    }

    // 10. Miss Fizzle Ring & Blast circles
    if (this.missPulse.active) {
      this.renderMissPulse(ctx, toPxX, toPxY, scale);
    }
    if (state.blast.active) {
      this.renderBlast(ctx, toPxX, toPxY, scale, state);
    }

    // 11. Pooled particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(toPxX(p.x), toPxY(p.y), p.size * (scale / 1.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // 11. Diegetic start instruction whisper on mobile (desktop uses the highlighted GameHud control legend)
    if (
      width < 768 &&
      state.phase === 'playing' &&
      state.promptTimer > 0 &&
      state.pendingWinRemaining === null &&
      state.enemyStrike === null
    ) {
      const promptAlpha = Math.min(1, state.promptTimer / 0.8);
      ctx.save();
      ctx.font = `600 ${Math.max(12, Math.round(10.5 * Math.min(scale, 1.35)))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(253, 224, 71, ${(0.94 * promptAlpha).toFixed(3)})`;
      ctx.fillText(
        `Tap ↺ / ↻ to lock ≥ ${state.levelConfig.lockThreshold}%, then Fire Missile!`,
        width * 0.5,
        height - 136
      );
      ctx.restore();
    }
  }

  private renderFullScreenScope(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    fullScreenRadius: number,
    scale: number,
    state: GameState
  ): void {
    const isThreat = state.enemyStrike !== null || !state.playerAlive;
    const radar = state.radarConfig;
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    const key = `${w}:${h}:${Math.round(scale * 100)}:${isThreat ? 1 : 0}:${radar.id}`;

    if (typeof document !== 'undefined') {
      if (!this.scopeCache || this.scopeCacheKey !== key) {
        const off = this.scopeCache ?? document.createElement('canvas');
        off.width = w;
        off.height = h;
        const octx = off.getContext('2d');
        if (octx) {
          const ocx = w * 0.5;
          const ocy = cy;
          octx.clearRect(0, 0, w, h);
          octx.save();

          // Full-screen crosshair axes spanning edge-to-edge
          octx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
          octx.lineWidth = 1;
          octx.beginPath();
          octx.moveTo(0, ocy);
          octx.lineTo(w, ocy);
          octx.moveTo(ocx, 0);
          octx.lineTo(ocx, h);
          octx.stroke();

          // Subtle diagonal 45-deg bearing lines spanning full screen
          octx.strokeStyle = 'rgba(148, 163, 184, 0.055)';
          for (const deg of [45, 135]) {
            const rad = (deg * Math.PI) / 180;
            const dx = Math.cos(rad) * fullScreenRadius;
            const dy = Math.sin(rad) * fullScreenRadius;
            octx.beginPath();
            octx.moveTo(ocx - dx, ocy - dy);
            octx.lineTo(ocx + dx, ocy + dy);
            octx.stroke();
          }

          // Concentric radar range rings extending across the entire screen
          const ringStep = 65 * scale;
          let ringIdx = 1;
          for (let r = ringStep; r < fullScreenRadius; r += ringStep) {
            const isOrbitBoundary = ringIdx === 2;
            octx.strokeStyle = isThreat
              ? 'rgba(239, 68, 68, 0.18)'
              : isOrbitBoundary
                ? `rgba(${radar.ringRgb}, 0.28)`
                : 'rgba(148, 163, 184, 0.12)';
            octx.lineWidth = isOrbitBoundary ? 1.5 : 1;
            octx.setLineDash(
              radar.id === 'valkyrie' && ringIdx % 2 === 1
                ? [10, 5]
                : ringIdx % 2 === 1
                  ? [5, 7]
                  : []
            );
            octx.beginPath();
            octx.arc(ocx, ocy, r, 0, Math.PI * 2);
            octx.stroke();
            ringIdx++;
          }
          octx.setLineDash([]);

          // Degree tick marks along the main tactical ring (plus Solaris outer azimuth ticks)
          const tickRing = ringStep * 2;
          const degStep = radar.id === 'solaris' ? 10 : 15;
          for (let deg = 0; deg < 360; deg += degStep) {
            const rad = (deg * Math.PI) / 180;
            const major = deg % 45 === 0 || (radar.id === 'solaris' && deg % 30 === 0);
            const inner = tickRing - (major ? 10 : 4.5) * scale * 0.75;
            const dx = Math.sin(rad);
            const dy = -Math.cos(rad);
            octx.strokeStyle = major
              ? `rgba(${radar.ringRgb}, 0.48)`
              : 'rgba(148, 163, 184, 0.20)';
            octx.lineWidth = major ? 1.5 : 1;
            octx.beginPath();
            octx.moveTo(ocx + dx * inner, ocy + dy * inner);
            octx.lineTo(ocx + dx * tickRing, ocy + dy * tickRing);
            octx.stroke();
          }

          octx.restore();
        }
        this.scopeCache = off;
        this.scopeCacheKey = key;
      }

      if (this.scopeCache) {
        // Apply shake delta relative to unshaken center
        const dx = cx - width * 0.5;
        ctx.drawImage(this.scopeCache, dx, 0);
      }
    }
  }

  private renderEarth(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    state: GameState,
    isAmbient: boolean
  ): void {
    const earthR = Math.max(10, GAME_CONFIG.EARTH_RADIUS * scale);
    const isThreat = !isAmbient && (state.enemyStrike !== null || !state.playerAlive);
    const isDestroyed = !isAmbient && !state.playerAlive;
    const isLocked = !isAmbient && state.signal >= state.levelConfig.lockThreshold;

    ctx.save();

    // Soft atmospheric rim glow around Earth
    const atmoR = earthR * 1.42;
    const atmoGrad = ctx.createRadialGradient(cx, cy, earthR * 0.82, cx, cy, atmoR);
    if (isThreat) {
      atmoGrad.addColorStop(0, 'rgba(239, 68, 68, 0.34)');
      atmoGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    } else if (isLocked) {
      atmoGrad.addColorStop(0, `rgba(${state.radarConfig.lockRgb}, 0.32)`);
      atmoGrad.addColorStop(1, `rgba(${state.radarConfig.lockRgb}, 0)`);
    } else {
      atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.30)');
      atmoGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    }
    ctx.fillStyle = atmoGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, atmoR, 0, Math.PI * 2);
    ctx.fill();

    // Clip interior of Earth sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.clip();

    if (this.earthStripSprite && this.earthGlobeSprite) {
      // Draw revolving surface strip from the uploaded Earth photo inside spherical clip
      const tileW = this.earthStripSprite.width * 0.5;
      const tileH = this.earthStripSprite.height;
      const scrollFrac = (this.ambientTime * 0.045) % 1;
      const sx = scrollFrac * tileW;
      const diameter = earthR * 2;
      ctx.drawImage(
        this.earthStripSprite,
        sx,
        0,
        tileW,
        tileH,
        cx - earthR,
        cy - earthR,
        diameter,
        diameter
      );

      // Subtle spherical depth vignette + sunlit atmospheric rim
      const sphereShade = ctx.createRadialGradient(
        cx - earthR * 0.28,
        cy - earthR * 0.28,
        earthR * 0.25,
        cx,
        cy,
        earthR * 1.04
      );
      sphereShade.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
      sphereShade.addColorStop(0.62, 'rgba(2, 6, 23, 0.08)');
      sphereShade.addColorStop(1, 'rgba(2, 6, 23, 0.58)');
      ctx.fillStyle = sphereShade;
      ctx.fillRect(cx - earthR, cy - earthR, diameter, diameter);
    } else {
      // Deep ocean sphere gradient fallback while image loads
      const oceanGrad = ctx.createRadialGradient(
        cx - earthR * 0.32,
        cy - earthR * 0.32,
        earthR * 0.1,
        cx + earthR * 0.12,
        cy + earthR * 0.12,
        earthR * 1.15
      );
      oceanGrad.addColorStop(0, '#38BDF8');
      oceanGrad.addColorStop(0.5, '#1D4ED8');
      oceanGrad.addColorStop(1, '#0B1938');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(cx - earthR, cy - earthR, earthR * 2, earthR * 2);
    }

    // Impact glow & scorch fractures if Earth was struck
    if (isDestroyed) {
      const scorch = ctx.createRadialGradient(cx, cy, 1, cx, cy, earthR * 0.88);
      scorch.addColorStop(0, 'rgba(249, 115, 22, 0.78)');
      scorch.addColorStop(0.5, 'rgba(239, 68, 68, 0.55)');
      scorch.addColorStop(1, 'rgba(15, 23, 42, 0.65)');
      ctx.fillStyle = scorch;
      ctx.fillRect(cx - earthR, cy - earthR, earthR * 2, earthR * 2);
    }

    ctx.restore(); // end sphere clip

    // Crisp atmospheric rim stroke
    ctx.strokeStyle = isThreat
      ? 'rgba(248, 113, 113, 0.85)'
      : isLocked
        ? `rgba(${state.radarConfig.lockRgb}, 0.85)`
        : 'rgba(125, 211, 252, 0.65)';
    ctx.lineWidth = Math.max(1.2, scale * 0.75);
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private renderTitleAmbientRadar(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    width: number,
    height: number,
    state: GameState
  ): void {
    const cx = toPxX(115);
    const cy = toPxY(0);
    const fullR = Math.hypot(width, height);
    const radar = state.radarConfig;
    const sweepAngle = this.ambientTime * (0.85 * radar.rotationSpeedMult);
    const orbitPx = GAME_CONFIG.PLAYER_ORBIT_RADIUS * scale;
    const shipPx = cx + Math.sin(sweepAngle) * orbitPx;
    const shipPy = cy - Math.cos(sweepAngle) * orbitPx;

    const w = Math.ceil(width);
    const h = Math.ceil(height);
    const key = `title:${w}:${h}:${Math.round(scale * 100)}:${radar.id}`;

    if (typeof document !== 'undefined') {
      if (!this.scopeCache || this.scopeCacheKey !== key) {
        const off = this.scopeCache ?? document.createElement('canvas');
        off.width = w;
        off.height = h;
        const octx = off.getContext('2d');
        if (octx) {
          octx.clearRect(0, 0, w, h);
          octx.strokeStyle = `rgba(${radar.ringRgb}, 0.14)`;
          octx.lineWidth = 1;
          for (let r = 68 * scale; r < fullR; r += 68 * scale) {
            octx.beginPath();
            octx.arc(cx, cy, r, 0, Math.PI * 2);
            octx.stroke();
          }
        }
        this.scopeCache = off;
        this.scopeCacheKey = key;
      }
      if (this.scopeCache) {
        ctx.drawImage(this.scopeCache, 0, 0);
      }
    }

    // Revolving Earth at center of the defense perimeter
    this.renderEarth(ctx, cx, cy, scale, state, true);

    ctx.save();

    // Circular guard orbit ring around Earth
    ctx.strokeStyle = `rgba(${radar.accentRgb}, 0.34)`;
    ctx.lineWidth = Math.max(1.2, scale * 0.7);
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, orbitPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Radar sweep cone radiating outward from the orbiting protecting ship
    const canvasAngle = sweepAngle - Math.PI / 2;
    ctx.fillStyle = `rgba(${radar.accentRgb}, 0.06)`;
    ctx.beginPath();
    ctx.moveTo(shipPx, shipPy);
    ctx.arc(shipPx, shipPy, fullR, canvasAngle - 0.32, canvasAngle + 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(${radar.accentRgb}, 0.12)`;
    ctx.beginPath();
    ctx.moveTo(shipPx, shipPy);
    ctx.arc(
      shipPx,
      shipPy,
      Math.min(fullR, 340 * scale),
      canvasAngle - 0.24,
      canvasAngle + 0.03
    );
    ctx.closePath();
    ctx.fill();

    // Sweeping beam leading edge
    ctx.strokeStyle = `rgba(${radar.accentRgb}, 0.78)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(shipPx, shipPy);
    ctx.lineTo(
      shipPx + Math.cos(canvasAngle) * fullR,
      shipPy + Math.sin(canvasAngle) * fullR
    );
    ctx.stroke();

    // Protecting ship revolving 360 degrees around Earth
    this.drawAircraftIcon(
      ctx,
      shipPx,
      shipPy,
      sweepAngle,
      scale,
      false,
      false
    );

    ctx.restore();
  }

  private renderCenterRadarAndShip(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    fullScreenRadius: number,
    scale: number,
    state: GameState
  ): void {
    const radar = state.radarConfig;
    const locked = state.signal >= state.levelConfig.lockThreshold;
    const hasSignal = state.signal > 2;
    const isThreat = state.enemyStrike !== null;
    const orbitPx = GAME_CONFIG.PLAYER_ORBIT_RADIUS * scale;
    const px = cx + Math.sin(state.radar.angle) * orbitPx;
    const py = cy - Math.cos(state.radar.angle) * orbitPx;
    const beamRadius = fullScreenRadius + orbitPx;

    // 1. Revolving Earth in the center of the playfield
    this.renderEarth(ctx, cx, cy, scale, state, false);

    ctx.save();

    // 2. Guard orbit ring around Earth showing the protecting ship's 360-degree path
    ctx.strokeStyle = isThreat
      ? 'rgba(239, 68, 68, 0.52)'
      : locked
        ? `rgba(${radar.lockRgb}, 0.65)`
        : `rgba(${radar.accentRgb}, 0.36)`;
    ctx.lineWidth = Math.max(1.2, scale * 0.72);
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, orbitPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (state.playerAlive) {
      // 3. Full-Screen Rotating Radar Detection Cone radiating from the orbiting protecting ship
      const canvasAngle = state.radar.angle - Math.PI / 2;
      const baseSpread = radar.id === 'aegis' || radar.id === 'solaris' ? 0.31 : 0.27;
      const spreadRad = locked
        ? 0.115
        : hasSignal
          ? baseSpread - 0.05 - (state.signal / 100) * 0.09
          : baseSpread;
      const beamColor = isThreat
        ? '239, 68, 68'
        : locked
          ? radar.lockRgb
          : hasSignal
            ? radar.accentRgb
            : radar.id === 'mk1'
              ? '100, 116, 139'
              : radar.accentRgb;

      // Subtle highlighted orbit arc showing current guard sector
      ctx.strokeStyle = `rgba(${beamColor}, ${locked ? 0.85 : 0.45})`;
      ctx.lineWidth = Math.max(2, scale * 1.15);
      ctx.beginPath();
      ctx.arc(cx, cy, orbitPx, canvasAngle - 0.32, canvasAngle + 0.32);
      ctx.stroke();

      ctx.fillStyle = `rgba(${beamColor}, ${
        locked ? 0.16 : hasSignal ? 0.11 : radar.id === 'mk1' ? 0.06 : 0.08
      })`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(
        px,
        py,
        beamRadius,
        canvasAngle - spreadRad,
        canvasAngle + spreadRad
      );
      ctx.closePath();
      ctx.fill();

      // Radar-specific outer sector edges for Aegis & Solaris
      if (radar.id === 'aegis' || radar.id === 'solaris') {
        ctx.strokeStyle = `rgba(${beamColor}, 0.24)`;
        ctx.lineWidth = 1;
        for (const edge of [canvasAngle - spreadRad, canvasAngle + spreadRad]) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(
            px + Math.cos(edge) * beamRadius,
            py + Math.sin(edge) * beamRadius
          );
          ctx.stroke();
        }
      }

      // Full-screen aim centerline from protecting ship nose
      ctx.strokeStyle = locked
        ? `rgba(${radar.lockRgb}, 0.78)`
        : hasSignal
          ? `rgba(${radar.accentRgb}, 0.56)`
          : `rgba(${radar.accentRgb}, 0.32)`;
      ctx.lineWidth = Math.max(1.2, scale * 0.75);
      ctx.setLineDash(radar.id === 'valkyrie' ? [10, 4] : [6, 6]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(
        px + Math.cos(canvasAngle) * beamRadius,
        py + Math.sin(canvasAngle) * beamRadius
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Expanding sonar pulse wave when tracking or locking onto a hazard signal
      if (hasSignal && !isThreat) {
        const rate = locked ? 2.1 : 0.85 + (state.signal / 100) * 1.1;
        const p = (this.ambientTime * rate) % 1;
        ctx.strokeStyle = `rgba(${beamColor}, ${((1 - p) * 0.48).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.4, scale * 0.78);
        ctx.beginPath();
        ctx.arc(
          px,
          py,
          (14 + p * (STAGE_BOUNDS.RADAR_RADIUS * 0.98)) * scale,
          canvasAngle - spreadRad * 1.15,
          canvasAngle + spreadRad * 1.15
        );
        ctx.stroke();
      }

      // Hazard lock beacon around the protecting ship when enemy hazard is detected
      if (locked && !isThreat) {
        const lockPulse = 0.65 + 0.35 * Math.sin(this.ambientTime * 14);
        ctx.strokeStyle = `rgba(${radar.lockRgb}, ${lockPulse.toFixed(2)})`;
        ctx.lineWidth = Math.max(1.6, scale * 0.9);
        ctx.beginPath();
        ctx.arc(px, py, 26 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crimson lock ring around protecting ship and Earth during incoming enemy counter-strike
      if (isThreat) {
        const pulse = 0.65 + 0.35 * Math.sin(this.ambientTime * 18);
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse.toFixed(2)})`;
        ctx.lineWidth = Math.max(2, scale * 1.15);
        ctx.beginPath();
        ctx.arc(cx, cy, (GAME_CONFIG.EARTH_RADIUS + 5) * scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Protecting Ship Turret Halo + Orbiting Fighter Jet Sprite (1.5x opponent UFO size)
      ctx.strokeStyle =
        state.playerFlashTimer > 0
          ? '#FFFFFF'
          : locked
            ? `rgba(${radar.lockRgb}, 0.92)`
            : `rgba(${radar.accentRgb}, 0.78)`;
      ctx.lineWidth = Math.max(1.5, scale * 0.9);
      ctx.beginPath();
      ctx.arc(px, py, 22.5 * scale, 0, Math.PI * 2);
      ctx.stroke();

      if (radar.id === 'valkyrie' || radar.id === 'solaris') {
        ctx.strokeStyle = `rgba(${locked ? radar.lockRgb : radar.accentRgb}, 0.42)`;
        ctx.lineWidth = Math.max(1.1, scale * 0.7);
        ctx.beginPath();
        ctx.arc(px, py, 26.5 * scale, canvasAngle - 0.8, canvasAngle + 0.8);
        ctx.stroke();
      }

      this.drawAircraftIcon(
        ctx,
        px,
        py,
        state.radar.angle,
        scale,
        false,
        state.playerFlashTimer > 0
      );

      // Protecting ship on-canvas health bar (3 to 6 HP depending on radar upgrade)
      this.drawHealthBar(
        ctx,
        px,
        py + 29 * scale,
        36 * scale,
        4.2 * scale,
        state.playerHp,
        state.playerMaxHp,
        state.playerHp <= 1
          ? '#EF4444'
          : state.playerHp <= Math.ceil(state.playerMaxHp * 0.5)
            ? '#F59E0B'
            : '#10B981'
      );
    } else {
      // Destroyed protecting ship debris along last orbit position
      ctx.translate(px, py);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.60)';
      ctx.lineWidth = Math.max(1.5, scale * 0.8);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6 * scale, Math.sin(a) * 6 * scale);
        ctx.lineTo(Math.cos(a) * 18 * scale, Math.sin(a) * 18 * scale);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawAircraftIcon(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    angleRad: number,
    scale: number,
    isEnemy: boolean,
    isFlashing: boolean
  ): void {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angleRad);

    const sprite = isEnemy ? this.enemySprite : this.playerSprite;
    // Our protecting spaceship is 1.5x larger than the opponent UFO width (34 * 1.5 = 51)
    const sizePx = isEnemy
      ? Math.max(26, 34 * scale)
      : Math.max(39, 51 * scale);

    if (sprite && !isFlashing) {
      ctx.drawImage(sprite, -sizePx * 0.5, -sizePx * 0.5, sizePx, sizePx);
      ctx.restore();
      return;
    }

    // Crisp fallback fighter jet silhouette (also used for brief 60ms white hit flash)
    const s = isEnemy ? scale * 0.9 : scale * 1.48;
    ctx.fillStyle = isFlashing ? '#FFFFFF' : isEnemy ? '#EF4444' : '#94A3B8';
    ctx.strokeStyle = isFlashing ? '#FFFFFF' : isEnemy ? '#FCA5A5' : '#E2E8F0';
    ctx.lineWidth = Math.max(1.2, s * 0.85);
    ctx.beginPath();
    ctx.moveTo(0, -16 * s);
    ctx.lineTo(3.5 * s, -5 * s);
    ctx.lineTo(15 * s, 5 * s);
    ctx.lineTo(13 * s, 9 * s);
    ctx.lineTo(4 * s, 6 * s);
    ctx.lineTo(6 * s, 13 * s);
    ctx.lineTo(0, 10 * s);
    ctx.lineTo(-6 * s, 13 * s);
    ctx.lineTo(-4 * s, 6 * s);
    ctx.lineTo(-13 * s, 9 * s);
    ctx.lineTo(-15 * s, 5 * s);
    ctx.lineTo(-3.5 * s, -5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isFlashing) {
      ctx.fillStyle = isEnemy ? '#FEF08A' : '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(0, -5 * s, 2.2 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    hp: number,
    maxHp: number,
    fillColor: string
  ): void {
    const w = Math.max(22, width);
    const h = Math.max(3.5, height);
    const x = cx - w * 0.5;
    const y = cy - h * 0.5;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 28, 0.88)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

    ctx.fillStyle = 'rgba(51, 65, 85, 0.65)';
    ctx.fillRect(x, y, w, h);

    if (ratio > 0) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, w * ratio, h);
    }

    if (maxHp > 1 && maxHp <= 8) {
      ctx.fillStyle = 'rgba(7, 11, 18, 0.85)';
      for (let i = 1; i < maxHp; i++) {
        const divX = x + (w * i) / maxHp;
        ctx.fillRect(divX - 0.5, y, 1, h);
      }
    }

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 0.9;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    ctx.restore();
  }

  private renderOpponentShip(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    enemy: ShipState,
    isCounterAttacking: boolean
  ): void {
    const sx = toPxX(enemy.x);
    const sy = toPxY(enemy.y);
    const isFlashing = enemy.flashTimer > 0;

    ctx.save();
    ctx.translate(sx, sy);

    const bracketW = 20 * scale;
    const bracketH = 14 * scale;
    const cornerLen = 5.5 * scale;
    ctx.strokeStyle = isFlashing
      ? '#FFFFFF'
      : isCounterAttacking
        ? '#EF4444'
        : '#10B981';
    ctx.lineWidth = Math.max(1.5, scale * 0.95);
    ctx.beginPath();
    ctx.moveTo(-bracketW, -bracketH + cornerLen);
    ctx.lineTo(-bracketW, -bracketH);
    ctx.lineTo(-bracketW + cornerLen, -bracketH);
    ctx.moveTo(bracketW - cornerLen, -bracketH);
    ctx.lineTo(bracketW, -bracketH);
    ctx.lineTo(bracketW, -bracketH + cornerLen);
    ctx.moveTo(-bracketW, bracketH - cornerLen);
    ctx.lineTo(-bracketW, bracketH);
    ctx.lineTo(-bracketW + cornerLen, bracketH);
    ctx.moveTo(bracketW - cornerLen, bracketH);
    ctx.lineTo(bracketW, bracketH);
    ctx.lineTo(bracketW, bracketH - cornerLen);
    ctx.stroke();
    ctx.restore();

    // Draw uploaded UFO saucer upright with gentle hover bank (player ship is 1.5x wider)
    const tilt = Math.max(
      -0.18,
      Math.min(0.18, enemy.angularVel * 0.14)
    ) + Math.sin(this.ambientTime * 3.1 + enemy.id) * 0.04;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(tilt);

    const ufoW = Math.max(26, 34 * scale);
    const ufoH = ufoW * (295 / 575);

    if (this.enemySprite && !isFlashing) {
      ctx.drawImage(this.enemySprite, -ufoW * 0.5, -ufoH * 0.5, ufoW, ufoH);
    } else {
      // Crisp saucer silhouette fallback (also used for brief 80ms white hit flash)
      ctx.fillStyle = isFlashing ? '#FFFFFF' : '#475569';
      ctx.strokeStyle = isFlashing ? '#FFFFFF' : '#F97316';
      ctx.lineWidth = Math.max(1.2, scale * 0.8);
      ctx.beginPath();
      ctx.ellipse(0, 0, ufoW * 0.48, ufoH * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -ufoH * 0.22, ufoW * 0.2, ufoH * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Opponent UFO health bar directly above target bracket
    if (!isCounterAttacking) {
      this.drawHealthBar(
        ctx,
        sx,
        sy - bracketH - 7 * scale,
        24 * scale,
        3.6 * scale,
        enemy.hp,
        enemy.maxHp,
        '#EF4444'
      );
    }
  }

  private renderLaunchShockwave(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    state: GameState
  ): void {
    const sw = state.launchShockwave;
    const t = Math.min(1, sw.elapsed / sw.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const alpha = Math.max(0, 1 - t);
    const px = toPxX(sw.x);
    const py = toPxY(sw.y);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(sw.angle);

    // Forward ignition flash cone
    ctx.fillStyle = `rgba(254, 240, 138, ${(alpha * 0.55).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(0, -14 * ease * scale);
    ctx.lineTo(10 * (1 - t * 0.5) * scale, 8 * scale);
    ctx.lineTo(-10 * (1 - t * 0.5) * scale, 8 * scale);
    ctx.closePath();
    ctx.fill();

    // Expanding shock ring
    ctx.strokeStyle = `rgba(${state.radarConfig.accentRgb}, ${(alpha * 0.8).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.4, (1 - t) * 2.5 * scale);
    ctx.beginPath();
    ctx.arc(0, 0, (6 + ease * 24) * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private renderContrail(
    ctx: CanvasRenderingContext2D,
    trail: TrailPoint[],
    count: number,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    outerRgb: string,
    coreRgb: string
  ): void {
    if (count < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < count - 1; i++) {
      const a = trail[i];
      const b = trail[i + 1];
      if (!a.active || !b.active) continue;
      const frac = 1 - i / count;
      ctx.strokeStyle = `rgba(${outerRgb}, ${(frac * 0.42).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, frac * 6.5 * scale);
      ctx.beginPath();
      ctx.moveTo(toPxX(a.x), toPxY(a.y));
      ctx.lineTo(toPxX(b.x), toPxY(b.y));
      ctx.stroke();

      ctx.strokeStyle = `rgba(${coreRgb}, ${(frac * 0.72).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.8, frac * 2.4 * scale);
      ctx.beginPath();
      ctx.moveTo(toPxX(a.x), toPxY(a.y));
      ctx.lineTo(toPxX(b.x), toPxY(b.y));
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderMissPulse(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number
  ): void {
    const mp = this.missPulse;
    const t = Math.min(1, mp.elapsed / mp.duration);
    const ease = 1 - Math.pow(1 - t, 2);
    const alpha = Math.max(0, 1 - t);
    const px = toPxX(mp.x);
    const py = toPxY(mp.y);

    ctx.save();
    ctx.strokeStyle = `rgba(148, 163, 184, ${(alpha * 0.75).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.2, (1 - t) * 2.6 * scale);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(px, py, (6 + ease * 26) * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderMissile(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    angle: number,
    scale: number,
    bodyColor: string,
    coreColor: string,
    flameColor: string
  ): void {
    const s = Math.max(1, scale * 0.95);
    const flicker = 0.78 + 0.35 * Math.abs(Math.sin(this.ambientTime * 68));

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    // Outer plasma glow around thruster & fuselage
    ctx.fillStyle = `${bodyColor}33`;
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 6.5 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multi-layer flickering supersonic exhaust flame
    ctx.fillStyle = flameColor;
    ctx.beginPath();
    ctx.moveTo(-2.6 * s, 7.5 * s);
    ctx.lineTo(0, (17 + 7 * flicker) * s);
    ctx.lineTo(2.6 * s, 7.5 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-1.3 * s, 7.5 * s);
    ctx.lineTo(0, (12 + 4 * flicker) * s);
    ctx.lineTo(1.3 * s, 7.5 * s);
    ctx.closePath();
    ctx.fill();

    // Swept stabilizing tail fins
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-2.3 * s, 3.5 * s);
    ctx.lineTo(-5.8 * s, 8.2 * s);
    ctx.lineTo(-2.1 * s, 7.5 * s);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(2.3 * s, 3.5 * s);
    ctx.lineTo(5.8 * s, 8.2 * s);
    ctx.lineTo(2.1 * s, 7.5 * s);
    ctx.closePath();
    ctx.fill();

    // Sleek missile fuselage & pointed warhead cone
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, -11.5 * s);
    ctx.lineTo(2.7 * s, -4.5 * s);
    ctx.lineTo(2.5 * s, 7.5 * s);
    ctx.lineTo(-2.5 * s, 7.5 * s);
    ctx.lineTo(-2.7 * s, -4.5 * s);
    ctx.closePath();
    ctx.fill();

    // Bright metallic nose highlight & core band
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(0, -11.5 * s);
    ctx.lineTo(1.4 * s, -5 * s);
    ctx.lineTo(1.2 * s, 3.5 * s);
    ctx.lineTo(-1.2 * s, 3.5 * s);
    ctx.lineTo(-1.4 * s, -5 * s);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderEnemyStrike(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    state: GameState
  ): void {
    const es = state.enemyStrike;
    if (!es) return;

    const sx = toPxX(state.ship.x);
    const sy = toPxY(state.ship.y);
    const cx = toPxX(0);
    const cy = toPxY(0);

    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = Math.max(1.5, scale * 0.8);
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (this.enemyTrailCount > 1) {
      this.renderContrail(
        ctx,
        this.enemyTrail,
        this.enemyTrailCount,
        toPxX,
        toPxY,
        scale,
        '239, 68, 68',
        '254, 202, 202'
      );
    }

    this.renderMissile(
      ctx,
      toPxX(es.x),
      toPxY(es.y),
      es.angle,
      scale * 1.1,
      '#EF4444',
      '#FECACA',
      '#F97316'
    );
  }

  private renderBlast(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    state: GameState
  ): void {
    const bx = toPxX(state.blast.x);
    const by = toPxY(state.blast.y);
    const t = Math.min(1, state.blast.elapsed / state.blast.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const alpha = Math.max(0, 1 - t);

    ctx.save();

    ctx.strokeStyle = `rgba(254, 240, 138, ${(alpha * 0.9).toFixed(3)})`;
    ctx.lineWidth = Math.max(2, (1 - t) * 4 * scale);
    ctx.beginPath();
    ctx.arc(bx, by, (10 + ease * 44) * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(239, 68, 68, ${(alpha * 0.78).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bx, by, (8 + ease * 28) * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(245, 158, 11, ${(alpha * 0.88).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bx, by, (5 + ease * 18) * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.95).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bx, by, (3 + ease * 9) * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
