/**
 * Đường bay cong và đuôi sao băng kiểu vũ trụ cho hai hình minh họa ở trang chủ.
 * Chỉ có phần tính toán và vẽ lên canvas; việc chạy theo thời gian nằm ở useStarFlight.
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
  /** Điểm cách đầu đường bay `distance` (tính theo độ dài cung, không phải theo tham số) */
  at: (distance: number) => PathSample;
}

/** Đường cong Bézier bậc ba, tra sẵn độ dài cung để đi đều theo quãng đường */
export function createFlightPath(p0: Point, p1: Point, p2: Point, p3: Point, samples = 240): FlightPath {
  const xs = new Float64Array(samples + 1);
  const ys = new Float64Array(samples + 1);
  const cumulative = new Float64Array(samples + 1);
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const u = 1 - t;
    xs[i] = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
    ys[i] = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
    if (i > 0) cumulative[i] = cumulative[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  const length = cumulative[samples];

  const at = (distance: number): PathSample => {
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
    return { x: xs[lo] + dx * f, y: ys[lo] + dy * f, tx: dx / norm, ty: dy / norm };
  };

  return { length, at };
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

export function createSparks(count: number, seed: number): Spark[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    u: Math.pow(random(), 0.85),
    offset: (random() - 0.5) * 2,
    size: 0.8 + random() * 2.6,
    phase: random() * Math.PI * 2,
  }));
}

// ---------- Vẽ đuôi ----------

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
}

const SEGMENTS = 72;
const STRANDS = [
  { phase: 0, frequency: 5.4, amplitude: 0.95 },
  { phase: 2.1, frequency: 4.2, amplitude: 0.75 },
  { phase: 4.2, frequency: 6.6, amplitude: 1.1 },
];

export function drawTrail(ctx: CanvasRenderingContext2D, frame: TrailFrame) {
  const { path, head, length, width, glowRadius, strength, time, palette, sparks } = frame;
  if (strength <= 0) return;
  const headPoint = path.at(head);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Quầng sáng quanh đầu sao
  const glow = ctx.createRadialGradient(headPoint.x, headPoint.y, 0, headPoint.x, headPoint.y, glowRadius);
  glow.addColorStop(0, rgba(palette.gold, 0.34 * strength));
  glow.addColorStop(0.45, rgba(palette.violet, 0.16 * strength));
  glow.addColorStop(1, rgba(palette.violet, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(headPoint.x, headPoint.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Các đoạn đuôi, từ đầu sao lùi về sau theo đúng đường bay nên đuôi cong theo đường bay
  const points: Array<PathSample & { u: number; w: number }> = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const u = i / SEGMENTS;
    const distance = head - u * length;
    if (distance < 0) break;
    points.push({ ...path.at(distance), u, w: width * Math.pow(1 - u, 0.85) });
  }

  const strokeSegments = (widthScale: number, alphaScale: number, lighten = 0) => {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const u = (a.u + b.u) / 2;
      let color = colorAt(palette, u);
      if (lighten > 0) color = mix(color, palette.white, lighten * (1 - u));
      ctx.strokeStyle = rgba(color, alphaScale * strength * Math.pow(1 - u, 1.25));
      ctx.lineWidth = Math.max(0.5, ((a.w + b.w) / 2) * widthScale);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  };
  strokeSegments(3.4, 0.1);
  strokeSegments(1.5, 0.3);
  strokeSegments(0.36, 0.75, 0.7);

  // Vài dải mảnh uốn lượn quanh trục đuôi
  for (const strand of STRANDS) {
    ctx.lineWidth = 1.4;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const wave = (p: typeof a) =>
        Math.sin(p.u * strand.frequency + strand.phase + time * 0.0035) * width * strand.amplitude * (0.25 + 0.75 * p.u);
      const u = (a.u + b.u) / 2;
      ctx.strokeStyle = rgba(colorAt(palette, u), 0.55 * strength * Math.pow(1 - u, 1.1));
      ctx.beginPath();
      ctx.moveTo(a.x - a.ty * wave(a), a.y + a.tx * wave(a));
      ctx.lineTo(b.x - b.ty * wave(b), b.y + b.tx * wave(b));
      ctx.stroke();
    }
  }

  // Bụi sao lấp lánh rải trong đuôi
  for (const spark of sparks) {
    const distance = head - spark.u * length;
    if (distance < 0) continue;
    const p = path.at(distance);
    const spread = width * (0.5 + spark.u * 1.1) * spark.offset;
    const x = p.x - p.ty * spread;
    const y = p.y + p.tx * spread;
    const twinkle = 0.45 + 0.55 * Math.pow(Math.sin(time * 0.006 + spark.phase), 2);
    const alpha = strength * Math.pow(1 - spark.u, 1.05) * twinkle;
    const color = mix(colorAt(palette, spark.u), palette.white, 0.35);
    ctx.fillStyle = rgba(color, alpha);
    ctx.beginPath();
    ctx.arc(x, y, spark.size, 0, Math.PI * 2);
    ctx.fill();
    if (spark.size > 2.6) {
      // Hạt lớn có thêm bốn tia nhỏ như ngôi sao
      ctx.strokeStyle = rgba(color, alpha * 0.8);
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
