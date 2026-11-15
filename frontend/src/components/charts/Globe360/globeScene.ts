/* Engine vẽ quả địa cầu 3D bằng canvas 2D (không phụ thuộc thư viện đồ họa).
   Bề mặt xoay quanh trục nghiêng với các lục địa thật (xem globeLand.ts), một vành 360° và các nút người đánh giá quay quanh quả cầu.
   Màu lấy từ biến CSS của phần tử canvas.

   Phong cách: khối cầu chàm chuyển sắc, lục địa là lưới chấm sáng, quầng khí quyển mỏng và vành mảnh;
   nút người đánh giá là viên tròn màu nhóm viền trắng, bóng mềm cùng sắc. Chỉ có hai chuyển động liên tục:
   quả cầu tự quay và vành quay quanh nó.

   Tối ưu hiệu năng:
   - đất liền tra từ một ảnh nhỏ: mỗi ô tra ngược về quả cầu rồi tra mặt nạ lục địa; ảnh này cắt lưới chấm vẽ sẵn;
   - lưới chấm, các dải chuyển sắc, kinh – vĩ tuyến và vành được tính sẵn, mỗi khung chỉ xoay và chiếu;
   - ba mức chất lượng (độ phân giải, độ mịn ảnh đất liền, bóng mềm) để chủ động hạ khi khung hình chậm. */

import { getLandMask, isLandAt } from './globeLand';

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

/** Pha màu c với màu w theo tỉ lệ t (0 = giữ nguyên c) */
const mix = (c: RGB, w: RGB, t: number): RGB => [c[0] + (w[0] - c[0]) * t, c[1] + (w[1] - c[1]) * t, c[2] + (w[2] - c[2]) * t];

interface Palette {
  /** Lục địa: màu chấm */
  land: RGB;
  landAlpha: number;
  /** Biển: sắc sáng phía được chiếu và sắc sâu ở mép khuất */
  sea: RGB;
  seaDeep: RGB;
  /** Lưới kinh – vĩ tuyến */
  grid: RGB;
  gridAlpha: number;
  /** Vành quay */
  ring: RGB;
  /** Quầng khí quyển và viền sáng mép cầu */
  glow: RGB;
  /** Chữ nhãn và bóng mềm */
  ink: RGB;
  /** Nền nhãn, viền nút, vệt sáng */
  paper: RGB;
  /** Nét biểu tượng trong nút */
  icon: RGB;
  tones: Record<GlobeTone, RGB>;
  font: string;
}

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const get = (name: string, fallback: RGB) => parseColor(style.getPropertyValue(name), fallback);
  const num = (name: string, fallback: number) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    land: get('--globe-land', [255, 255, 255]),
    landAlpha: num('--globe-land-alpha', 0.9),
    sea: get('--globe-sea', [99, 102, 241]),
    seaDeep: get('--globe-sea-deep', [43, 39, 117]),
    grid: get('--globe-grid', [255, 255, 255]),
    gridAlpha: num('--globe-grid-alpha', 0.12),
    ring: get('--globe-ring', [165, 168, 248]),
    glow: get('--globe-glow', [99, 102, 241]),
    ink: get('--globe-ink', [24, 26, 58]),
    paper: get('--globe-paper', [255, 255, 255]),
    icon: get('--globe-icon', [255, 255, 255]),
    tones: {
      gold: get('--globe-tone-gold', [251, 191, 36]),
      cyan: get('--globe-tone-cyan', [34, 211, 238]),
      violet: get('--globe-tone-violet', [139, 92, 246]),
      magenta: get('--globe-tone-magenta', [236, 72, 153]),
    },
    font: style.getPropertyValue('--font-sans').trim() || 'sans-serif',
  };
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

/** Lưới chấm vẽ sẵn phủ cả đĩa (theo điểm ảnh thiết bị) và lớp ghép chấm với đất liền mỗi khung */
interface DotLayer {
  dots: HTMLCanvasElement;
  layer: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  /** Cạnh tính bằng điểm ảnh thiết bị */
  side: number;
}

/** Dải chuyển sắc phụ thuộc kích thước, tạo lại khi đổi cỡ */
interface Paint {
  size: number;
  atmosphere: CanvasGradient;
  sphere: CanvasGradient;
  rim: CanvasGradient;
  sheen: CanvasGradient;
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
  const iconPaths = nodes.map((n) => (n.icon ? new Path2D(n.icon) : null));

  let quality = Math.max(0, Math.min(2, Math.round(initialQuality)));
  let size = 0;
  let deviceRatio = 1;
  let pixelRatio = 1;
  let landBuffer: LandBuffer | null = null;
  let dotLayer: DotLayer | null = null;
  let paint: Paint | null = null;

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

  function applySize() {
    const dpr = Math.min(deviceRatio, MAX_DPR[quality]);
    pixelRatio = dpr;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    landBuffer = null;
    dotLayer = null;
    paint = null;
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

  /** Lưới chấm so le phủ đĩa; chấm nhỏ dần về mép để giữ cảm giác cong của mặt cầu */
  function ensureDots(R: number) {
    const side = Math.max(8, Math.ceil(R * 2 * pixelRatio));
    if (dotLayer && dotLayer.side === side) return dotLayer;
    const dots = makeCanvas(side, side);
    const layer = makeCanvas(side, side);
    const dotContext = dots.getContext('2d');
    const layerContext = layer.getContext('2d');
    if (!dotContext || !layerContext) return null;
    const radius = side / 2;
    const spacing = Math.max(2.6 * pixelRatio, side / 64);
    const rowStep = spacing * 0.866;
    dotContext.fillStyle = rgba(palette.land, 1);
    dotContext.beginPath();
    for (let row = 0, y = rowStep / 2; y < side; row++, y += rowStep) {
      const offset = row % 2 ? spacing / 2 : 0;
      for (let x = spacing / 2 + offset; x < side; x += spacing) {
        const u = (x - radius) / radius;
        const v = (y - radius) / radius;
        const w2 = 1 - u * u - v * v;
        if (w2 <= 0) continue;
        const r = spacing * 0.3 * (0.45 + 0.55 * Math.sqrt(Math.sqrt(w2)));
        dotContext.moveTo(x + r, y);
        dotContext.arc(x, y, r, 0, TAU);
      }
    }
    dotContext.fill();
    dotLayer = { dots, layer, context: layerContext, side };
    return dotLayer;
  }

  function ensurePaint(cx: number, cy: number, R: number) {
    if (paint && paint.size === size) return paint;
    const { sea, seaDeep, glow, paper } = palette;
    const atmosphere = context.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.24);
    atmosphere.addColorStop(0, rgba(glow, 0.34));
    atmosphere.addColorStop(0.45, rgba(glow, 0.12));
    atmosphere.addColorStop(1, rgba(glow, 0));
    const sphere = context.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx - R * 0.1, cy - R * 0.1, R * 1.25);
    sphere.addColorStop(0, rgba(mix(sea, paper, 0.22), 1));
    sphere.addColorStop(0.5, rgba(sea, 1));
    sphere.addColorStop(1, rgba(seaDeep, 1));
    const rim = context.createRadialGradient(cx, cy, R * 0.8, cx, cy, R);
    rim.addColorStop(0, rgba(glow, 0));
    rim.addColorStop(1, rgba(mix(glow, paper, 0.45), 0.42));
    const sheen = context.createRadialGradient(cx - R * 0.42, cy - R * 0.48, 0, cx - R * 0.42, cy - R * 0.48, R * 0.75);
    sheen.addColorStop(0, rgba(paper, 0.26));
    sheen.addColorStop(1, rgba(paper, 0));
    paint = { size, atmosphere, sphere, rim, sheen };
    return paint;
  }

  /* Đất liền: mỗi ô của một ảnh nhỏ được tra ngược về tọa độ quả cầu rồi tra mặt nạ lục địa;
     ảnh đó cắt lưới chấm vẽ sẵn nên lục địa hiện thành các chấm sáng. */
  function drawLand(cx: number, cy: number, R: number, cyw: number, syw: number, cosTilt: number, sinTilt: number, cp: number, sp: number) {
    const cell = Math.max(1.5, R / 60) * LAND_CELL[quality];
    const n = Math.max(8, Math.ceil((2 * R) / cell));
    if (!landBuffer || landBuffer.n !== n) {
      const element = makeCanvas(n, n);
      const bufferContext = element.getContext('2d');
      if (!bufferContext) return;
      landBuffer = { canvas: element, context: bufferContext, image: bufferContext.createImageData(n, n), n };
    }
    const dots = ensureDots(R);
    if (!dots) return;
    const { canvas: element, context: bufferContext, image } = landBuffer;
    const data = image.data;
    const mask = getLandMask();
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
        data[o + 3] = isLandAt(mask, x0, y0, z0) ? 255 : 0;
      }
    }
    bufferContext.putImageData(image, 0, 0);

    const { layer, context: layerContext, side } = dots;
    layerContext.globalCompositeOperation = 'copy';
    layerContext.drawImage(dots.dots, 0, 0);
    layerContext.globalCompositeOperation = 'destination-in';
    layerContext.imageSmoothingEnabled = false;
    layerContext.drawImage(element, 0, 0, side, side);
    context.globalAlpha = palette.landAlpha;
    context.drawImage(layer, cx - R, cy - R, R * 2, R * 2);
    context.globalAlpha = 1;
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
    const { ink, paper, tones } = palette;
    const soft = quality < 2;
    const look = ensurePaint(cx, cy, R);

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

    /* Vành mảnh: nửa sau mờ, nửa trước rõ kèm một dải sáng mềm bên dưới */
    const ringWidth = Math.max(1, 1.6 * s);
    const traceRing = (front: boolean) => {
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
    };
    const drawRing = (front: boolean) => {
      traceRing(front);
      if (front) {
        context.strokeStyle = rgba(palette.ring, 0.22);
        context.lineWidth = ringWidth * 4;
        context.stroke();
      }
      context.strokeStyle = rgba(palette.ring, front ? 0.95 : 0.35);
      context.lineWidth = ringWidth;
      context.stroke();
    };

    const badgeRadius = Math.max(10, 12 * s);

    const drawNode = (k: number, front: boolean) => {
      const st = nodeState[k];
      if ((st.z >= 0) !== front) return;
      const tone = tones[nodes[k].tone];
      const active = nodes[k].key === activeKey;
      if (!front && Math.hypot(st.x - cx, st.y - cy) < R) return;

      const depth = 0.85 + 0.15 * (st.z / ringR);
      const radius = badgeRadius * (active ? 1.25 : 1) * depth;
      context.globalAlpha = front ? 1 : 0.55;

      if (front) {
        /* Tia nối từ nút xuống bề mặt, chân tia là một chấm sáng màu nhóm */
        project(st.dx * R, st.dy * R, st.dz * R);
        const bx = P.x;
        const by = P.y;
        context.strokeStyle = rgba(tone, active ? 0.85 : 0.5);
        context.lineWidth = Math.max(1, (active ? 1.6 : 1.1) * s);
        context.beginPath();
        context.moveTo(st.x, st.y);
        context.lineTo(bx, by);
        context.stroke();
        context.fillStyle = rgba(tone, 0.3);
        context.beginPath();
        context.arc(bx, by, Math.max(3, 5.5 * s), 0, TAU);
        context.fill();
        context.fillStyle = rgba(tone, 1);
        context.strokeStyle = rgba(paper, 1);
        context.lineWidth = Math.max(1, 1.2 * s);
        context.beginPath();
        context.arc(bx, by, Math.max(1.6, 2.6 * s), 0, TAU);
        context.fill();
        context.stroke();
      }

      /* Quầng của nút đang chọn */
      if (active) {
        context.fillStyle = rgba(tone, 0.16);
        context.strokeStyle = rgba(tone, 0.45);
        context.lineWidth = Math.max(1, 1.2 * s);
        context.beginPath();
        context.arc(st.x, st.y, radius * 1.7, 0, TAU);
        context.fill();
        context.stroke();
      }

      /* Viên tròn màu nhóm: chuyển sắc nhẹ từ góc trên trái, bóng mềm cùng sắc, viền trắng */
      const fill = context.createRadialGradient(st.x - radius * 0.4, st.y - radius * 0.45, 0, st.x, st.y, radius * 1.1);
      fill.addColorStop(0, rgba(mix(tone, paper, 0.35), 1));
      fill.addColorStop(1, rgba(tone, 1));
      if (soft) {
        context.shadowColor = rgba(tone, 0.55);
        context.shadowBlur = 12 * s;
        context.shadowOffsetY = 3 * s;
      }
      context.fillStyle = fill;
      context.beginPath();
      context.arc(st.x, st.y, radius, 0, TAU);
      context.fill();
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;
      context.strokeStyle = rgba(paper, 1);
      context.lineWidth = Math.max(1.5, 2 * s);
      context.stroke();

      const iconPath = iconPaths[k];
      if (iconPath) {
        const scale = (radius * 1.15) / 24;
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
        context.fillStyle = rgba(paper, 1);
        context.beginPath();
        context.arc(st.x, st.y, radius * 0.35, 0, TAU);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    /* Lớp sau: nửa vành phía sau và các nút phía sau */
    drawRing(false);
    for (let k = 0; k < nodes.length; k++) drawNode(k, false);

    /* Quầng khí quyển, rồi khối cầu chuyển sắc */
    context.fillStyle = look.atmosphere;
    context.beginPath();
    context.arc(cx, cy, R * 1.24, 0, TAU);
    context.fill();
    context.fillStyle = look.sphere;
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

    /* Lưới kinh – vĩ tuyến thưa, nét mảnh rất nhạt */
    context.strokeStyle = rgba(palette.grid, palette.gridAlpha);
    context.lineWidth = Math.max(0.75, 0.9 * s);
    context.beginPath();
    for (let i = 0; i < GRATICULE.length; i++) strokeLine(GRATICULE[i]);
    context.stroke();

    drawLand(cx, cy, R, cyw, syw, cosTilt, sinTilt, cp, sp);

    /* Viền sáng mép cầu và vệt sáng mềm góc trên trái */
    context.fillStyle = look.rim;
    context.fillRect(cx - R, cy - R, R * 2, R * 2);
    context.fillStyle = look.sheen;
    context.fillRect(cx - R, cy - R, R * 2, R * 2);
    context.restore();

    /* Lớp trước: nửa vành phía trước và các nút phía trước */
    drawRing(true);
    for (let k = 0; k < nodes.length; k++) drawNode(k, true);

    /* Nhãn của nút đang chọn: viên thuốc trắng bóng mềm, chấm màu nhóm trước tên */
    const activeIndex = activeKey === null ? -1 : nodes.findIndex((n) => n.key === activeKey);
    if (activeIndex >= 0 && nodeState[activeIndex].z > -ringR * 0.25) {
      const stn = nodeState[activeIndex];
      const text = nodes[activeIndex].label;
      const tone = tones[nodes[activeIndex].tone];
      const fontSize = Math.max(12, 13 * s);
      context.font = `600 ${fontSize}px ${palette.font}`;
      const widthKey = `${fontSize}|${text}`;
      let textWidth = widthCache.get(widthKey);
      if (textWidth === undefined) {
        textWidth = context.measureText(text).width;
        widthCache.set(widthKey, textWidth);
      }
      const padX = 10 * s;
      const dot = 7 * s;
      const dotGap = 6 * s;
      const boxW = textWidth + padX * 2 + dot + dotGap;
      const boxH = fontSize + 12 * s;
      const margin = 4;
      const bx = Math.max(margin, Math.min(size - boxW - margin, stn.x - boxW / 2));
      const gap = badgeRadius * 1.9 + 4;
      const above = stn.y - gap - 4 - boxH > margin;
      const by = above ? stn.y - gap - boxH : stn.y + gap;

      const rr = boxH / 2;
      context.beginPath();
      context.moveTo(bx + rr, by);
      context.arcTo(bx + boxW, by, bx + boxW, by + boxH, rr);
      context.arcTo(bx + boxW, by + boxH, bx, by + boxH, rr);
      context.arcTo(bx, by + boxH, bx, by, rr);
      context.arcTo(bx, by, bx + boxW, by, rr);
      context.closePath();
      if (soft) {
        context.shadowColor = rgba(ink, 0.18);
        context.shadowBlur = 16 * s;
        context.shadowOffsetY = 4 * s;
      }
      context.fillStyle = rgba(paper, 0.96);
      context.fill();
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;
      context.strokeStyle = rgba(ink, 0.08);
      context.lineWidth = 1;
      context.stroke();

      context.fillStyle = rgba(tone, 1);
      context.beginPath();
      context.arc(bx + padX + dot / 2, by + boxH / 2, dot / 2, 0, TAU);
      context.fill();

      context.fillStyle = rgba(ink, 1);
      context.textBaseline = 'middle';
      context.textAlign = 'left';
      context.fillText(text, bx + padX + dot + dotGap, by + boxH / 2 + 0.5);
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
