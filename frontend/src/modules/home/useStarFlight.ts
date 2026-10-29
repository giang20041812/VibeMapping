import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createFlightPath, createSparks, drawTrail, readFlightPalette } from './starFlight';
import type { Point } from './starFlight';

interface FlightElements {
  section: HTMLElement;
  copy: HTMLElement;
  visual: HTMLElement;
  canvas: HTMLCanvasElement;
  flip: boolean;
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** --duration-fly ở dạng mili giây; 0 khi người dùng bật giảm chuyển động */
function readDuration(element: Element): number {
  const raw = getComputedStyle(element).getPropertyValue('--duration-fly').trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : value;
}

/** Vệt hiện chữ chạy tiếp với tốc độ này (px/ms) sau khi sao đã tới nơi, cho tới khi hiện hết chữ */
const FINISH_SWEEP_SPEED = 0.9;

/**
 * Hình minh họa bay vào như một ngôi sao theo đường cong, kéo theo đuôi vũ trụ vẽ trên canvas.
 * Sao bay ngang phía trên chữ; sao đi qua rồi chữ mới hiện ra dần, theo chiều sao bay.
 * Trả về hàm hủy; hủy giữa chừng thì trả mọi thứ về trạng thái ban đầu.
 */
function runStarFlight({ section, copy, visual, canvas, flip }: FlightElements, onDone: () => void): () => void {
  const duration = readDuration(section);
  let finished = false;
  const finish = () => {
    finished = true;
    visual.style.opacity = '1';
    visual.style.transform = '';
    visual.style.willChange = '';
    canvas.style.display = 'none';
    onDone();
  };
  if (duration <= 0) {
    finish();
    return () => {};
  }

  const unit = parseFloat(getComputedStyle(document.documentElement).fontSize) / 14 || 1;
  const sectionBox = section.getBoundingClientRect();
  const local = (rect: DOMRect) => ({
    left: rect.left - sectionBox.left,
    top: rect.top - sectionBox.top,
    width: rect.width,
    height: rect.height,
  });
  // Đo khi hình còn đứng ở chỗ cuối cùng của nó
  visual.style.transform = '';
  const copyBox = local(copy.getBoundingClientRect());
  const visualBox = local(visual.getBoundingClientRect());
  const target: Point = { x: visualBox.left + visualBox.width / 2, y: visualBox.top + visualBox.height / 2 };
  const sectionHeight = sectionBox.height;
  const viewportWidth = document.documentElement.clientWidth;

  /* Chữ và hình nằm cạnh nhau (hai cột) hay chồng lên nhau (một cột, điện thoại) */
  const sideBySide = visualBox.top < copyBox.top + copyBox.height && copyBox.top < visualBox.top + visualBox.height;
  /* Sao lao từ ngoài mép màn hình xuống qua giữa phần chữ, lượn xuống thấp nhất rồi vòng lên chỗ hình:
     đường cong võng xuống nên đuôi quét ngang qua chữ */
  const start: Point = {
    x: flip ? viewportWidth - sectionBox.left + 180 * unit : -sectionBox.left - 180 * unit,
    y: sideBySide ? target.y - 0.34 * sectionHeight : copyBox.top - 0.12 * copyBox.height,
  };
  const span = target.x - start.x;
  const path = sideBySide
    ? createFlightPath(
        start,
        { x: start.x + 0.34 * span, y: target.y + 0.2 * sectionHeight },
        { x: target.x - 0.26 * span, y: target.y + 0.15 * sectionHeight },
        target,
      )
    : createFlightPath(
        start,
        { x: start.x + 0.34 * span, y: copyBox.top + 0.9 * copyBox.height },
        { x: target.x - 0.3 * span, y: target.y - 0.35 * visualBox.height },
        target,
      );

  // Vệt hiện chữ nghiêng theo hướng sao bay (mép vệt vuông góc với hướng bay)
  const dirLength = Math.hypot(span, 0.5 * (target.y - start.y)) || 1;
  const dir: Point = { x: span / dirLength, y: (0.5 * (target.y - start.y)) / dirLength };
  const angle = (Math.atan2(dir.x, -dir.y) * 180) / Math.PI;
  const copyCenter: Point = { x: copyBox.left + copyBox.width / 2, y: copyBox.top + copyBox.height / 2 };
  const gradientLength = Math.abs(copyBox.width * dir.x) + Math.abs(copyBox.height * dir.y);
  const project = (q: Point) => (q.x - copyCenter.x) * dir.x + (q.y - copyCenter.y) * dir.y + gradientLength / 2;
  const lag = 150 * unit;
  const soft = Math.min(220 * unit, gradientLength * 0.45);
  copy.style.setProperty('--wipe-angle', `${angle}deg`);

  // Canvas phủ bề ngang màn hình để đuôi chạy từ mép màn hình vào, chừa chỗ hai phía cho đường cong
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const padTop = 0.6 * sectionHeight;
  const canvasHeight = sectionHeight * 2.2;
  canvas.style.display = 'block';
  canvas.style.left = `${-sectionBox.left}px`;
  canvas.style.top = `${-padTop}px`;
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    finish();
    return () => {};
  }

  const palette = readFlightPalette(section);
  const sparks = createSparks(56, 7);
  const stageWidth = Math.min(visualBox.width, 520 * unit);
  const baseLength = Math.min(path.length * 0.62, 900 * unit);

  visual.style.willChange = 'transform, opacity';
  let frameId = 0;
  let startTime = 0;
  let lastTime = 0;
  let maxFront = -Infinity;
  let cancelled = false;

  const frame = (now: number) => {
    if (cancelled) return;
    if (!startTime) {
      startTime = now;
      lastTime = now;
    }
    const p = Math.min((now - startTime) / duration, 1);
    const travel = 1 - Math.pow(1 - p, 2.3);
    const headDistance = path.length * travel;
    const head = path.at(headDistance);

    // Hình chính là ngôi sao: nhỏ khi bay, lớn dần và hết xoay khi tới nơi
    const scale = 0.3 + 0.7 * smoothstep(0.25, 1, p);
    const rotation = -200 * Math.pow(1 - p, 1.8);
    visual.style.opacity = String(Math.min(1, p / 0.05));
    visual.style.transform = `translate(${head.x - target.x}px, ${head.y - target.y}px) rotate(${rotation}deg) scale(${scale})`;

    // Đuôi cong theo đường bay, thu ngắn và mờ đi khi sao tới nơi
    const headSize = stageWidth * scale;
    const strength = 1 - smoothstep(0.72, 1, p);
    ctx.setTransform(dpr, 0, 0, dpr, sectionBox.left * dpr, padTop * dpr);
    ctx.clearRect(-sectionBox.left, -padTop, viewportWidth, canvasHeight);
    drawTrail(ctx, {
      path,
      head: headDistance,
      length: baseLength * strength,
      width: Math.min(Math.max(headSize * 0.26, 12 * unit), 80 * unit, viewportWidth * 0.14),
      glowRadius: headSize * 0.85,
      strength: Math.pow(strength, 0.7),
      time: now,
      palette,
      sparks,
    });

    // Sao đi qua rồi chữ mới hiện: mép vệt đi sau đầu sao một đoạn và không bao giờ lùi lại
    maxFront = Math.max(maxFront, project(head) - lag);
    if (p >= 1) maxFront += FINISH_SWEEP_SPEED * (now - lastTime);
    lastTime = now;
    copy.style.setProperty('--wipe-front', `${maxFront}px`);
    copy.style.setProperty('--wipe-solid', `${maxFront - soft}px`);

    if (p >= 1 && maxFront - soft >= gradientLength) {
      finish();
      return;
    }
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frameId);
    // Đã bay xong thì giữ nguyên trạng thái cuối
    if (finished) return;
    visual.style.opacity = '';
    visual.style.transform = '';
    visual.style.willChange = '';
    canvas.style.display = 'none';
    copy.style.removeProperty('--wipe-angle');
    copy.style.removeProperty('--wipe-front');
    copy.style.removeProperty('--wipe-solid');
  };
}

/** Chờ hình tải xong tối đa chừng này rồi vẫn bay, để hàng không trống mãi khi máy chủ chậm */
const READY_TIMEOUT_MS = 3000;

/**
 * Chạy chuyến bay một lần khi hàng giới thiệu đã hiện ra và hình đã sẵn sàng (không còn khung chờ tải).
 * Trả về `started` khi chuyến bay bắt đầu.
 */
export function useStarFlight(sectionRef: RefObject<HTMLElement | null>, seen: boolean, ready: boolean, flip: boolean) {
  const copyRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landed, setLanded] = useState(false);
  const [waitedEnough, setWaitedEnough] = useState(false);

  useEffect(() => {
    if (!seen || ready) return;
    const timer = window.setTimeout(() => setWaitedEnough(true), READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [seen, ready]);

  const started = seen && (ready || waitedEnough);

  useEffect(() => {
    if (!started || landed) return;
    const section = sectionRef.current;
    const copy = copyRef.current;
    const visual = visualRef.current;
    const canvas = canvasRef.current;
    if (!section || !copy || !visual || !canvas) return;
    return runStarFlight({ section, copy, visual, canvas, flip }, () => setLanded(true));
  }, [started, landed, flip, sectionRef]);

  return { copyRef, visualRef, canvasRef, started, landed };
}
