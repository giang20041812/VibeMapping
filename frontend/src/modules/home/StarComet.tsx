import React, { useId } from 'react';

/* Hạt lấp lánh rải dọc đuôi (toạ độ trong khung đuôi 720 × 200, đầu sao ở mép phải) */
const SPARKS = [
  { cx: 610, cy: 66, r: 5, tone: 'gold' },
  { cx: 540, cy: 132, r: 4, tone: 'blue' },
  { cx: 470, cy: 58, r: 6, tone: 'gold' },
  { cx: 395, cy: 128, r: 4.5, tone: 'blue' },
  { cx: 320, cy: 76, r: 5, tone: 'gold' },
  { cx: 250, cy: 118, r: 3.5, tone: 'blue' },
  { cx: 180, cy: 88, r: 3, tone: 'gold' },
  { cx: 110, cy: 106, r: 2.5, tone: 'blue' },
] as const;

/**
 * Ngôi sao bay đi cùng hình minh họa: đuôi rộng mờ dần phía sau kèm hạt lấp lánh, đầu sao sáng có bốn tia.
 * Chỉ là trang trí; vị trí và chuyển động do HomePage.css điều khiển.
 */
export const StarComet: React.FC = () => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tailGradient = `${uid}-tail`;
  const coreGradient = `${uid}-core`;
  const haloGradient = `${uid}-halo`;
  const wideBlur = `${uid}-wide`;
  const softBlur = `${uid}-soft`;

  return (
    <>
      <svg className="star-tail" viewBox="0 0 720 200" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={tailGradient} gradientUnits="userSpaceOnUse" x1="720" y1="0" x2="0" y2="0">
            <stop offset="0" className="star-stop-gold" />
            <stop offset="0.3" className="star-stop-blue" />
            <stop offset="0.7" className="star-stop-mist" />
            <stop offset="1" className="star-stop-clear" />
          </linearGradient>
          <linearGradient id={coreGradient} gradientUnits="userSpaceOnUse" x1="720" y1="0" x2="0" y2="0">
            <stop offset="0" className="star-stop-hot" />
            <stop offset="0.5" className="star-stop-gold" />
            <stop offset="1" className="star-stop-clear" />
          </linearGradient>
          <filter id={wideBlur} x="-5%" y="-60%" width="110%" height="220%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id={softBlur} x="-5%" y="-60%" width="110%" height="220%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <path d="M720 40 C520 52 240 84 0 100 C240 116 520 148 720 160Z" fill={`url(#${tailGradient})`} filter={`url(#${wideBlur})`} />
        <path d="M720 66 C520 74 240 94 0 100 C240 106 520 126 720 134Z" fill={`url(#${tailGradient})`} filter={`url(#${softBlur})`} />
        <path d="M720 90 C480 94 240 98 0 100 C240 102 480 106 720 110Z" fill={`url(#${coreGradient})`} />
        {SPARKS.map((spark) => (
          <circle key={spark.cx} cx={spark.cx} cy={spark.cy} r={spark.r} className={`star-spark-${spark.tone}`} />
        ))}
      </svg>

      <svg className="star-head" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={haloGradient}>
            <stop offset="0" className="star-stop-hot" />
            <stop offset="0.3" className="star-stop-gold" />
            <stop offset="0.55" className="star-stop-halo" />
            <stop offset="1" className="star-stop-clear" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill={`url(#${haloGradient})`} />
        <path className="star-ray-small" d="M100 4 L108 92 L196 100 L108 108 L100 196 L92 108 L4 100 L92 92Z" transform="translate(100 100) rotate(45) scale(0.7) translate(-100 -100)" />
        <path className="star-ray" d="M100 4 L108 92 L196 100 L108 108 L100 196 L92 108 L4 100 L92 92Z" />
        <circle className="star-core" cx="100" cy="100" r="13" />
      </svg>
    </>
  );
};
