/* Engine vẽ quả địa cầu 3D bằng canvas 2D (không phụ thuộc thư viện đồ họa).
   Bề mặt xoay quanh trục nghiêng với các lục địa thật (xem globeLand.ts), một vành 360° có vạch chia độ
   và các nút người đánh giá quay quanh quả cầu. Màu lấy từ biến CSS của phần tử canvas.

   Đất liền có hai kiểu: chấm vuông (nền tối) hoặc viền bờ biển cùng nét gạch chéo như bản khắc (nền sáng).

   Tối ưu hiệu năng:
   - lớp tĩnh (quầng sáng, thân cầu, viền) và quầng sáng của nút được vẽ sẵn vào sprite, mỗi khung chỉ drawImage;
   - kiểu chấm: chỉ vẽ nửa điểm phía trước, gộp mọi điểm cùng độ sáng vào một đường path;
   - kiểu gạch chéo: nét kẻ cố định trên màn hình, mỗi mẫu được đưa ngược về tọa độ quả cầu để tra mặt nạ lục địa;
     vĩ độ của mẫu không đổi khi quả cầu quay, kinh độ chỉ lệch đúng góc quay, nên phép đổi tọa độ được tính sẵn
     (chỉ tính lại khi đổi cỡ hoặc góc nhìn) và mỗi khung chỉ còn cộng góc quay rồi tra mặt nạ;
   - bờ biển, kinh – vĩ tuyến, vành và vạch chia độ được tính sẵn, mỗi khung chỉ xoay và chiếu;
   - ba mức chất lượng (số điểm, độ phân giải, độ mịn nét) để chủ động hạ khi khung hình chậm. */

import { MASK_HEIGHT, MASK_WIDTH, getCoastlines, getLandMask, isLandAt } from './globeLand';

export type GlobeTone = 'gold' | 'cyan' | 'violet' | 'magenta';

export interface SceneNode {
  key: string;
  label: string;
  tone: GlobeTone;
  /** Đường vẽ biểu tượng (SVG path, lưới 24 × 24) hiển thị trong nút; bỏ trống thì vẽ chấm */
  icon?: string;
}

export interface GlobeScene {
  resize(size: number, dpr: number): void;
  step(dt: number, slow: boolean): void;
  render(time: number, activeKey: string | null): void;
  grab(): void;
  dragBy(dx: number, dy: number, dt: number): void;
  release(): void;
  nodeAt(x: number, y: number): string | null;
  /** Đưa nút của nhóm đã chọn ra phía trước vành; null để vành tự quay tiếp */
  focus(key: string | null, snap: boolean): void;
  /** Bật: quay bình thường; tắt: giảm tốc dần rồi đứng yên */
  setActive(active: boolean): void;
  /** Không còn chuyển động nào đang diễn ra, có thể dừng vòng lặp vẽ */
  isIdle(): boolean;
  /** 0 = đầy đủ, 1 = vừa, 2 = nhẹ nhất */
  setQuality(level: number): void;
  getQuality(): number;
}

type RGB = [number, number, number];

const TAU = Math.PI * 2;
const AXIAL_TILT = 0.41;
const REST_PITCH = 0.42;
const RING_TILT = -0.3;
const RING_RADIUS = 1.5;
const RING_STEPS = 120;
const TICK_COUNT = 72;
const ARC_STEPS = 32;
const ARC_COUNT = 5;
const MERIDIANS = 12;
const MERIDIAN_STEPS = 40;
const PARALLEL_STEPS = 56;
const AUTO_YAW = 0.2;
const RING_SPEED = 0.42;
const DRAG_YAW = 0.0075;
const DRAG_PITCH = 0.004;
const GLOW_SPRITE = 64;
const BUCKET_COUNT = 5;

const DOTS_PER_PX = [1.9, 1.3, 0.85];
const MAX_DOTS = [1100, 760, 480];
const MAX_DPR = [1.75, 1.35, 1];

/* Gạch chéo đất liền (đơn vị theo cỡ canvas / 360): bước lấy mẫu dọc nét theo từng mức chất lượng, khoảng cách giữa các nét */
const HATCH_STEP = [0.9, 1.3, 1.9];
const HATCH_GAP = [2.5, 2.9, 3.6];
const CROSS_GAP = 3.2;
/* Hướng nhìn của ánh sáng (trái trên, hướng về người xem); phần có độ sáng dưới ngưỡng được kẻ thêm nét đan chéo */
const LIGHT: [number, number, number] = [-0.38, 0.45, 0.81];
const SHADE_LIMIT = 0.3;

/* ---------- Màu ---------- */

function parseColor(value: string, fallback: RGB): RGB {
  const v = value.trim();
  if (v.startsWith('#')) {
    const hex = v.length === 4 ? v.slice(1).split('').map((c) => c + c).join('') : v.slice(1, 7);
    const n = parseInt(hex, 16);
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const match = v.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(',').map((p) => parseFloat(p));
    if (parts.length >= 3 && parts.every(Number.isFinite)) return [parts[0], parts[1], parts[2]];
  }
  return fallback;
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

interface Palette {
  land: RGB;
  sea: RGB;
  bodyLit: RGB;
  bodyDark: RGB;
  /** Quầng sáng quanh quả cầu */
  halo: RGB;
  /** Viền và rìa sáng của thân cầu */
  rim: RGB;
  /** Lưới kinh – vĩ tuyến */
  grid: RGB;
  /** Vĩ tuyến quét từ trên xuống */
  sweep: RGB;
  /** Vành quay và vạch chia độ */
  ring: RGB;
  tick: RGB;
  /** Phần bóng ở cạnh tối của thân cầu */
  shade: RGB;
  /** Lớp phủ nhạt dần ở rìa quả cầu, làm các nét gần rìa mờ đi như bị sương che */
  limb: RGB;
  /** Mực: tia sáng chạy, chữ nhãn */
  ink: RGB;
  /** Nền nút và nền nhãn (kiểu nút viền) */
  face: RGB;
  labelBg: RGB;
  tones: Record<GlobeTone, RGB>;
  font: string;
  haloAlpha: number;
  /** Dịch tâm quầng sáng xuống dưới, theo bán kính quả cầu: tạo bóng đổ nhẹ */
  haloShift: number;
  bodyAlpha: number;
  shadeAlpha: number;
  limbAlpha: number;
  rimFill: number;
  rimLine: number;
  gridAlpha: number;
  sweepAlpha: number;
  seaAlpha: number;
  nodeGlow: number;
  /** Đất liền vẽ bằng nét gạch chéo như phác thảo; ngược lại là các chấm vuông */
  hatch: boolean;
  /** Nút trắng viền màu nhóm; ngược lại là nút đặc màu nhóm */
  outline: boolean;
}

/* Giá trị dự phòng là bảng màu nền tối (khung Stage), khớp với CSS mặc định của khung đó */
function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const get = (name: string, fallback: RGB) => parseColor(style.getPropertyValue(name), fallback);
  const num = (name: string, fallback: number) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  const is = (name: string, expected: string) => style.getPropertyValue(name).trim() === expected;
  const atmosphere: RGB = [34, 211, 238];
  return {
    land: get('--globe-land', [199, 227, 254]),
    sea: get('--globe-sea', [102, 172, 224]),
    bodyLit: get('--globe-body-lit', [45, 116, 168]),
    bodyDark: get('--globe-body-dark', [3, 25, 100]),
    halo: get('--globe-halo', atmosphere),
    rim: get('--globe-rim', atmosphere),
    grid: get('--globe-grid', atmosphere),
    sweep: get('--globe-sweep', atmosphere),
    ring: get('--globe-ring', atmosphere),
    tick: get('--globe-tick', [255, 255, 255]),
    shade: get('--globe-shade', [3, 25, 100]),
    limb: get('--globe-limb', [255, 255, 255]),
    ink: get('--globe-ink', [255, 255, 255]),
    face: get('--globe-face', [255, 255, 255]),
    labelBg: get('--globe-label-bg', [3, 25, 100]),
    tones: {
      gold: get('--globe-tone-gold', [246, 183, 60]),
      cyan: get('--globe-tone-cyan', [34, 211, 238]),
      violet: get('--globe-tone-violet', [139, 108, 255]),
      magenta: get('--globe-tone-magenta', [240, 91, 208]),
    },
    font: style.getPropertyValue('--font-sans').trim() || 'sans-serif',
    haloAlpha: num('--globe-halo-alpha', 1),
    haloShift: num('--globe-halo-shift', 0),
    bodyAlpha: num('--globe-body-alpha', 1),
    shadeAlpha: num('--globe-shade-alpha', 0.62),
    limbAlpha: num('--globe-limb-alpha', 0),
    rimFill: num('--globe-rim-fill', 0.4),
    rimLine: num('--globe-rim-line', 0.6),
    gridAlpha: num('--globe-grid-alpha', 0.2),
    sweepAlpha: num('--globe-sweep-alpha', 0.65),
    seaAlpha: num('--globe-sea-alpha', 1),
    nodeGlow: num('--globe-node-glow', 1),
    hatch: is('--globe-land-style', 'hatch'),
    outline: is('--globe-node-style', 'outline'),
  };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function mixColor(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(mix(a[0], b[0], t)), Math.round(mix(a[1], b[1], t)), Math.round(mix(a[2], b[2], t))];
}

/* ---------- Bề mặt: điểm Fibonacci, mỗi điểm biết mình nằm trên đất liền hay biển ---------- */

interface Surface {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  land: Uint8Array;
}

const surfaceCache = new Map<number, Surface>();

function buildSurface(count: number): Surface {
  const cached = surfaceCache.get(count);
  if (cached) return cached;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const land = new Uint8Array(count);
  const landMask = getLandMask();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const yy = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - yy * yy);
    const phi = i * golden;
    x[i] = Math.cos(phi) * r;
    y[i] = yy;
    z[i] = Math.sin(phi) * r;
    land[i] = isLandAt(landMask, x[i], yy, z[i]) ? 1 : 0;
  }
  const surface = { count, x, y, z, land };
  surfaceCache.set(count, surface);
  return surface;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Arc {
  points: Float32Array;
  tone: GlobeTone;
  offset: number;
}

/** Cung nối hai điểm trên đất liền, nhô lên khỏi bề mặt */
function buildArcs(surface: Surface, tones: GlobeTone[]): Arc[] {
  const rng = mulberry32(2026);
  const lands: number[] = [];
  for (let i = 0; i < surface.count; i++) if (surface.land[i]) lands.push(i);
  const arcs: Arc[] = [];
  if (lands.length < 2) return arcs;

  for (let attempt = 0; attempt < 120 && arcs.length < ARC_COUNT; attempt++) {
    const a = lands[Math.floor(rng() * lands.length)];
    const b = lands[Math.floor(rng() * lands.length)];
    const dot = surface.x[a] * surface.x[b] + surface.y[a] * surface.y[b] + surface.z[a] * surface.z[b];
    const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (omega < 0.7 || omega > 1.7) continue;

    const points = new Float32Array((ARC_STEPS + 1) * 3);
    const sinOmega = Math.sin(omega);
    for (let s = 0; s <= ARC_STEPS; s++) {
      const t = s / ARC_STEPS;
      const k1 = Math.sin((1 - t) * omega) / sinOmega;
      const k2 = Math.sin(t * omega) / sinOmega;
      const lift = 1 + 0.2 * Math.sin(Math.PI * t) * (omega / 1.5);
      points[s * 3] = (surface.x[a] * k1 + surface.x[b] * k2) * lift;
      points[s * 3 + 1] = (surface.y[a] * k1 + surface.y[b] * k2) * lift;
      points[s * 3 + 2] = (surface.z[a] * k1 + surface.z[b] * k2) * lift;
    }
    arcs.push({ points, tone: tones[arcs.length % tones.length], offset: rng() });
  }
  return arcs;
}

/* ---------- Dữ liệu hình học tính sẵn (không phụ thuộc kích thước) ---------- */

function parallel(lat: number) {
  const line = new Float32Array((PARALLEL_STEPS + 1) * 3);
  for (let i = 0; i <= PARALLEL_STEPS; i++) {
    const lon = (i / PARALLEL_STEPS) * TAU;
    line[i * 3] = Math.cos(lat) * Math.cos(lon);
    line[i * 3 + 1] = Math.sin(lat);
    line[i * 3 + 2] = Math.cos(lat) * Math.sin(lon);
  }
  return line;
}

/** Mỗi đường là một dãy điểm đơn vị liên tiếp (x, y, z) */
function buildGraticule() {
  const lines: Float32Array[] = [];
  for (let m = 0; m < MERIDIANS; m++) {
    const lon = (m / MERIDIANS) * TAU;
    const line = new Float32Array((MERIDIAN_STEPS + 1) * 3);
    for (let i = 0; i <= MERIDIAN_STEPS; i++) {
      const lat = -Math.PI / 2 + (i / MERIDIAN_STEPS) * Math.PI;
      line[i * 3] = Math.cos(lat) * Math.cos(lon);
      line[i * 3 + 1] = Math.sin(lat);
      line[i * 3 + 2] = Math.cos(lat) * Math.sin(lon);
    }
    lines.push(line);
  }
  for (let l = -2; l <= 2; l++) lines.push(parallel((l * Math.PI) / 6));
  return lines;
}

const GRATICULE = buildGraticule();

/** Hướng đơn vị của các điểm trên vành (đã nghiêng) */
const RING_DIRS = (() => {
  const dirs = new Float32Array((RING_STEPS + 1) * 3);
  const rcz = Math.cos(RING_TILT);
  const rsz = Math.sin(RING_TILT);
  for (let i = 0; i <= RING_STEPS; i++) {
    const a = (i / RING_STEPS) * TAU;
    const x0 = Math.cos(a);
    dirs[i * 3] = x0 * rcz;
    dirs[i * 3 + 1] = x0 * rsz;
    dirs[i * 3 + 2] = Math.sin(a);
  }
  return dirs;
})();

const TICK_COS = new Float32Array(TICK_COUNT);
const TICK_SIN = new Float32Array(TICK_COUNT);
for (let k = 0; k < TICK_COUNT; k++) {
  TICK_COS[k] = Math.cos((k / TICK_COUNT) * TAU);
  TICK_SIN[k] = Math.sin((k / TICK_COUNT) * TAU);
}

/** Đưa góc về khoảng (-π, π] */
function wrapAngle(angle: number) {
  const a = ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a === -Math.PI ? Math.PI : a;
}

/* ---------- Gạch chéo đất liền ---------- */

/** Các mẫu của một lớp nét gạch, tính sẵn cho một cỡ và một góc nhìn */
interface HatchPass {
  count: number;
  /** Vị trí trên canvas */
  x: Float32Array;
  y: Float32Array;
  /** Vị trí hàng trong mặt nạ lục địa (đã nhân bề ngang mặt nạ) */
  row: Int32Array;
  /** Cột trong mặt nạ khi quả cầu ở góc quay 0 */
  column: Float32Array;
  /** 1 khi mẫu không nối liền với mẫu trước (đầu nét mới hoặc có mẫu bị bỏ ở giữa) */
  gapBefore: Uint8Array;
}

/** Lấy mẫu dọc các nét kẻ song song trên đĩa quả cầu và đổi sẵn mỗi mẫu về vĩ độ cùng kinh độ ở góc quay 0 */
function buildHatchPass(
  angle: number,
  gap: number,
  step: number,
  shadedOnly: boolean,
  R: number,
  cx: number,
  cy: number,
  pitch: number,
): HatchPass {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cosTilt = Math.cos(AXIAL_TILT);
  const sinTilt = Math.sin(AXIAL_TILT);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const x: number[] = [];
  const y: number[] = [];
  const row: number[] = [];
  const column: number[] = [];
  const gapBefore: number[] = [];
  for (let c = -1 + gap / 2; c < 1; c += gap) {
    const half = Math.sqrt(1 - c * c);
    let broken = true;
    for (let t = -half; t <= half; t += step) {
      const u = t * dirX - c * dirY;
      const v = t * dirY + c * dirX;
      const w2 = 1 - u * u - v * v;
      if (w2 <= 0) {
        broken = true;
        continue;
      }
      const w = Math.sqrt(w2);
      if (shadedOnly && u * LIGHT[0] + v * LIGHT[1] + w * LIGHT[2] > SHADE_LIMIT) {
        broken = true;
        continue;
      }
      const py = v * cp + w * sp;
      const pz = w * cp - v * sp;
      const x1 = u * cosTilt + py * sinTilt;
      const y0 = py * cosTilt - u * sinTilt;
      const lat = Math.asin(y0 > 1 ? 1 : y0 < -1 ? -1 : y0);
      const r = Math.min(MASK_HEIGHT - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * MASK_HEIGHT));
      x.push(cx + u * R);
      y.push(cy - v * R);
      row.push(r * MASK_WIDTH);
      // Quay quanh trục một góc yaw chỉ trừ kinh độ đi đúng yaw: kinh độ = -atan2(z, x) - yaw
      column.push(((Math.PI - Math.atan2(pz, x1)) / TAU) * MASK_WIDTH);
      gapBefore.push(broken ? 1 : 0);
      broken = false;
    }
  }
  return {
    count: x.length,
    x: Float32Array.from(x),
    y: Float32Array.from(y),
    row: Int32Array.from(row),
    column: Float32Array.from(column),
    gapBefore: Uint8Array.from(gapBefore),
  };
}

/* ---------- Cảnh ---------- */

interface NodeState {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
}

interface Sprites {
  halo: HTMLCanvasElement;
  body: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  glows: Record<GlobeTone, HTMLCanvasElement>;
}

function makeCanvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = Math.max(1, Math.round(width));
  element.height = Math.max(1, Math.round(height));
  return element;
}

export function createGlobeScene(canvas: HTMLCanvasElement, nodes: SceneNode[], initialQuality = 0): GlobeScene | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const context = ctx;

  const palette = readPalette(canvas);
  const toneList = nodes.map((n) => n.tone);
  const iconPaths = nodes.map((n) => (n.icon ? new Path2D(n.icon) : null));

  let quality = Math.max(0, Math.min(2, Math.round(initialQuality)));
  let size = 0;
  let deviceRatio = 1;
  let surface = buildSurface(0);
  let arcs: Arc[] = [];
  let px = new Float32Array(0);
  let py = new Float32Array(0);
  let buckets: Int32Array[] = [];
  let sprites: Sprites | null = null;
  let hatchCache: { key: string; main: HatchPass; cross: HatchPass } | null = null;

  let yaw = 0.7;
  let pitch = REST_PITCH;
  let yawVel = 0;
  let ringPhase = 0.4;
  let speed = 1;
  let activity = 1;
  let activityTarget = 1;
  let dragging = false;
  let focusIndex = -1;
  let focusSettled = true;

  const nodeState: NodeState[] = nodes.map(() => ({ x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 }));
  const P = { x: 0, y: 0, z: 0 };
  const widthCache = new Map<string, number>();
  const arcProjected = new Float32Array((ARC_STEPS + 1) * 3);
  const counts = [0, 0, 0, 0, 0];

  /* ----- Sprite tĩnh ----- */
  function buildSprites(scale: number) {
    const R = size * 0.285;
    const { bodyLit, bodyDark, tones } = palette;

    const haloSize = R * 3.2;
    const halo = makeCanvas(haloSize * scale, haloSize * scale);
    const haloCtx = halo.getContext('2d');
    if (haloCtx) {
      haloCtx.scale(scale, scale);
      const c = haloSize / 2;
      const shift = R * palette.haloShift;
      const gradient = haloCtx.createRadialGradient(c, c + shift, R * 0.9, c, c + shift, R * 1.6 - shift);
      gradient.addColorStop(0, rgba(palette.halo, 0.34 * palette.haloAlpha));
      gradient.addColorStop(0.35, rgba(palette.halo, 0.12 * palette.haloAlpha));
      gradient.addColorStop(1, rgba(palette.halo, 0));
      haloCtx.fillStyle = gradient;
      haloCtx.fillRect(0, 0, haloSize, haloSize);
    }

    const bodySize = R * 2;
    const body = makeCanvas(bodySize * scale, bodySize * scale);
    const bodyCtx = body.getContext('2d');
    if (bodyCtx) {
      bodyCtx.scale(scale, scale);
      const gradient = bodyCtx.createRadialGradient(R - R * 0.38, R - R * 0.42, R * 0.05, R, R, R * 1.05);
      gradient.addColorStop(0, rgba(bodyLit, palette.bodyAlpha));
      gradient.addColorStop(0.55, rgba(mixColor(bodyLit, bodyDark, 0.6), palette.bodyAlpha));
      gradient.addColorStop(1, rgba(bodyDark, palette.bodyAlpha));
      bodyCtx.fillStyle = gradient;
      bodyCtx.beginPath();
      bodyCtx.arc(R, R, R, 0, TAU);
      bodyCtx.fill();
    }

    const overlay = makeCanvas((bodySize + 4) * scale, (bodySize + 4) * scale);
    const overlayCtx = overlay.getContext('2d');
    if (overlayCtx) {
      overlayCtx.scale(scale, scale);
      const c = R + 2;
      const shade = overlayCtx.createRadialGradient(c + R * 0.5, c + R * 0.55, R * 0.25, c + R * 0.3, c + R * 0.35, R * 1.25);
      shade.addColorStop(0, rgba(palette.shade, 0));
      shade.addColorStop(1, rgba(palette.shade, palette.shadeAlpha));
      overlayCtx.fillStyle = shade;
      overlayCtx.beginPath();
      overlayCtx.arc(c, c, R, 0, TAU);
      overlayCtx.fill();

      if (palette.limbAlpha > 0) {
        const limb = overlayCtx.createRadialGradient(c, c, R * 0.55, c, c, R);
        limb.addColorStop(0, rgba(palette.limb, 0));
        limb.addColorStop(0.7, rgba(palette.limb, palette.limbAlpha * 0.25));
        limb.addColorStop(1, rgba(palette.limb, palette.limbAlpha));
        overlayCtx.fillStyle = limb;
        overlayCtx.beginPath();
        overlayCtx.arc(c, c, R, 0, TAU);
        overlayCtx.fill();
      }

      const rim = overlayCtx.createRadialGradient(c, c, R * 0.76, c, c, R);
      rim.addColorStop(0, rgba(palette.rim, 0));
      rim.addColorStop(1, rgba(palette.rim, palette.rimFill));
      overlayCtx.fillStyle = rim;
      overlayCtx.beginPath();
      overlayCtx.arc(c, c, R, 0, TAU);
      overlayCtx.fill();
      overlayCtx.strokeStyle = rgba(palette.rim, palette.rimLine);
      overlayCtx.lineWidth = 1.4 * (size / 360);
      overlayCtx.stroke();
    }

    const glows = {} as Record<GlobeTone, HTMLCanvasElement>;
    (Object.keys(tones) as GlobeTone[]).forEach((tone) => {
      const sprite = makeCanvas(GLOW_SPRITE, GLOW_SPRITE);
      const g = sprite.getContext('2d');
      if (g) {
        const half = GLOW_SPRITE / 2;
        const gradient = g.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, rgba(tones[tone], 0.85 * palette.nodeGlow));
        gradient.addColorStop(1, rgba(tones[tone], 0));
        g.fillStyle = gradient;
        g.fillRect(0, 0, GLOW_SPRITE, GLOW_SPRITE);
      }
      glows[tone] = sprite;
    });

    sprites = { halo, body, overlay, glows };
  }

  function applySize() {
    const dpr = Math.min(deviceRatio, MAX_DPR[quality]);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* Kiểu gạch chéo tra thẳng mặt nạ lục địa nên các điểm chỉ còn dùng để chọn đầu mút cung nối */
    const count = palette.hatch ? 400 : Math.max(300, Math.min(MAX_DOTS[quality], Math.round(size * DOTS_PER_PX[quality])));
    surface = buildSurface(count);
    arcs = buildArcs(surface, toneList);
    px = new Float32Array(count);
    py = new Float32Array(count);
    buckets = Array.from({ length: BUCKET_COUNT }, () => new Int32Array(count));
    buildSprites(dpr);
  }

  function resize(nextSize: number, dpr: number) {
    size = nextSize;
    deviceRatio = dpr;
    applySize();
  }

  function setQuality(level: number) {
    const next = Math.max(0, Math.min(2, Math.round(level)));
    if (next === quality) return;
    quality = next;
    if (size > 0) applySize();
  }

  /** Pha của vành để nút thứ k nằm ở điểm gần người xem nhất */
  function focusPhase(k: number) {
    return Math.PI / 2 - (k * TAU) / nodes.length;
  }

  function step(dt: number, slow: boolean) {
    const target = slow ? 0.3 : 1;
    speed += (target - speed) * Math.min(1, dt * 5);
    activity += (activityTarget - activity) * Math.min(1, dt * 2.5);
    if (Math.abs(activity - activityTarget) < 0.002) activity = activityTarget;
    const rate = speed * activity;
    if (!dragging) {
      yaw += (AUTO_YAW * rate + yawVel) * dt;
      yawVel *= Math.exp(-dt * 2.2);
      if (Math.abs(yawVel) < 0.005) yawVel = 0;
      pitch += (REST_PITCH - pitch) * Math.min(1, dt * 0.6);
      /* Chốt hẳn về góc nghỉ: gạch chéo tính sẵn theo góc nhìn, góc cứ nhích từng chút thì phải tính lại mỗi khung */
      if (Math.abs(REST_PITCH - pitch) < 1e-4) pitch = REST_PITCH;
    }
    if (focusIndex >= 0) {
      const diff = wrapAngle(focusPhase(focusIndex) - ringPhase);
      ringPhase += diff * Math.min(1, dt * 4);
      focusSettled = Math.abs(diff) < 0.002;
    } else {
      ringPhase += RING_SPEED * rate * dt;
    }
  }

  function render(time: number, activeKey: string | null) {
    const art = sprites;
    if (size === 0 || !art) return;
    const s = size / 360;
    const R = size * 0.285;
    const cx = size / 2;
    const cy = size / 2;
    const ringR = R * RING_RADIUS;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const { land, sea, ink, tones } = palette;

    context.clearRect(0, 0, size, size);

    const project = (x: number, y: number, z: number) => {
      P.x = cx + x;
      P.y = cy - (y * cp - z * sp);
      P.z = y * sp + z * cp;
    };

    /* Vị trí các nút trên vành */
    const rcz = Math.cos(RING_TILT);
    const rsz = Math.sin(RING_TILT);
    for (let k = 0; k < nodes.length; k++) {
      const a = ringPhase + (k * TAU) / nodes.length;
      const x0 = Math.cos(a);
      const rx = x0 * rcz;
      const ry = x0 * rsz;
      const rz = Math.sin(a);
      project(rx * ringR, ry * ringR, rz * ringR);
      const st = nodeState[k];
      st.x = P.x;
      st.y = P.y;
      st.z = P.z;
      st.dx = rx;
      st.dy = ry;
      st.dz = rz;
    }

    /* Quầng khí quyển (sprite) */
    const haloSize = R * 3.2;
    context.drawImage(art.halo, cx - haloSize / 2, cy - haloSize / 2, haloSize, haloSize);

    const spin = -ringPhase * 0.35;
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);

    const drawRing = (front: boolean) => {
      context.lineWidth = (front ? 1.6 : 1.1) * s;
      context.strokeStyle = rgba(palette.ring, front ? 0.7 : 0.26);
      context.beginPath();
      let pen = false;
      for (let i = 0; i <= RING_STEPS; i++) {
        project(RING_DIRS[i * 3] * ringR, RING_DIRS[i * 3 + 1] * ringR, RING_DIRS[i * 3 + 2] * ringR);
        if (P.z >= 0 === front) {
          if (pen) context.lineTo(P.x, P.y);
          else {
            context.moveTo(P.x, P.y);
            pen = true;
          }
        } else pen = false;
      }
      context.stroke();

      /* Vạch chia độ: vạch dài mỗi 90°, vừa mỗi 30°, ngắn còn lại */
      context.strokeStyle = rgba(palette.tick, front ? 0.75 : 0.22);
      for (let tier = 0; tier < 3; tier++) {
        context.lineWidth = (tier === 0 ? 2.2 : 1) * s;
        const len = (tier === 0 ? 10 : tier === 1 ? 6.5 : 3.4) * s;
        context.beginPath();
        for (let k = 0; k < TICK_COUNT; k++) {
          if ((k % 18 === 0 ? 0 : k % 6 === 0 ? 1 : 2) !== tier) continue;
          const c = TICK_COS[k] * cs - TICK_SIN[k] * sn;
          const d = TICK_SIN[k] * cs + TICK_COS[k] * sn;
          const dx = c * rcz;
          const dy = c * rsz;
          project(dx * ringR, dy * ringR, d * ringR);
          if (P.z >= 0 !== front) continue;
          const x0 = P.x;
          const y0 = P.y;
          project(dx * (ringR + len), dy * (ringR + len), d * (ringR + len));
          context.moveTo(x0, y0);
          context.lineTo(P.x, P.y);
        }
        context.stroke();
      }
    };

    const badgeRadius = Math.max(11, 12 * s);

    const drawNode = (k: number, front: boolean) => {
      const st = nodeState[k];
      if ((st.z >= 0) !== front) return;
      const tone = tones[nodes[k].tone];
      const active = nodes[k].key === activeKey;
      if (!front && Math.hypot(st.x - cx, st.y - cy) < R) return;

      const depth = 0.85 + 0.15 * (st.z / ringR);
      const dim = front ? 1 : 0.5;
      const radius = badgeRadius * (active ? 1.3 : 1) * depth;
      const glowR = radius * (active ? 3.4 : 2.6);
      context.globalAlpha = dim;
      context.drawImage(art.glows[nodes[k].tone], st.x - glowR, st.y - glowR, glowR * 2, glowR * 2);

      /* Nút đặc màu nhóm, viền sáng, biểu tượng nét tối ở giữa; kiểu nút viền: nền trắng, viền và biểu tượng màu nhóm,
         chỉ đặc màu khi đang chọn */
      const solid = !palette.outline || active;
      context.fillStyle = solid ? rgba(tone, 1) : rgba(palette.face, 0.94);
      context.beginPath();
      context.arc(st.x, st.y, radius, 0, TAU);
      context.fill();
      context.strokeStyle = palette.outline ? rgba(tone, 1) : rgba(ink, 0.9);
      context.lineWidth = Math.max(1, (palette.outline ? 1.5 : 1.3) * s);
      context.stroke();

      const iconPath = iconPaths[k];
      if (iconPath) {
        const scale = (radius * 1.25) / 24;
        context.save();
        context.translate(st.x - 12 * scale, st.y - 12 * scale);
        context.scale(scale, scale);
        context.strokeStyle = rgba(palette.outline ? ink : palette.bodyDark, 1);
        context.lineWidth = 2.2;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.stroke(iconPath);
        context.restore();
      } else {
        context.fillStyle = palette.outline && !active ? rgba(tone, 1) : rgba(ink, 1);
        context.beginPath();
        context.arc(st.x, st.y, radius * 0.4, 0, TAU);
        context.fill();
      }
      context.globalAlpha = 1;

      if (!front) return;

      /* Tia nối từ nút xuống bề mặt */
      project(st.dx * R, st.dy * R, st.dz * R);
      const bx = P.x;
      const by = P.y;
      context.strokeStyle = rgba(tone, active ? 0.8 : 0.3);
      context.lineWidth = (active ? 2 : 1) * s;
      context.beginPath();
      context.moveTo(st.x, st.y);
      context.lineTo(bx, by);
      context.stroke();

      const travel = (time * 0.0009 + k * 0.27) % 1;
      context.fillStyle = rgba(ink, active ? 0.95 : 0.55);
      context.beginPath();
      context.arc(mix(st.x, bx, travel), mix(st.y, by, travel), (active ? 2.2 : 1.4) * s, 0, TAU);
      context.fill();

      const ripple = (time * 0.0006 + k * 0.31) % 1;
      context.strokeStyle = rgba(tone, (1 - ripple) * (active ? 0.8 : 0.4));
      context.lineWidth = 1.2 * s;
      context.beginPath();
      context.arc(bx, by, (3 + 14 * ripple) * s, 0, TAU);
      context.stroke();
    };

    /* Lớp sau: nửa vành phía sau và các nút phía sau */
    drawRing(false);
    for (let k = 0; k < nodes.length; k++) drawNode(k, false);

    /* Thân quả cầu (sprite) */
    context.drawImage(art.body, cx - R, cy - R, R * 2, R * 2);

    /* Phép xoay từ hệ quả cầu ra màn hình: quay quanh trục, nghiêng trục, rồi ngả theo góc nhìn */
    const cyw = Math.cos(yaw);
    const syw = Math.sin(yaw);
    const cosTilt = Math.cos(AXIAL_TILT);
    const sinTilt = Math.sin(AXIAL_TILT);

    const surfacePoint = (x0: number, y0: number, z0: number) => {
      const x1 = x0 * cyw + z0 * syw;
      const z1 = -x0 * syw + z0 * cyw;
      const x2 = x1 * cosTilt - y0 * sinTilt;
      const y2 = x1 * sinTilt + y0 * cosTilt;
      project(x2 * R, y2 * R, z1 * R);
    };
    const strokeLine = (line: Float32Array) => {
      const n = line.length / 3;
      let pen = false;
      for (let i = 0; i < n; i++) {
        surfacePoint(line[i * 3], line[i * 3 + 1], line[i * 3 + 2]);
        if (P.z > 0) {
          if (pen) context.lineTo(P.x, P.y);
          else {
            context.moveTo(P.x, P.y);
            pen = true;
          }
        } else pen = false;
      }
    };

    if (palette.hatch) {
      /* Đất liền kiểu bản khắc: nét kẻ chéo cố định trên màn hình, chỉ vẽ đoạn nào đang rơi trên đất liền
         (đưa điểm mẫu ngược về tọa độ quả cầu để tra mặt nạ), phía tối kẻ thêm nét đan chéo, bờ biển viền đậm */
      const landMask = getLandMask();
      const hatchKey = `${size}|${quality}|${pitch}`;
      if (!hatchCache || hatchCache.key !== hatchKey) {
        /* Nét và khoảng cách có mức tối thiểu để quả cầu nhỏ (công tắc) vẫn thấy rõ nét gạch */
        const step = Math.max(0.9, HATCH_STEP[quality] * s) / R;
        hatchCache = {
          key: hatchKey,
          main: buildHatchPass(Math.PI / 4, Math.max(3.2, HATCH_GAP[quality] * s) / R, step, false, R, cx, cy, pitch),
          cross: buildHatchPass(-Math.PI / 4, Math.max(4.2, CROSS_GAP * s) / R, step, true, R, cx, cy, pitch),
        };
      }
      /* Góc quay đổi ra số cột mặt nạ, đưa về [0, bề ngang) để mỗi mẫu chỉ cần trừ một lần khi vượt mép */
      const shift = ((((-yaw / TAU) * MASK_WIDTH) % MASK_WIDTH) + MASK_WIDTH) % MASK_WIDTH;
      const hatch = (pass: HatchPass) => {
        context.beginPath();
        let pen = false;
        for (let i = 0; i < pass.count; i++) {
          if (pass.gapBefore[i]) pen = false;
          let column = Math.floor(pass.column[i] + shift);
          if (column >= MASK_WIDTH) column -= MASK_WIDTH;
          if (landMask[pass.row[i] + column] === 1) {
            if (pen) context.lineTo(pass.x[i], pass.y[i]);
            else {
              context.moveTo(pass.x[i], pass.y[i]);
              pen = true;
            }
          } else pen = false;
        }
        context.stroke();
      };

      context.strokeStyle = rgba(land, 0.5);
      context.lineWidth = Math.max(0.7, 0.7 * s);
      hatch(hatchCache.main);
      context.strokeStyle = rgba(land, 0.42);
      context.lineWidth = Math.max(0.6, 0.6 * s);
      hatch(hatchCache.cross);

      context.strokeStyle = rgba(land, 0.88);
      context.lineWidth = Math.max(1, 1.1 * s);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      const coasts = getCoastlines();
      for (let i = 0; i < coasts.length; i++) strokeLine(coasts[i]);
      context.stroke();
      context.lineCap = 'butt';
      context.lineJoin = 'miter';
    } else {
      /* Điểm bề mặt: chỉ nửa trước, gộp theo độ sáng */
      counts.fill(0);
      for (let i = 0; i < surface.count; i++) {
        const x0 = surface.x[i];
        const y0 = surface.y[i];
        const z0 = surface.z[i];
        const x1 = x0 * cyw + z0 * syw;
        const z1 = -x0 * syw + z0 * cyw;
        const x2 = x1 * cosTilt - y0 * sinTilt;
        const y2 = x1 * sinTilt + y0 * cosTilt;
        const z3 = y2 * sp + z1 * cp;
        if (z3 <= 0) continue;
        px[i] = cx + x2 * R;
        py[i] = cy - (y2 * cp - z1 * sp) * R;
        let b: number;
        if (surface.land[i]) b = z3 > 0.7 ? 4 : z3 > 0.35 ? 3 : 2;
        else b = z3 > 0.4 ? 1 : 0;
        buckets[b][counts[b]++] = i;
      }

      const bucketStyle: { color: RGB; alpha: number; radius: number }[] = [
        { color: sea, alpha: 0.26 * palette.seaAlpha, radius: 0.8 },
        { color: sea, alpha: 0.46 * palette.seaAlpha, radius: 0.95 },
        { color: land, alpha: 0.5, radius: 1.25 },
        { color: land, alpha: 0.8, radius: 1.55 },
        { color: land, alpha: 1, radius: 1.8 },
      ];
      for (let b = 0; b < BUCKET_COUNT; b++) {
        if (counts[b] === 0) continue;
        const style = bucketStyle[b];
        const r = style.radius * s;
        context.fillStyle = rgba(style.color, style.alpha);
        const d = r * 2;
        context.beginPath();
        for (let n = 0; n < counts[b]; n++) {
          const i = buckets[b][n];
          context.rect(px[i] - r, py[i] - r, d, d);
        }
        context.fill();
      }
    }

    /* Lưới kinh – vĩ tuyến (chỉ nửa trước) và vĩ tuyến quét từ trên xuống */
    context.strokeStyle = rgba(palette.grid, palette.gridAlpha);
    context.lineWidth = 0.8 * s;
    context.beginPath();
    for (let i = 0; i < GRATICULE.length; i++) strokeLine(GRATICULE[i]);
    context.stroke();

    context.strokeStyle = rgba(palette.sweep, palette.sweepAlpha);
    context.lineWidth = 1.6 * s;
    context.beginPath();
    strokeLine(parallel(Math.sin(time * 0.00045) * 1.2));
    context.stroke();

    /* Đổ bóng cạnh sáng – tối và viền khí quyển (sprite) */
    context.drawImage(art.overlay, cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4);

    /* Các cung kết nối trên bề mặt */
    for (let a = 0; a < arcs.length; a++) {
      const arc = arcs[a];
      const tone = tones[arc.tone];
      const pts = arc.points;
      for (let i = 0; i <= ARC_STEPS; i++) {
        surfacePoint(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
        arcProjected[i * 3] = P.x;
        arcProjected[i * 3 + 1] = P.y;
        arcProjected[i * 3 + 2] = P.z;
      }
      context.strokeStyle = rgba(tone, 0.4);
      context.lineWidth = 1.1 * s;
      context.beginPath();
      let pen = false;
      for (let i = 0; i <= ARC_STEPS; i++) {
        if (arcProjected[i * 3 + 2] > 0.03) {
          if (pen) context.lineTo(arcProjected[i * 3], arcProjected[i * 3 + 1]);
          else {
            context.moveTo(arcProjected[i * 3], arcProjected[i * 3 + 1]);
            pen = true;
          }
        } else pen = false;
      }
      context.stroke();

      const head = Math.floor(((time * 0.00035 + arc.offset) % 1) * (ARC_STEPS + 1));
      for (let tail = 0; tail < 6; tail++) {
        const i = head - tail;
        if (i < 0 || arcProjected[i * 3 + 2] <= 0.03) continue;
        context.fillStyle = rgba(tail === 0 ? ink : tone, 1 - tail / 6);
        context.beginPath();
        context.arc(arcProjected[i * 3], arcProjected[i * 3 + 1], (2.2 - tail * 0.2) * s, 0, TAU);
        context.fill();
      }
    }

    /* Lớp trước: nửa vành phía trước và các nút phía trước */
    drawRing(true);
    for (let k = 0; k < nodes.length; k++) drawNode(k, true);

    /* Nhãn của nút đang chọn */
    const activeIndex = activeKey === null ? -1 : nodes.findIndex((n) => n.key === activeKey);
    if (activeIndex >= 0 && nodeState[activeIndex].z > -ringR * 0.25) {
      const stn = nodeState[activeIndex];
      const text = nodes[activeIndex].label;
      const fontSize = Math.max(12, 13 * s);
      context.font = `700 ${fontSize}px ${palette.font}`;
      const widthKey = `${fontSize}|${text}`;
      let textWidth = widthCache.get(widthKey);
      if (textWidth === undefined) {
        textWidth = context.measureText(text).width;
        widthCache.set(widthKey, textWidth);
      }
      const padX = 9 * s;
      const boxW = textWidth + padX * 2;
      const boxH = fontSize + 10 * s;
      const margin = 4;
      const bx = Math.max(margin, Math.min(size - boxW - margin, stn.x - boxW / 2));
      const gap = badgeRadius * 1.3 + 6;
      const above = stn.y - gap - 4 - boxH > margin;
      const by = above ? stn.y - gap - boxH : stn.y + gap;
      const tone = tones[nodes[activeIndex].tone];

      context.fillStyle = rgba(palette.labelBg, 0.92);
      context.strokeStyle = rgba(tone, 0.95);
      context.lineWidth = 1.5 * s;
      const rr = Math.min(4 * s, boxH / 2);
      context.beginPath();
      context.moveTo(bx + rr, by);
      context.arcTo(bx + boxW, by, bx + boxW, by + boxH, rr);
      context.arcTo(bx + boxW, by + boxH, bx, by + boxH, rr);
      context.arcTo(bx, by + boxH, bx, by, rr);
      context.arcTo(bx, by, bx + boxW, by, rr);
      context.closePath();
      context.fill();
      context.stroke();

      context.fillStyle = rgba(ink, 1);
      context.textBaseline = 'middle';
      context.textAlign = 'center';
      context.fillText(text, bx + boxW / 2, by + boxH / 2 + 0.5);
    }
  }

  return {
    resize,
    step,
    render,
    grab() {
      dragging = true;
      yawVel = 0;
    },
    dragBy(dx, dy, dt) {
      yaw += dx * DRAG_YAW;
      pitch = Math.max(0.08, Math.min(0.95, pitch + dy * DRAG_PITCH));
      if (dt > 0) yawVel = 0.6 * yawVel + 0.4 * Math.max(-4, Math.min(4, (dx * DRAG_YAW) / dt));
    },
    release() {
      dragging = false;
    },
    focus(key, snap) {
      focusIndex = key === null ? -1 : nodes.findIndex((n) => n.key === key);
      focusSettled = false;
      if (snap && focusIndex >= 0) {
        ringPhase = focusPhase(focusIndex);
        focusSettled = true;
      }
    },
    setActive(active) {
      activityTarget = active ? 1 : 0;
    },
    isIdle() {
      const rotating = activity > 0 || activityTarget > 0;
      const moving = dragging || yawVel !== 0 || (focusIndex >= 0 && !focusSettled);
      return !rotating && !moving;
    },
    nodeAt(x, y) {
      const sc = size / 360;
      let bestIndex = -1;
      let bestDist = Math.max(26 * sc, 20);
      for (let k = 0; k < nodes.length; k++) {
        const st = nodeState[k];
        if (st.z < -size * 0.05) continue;
        const dist = Math.hypot(st.x - x, st.y - y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = k;
        }
      }
      return bestIndex >= 0 ? nodes[bestIndex].key : null;
    },
    setQuality,
    getQuality: () => quality,
  };
}
