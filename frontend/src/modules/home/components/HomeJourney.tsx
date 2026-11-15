import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Check,
  ClipboardCheck,
  Compass,
  MapPin,
  Route,
  Scale,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../../../components/common';
import { PolygonChart, type PolygonAxis, type PolygonLevel } from '../../../components/charts/PolygonChart/PolygonChart';
import { PolygonChartSkeleton } from '../../../components/charts/PolygonChart/PolygonChartSkeleton';
import { Rater360, type RaterNode } from '../../../components/charts/Rater360/Rater360';
import { PARTS } from '../../assessment_session/assessmentSession.constants';
import './HomeJourney.css';

export interface HomeJourneyProps {
  id: string;
  canExplore: boolean;
  testPath: string;
  questionRange: string;
  minuteRange: string;
  raters: RaterNode[];
  ratersPerGroup: number;
  careers: number | null;
  axes: PolygonAxis[];
  levels: PolygonLevel[];
  isOwnResult: boolean;
  isChartLoading: boolean;
}

interface Step {
  key: string;
  stepId: string;
  title: string;
  facts: string[];
  icon: LucideIcon;
  scene: React.ReactNode;
}

/* ==========================================================================
   BƯỚC 1: TỰ ĐÁNH GIÁ
   ========================================================================== */

const SELF_CORE_VALUES = ['Tư duy logic', 'Sáng tạo công nghệ', 'Học hỏi liên tục'];

const SelfAssessmentArtifact: React.FC<{
  axes: PolygonAxis[];
  levels: PolygonLevel[];
  isOwnResult: boolean;
  isLoading: boolean;
}> = ({ axes, levels, isOwnResult, isLoading }) => {
  const topGroups = [...axes]
    .filter((a): a is PolygonAxis & { value: number } => a.value !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  return (
    <div className="artifact-window artifact-self">
      <div className="artifact-topbar">
        <ol className="artifact-part-stepper" aria-label="Bốn phần tự đánh giá">
          {PARTS.map((part) => (
            <li key={part.number} className="artifact-part-item">
              <Check size={12} strokeWidth={2.8} aria-hidden="true" />
              <span>{part.short}</span>
            </li>
          ))}
        </ol>
        <span className="artifact-tag">{isOwnResult ? 'Kết quả của bạn' : 'Mẫu 50 câu'}</span>
      </div>

      <div className="artifact-self-grid">
        <div className="artifact-self-radar">
          {isLoading ? (
            <PolygonChartSkeleton />
          ) : (
            <PolygonChart axes={axes} levels={levels} showReadout={false} showNodeValues autoCycleMs={0} />
          )}
        </div>

        <div className="artifact-self-side">
          <div className="artifact-panel-block">
            <div className="artifact-panel-head">
              <span className="artifact-panel-title">Nhóm tố chất nổi bật</span>
              <span className="artifact-tag is-sky">Holland: I-R-C</span>
            </div>
            <ul className="artifact-score-list">
              {topGroups.map((group, idx) => (
                <li
                  key={group.key}
                  className="artifact-score-row"
                  style={{ '--w': `${Math.round(group.value)}%` } as React.CSSProperties}
                >
                  <div className="artifact-score-meta">
                    <span className="artifact-score-name">{group.label}</span>
                    <strong className="artifact-score-val">{Math.round(group.value)}%</strong>
                  </div>
                  <span className="scene-track">
                    <span className={`scene-fill ${idx === 0 ? 'is-coral' : ''}`} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="artifact-panel-block">
            <span className="artifact-panel-title">Giá trị cốt lõi</span>
            <div className="artifact-chip-row">
              {SELF_CORE_VALUES.map((val) => (
                <span key={val} className="artifact-value-chip">
                  {val}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   BƯỚC 2: ĐÁNH GIÁ 360°
   ========================================================================== */

const RATER_SAMPLE_META: Record<string, string> = {
  parent: '2/2 bài · 86%',
  friend: '2/2 bài · 88%',
  teacher: '2/2 bài · 94%',
  mentor: '2/2 bài · 91%',
};

const CALIBRATION_ROWS = [
  { label: 'Tư duy & Năng lực học tập', self: '86%', combined: '92%', delta: '+6%' },
  { label: 'Giao tiếp & Phối hợp nhóm', self: '70%', combined: '82%', delta: '+12%' },
  { label: 'Thái độ & Tinh thần làm việc', self: '84%', combined: '89%', delta: '+5%' },
];

const Rater360Artifact: React.FC<{ raters: RaterNode[] }> = ({ raters }) => {
  const enrichedNodes: RaterNode[] = raters.map((node) => ({
    ...node,
    meta: RATER_SAMPLE_META[node.key] ?? '2/2 đã nộp',
  }));

  return (
    <div className="artifact-window artifact-360">
      <div className="artifact-topbar">
        <div className="artifact-status-line">
          <span className="artifact-status-dot" aria-hidden="true" />
          <span>Cho phép người khác đánh giá · Đang bật</span>
        </div>
        <span className="artifact-tag is-sky">Đã duyệt 8/8 bài</span>
      </div>

      <div className="artifact-360-stage">
        <Rater360 nodes={enrichedNodes} centerLabel="Bạn" centerSub="Tổng hợp 360°" />
      </div>

      <div className="artifact-360-compare">
        <div className="artifact-360-compare-head">
          <span>Nhóm tiêu chí đối chiếu</span>
          <span>Tự đánh giá</span>
          <span>Sau 360°</span>
        </div>
        <ul className="artifact-360-compare-list">
          {CALIBRATION_ROWS.map((row) => (
            <li key={row.label} className="artifact-360-compare-row">
              <span className="artifact-360-crit">{row.label}</span>
              <span className="artifact-360-self">{row.self}</span>
              <span className="artifact-360-combined">
                <strong>{row.combined}</strong>
                <em className="artifact-360-delta">{row.delta}</em>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/* ==========================================================================
   BƯỚC 3: NGHỀ PHÙ HỢP
   ========================================================================== */

const TOP_CAREER_BARS = [
  { label: 'Năng lực chuyên môn', value: 95 },
  { label: 'Sở thích nghề nghiệp (Holland I-R-C)', value: 93 },
  { label: 'Giá trị & Động lực phát triển', value: 92 },
];

const NEXT_CAREERS = [
  {
    rank: 2,
    name: 'Kỹ sư dữ liệu & Trí tuệ nhân tạo (Data / AI Engineer)',
    holland: 'I-R-C · Nghiên cứu – Kỹ thuật',
    fit: 89,
  },
  {
    rank: 3,
    name: 'Kỹ sư hệ thống & Điện toán đám mây (Cloud / DevOps)',
    holland: 'R-I-C · Kỹ thuật – Nghiên cứu',
    fit: 84,
  },
];

const CareerFitArtifact: React.FC = () => (
  <div className="artifact-window artifact-fit">
    <div className="artifact-topbar">
      <span className="artifact-status-line">Hồ sơ 360° · Độ đầy đủ dữ liệu 96%</span>
      <span className="artifact-tag is-coral">Hạng 1 phù hợp nhất</span>
    </div>

    <div className="artifact-fit-hero">
      <div className="artifact-fit-score-box">
        <span className="artifact-fit-rank-label">Hạng 1 · Mục tiêu</span>
        <strong className="artifact-fit-big-score">94%</strong>
        <span className="artifact-fit-score-sub">Độ tương thích</span>
      </div>

      <div className="artifact-fit-main">
        <div className="artifact-fit-head">
          <h4 className="artifact-fit-title">Kỹ sư phần mềm (Software Engineer)</h4>
          <span className="artifact-fit-sub">Công nghệ thông tin · Holland: I-R-C</span>
        </div>

        <ul className="artifact-fit-bars">
          {TOP_CAREER_BARS.map((bar) => (
            <li
              key={bar.label}
              className="artifact-fit-bar-item"
              style={{ '--w': `${bar.value}%` } as React.CSSProperties}
            >
              <div className="artifact-fit-bar-head">
                <span>{bar.label}</span>
                <strong>{bar.value}%</strong>
              </div>
              <span className="scene-track">
                <span className="scene-fill is-coral" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>

    <ul className="artifact-fit-next">
      {NEXT_CAREERS.map((row) => (
        <li key={row.rank} className="artifact-fit-next-row">
          <span className="artifact-fit-rank">#{row.rank}</span>
          <span className="artifact-fit-next-icon" aria-hidden="true">
            <Briefcase size={16} />
          </span>
          <div className="artifact-fit-next-body">
            <strong className="artifact-fit-next-name">{row.name}</strong>
            <span className="artifact-fit-next-holland">{row.holland}</span>
          </div>
          <strong className="artifact-fit-next-score">{row.fit}%</strong>
        </li>
      ))}
    </ul>
  </div>
);

/* ==========================================================================
   BƯỚC 4: SO SÁNH PHƯƠNG ÁN
   ========================================================================== */

const COMPARE_PLANS = [
  {
    rank: 1,
    preferred: true,
    school: 'ĐH Bách khoa Hà Nội (HUST)',
    program: 'Khoa học Máy tính (IT1)',
    career: 'Kỹ sư phần mềm · 94%',
    cutoff: '26.85 (A00)',
    admissionStatus: 'Đạt (+0.65đ)',
    tuition: '34 triệu / năm',
    location: 'Hà Nội · 4 năm',
    totalScore: '92.4 / 100',
  },
  {
    rank: 2,
    preferred: false,
    school: 'ĐH Công nghệ – ĐHQGHN (UET)',
    program: 'Kỹ thuật Phần mềm (CN8)',
    career: 'Kỹ sư phần mềm · 94%',
    cutoff: '26.40 (A00)',
    admissionStatus: 'Đạt (+1.10đ)',
    tuition: '31.5 triệu / năm',
    location: 'Hà Nội · 4 năm',
    totalScore: '89.8 / 100',
  },
];

const DecisionCompareArtifact: React.FC = () => (
  <div className="artifact-window artifact-compare">
    <div className="artifact-topbar">
      <div className="artifact-param-list">
        <span>Điểm của bạn: <strong>27.50 (A00)</strong></span>
        <span>Ngân sách: <strong>45 triệu/năm</strong></span>
        <span>Ưu tiên: <strong>Hà Nội</strong></span>
      </div>
      <span className="artifact-tag is-sky">4 tiêu chí</span>
    </div>

    <div className="artifact-compare-grid">
      {COMPARE_PLANS.map((plan) => (
        <div
          key={plan.school}
          className={`artifact-plan-card ${plan.preferred ? 'is-preferred' : ''}`}
        >
          <div className="artifact-plan-head">
            <span className="artifact-plan-rank">
              {plan.preferred && <Star size={11} aria-hidden="true" />}
              Phương án {plan.rank} {plan.preferred ? '· Ưu tiên' : '· Dự phòng'}
            </span>
            <strong className="artifact-plan-school">{plan.school}</strong>
            <span className="artifact-plan-program">{plan.program}</span>
          </div>

          <dl className="artifact-plan-rows">
            <div className="artifact-plan-row">
              <dt>Nghề hướng tới</dt>
              <dd>{plan.career}</dd>
            </div>
            <div className="artifact-plan-row">
              <dt>Điểm chuẩn</dt>
              <dd>
                <span>{plan.cutoff}</span>
                <span className="artifact-plan-ok">{plan.admissionStatus}</span>
              </dd>
            </div>
            <div className="artifact-plan-row">
              <dt>Học phí</dt>
              <dd>{plan.tuition}</dd>
            </div>
            <div className="artifact-plan-row">
              <dt>Đào tạo</dt>
              <dd>{plan.location}</dd>
            </div>
          </dl>

          <div className="artifact-plan-foot">
            <span className="artifact-plan-foot-label">Điểm tổng hợp</span>
            <strong className="artifact-plan-total">{plan.totalScore}</strong>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   BƯỚC 5: LỘ TRÌNH CÁ NHÂN
   ========================================================================== */

interface SampleRoadmapStage {
  stepCode: string;
  title: string;
  statusLabel: string;
  statusKind: 'done' | 'current';
  percent: number;
  items: { pillar: string; text: string; done: boolean }[];
}

const SAMPLE_ROADMAP_STAGES: SampleRoadmapStage[] = [
  {
    stepCode: 'Chặng 1',
    title: 'Nền tảng lập trình & Tư duy máy tính',
    statusLabel: 'Đã xong',
    statusKind: 'done',
    percent: 100,
    items: [
      { pillar: 'Kiến thức', text: 'Học ngôn ngữ C++ & Lập trình hướng đối tượng (OOP)', done: true },
      { pillar: 'Kỹ năng', text: 'Sử dụng Git/GitHub & Giải 100 bài toán tư duy logic', done: true },
    ],
  },
  {
    stepCode: 'Chặng 2',
    title: 'Cấu trúc dữ liệu, Giải thuật & Cơ sở dữ liệu',
    statusLabel: 'Đã xong',
    statusKind: 'done',
    percent: 100,
    items: [
      { pillar: 'Kiến thức', text: 'Học Cấu trúc dữ liệu & Giải thuật (Mảng, Cây, Đồ thị)', done: true },
      { pillar: 'Kỹ năng', text: 'Thiết kế Cơ sở dữ liệu SQL & Xây dựng RESTful API', done: true },
    ],
  },
  {
    stepCode: 'Chặng 3',
    title: 'Xây dựng dự án thực tế & Thực tập doanh nghiệp',
    statusLabel: 'Đang học',
    statusKind: 'current',
    percent: 50,
    items: [
      { pillar: 'Trải nghiệm', text: 'Xây dựng Web bán hàng Full-stack (React, TypeScript, Node.js)', done: true },
      { pillar: 'Trải nghiệm', text: 'Triển khai Docker, CI/CD & Thực tập tại doanh nghiệp', done: false },
    ],
  },
];

const RoadmapArtifact: React.FC = () => (
  <div className="artifact-window artifact-roadmap">
    <div className="artifact-topbar">
      <span className="artifact-status-line">ĐH Bách khoa Hà Nội · Khoa học Máy tính</span>
      <span className="artifact-tag is-coral">Tiến độ: 83%</span>
    </div>

    <ol className="artifact-roadmap-list">
      {SAMPLE_ROADMAP_STAGES.map((stage) => (
        <li
          key={stage.stepCode}
          className={`artifact-roadmap-stage is-${stage.statusKind}`}
        >
          <div className="artifact-roadmap-stage-head">
            <span className="artifact-roadmap-code">{stage.stepCode}</span>
            <strong className="artifact-roadmap-title">{stage.title}</strong>
            <span className={`artifact-roadmap-status is-${stage.statusKind}`}>
              {stage.statusLabel} · {stage.percent}%
            </span>
          </div>

          <ul className="artifact-roadmap-tasks">
            {stage.items.map((item) => (
              <li key={item.text} className={`artifact-roadmap-task ${item.done ? 'is-done' : ''}`}>
                <span className="artifact-task-box" aria-hidden="true">
                  {item.done && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="artifact-task-pillar">{item.pillar}</span>
                <span className="artifact-task-text">{item.text}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}

      <li className="artifact-roadmap-goal">
        <span className="artifact-goal-pin" aria-hidden="true">
          <MapPin size={18} />
        </span>
        <div className="artifact-goal-body">
          <span className="artifact-goal-eyebrow">Mục tiêu quyết định</span>
          <strong className="artifact-goal-title">Trở thành Lập trình viên (Kỹ sư phần mềm)</strong>
        </div>
      </li>
    </ol>
  </div>
);

/* ==========================================================================
   THEO DÕI CUỘN MƯỢT MÀ
   ========================================================================== */

const LINE_DESKTOP = 0.5;
const LINE_MOBILE = 0.65;

function useJourneyProgress(listRef: React.RefObject<HTMLOListElement | null>) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const mobile = window.matchMedia('(max-width: 960px)');
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
      let next = 0;
      items.forEach((item, i) => {
        if (centers[i] <= line) next = i;
        const length = i < items.length - 1 ? centers[i + 1] - centers[i] : 0;
        item.style.setProperty('--seg-fill', `${Math.max(0, Math.min(length, line - centers[i]))}px`);
      });
      setActive((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      if (near && !frame) frame = requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        if (!frame) frame = requestAnimationFrame(update);
      },
      { rootMargin: '25% 0px 25% 0px' },
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
 * Hành trình 5 bước hướng nghiệp:
 * Khoảng cách giữa các bước rộng rãi, không có mô tả thừa, chuyển cảnh hoàn toàn trên GPU không giật lag.
 */
export const HomeJourney: React.FC<HomeJourneyProps> = ({
  id,
  canExplore,
  testPath,
  questionRange,
  minuteRange,
  raters,
  ratersPerGroup,
  careers,
  axes,
  levels,
  isOwnResult,
  isChartLoading,
}) => {
  const listRef = useRef<HTMLOListElement>(null);
  const scrollActive = useJourneyProgress(listRef);
  const STEP_COUNT = 5;
  const shown = Math.min(Math.max(scrollActive, 0), STEP_COUNT - 1);

  const steps: Step[] = [
    {
      key: 'self',
      stepId: 'step-self',
      title: 'Tự đánh giá',
      facts: [
        `${questionRange} câu hỏi · ${minuteRange.replace('′', '')} phút thực hiện`,
        '4 phần: Tính cách, Giá trị, Sở thích, Năng lực',
        'Bản đồ 7 nhóm tố chất & mã Holland',
      ],
      icon: ClipboardCheck,
      scene: (
        <SelfAssessmentArtifact
          axes={axes}
          levels={levels}
          isOwnResult={isOwnResult}
          isLoading={isChartLoading}
        />
      ),
    },
    {
      key: '360',
      stepId: 'step-360',
      title: 'Đánh giá 360',
      facts: [
        `${raters.length} nhóm: Phụ huynh, Giáo viên, Bạn bè, Người hướng dẫn`,
        `Tối đa ${ratersPerGroup} người đánh giá mỗi nhóm`,
        'Đối chiếu điểm tự đánh giá & góc nhìn 360°',
      ],
      icon: Users,
      scene: <Rater360Artifact raters={raters} />,
    },
    {
      key: 'fit',
      stepId: 'step-fit',
      title: 'Nghề phù hợp',
      facts: [
        careers !== null ? `Đối chiếu ${careers.toLocaleString('vi-VN')} nghề nghiệp chuẩn hóa` : 'Đối chiếu danh mục nghề nghiệp chuẩn hóa',
        'Xếp hạng theo Năng lực, Sở thích & Giá trị',
        'Chọn nghề mục tiêu để lập phương án',
      ],
      icon: Compass,
      scene: <CareerFitArtifact />,
    },
    {
      key: 'compare',
      stepId: 'step-compare',
      title: 'So sánh phương án',
      facts: [
        'Đặt các phương án Trường – Ngành cạnh nhau',
        '4 tiêu chí: Độ phù hợp, Điểm chuẩn, Học phí, Địa điểm',
        'Xác định phương án ưu tiên & dự phòng',
      ],
      icon: Scale,
      scene: <DecisionCompareArtifact />,
    },
    {
      key: 'roadmap',
      stepId: 'step-roadmap',
      title: 'Lộ trình',
      facts: [
        'Chia theo từng chặng từ nền tảng đến thực chiến',
        '3 trụ cột: Kiến thức · Kỹ năng · Trải nghiệm',
        'Theo dõi tiến độ tới mục tiêu nghề nghiệp',
      ],
      icon: Route,
      scene: <RoadmapArtifact />,
    },
  ];

  const scrollToStep = (stepId: string) => {
    const el = document.getElementById(stepId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section id={id} className="journey" aria-labelledby={`${id}-title`}>
      <div className="journey-head">
        <span className="journey-eyebrow">Lộ trình định hướng 5 bước</span>
        <div className="journey-head-row">
          <h2 id={`${id}-title`} className="journey-title">
            Từ thấu hiểu bản thân đến mục tiêu nghề nghiệp
          </h2>
          <ol className="journey-quick-tabs" aria-label="Chọn nhanh bước">
            {steps.map((s, idx) => (
              <li key={s.key}>
                <button
                  type="button"
                  className={`journey-quick-tab ${idx === shown ? 'is-active' : idx < shown ? 'is-done' : ''}`}
                  onClick={() => scrollToStep(s.stepId)}
                >
                  <span className="journey-quick-num">0{idx + 1}</span>
                  <span>{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="journey-body">
        <ol ref={listRef} className="journey-list">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const state = i < scrollActive ? 'is-done' : i === scrollActive ? 'is-current' : '';
            return (
              <li key={step.key} id={step.stepId} data-step className={`journey-step ${state}`}>
                <span className="journey-meta">Bước 0{i + 1}</span>
                <span className="journey-rail" aria-hidden="true">
                  <span className="journey-dot" />
                  <span className="journey-segment" />
                </span>
                <div className="journey-content">
                  <button
                    type="button"
                    className="journey-step-trigger"
                    onClick={() => scrollToStep(step.stepId)}
                  >
                    <h3 className="journey-step-title">
                      <span className="journey-step-icon" aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      {step.title}
                    </h3>
                  </button>
                  <ul className="journey-facts">
                    {step.facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
          <li data-step className={`journey-step journey-end ${scrollActive >= steps.length ? 'is-current' : ''}`}>
            <span className="journey-meta" />
            <span className="journey-rail" aria-hidden="true">
              <span className="journey-dot" />
            </span>
            <div className="journey-content">
              {canExplore && (
                <Link to={testPath} className="journey-cta">
                  <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                    Bắt đầu làm bài đánh giá ngay
                  </Button>
                </Link>
              )}
            </div>
          </li>
        </ol>

        <div className="journey-aside">
          <div className="journey-stage" aria-hidden="true">
            <span className="journey-stage-glow" />
            {steps.map((step, i) => (
              <div
                key={step.key}
                className={`journey-scene journey-scene-${step.key} ${i === shown ? 'is-active' : ''}`}
              >
                {step.scene}
              </div>
            ))}
            <ol className="journey-dots">
              {steps.map((step, i) => (
                <li
                  key={step.key}
                  className={i === shown ? 'is-active' : i < shown ? 'is-done' : ''}
                  onClick={() => scrollToStep(step.stepId)}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};
