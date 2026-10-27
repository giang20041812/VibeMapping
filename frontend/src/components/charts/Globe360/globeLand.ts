/* Đất liền thật của quả địa cầu: mặt nạ lục địa để tra cứu theo kinh – vĩ độ và các đường bờ biển để vẽ viền.
   Hệ tọa độ trùng với cảnh: y hướng lên cực Bắc, kinh độ tăng dần về phía đông khi nhìn từ ngoài vào. */

import { LAND_RINGS } from './globeLandData';

export const MASK_WIDTH = 720;
export const MASK_HEIGHT = 360;

const TAU = Math.PI * 2;
/* Cạnh dài hơn mức này (rađian, khoảng 1,2°) được chia nhỏ để bám theo mặt cầu thay vì cắt xuyên qua */
const MAX_EDGE = 0.021;
/* Các cạnh nằm đúng trên kinh tuyến ±180° hoặc vĩ tuyến −90° chỉ là đường cắt của dữ liệu, không phải bờ biển */
const CUT_EDGE_DEG = 179.95;
const CUT_POLE_DEG = -89.95;

type Ring = [number, number][];

function decodeRings(): Ring[] {
  return LAND_RINGS.split('|').map((text) => {
    let x = 0;
    let y = 0;
    return text.split(' ').map((token) => {
      const comma = token.indexOf(',');
      x += parseInt(token.slice(0, comma), 36);
      y += parseInt(token.slice(comma + 1), 36);
      return [x / 10, y / 10] as [number, number];
    });
  });
}

let rings: Ring[] | null = null;
const getRings = () => (rings ??= decodeRings());

/* ---------- Mặt nạ lục địa (kinh độ trải ngang, vĩ độ từ Bắc xuống Nam) ---------- */

let mask: Uint8Array | null = null;

function buildMask(): Uint8Array {
  const data = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
  const canvas = document.createElement('canvas');
  canvas.width = MASK_WIDTH;
  canvas.height = MASK_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return data;
  context.fillStyle = '#000';
  context.beginPath();
  for (const ring of getRings()) {
    ring.forEach(([lon, lat], i) => {
      const px = ((lon + 180) / 360) * MASK_WIDTH;
      const py = ((90 - lat) / 180) * MASK_HEIGHT;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.closePath();
  }
  context.fill('evenodd');
  const pixels = context.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
  for (let i = 0; i < data.length; i++) data[i] = pixels[i * 4 + 3] > 127 ? 1 : 0;
  return data;
}

export const getLandMask = () => (mask ??= buildMask());

/** Tra mặt nạ bằng vectơ đơn vị trong hệ quả cầu (x, y hướng lên, z) */
export function isLandAt(landMask: Uint8Array, x: number, y: number, z: number): boolean {
  const lon = Math.atan2(-z, x);
  const lat = Math.asin(y > 1 ? 1 : y < -1 ? -1 : y);
  let u = Math.floor(((lon + Math.PI) / TAU) * MASK_WIDTH);
  let v = Math.floor(((Math.PI / 2 - lat) / Math.PI) * MASK_HEIGHT);
  if (u >= MASK_WIDTH) u = MASK_WIDTH - 1;
  if (v >= MASK_HEIGHT) v = MASK_HEIGHT - 1;
  return landMask[v * MASK_WIDTH + u] === 1;
}

/* ---------- Đường bờ biển: mỗi đường là một dãy điểm đơn vị liên tiếp (x, y, z) ---------- */

let coastlines: Float32Array[] | null = null;

const isCutEdge = (a: [number, number], b: [number, number]) =>
  (Math.abs(a[0]) >= CUT_EDGE_DEG && Math.abs(b[0]) >= CUT_EDGE_DEG && Math.sign(a[0]) === Math.sign(b[0])) ||
  (a[1] <= CUT_POLE_DEG && b[1] <= CUT_POLE_DEG);

function toVector(lon: number, lat: number): [number, number, number] {
  const lonRad = (lon * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const c = Math.cos(latRad);
  return [c * Math.cos(lonRad), Math.sin(latRad), -c * Math.sin(lonRad)];
}

function buildCoastlines(): Float32Array[] {
  const lines: Float32Array[] = [];
  for (const ring of getRings()) {
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 6) lines.push(Float32Array.from(run));
      run = [];
    };
    for (let i = 0; i < ring.length; i++) {
      const [x, y, z] = toVector(ring[i][0], ring[i][1]);
      if (i > 0 && isCutEdge(ring[i - 1], ring[i])) flush();
      if (run.length >= 3) {
        const px = run[run.length - 3];
        const py = run[run.length - 2];
        const pz = run[run.length - 1];
        const angle = Math.acos(Math.max(-1, Math.min(1, px * x + py * y + pz * z)));
        const steps = Math.ceil(angle / MAX_EDGE);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const ix = px + (x - px) * t;
          const iy = py + (y - py) * t;
          const iz = pz + (z - pz) * t;
          const norm = Math.hypot(ix, iy, iz) || 1;
          run.push(ix / norm, iy / norm, iz / norm);
        }
      }
      run.push(x, y, z);
    }
    flush();
  }
  return lines;
}

export const getCoastlines = () => (coastlines ??= buildCoastlines());
