import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Check, ClipboardCheck, Compass, MapPin, Route, Scale, Users, type LucideIcon } from 'lucide-react';
import { Button } from '../../../components/common';
import { Rater360, type RaterNode } from '../../../components/charts/Rater360/Rater360';
import { PARTS } from '../../assessment_session/assessmentSession.constants';
import { PILLAR_LABEL } from '../../roadmap/roadmap.logic';
import { useInView } from '../../../hooks/useInView';
import './HomeJourney.css';

interface HomeJourneyProps {
  id: string;
  canExplore: boolean;
  testPath: string;
  questionRange: string;
  minuteRange: string;
  raters: RaterNode[];
  ratersPerGroup: number;
  /** Số nghề trong danh mục; null khi chưa tải được */
  careers: number | null;
}

interface Step {
  key: string;
  title: string;
  detail: string;
  facts: string[];
  icon: LucideIcon;
  scene: React.ReactNode;
}

/* ---------- Cảnh minh họa của từng bước (số liệu nghề là ví dụ) ---------- */

/** Bốn phần của bài tự đánh giá lần lượt hoàn thành, phần cuối đang làm */
const PartsScene: React.FC = () => (
  <ul className="scene-card scene-parts">
    {PARTS.map((part, i) => {
      const doing = i === PARTS.length - 1;
      return (
        <li key={part.number} className={`scene-part ${doing ? 'is-doing' : ''}`} style={{ '--i': i } as React.CSSProperties}>
          <span className="scene-part-mark" aria-hidden="true">
            {doing ? <span className="scene-part-pulse" /> : <Check size={14} strokeWidth={3} />}
          </span>
          <span className="scene-part-name">{part.name}</span>
          <span className="scene-track">
            <span className="scene-fill" />
          </span>
        </li>
      );
    })}
  </ul>
);

const SAMPLE_FIT = [
  { name: 'Bác sĩ đa khoa', fit: 92 },
  { name: 'Bác sĩ dinh dưỡng', fit: 86 },
  { name: 'Account Executive', fit: 78 },
];

/** Danh sách nghề xếp theo độ phù hợp, nghề phù hợp nhất tô cam */
const FitScene: React.FC = () => (
  <div className="scene-card scene-fit">
    <span className="scene-tag">Ví dụ</span>
    <ul className="scene-fit-list">
      {SAMPLE_FIT.map((row, i) => (
        <li key={row.name} className={`scene-fit-row ${i === 0 ? 'is-top' : ''}`} style={{ '--i': i, '--value': `${row.fit}%` } as React.CSSProperties}>
          <span className="scene-fit-icon" aria-hidden="true">
            <Briefcase size={18} />
          </span>
          <span className="scene-fit-body">
            <span className="scene-fit-name">{row.name}</span>
            <span className="scene-track">
              <span className="scene-fill" />
            </span>
          </span>
          <b className="scene-fit-value">{row.fit}%</b>
        </li>
      ))}
    </ul>
  </div>
);

/* Tiêu chí so sánh như ở trang So sánh phương án; mức 1–3 là Thấp, Vừa, Cao */
const COMPARE_CRITERIA = ['Phù hợp nghề', 'Đáp ứng đầu vào', 'Tài chính', 'Địa điểm'];
const SAMPLE_OPTIONS = [
  { name: 'Bác sĩ đa khoa', levels: [3, 2, 1, 3] },
  { name: 'Bác sĩ dinh dưỡng', levels: [2, 3, 3, 2] },
];

/** Hai phương án đặt cạnh nhau theo từng tiêu chí; mức cao hơn ở mỗi tiêu chí tô cam */
const CompareScene: React.FC = () => (
  <div className="scene-compare">
    {SAMPLE_OPTIONS.map((option, col) => (
      <div key={option.name} className="scene-card scene-option" style={{ '--i': col } as React.CSSProperties}>
        <span className="scene-option-name">{option.name}</span>
        <ul className="scene-criteria">
          {COMPARE_CRITERIA.map((label, row) => {
            const level = option.levels[row];
            const best = level > SAMPLE_OPTIONS[1 - col].levels[row];
            return (
              <li key={label} className={`scene-criterion ${best ? 'is-best' : ''}`} style={{ '--r': row } as React.CSSProperties}>
                <span className="scene-criterion-name">{label}</span>
                <span className="scene-meter" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={n <= level ? 'is-on' : ''} />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </div>
);

const SAMPLE_PLAN: { year: string; pillars: (keyof typeof PILLAR_LABEL)[] }[] = [
  { year: 'Lớp 10', pillars: ['knowledge', 'exploration'] },
  { year: 'Lớp 11', pillars: ['knowledge', 'experience'] },
  { year: 'Lớp 12', pillars: ['experience', 'exploration'] },
];

/** Lộ trình từng năm học nối bằng đường chấm như logo, kết thúc ở nghề mục tiêu */
const RoadmapScene: React.FC = () => (
  <ol className="scene-roadmap">
    {SAMPLE_PLAN.map((stage, i) => (
      <li key={stage.year} className="scene-card scene-stage" style={{ '--i': i } as React.CSSProperties}>
        <span className="scene-stage-year">{stage.year}</span>
        <span className="scene-stage-pillars">
          {stage.pillars.map((p) => (
            <span key={p} className="scene-pillar">
              {PILLAR_LABEL[p]}
            </span>
          ))}
        </span>
      </li>
    ))}
    <li className="scene-goal" style={{ '--i': SAMPLE_PLAN.length } as React.CSSProperties}>
      <span className="scene-goal-pin" aria-hidden="true">
        <MapPin size={20} />
      </span>
      Nghề mục tiêu
    </li>
  </ol>
);

/* ---------- Theo dõi cuộn: vạch tiến độ và bước đang tới ---------- */

/** Vị trí đường mốc trong khung nhìn: bước có chấm vượt qua đường này được tính là đã tới */
const LINE_DESKTOP = 0.55;
const LINE_MOBILE = 0.72;

function useJourneyProgress(listRef: React.RefObject<HTMLOListElement | null>) {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const mobile = window.matchMedia('(max-width: 900px)');
    let frame = 0;
    let near = false;

    const update = () => {
      frame = 0;
      const line = window.innerHeight * (mobile.matches ? LINE_MOBILE : LINE_DESKTOP);
      const items = Array.from(list.querySelectorAll<HTMLElement>('[data-step]'));
      const centers = items.map((item) => {
        const dot = item.querySelector<HTMLElement>('.journey-dot');
        const rect = (dot ?? item).getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
      let next = -1;
      items.forEach((item, i) => {
        if (centers[i] <= line) next = i;
        const length = i < items.length - 1 ? centers[i + 1] - centers[i] : 0;
        item.style.setProperty('--seg-fill', `${Math.max(0, Math.min(length, line - centers[i]))}px`);
      });
      setActive(next);
    };
    const schedule = () => {
      if (near && !frame) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        if (!frame) frame = requestAnimationFrame(update);
      },
      { rootMargin: '20% 0px 20% 0px' },
    );
    observer.observe(list);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [listRef]);

  return active;
}

/**
 * Hành trình hướng nghiệp theo đúng thứ tự dùng sản phẩm. Bên trái là dòng thời gian: vạch cam chạy theo cuộn,
 * bước đã tới sáng lên, bước sắp tới mờ đi. Bên phải là khung hình dính, đổi cảnh theo bước đang tới.
 */
export const HomeJourney: React.FC<HomeJourneyProps> = ({ id, canExplore, testPath, questionRange, minuteRange, raters, ratersPerGroup, careers }) => {
  const listRef = useRef<HTMLOListElement>(null);
  const active = useJourneyProgress(listRef);
  const { ref: stageRef, seen } = useInView<HTMLDivElement>(0.3);
  const STEP_COUNT = 5;
  const shown = Math.min(Math.max(active, 0), STEP_COUNT - 1);
  /* Mỗi lần một cảnh được chọn lại thì dựng lại để chuyển động mở đầu chạy lại; cảnh vừa rời giữ nguyên để mờ dần */
  const [runs, setRuns] = useState<number[]>([0, 0, 0, 0, 0]);
  useEffect(() => {
    setRuns((r) => r.map((v, i) => (i === shown ? v + 1 : v)));
  }, [shown]);

  const steps: Step[] = [
    {
      key: 'self',
      title: 'Tự đánh giá',
      detail: 'Trả lời bộ câu hỏi về tính cách, giá trị, sở thích và năng lực của bạn.',
      facts: [`${questionRange} câu hỏi`, `${minuteRange.replace('′', '')} phút`],
      icon: ClipboardCheck,
      scene: <PartsScene />,
    },
    {
      key: '360',
      title: 'Đánh giá 360',
      detail: 'Mời phụ huynh, bạn bè, giáo viên và người hướng dẫn cùng đánh giá bạn.',
      facts: [`${raters.length} nhóm người đánh giá`, `Tối đa ${ratersPerGroup} người mỗi nhóm`],
      icon: Users,
      scene: <Rater360 nodes={raters} />,
    },
    {
      key: 'fit',
      title: 'Nghề phù hợp',
      detail: 'Xem mức độ phù hợp của bạn với từng nghề trong danh mục.',
      facts: careers !== null ? [`${careers.toLocaleString('vi-VN')} nghề nghiệp`] : [],
      icon: Compass,
      scene: <FitScene />,
    },
    {
      key: 'compare',
      title: 'So sánh phương án',
      detail: 'Đặt các lựa chọn cạnh nhau theo từng tiêu chí để quyết định.',
      facts: [`${COMPARE_CRITERIA.length} tiêu chí`],
      icon: Scale,
      scene: <CompareScene />,
    },
    {
      key: 'roadmap',
      title: 'Lộ trình',
      detail: 'Lên kế hoạch từng năm học để đi tới nghề mục tiêu.',
      facts: [],
      icon: Route,
      scene: <RoadmapScene />,
    },
  ];

  return (
    <section id={id} className="journey" aria-labelledby={`${id}-title`}>
      <div className="journey-head">
        <span className="journey-eyebrow">Hành trình</span>
        <h2 id={`${id}-title`} className="journey-title">
          Từ hiểu mình đến chọn nghề
        </h2>
      </div>

      <div className="journey-body">
        <ol ref={listRef} className="journey-list">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const state = i < active ? 'is-done' : i === active ? 'is-current' : '';
            return (
              <li key={step.key} data-step className={`journey-step ${state}`}>
                <span className="journey-meta">Bước {i + 1}</span>
                <span className="journey-rail" aria-hidden="true">
                  <span className="journey-dot" />
                  <span className="journey-segment" />
                </span>
                <div className="journey-content">
                  <h3 className="journey-step-title">
                    <Icon size={22} aria-hidden="true" />
                    {step.title}
                  </h3>
                  <p className="journey-detail">{step.detail}</p>
                  {step.facts.length > 0 && (
                    <ul className="journey-facts">
                      {step.facts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
          <li data-step className={`journey-step journey-end ${active >= steps.length ? 'is-current' : ''}`}>
            <span className="journey-meta" />
            <span className="journey-rail" aria-hidden="true">
              <span className="journey-dot" />
            </span>
            <div className="journey-content">
              {canExplore && (
                <Link to={testPath} className="journey-cta">
                  <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                    Làm bài test
                  </Button>
                </Link>
              )}
            </div>
          </li>
        </ol>

        <div className="journey-aside">
          <div ref={stageRef} className="journey-stage" aria-hidden="true">
            <span className="journey-stage-glow" />
            {seen &&
              steps.map((step, i) => (
                <div key={`${step.key}-${runs[i]}`} className={`journey-scene journey-scene-${step.key} ${i === shown ? 'is-active' : ''}`}>
                  {step.scene}
                </div>
              ))}
            <ol className="journey-dots">
              {steps.map((step, i) => (
                <li key={step.key} className={i === shown ? 'is-active' : i < shown ? 'is-done' : ''} />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};
