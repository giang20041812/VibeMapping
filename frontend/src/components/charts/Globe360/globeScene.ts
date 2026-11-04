/* Engine vẽ quả địa cầu 3D bằng canvas 2D (không phụ thuộc thư viện đồ họa), kiểu hình dán.
   Bề mặt xoay quanh trục nghiêng với các lục địa thật (xem globeLand.ts), một vành 360° và các nút người đánh giá quay quanh quả cầu.
   Màu lấy từ biến CSS của phần tử canvas.

   Phong cách: màu phẳng, viền mực dày, bóng đặc lệch xuống, không phát sáng, không gradient. Chỉ có hai chuyển động liên tục:
   quả cầu tự quay và vành quay quanh nó. Không có quầng sáng, tia quét, chấm chạy hay sóng gợn.

   Tối ưu hiệu năng:
   - đất liền tô đặc từ một ảnh nhỏ: mỗi ô tra ngược về quả cầu rồi tra mặt nạ lục địa, phóng lên đĩa; số ô giảm theo mức chất lượng;
   - bờ biển, kinh – vĩ tuyến và vành được tính sẵn, mỗi khung chỉ xoay và chiếu;
   - ba mức chất lượng (độ phân giải, độ mịn ảnh đất liền) để chủ động hạ khi khung hình chậm. */

import { getCoastlines, getLandMask, isLandAt } from './globeLand';

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
const ARC_STEPS = 32;
const ARC_COUNT = 5;
const MERIDIANS = 6;
const MERIDIAN_STEPS = 40;
const PARALLEL_STEPS = 56;
const AUTO_YAW = 0.2;
const RING_SPEED = 0.42;
const DRAG_YAW = 0.0075;
const DRAG_PITCH = 0.004;

const MAX_DPR = [1.75, 1.35, 1];

/* Cỡ ô của ảnh đất liền theo mức chất lượng (nhân với R / 60, tối thiểu 1,5 px): mức càng thấp ô càng to, tra mặt nạ càng ít */
const LAND_CELL = [1, 1.4, 2];

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
  /** Lưới kinh – vĩ tuyến */
  grid: RGB;
  /** Vành quay */
  ring: RGB;
  /** Vệt bóng hình trăng khuyết */
  shade: RGB;
  /** Mực: viền mọi hình, bóng đặc, chữ nhãn */
  ink: RGB;
  /** Giấy: nền nhãn, vòng quanh nút đang chọn, vệt sáng */
  paper: RGB;
  /** Nét biểu tượng trong nút */
  icon: RGB;
  tones: Record<GlobeTone, RGB>;
  font: string;
  shadeAlpha: number;
  gridAlpha: number;
}

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const get = (name: string, fallback: RGB) => parseColor(style.getPropertyValue(name), fallback);
  const num = (name: string, fallback: number) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    land: get('--globe-land', [16, 185, 129]),
    sea: get('--globe-sea', [59, 130, 246]),
    grid: get('--globe-grid', [255, 255, 255]),
    ring: get('--globe-ring', [139, 92, 246]),
    shade: get('--globe-shade', [30, 27, 90]),
    ink: get('--globe-ink', [30, 27, 90]),
    paper: get('--globe-paper', [255, 255, 255]),
    icon: get('--globe-icon', [255, 255, 255]),
    tones: {
      gold: get('--globe-tone-gold', [251, 191, 36]),
      cyan: get('--globe-tone-cyan', [34, 211, 238]),
      violet: get('--globe-tone-violet', [139, 92, 246]),
      magenta: get('--globe-tone-magenta', [236, 72, 153]),
    },
    font: style.getPropertyValue('--font-sans').trim() || 'sans-serif',
    shadeAlpha: num('--globe-shade-alpha', 0.22),
    gridAlpha: num('--globe-grid-alpha', 0.5),
  };
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
  for (let l = -1; l <= 1; l++) lines.push(parallel((l * Math.PI) / 6));
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

/** Đưa góc về khoảng (-π, π] */
function wrapAngle(angle: number) {
  const a = ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a === -Math.PI ? Math.PI : a;
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

interface LandBuffer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  image: ImageData;
  /** Số ô mỗi cạnh */
  n: number;
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
  let landBuffer: LandBuffer | null = null;

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

  function applySize() {
    const dpr = Math.min(deviceRatio, MAX_DPR[quality]);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* Các điểm bề mặt chỉ còn dùng để chọn đầu mút cung nối */
    surface = buildSurface(400);
    arcs = buildArcs(surface, toneList);
    landBuffer = null;
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

  /* Đất liền tô đặc: mỗi ô của một ảnh nhỏ được tra ngược về tọa độ quả cầu rồi tra mặt nạ lục địa, sau đó phóng lên đĩa.
     Bờ biển vẽ đè bằng nét mực nên phần lệch nửa ô không lộ ra. */
  function drawLand(cx: number, cy: number, R: number, cyw: number, syw: number, cosTilt: number, sinTilt: number, cp: number, sp: number) {
    const cell = Math.max(1.5, R / 60) * LAND_CELL[quality];
    const n = Math.max(8, Math.ceil((2 * R) / cell));
    if (!landBuffer || landBuffer.n !== n) {
      const element = makeCanvas(n, n);
      const bufferContext = element.getContext('2d');
      if (!bufferContext) return;
      landBuffer = { canvas: element, context: bufferContext, image: bufferContext.createImageData(n, n), n };
    }
    const { canvas: element, context: bufferContext, image } = landBuffer;
    const data = image.data;
    const mask = getLandMask();
    const [lr, lg, lb] = palette.land;
    let o = 0;
    for (let j = 0; j < n; j++) {
      const v = 1 - ((j + 0.5) * 2) / n;
      for (let i = 0; i < n; i++, o += 4) {
        const u = ((i + 0.5) * 2) / n - 1;
        const w2 = 1 - u * u - v * v;
        if (w2 <= 0) {
          data[o + 3] = 0;
          continue;
        }
        const w = Math.sqrt(w2);
        const y2 = v * cp + w * sp;
        const z1 = w * cp - v * sp;
        const x1 = u * cosTilt + y2 * sinTilt;
        const y0 = y2 * cosTilt - u * sinTilt;
        const x0 = x1 * cyw - z1 * syw;
        const z0 = x1 * syw + z1 * cyw;
        if (isLandAt(mask, x0, y0, z0)) {
          data[o] = lr;
          data[o + 1] = lg;
          data[o + 2] = lb;
          data[o + 3] = 255;
        } else data[o + 3] = 0;
      }
    }
    bufferContext.putImageData(image, 0, 0);
    context.drawImage(element, cx - R, cy - R, R * 2, R * 2);
  }

  function render(_time: number, activeKey: string | null) {
    if (size === 0) return;
    const s = size / 360;
    const R = size * 0.285;
    const cx = size / 2;
    const cy = size / 2;
    const ringR = R * RING_RADIUS;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const { sea, ink, tones } = palette;
    /* Nét mực và bóng đặc dùng chung cho mọi hình: dày vừa, bóng lệch xuống không nhòe */
    const inkWidth = Math.max(1.6, 2.4 * s);
    const pop = Math.max(1.5, 4 * s);

    context.clearRect(0, 0, size, size);
    context.lineCap = 'round';
    context.lineJoin = 'round';

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

    /* Vành: nửa trước là dải màu viền mực, nửa sau là nét đứt mờ */
    const ringWidth = Math.max(2, 3 * s);
    const drawRing = (front: boolean) => {
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
      if (front) {
        context.strokeStyle = rgba(ink, 1);
        context.lineWidth = ringWidth + inkWidth * 1.6;
        context.stroke();
        context.strokeStyle = rgba(palette.ring, 1);
        context.lineWidth = ringWidth;
        context.stroke();
      } else {
        context.setLineDash([7 * s, 6 * s]);
        context.strokeStyle = rgba(palette.ring, 0.55);
        context.lineWidth = ringWidth * 0.8;
        context.stroke();
        context.setLineDash([]);
      }
    };

    const badgeRadius = Math.max(11, 12 * s);
    const edge = inkWidth * 0.5;

    const drawNode = (k: number, front: boolean) => {
      const st = nodeState[k];
      if ((st.z >= 0) !== front) return;
      const tone = tones[nodes[k].tone];
      const active = nodes[k].key === activeKey;
      if (!front && Math.hypot(st.x - cx, st.y - cy) < R) return;

      const depth = 0.85 + 0.15 * (st.z / ringR);
      const radius = badgeRadius * (active ? 1.3 : 1) * depth;
      context.globalAlpha = front ? 1 : 0.5;

      if (front) {
        /* Tia nối từ nút xuống bề mặt: nét đứt mực, chân tia là một chấm màu nhóm */
        project(st.dx * R, st.dy * R, st.dz * R);
        const bx = P.x;
        const by = P.y;
        context.setLineDash([4 * s, 4 * s]);
        context.strokeStyle = rgba(ink, active ? 0.9 : 0.5);
        context.lineWidth = Math.max(1, (active ? 2 : 1.5) * s);
        context.beginPath();
        context.moveTo(st.x, st.y);
        context.lineTo(bx, by);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = rgba(tone, 1);
        context.strokeStyle = rgba(ink, 1);
        context.lineWidth = inkWidth * 0.7;
        context.beginPath();
        context.arc(bx, by, Math.max(2, 3.2 * s), 0, TAU);
        context.fill();
        context.stroke();
      }

      /* Bóng đặc lệch xuống, vòng trắng khi đang chọn, rồi nút màu nhóm viền mực */
      const outer = radius + (active ? 5 * s : 0);
      context.fillStyle = rgba(ink, 1);
      context.beginPath();
      context.arc(st.x, st.y + pop, outer + edge, 0, TAU);
      context.fill();
      context.strokeStyle = rgba(ink, 1);
      context.lineWidth = inkWidth;
      if (active) {
        context.fillStyle = rgba(palette.paper, 1);
        context.beginPath();
        context.arc(st.x, st.y, outer, 0, TAU);
        context.fill();
        context.stroke();
      }
      context.fillStyle = rgba(tone, 1);
      context.beginPath();
      context.arc(st.x, st.y, radius, 0, TAU);
      context.fill();
      context.stroke();

      /* Vệt bóng trắng góc trên trái */
      context.fillStyle = rgba(palette.paper, 0.7);
      context.beginPath();
      context.ellipse(st.x - radius * 0.42, st.y - radius * 0.46, radius * 0.2, radius * 0.11, -0.7, 0, TAU);
      context.fill();

      const iconPath = iconPaths[k];
      if (iconPath) {
        const scale = (radius * 1.25) / 24;
        context.save();
        context.translate(st.x - 12 * scale, st.y - 12 * scale);
        context.scale(scale, scale);
        context.strokeStyle = rgba(palette.icon, 1);
        context.lineWidth = 2.2;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.stroke(iconPath);
        context.restore();
      } else {
        context.fillStyle = rgba(ink, 1);
        context.beginPath();
        context.arc(st.x, st.y, radius * 0.4, 0, TAU);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    /* Lớp sau: nửa vành phía sau và các nút phía sau */
    drawRing(false);
    for (let k = 0; k < nodes.length; k++) drawNode(k, false);

    /* Bóng đặc của quả cầu, rồi biển phẳng */
    context.fillStyle = rgba(ink, 1);
    context.beginPath();
    context.arc(cx, cy + pop * 1.4, R + edge, 0, TAU);
    context.fill();
    context.fillStyle = rgba(sea, 1);
    context.beginPath();
    context.arc(cx, cy, R, 0, TAU);
    context.fill();

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

    context.save();
    context.beginPath();
    context.arc(cx, cy, R, 0, TAU);
    context.clip();

    drawLand(cx, cy, R, cyw, syw, cosTilt, sinTilt, cp, sp);

    /* Lưới kinh – vĩ tuyến thưa, nét trắng mảnh */
    context.strokeStyle = rgba(palette.grid, palette.gridAlpha);
    context.lineWidth = Math.max(1, 1.2 * s);
    context.beginPath();
    for (let i = 0; i < GRATICULE.length; i++) strokeLine(GRATICULE[i]);
    context.stroke();

    /* Bờ biển viền mực */
    context.strokeStyle = rgba(ink, 0.9);
    context.lineWidth = Math.max(1.1, 1.5 * s);
    context.beginPath();
    const coasts = getCoastlines();
    for (let i = 0; i < coasts.length; i++) strokeLine(coasts[i]);
    context.stroke();

    /* Khối: một vệt bóng hình trăng khuyết mép sắc ở góc dưới phải, một vệt sáng trắng ở góc trên trái */
    context.fillStyle = rgba(palette.shade, palette.shadeAlpha);
    context.beginPath();
    context.arc(cx, cy, R, 0, TAU);
    context.moveTo(cx - R * 0.2 + R * 0.96, cy - R * 0.24);
    context.arc(cx - R * 0.2, cy - R * 0.24, R * 0.96, 0, TAU);
    context.fill('evenodd');
    context.fillStyle = rgba(palette.paper, 0.6);
    context.beginPath();
    context.ellipse(cx - R * 0.45, cy - R * 0.52, R * 0.17, R * 0.08, -0.65, 0, TAU);
    context.fill();
    context.beginPath();
    context.arc(cx - R * 0.2, cy - R * 0.68, R * 0.04, 0, TAU);
    context.fill();
    context.restore();

    context.strokeStyle = rgba(ink, 1);
    context.lineWidth = inkWidth * 1.1;
    context.beginPath();
    context.arc(cx, cy, R, 0, TAU);
    context.stroke();

    /* Các cung kết nối trên bề mặt: nét đứt màu nhóm, đứng yên */
    context.setLineDash([5 * s, 4 * s]);
    context.lineWidth = Math.max(1.2, 1.8 * s);
    for (let a = 0; a < arcs.length; a++) {
      const arc = arcs[a];
      const pts = arc.points;
      for (let i = 0; i <= ARC_STEPS; i++) {
        surfacePoint(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
        arcProjected[i * 3] = P.x;
        arcProjected[i * 3 + 1] = P.y;
        arcProjected[i * 3 + 2] = P.z;
      }
      context.strokeStyle = rgba(tones[arc.tone], 1);
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
    }
    context.setLineDash([]);

    /* Lớp trước: nửa vành phía trước và các nút phía trước */
    drawRing(true);
    for (let k = 0; k < nodes.length; k++) drawNode(k, true);

    /* Nhãn của nút đang chọn: nhãn trắng viền mực có bóng đặc */
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

      const rr = boxH / 2;
      const pill = (y: number) => {
        context.beginPath();
        context.moveTo(bx + rr, y);
        context.arcTo(bx + boxW, y, bx + boxW, y + boxH, rr);
        context.arcTo(bx + boxW, y + boxH, bx, y + boxH, rr);
        context.arcTo(bx, y + boxH, bx, y, rr);
        context.arcTo(bx, y, bx + boxW, y, rr);
        context.closePath();
      };
      context.fillStyle = rgba(ink, 1);
      context.strokeStyle = rgba(ink, 1);
      context.lineWidth = inkWidth;
      pill(by + pop * 0.8);
      context.fill();
      context.stroke();
      context.fillStyle = rgba(palette.paper, 1);
      pill(by);
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
