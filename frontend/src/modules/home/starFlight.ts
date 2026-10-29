/**
 * Đường bay cong và đuôi sao băng kiểu vũ trụ cho hai hình minh họa ở trang chủ.
 * Chỉ có phần tính toán và vẽ lên canvas; việc chạy theo thời gian nằm ở useStarFlight.
 * Vẽ bằng vài hình tô chuyển màu thay vì hàng trăm nét rời, để mỗi khung hình đủ nhẹ.
 */

export interface Point {
  x: number;
  y: number;
}

export interface PathSample extends Point {
  /** Hướng đi tại điểm đó (vectơ đơn vị) */
  tx: number;
  ty: number;
}

export interface FlightPath {
  length: number;
  /** Hộp bao quanh cả đường bay */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Điểm cách đầu đường bay `distance` (tính theo độ dài cung, không phải theo tham số); ghi vào `out` nếu có để khỏi cấp phát */
  at: (distance: number, out?: PathSample) => PathSample;
}

/** Đường cong Bézier bậc ba, tra sẵn độ dài cung để đi đều theo quãng đường */
export function createFlightPath(p0: Point, p1: Point, p2: Point, p3: Point, samples = 240): FlightPath {
  const xs = new Float64Array(samples + 1);
  const ys = new Float64Array(samples + 1);
  const cumulative = new Float64Array(samples + 1);
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const u = 1 - t;
    xs[i] = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
    ys[i] = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
    if (i > 0) cumulative[i] = cumulative[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    bounds.minX = Math.min(bounds.minX, xs[i]);
    bounds.maxX = Math.max(bounds.maxX, xs[i]);
    bounds.minY = Math.min(bounds.minY, ys[i]);
    bounds.maxY = Math.max(bounds.maxY, ys[i]);
  }
  const length = cumulative[samples];

  const at = (distance: number, out: PathSample = { x: 0, y: 0, tx: 1, ty: 0 }): PathSample => {
    const d = Math.min(Math.max(distance, 0), length);
    let lo = 0;
    let hi = samples;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= d) lo = mid;
      else hi = mid;
    }
    const span = cumulative[hi] - cumulative[lo] || 1;
    const f = (d - cumulative[lo]) / span;
    const dx = xs[hi] - xs[lo];
    const dy = ys[hi] - ys[lo];
    const norm = Math.hypot(dx, dy) || 1;
    out.x = xs[lo] + dx * f;
    out.y = ys[lo] + dy * f;
    out.tx = dx / norm;
    out.ty = dy / norm;
    return out;
  };

  return { length, bounds, at };
}

// ---------- Màu ----------

export type Rgb = [number, number, number];

export function parseColor(value: string): Rgb {
  const text = value.trim();
  if (text.startsWith('#')) {
    const hex = text.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  }
  const numbers = text.match(/\d+(\.\d+)?/g);
  if (numbers && numbers.length >= 3) return [Number(numbers[0]), Number(numbers[1]), Number(numbers[2])];
  return [255, 255, 255];
}

export interface FlightPalette {
  gold: Rgb;
  magenta: Rgb;
  violet: Rgb;
  cyan: Rgb;
  white: Rgb;
}

/** Lấy màu từ biến thiết kế, không đặt mã màu trong mã */
export function readFlightPalette(element: Element): FlightPalette {
  const style = getComputedStyle(element);
  const read = (name: string) => parseColor(style.getPropertyValue(name));
  return {
    gold: read('--color-accent-gold'),
    magenta: read('--accent-magenta'),
    violet: read('--accent-violet'),
    cyan: read('--accent-cyan'),
    white: read('--brand-white'),
  };
}

const mix = (a: Rgb, b: Rgb, f: number): Rgb => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

/** Màu dọc đuôi: vàng ở đầu sao, rồi hồng, tím, xanh lơ ở cuối đuôi (u: 0 ở đầu sao, 1 ở cuối đuôi) */
function colorAt(palette: FlightPalette, u: number): Rgb {
  if (u < 0.32) return mix(palette.gold, palette.magenta, u / 0.32);
  if (u < 0.66) return mix(palette.magenta, palette.violet, (u - 0.32) / 0.34);
  return mix(palette.violet, palette.cyan, (u - 0.66) / 0.34);
}

const rgba = (c: Rgb, alpha: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

// ---------- Bụi sao ----------

export interface Spark {
  /** Vị trí dọc đuôi (0 ở đầu sao, 1 ở cuối đuôi) */
  u: number;
  /** Lệch ngang so với trục đuôi, tính theo bề rộng đuôi (-1..1) */
  offset: number;
  size: number;
  phase: number;
  /** Màu cố định theo vị trí trong đuôi, tính sẵn một lần */
  color: Rgb;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSparks(count: number, seed: number, palette: FlightPalette): Spark[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const u = Math.pow(random(), 0.85);
    return {
      u,
      offset: (random() - 0.5) * 2,
      size: 0.8 + random() * 2.6,
      phase: random() * Math.PI * 2,
      color: mix(colorAt(palette, u), palette.white, 0.35),
    };
  });
}

// ---------- Vẽ đuôi ----------

/** Mức chi tiết: 2 đầy đủ, 1 bớt dải mảnh và nửa số bụi sao, 0 chỉ còn quầng sáng và thân đuôi */
export type TrailDetail = 0 | 1 | 2;

export interface TrailFrame {
  path: FlightPath;
  /** Quãng đường đầu sao đã bay được dọc đường bay */
  head: number;
  /** Chiều dài đuôi hiện tại */
  length: number;
  /** Bề rộng đuôi ngay sau đầu sao */
  width: number;
  /** Bán kính quầng sáng quanh đầu sao */
  glowRadius: number;
  /** 0..1, đuôi và quầng sáng mờ dần khi sao tới nơi */
  strength: number;
  time: number;
  palette: FlightPalette;
  sparks: Spark[];
  detail: TrailDetail;
}

const RIBBON_POINTS = 32;
const ENVELOPE_STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1];
const STRANDS = [
  { phase: 0, frequency: 5.4, amplitude: 0.95 },
  { phase: 2.1, frequency: 4.2, amplitude: 0.75 },
  { phase: 4.2, frequency: 6.6, amplitude: 1.1 },
];

/* Mảng tạm dùng lại giữa các khung hình để không cấp phát mỗi lần vẽ */
const px = new Float32Array(RIBBON_POINTS + 1);
const py = new Float32Array(RIBBON_POINTS + 1);
const nx = new Float32Array(RIBBON_POINTS + 1);
const ny = new Float32Array(RIBBON_POINTS + 1);
const half = new Float32Array(RIBBON_POINTS + 1);
const sample: PathSample = { x: 0, y: 0, tx: 1, ty: 0 };

/** Số đoạn của nửa hình tròn bo đầu đuôi */
const CAP_STEPS = 8;

/** Một dải đuôi: tô một lần bằng đường viền hai bên, rộng gấp `scale` lần bề rộng gốc, đầu bo tròn ở phía sao */
function fillRibbon(ctx: CanvasRenderingContext2D, count: number, scale: number) {
  ctx.beginPath();
  for (let i = 0; i < count; i += 1) {
    const x = px[i] + nx[i] * half[i] * scale;
    const y = py[i] + ny[i] * half[i] * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = count - 1; i >= 0; i -= 1) ctx.lineTo(px[i] - nx[i] * half[i] * scale, py[i] - ny[i] * half[i] * scale);
  // Nửa hình tròn từ mép phải sang mép trái của đầu đuôi, phình về phía trước (hướng sao bay)
  const radius = half[0] * scale;
  const forwardX = ny[0];
  const forwardY = -nx[0];
  for (let k = 1; k < CAP_STEPS; k += 1) {
    const a = Math.PI - (k * Math.PI) / CAP_STEPS;
    const across = Math.cos(a) * radius;
    const ahead = Math.sin(a) * radius;
    ctx.lineTo(px[0] + nx[0] * across + forwardX * ahead, py[0] + ny[0] * across + forwardY * ahead);
  }
  ctx.closePath();
  ctx.fill();
}

/** Chuyển màu dọc đuôi từ đầu sao tới cuối đuôi, mờ dần theo độ dài */
function trailGradient(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  palette: FlightPalette,
  strength: number,
  lighten: number,
) {
  const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  for (const u of ENVELOPE_STOPS) {
    let color = colorAt(palette, u);
    if (lighten > 0) color = mix(color, palette.white, lighten * (1 - u));
    gradient.addColorStop(u, rgba(color, strength * Math.pow(1 - u, 1.25)));
  }
  return gradient;
}

export function drawTrail(ctx: CanvasRenderingContext2D, frame: TrailFrame) {
  const { path, head, length, width, glowRadius, strength, time, palette, sparks, detail } = frame;
  if (strength <= 0) return;
  const headPoint = path.at(head);
  const headX = headPoint.x;
  const headY = headPoint.y;

  // Quầng sáng quanh đầu sao
  const glow = ctx.createRadialGradient(headX, headY, 0, headX, headY, glowRadius);
  glow.addColorStop(0, rgba(palette.gold, 0.34 * strength));
  glow.addColorStop(0.45, rgba(palette.violet, 0.16 * strength));
  glow.addColorStop(1, rgba(palette.violet, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(headX, headY, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Điểm dọc đuôi, từ đầu sao lùi về sau theo đúng đường bay nên đuôi cong theo đường bay
  let count = 0;
  for (let i = 0; i <= RIBBON_POINTS; i += 1) {
    const u = i / RIBBON_POINTS;
    const distance = head - u * length;
    if (distance < 0) break;
    path.at(distance, sample);
    px[count] = sample.x;
    py[count] = sample.y;
    nx[count] = -sample.ty;
    ny[count] = sample.tx;
    half[count] = (width * Math.pow(1 - u, 0.85)) / 2;
    count += 1;
  }
  if (count < 2) return;
  // Gradient trải đến hết chiều dài đuôi dự kiến, không chỉ đến điểm cuối hiện có (đuôi bị cụt khi mới bay)
  const reach = RIBBON_POINTS / (count - 1);
  const tip = { x: headX, y: headY };
  const far = { x: tip.x + (px[count - 1] - tip.x) * reach, y: tip.y + (py[count - 1] - tip.y) * reach };

  // Ba lớp: quầng rộng mờ, thân đuôi, lõi sáng
  const body = trailGradient(ctx, tip, far, palette, strength, 0);
  ctx.fillStyle = body;
  if (detail > 0) {
    ctx.globalAlpha = 0.2;
    fillRibbon(ctx, count, 3.4);
  }
  ctx.globalAlpha = 0.55;
  fillRibbon(ctx, count, 1.5);
  ctx.fillStyle = trailGradient(ctx, tip, far, palette, strength, 0.7);
  ctx.globalAlpha = 0.9;
  fillRibbon(ctx, count, 0.36);

  // Vài dải mảnh uốn lượn quanh trục đuôi
  if (detail > 1) {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = body;
    ctx.lineWidth = 1.4;
    for (const strand of STRANDS) {
      ctx.beginPath();
      for (let i = 0; i < count; i += 1) {
        const u = i / RIBBON_POINTS;
        const wave = Math.sin(u * strand.frequency + strand.phase + time * 0.0035) * width * strand.amplitude * (0.25 + 0.75 * u);
        const x = px[i] + nx[i] * wave;
        const y = py[i] + ny[i] * wave;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Bụi sao lấp lánh rải trong đuôi
  if (detail > 0) {
    const used = detail > 1 ? sparks.length : Math.ceil(sparks.length / 2);
    for (let s = 0; s < used; s += 1) {
      const spark = sparks[s];
      const distance = head - spark.u * length;
      if (distance < 0) continue;
      path.at(distance, sample);
      const spread = width * (0.5 + spark.u * 1.1) * spark.offset;
      const x = sample.x - sample.ty * spread;
      const y = sample.y + sample.tx * spread;
      const twinkle = 0.45 + 0.55 * Math.pow(Math.sin(time * 0.006 + spark.phase), 2);
      const alpha = strength * Math.pow(1 - spark.u, 1.05) * twinkle;
      ctx.fillStyle = rgba(spark.color, alpha);
      ctx.beginPath();
      ctx.arc(x, y, spark.size, 0, Math.PI * 2);
      ctx.fill();
      if (spark.size > 2.6 && detail > 1) {
        // Hạt lớn có thêm bốn tia nhỏ như ngôi sao
        ctx.strokeStyle = rgba(spark.color, alpha * 0.8);
        ctx.lineWidth = 1;
        const ray = spark.size * 3.2;
        ctx.beginPath();
        ctx.moveTo(x - ray, y);
        ctx.lineTo(x + ray, y);
        ctx.moveTo(x, y - ray);
        ctx.lineTo(x, y + ray);
        ctx.stroke();
      }
    }
  }
}
