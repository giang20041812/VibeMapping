import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Gauge,
  Orbit,
  Route,
  Scale,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Badge,
  Checkbox,
  Magnetic,
  ProgressBar,
  RollText,
  SplitText,
  trackPointer,
} from '../../../components/common';
import { PolygonChartSkeleton } from '../../../components/charts/PolygonChart/PolygonChartSkeleton';
import { PolygonChart, type PolygonAxis, type PolygonLevel } from '../../../components/charts/PolygonChart/PolygonChart';
import { Rater360, type RaterNode } from '../../../components/charts/Rater360/Rater360';
import type { CareerComponentResult, ComponentMatch } from '../../../domain/assessmentRules';
import { FitListHead, FitMeter, FitRow, type FitRowItem } from '../../career_explorer/components/FitRow';
import { RESULT_STATUS_LABEL } from '../../career_explorer/careerFit.constants';
import { PillarBadge } from '../../roadmap/components/PillarBadge';
import { STAGE_STATUS_LABEL, STAGE_STATUS_VARIANT } from '../../roadmap/components/RoadmapStageCard';
import { ACTIVITY_TYPE_LABEL, formatDate, stageLabel } from '../../roadmap/roadmap.logic';
import type { ActivityType, RoadmapPillar, StageStatus } from '../../roadmap/roadmap.types';
import '../../roadmap/pages/RoadmapPage.css';
import { StatSticker } from './StatSticker';
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
   BƯỚC 1: TỰ ĐÁNH GIÁ (biểu đồ đa giác kiểu hình dán, nhãn dán trung bình & nổi bật)
   ========================================================================== */

/** Điểm trung bình và nhóm nổi bật nhất của biểu đồ, hiện thành nhãn dán trên hình */
function summarize(axes: PolygonAxis[]) {
  const scored = axes.filter((a): a is PolygonAxis & { value: number } => a.value !== null);
  if (scored.length === 0) return null;
  const average = Math.round(scored.reduce((sum, a) => sum + a.value, 0) / scored.length);
  const top = scored.reduce((best, a) => (a.value > best.value ? a : best));
  return { average, top: top.shortLabel ?? top.label };
}

const SelfAssessmentArtifact: React.FC<{
  axes: PolygonAxis[];
  levels: PolygonLevel[];
  isOwnResult: boolean;
  isLoading: boolean;
}> = ({ axes, levels, isOwnResult, isLoading }) => {
  const summary = summarize(axes);
  return (
    <div className="artifact-window artifact-sticker-stage">
      {!isLoading && (
        <span className="artifact-sticker-badge">
          <Badge variant={isOwnResult ? 'success' : 'default'}>{isOwnResult ? 'Đánh giá của bạn' : 'Ví dụ'}</Badge>
        </span>
      )}
      {isLoading ? (
        <PolygonChartSkeleton />
      ) : (
        <PolygonChart axes={axes} levels={levels} showReadout={false} showNodeValues />
      )}
      {!isLoading && summary && (
        <>
          <StatSticker place="top-left" tone="violet" icon={Gauge} value={`${summary.average}%`} label="Trung bình" />
          <StatSticker place="bottom-right" tone="gold" icon={Trophy} value={summary.top} label="Nổi bật" />
        </>
      )}
    </div>
  );
};

/* ==========================================================================
   BƯỚC 2: ĐÁNH GIÁ 360° (hình người biểu tượng cho bản thân, các nhóm quay quanh)
   ========================================================================== */

const Rater360Artifact: React.FC<{ raters: RaterNode[]; active: boolean }> = ({ raters, active }) => (
  <div className="artifact-window artifact-sticker-stage">
    <Rater360 nodes={raters} centerLabel="Bạn" paused={!active} />
    <StatSticker place="top-left" tone="cyan" icon={Orbit} value="360°" label="Đa góc nhìn" />
    <StatSticker place="bottom-right" tone="magenta" icon={Users} value={`${raters.length} + Bạn`} label="Người đánh giá" />
  </div>
);

/* ==========================================================================
   BƯỚC 3: NGHỀ PHÙ HỢP
   ========================================================================== */

/** Trọng số mặc định của mức phù hợp: Năng lực 0,4 · Sở thích 0,3 · Động lực 0,3 */
const FIT_WEIGHTS = { g1toG5: 0.4, g6: 0.3, g7: 0.3 } as const;

const samplePart = (percent: number, weight: number): ComponentMatch => ({
  match: percent / 100,
  matchPercent: percent,
  originalWeight: weight,
  appliedWeight: weight,
  usedCriteria: 1,
  missingUserScores: 0,
});

/** Nghề mẫu: mức phù hợp tổng tính từ ba thành phần theo đúng trọng số như trang Nghề phù hợp */
function sampleCareer(
  rank: number,
  careerName: string,
  hollandTop3: string,
  parts: { g1toG5: number; g6: number; g7: number },
  isTarget = false,
): FitRowItem {
  const fit = parts.g1toG5 * FIT_WEIGHTS.g1toG5 + parts.g6 * FIT_WEIGHTS.g6 + parts.g7 * FIT_WEIGHTS.g7;
  const result: CareerComponentResult = {
    g1toG5: samplePart(parts.g1toG5, FIT_WEIGHTS.g1toG5),
    g6: { ...samplePart(parts.g6, FIT_WEIGHTS.g6), method: 'profile_6d_demo' },
    g7: samplePart(parts.g7, FIT_WEIGHTS.g7),
    careerFitPercent: fit,
    rankBand: Math.floor(fit),
    componentCompleteness: 1,
    highestWeightGap: 0,
    unmetCriteriaCount: 0,
    criteriaEvaluations: [],
    status: 'ready',
    notice: '',
  };
  return { careerId: `sample-${rank}`, careerName, fitPercent: fit, nearThreshold: false, hollandTop3, rank, isTarget, result };
}

const SAMPLE_CAREERS: FitRowItem[] = [
  sampleCareer(1, 'Kỹ sư phần mềm', 'IRC', { g1toG5: 92, g6: 95, g7: 88 }, true),
  sampleCareer(2, 'Kỹ sư dữ liệu', 'ICR', { g1toG5: 88, g6: 90, g7: 85 }),
  sampleCareer(3, 'Kỹ sư điện toán đám mây', 'RIC', { g1toG5: 84, g6: 82, g7: 86 }),
];

const TOP_CAREER = SAMPLE_CAREERS[0];
const TOP_CAREER_LABEL = `${TOP_CAREER.careerName} · ${Math.round(TOP_CAREER.fitPercent ?? 0)}%`;

const CareerFitArtifact: React.FC = () => (
  <div className="artifact-window artifact-fit">
    <div className="fit-status artifact-stagger" style={{ '--stagger-i': 0 } as React.CSSProperties}>
      <Badge variant="success">{RESULT_STATUS_LABEL.final_360}</Badge>
      <span className="fit-completeness">
        <span>Độ đầy đủ dữ liệu <b>96%</b></span>
        <FitMeter percent={96} />
      </span>
    </div>

    <div className="fit-list is-static artifact-stagger" style={{ '--stagger-i': 1 } as React.CSSProperties}>
      <FitListHead withActions={false} />
      <ol className="fit-rows">
        {SAMPLE_CAREERS.map((item, index) => (
          <FitRow key={item.careerId} item={item} isTop={index === 0} />
        ))}
      </ol>
    </div>
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
    career: TOP_CAREER_LABEL,
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
    career: TOP_CAREER_LABEL,
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
      {COMPARE_PLANS.map((plan, idx) => (
        <div
          key={plan.school}
          className={`artifact-plan-card spotlight artifact-stagger ${plan.preferred ? 'is-preferred' : ''}`}
          style={{ '--stagger-i': idx } as React.CSSProperties}
          onPointerMove={trackPointer}
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

interface SampleActivity {
  pillar: RoadmapPillar;
  title: string;
  done: boolean;
  type: ActivityType | null;
}

interface SampleStage {
  /** Tháng của hạn (YYYY-MM), cùng cách chia giai đoạn như trang Lộ trình */
  key: string;
  status: StageStatus;
  due: string;
  items: SampleActivity[];
}

/** Giai đoạn đang thực hiện đứng đầu, rồi đến giai đoạn sau và giai đoạn đã qua, như trang Lộ trình */
const SAMPLE_STAGES: SampleStage[] = [
  {
    key: '2026-11',
    status: 'current',
    due: '2026-11-30',
    items: [
      { pillar: 'knowledge', title: 'Hoàn thành khóa Cấu trúc dữ liệu và giải thuật', done: true, type: 'course' },
      { pillar: 'experience', title: 'Xây dựng ứng dụng web quản lý công việc', done: false, type: 'project' },
      { pillar: 'exploration', title: 'Tham gia ngày hội việc làm công nghệ', done: false, type: null },
    ],
  },
  {
    key: '2026-12',
    status: 'upcoming',
    due: '2026-12-31',
    items: [
      { pillar: 'knowledge', title: 'Đọc sách Clean Code', done: false, type: 'book' },
      { pillar: 'experience', title: 'Đóng góp một dự án mã nguồn mở', done: false, type: 'project' },
      { pillar: 'exploration', title: 'Phỏng vấn một kỹ sư phần mềm', done: false, type: null },
    ],
  },
  {
    key: '2026-10',
    status: 'done',
    due: '2026-10-31',
    items: [
      { pillar: 'knowledge', title: 'Học lập trình hướng đối tượng', done: true, type: 'course' },
      { pillar: 'experience', title: 'Giải 50 bài tập lập trình', done: true, type: 'exercise' },
      { pillar: 'exploration', title: 'Tham quan công ty phần mềm', done: true, type: null },
    ],
  },
];

const doneOf = (stage: SampleStage) => stage.items.filter((item) => item.done).length;
const percentOf = (stage: SampleStage) => Math.round((doneOf(stage) / stage.items.length) * 100);
const ROADMAP_TOTAL = SAMPLE_STAGES.reduce((sum, stage) => sum + stage.items.length, 0);
const ROADMAP_DONE = SAMPLE_STAGES.reduce((sum, stage) => sum + doneOf(stage), 0);
const keepChecked = () => undefined;

const RoadmapArtifact: React.FC = () => (
  <div className="artifact-window artifact-roadmap">
    <div className="artifact-stagger" style={{ '--stagger-i': 0 } as React.CSSProperties}>
      <section className="roadmap-overview">
        <dl className="roadmap-kpis">
          <div><dt>Hoàn thành</dt><dd>{Math.round((ROADMAP_DONE / ROADMAP_TOTAL) * 100)}%</dd></div>
          <div><dt>Kế hoạch đến hôm nay</dt><dd>52%</dd></div>
          <div><dt>Còn lại</dt><dd>19 tháng</dd></div>
          <div>
            <dt>Trạng thái</dt>
            <dd><Badge variant="success">Đúng hướng</Badge></dd>
          </div>
        </dl>
      </section>
    </div>

    <div className="roadmap-stages artifact-stagger" style={{ '--stagger-i': 1 } as React.CSSProperties}>
      {SAMPLE_STAGES.map((stage, index) => {
        const code = `Chặng ${String(index + 1).padStart(2, '0')}`;
        const label = stageLabel(stage.key);
        const percent = percentOf(stage);
        const badge = <Badge variant={STAGE_STATUS_VARIANT[stage.status]} size="sm">{STAGE_STATUS_LABEL[stage.status]}</Badge>;

        if (stage.status !== 'current') {
          return (
            <article key={stage.key} className={`roadmap-stage is-collapsed is-${stage.status}`}>
              <div className="roadmap-stage-toggle">
                <ChevronRight size={18} aria-hidden="true" />
                <span className="roadmap-stage-code">{code}</span>
                <span className="roadmap-stage-name">{label}</span>
                {badge}
                <span className="roadmap-stage-count">{doneOf(stage)}/{stage.items.length} hoạt động</span>
                <span className="roadmap-stage-percent">{percent}%</span>
              </div>
            </article>
          );
        }

        return (
          <article key={stage.key} className="roadmap-stage is-current">
            <header className="roadmap-stage-head">
              <div className="roadmap-stage-toggle">
                <CalendarClock size={18} aria-hidden="true" />
                <span className="roadmap-stage-code">{code}</span>
                <span className="roadmap-stage-name">{label}</span>
                {badge}
                <span className="roadmap-stage-count">Hạn {formatDate(stage.due)}</span>
                <span className="roadmap-stage-count">{doneOf(stage)}/{stage.items.length}</span>
                <span className="roadmap-stage-percent">{percent}%</span>
                <ChevronDown size={18} aria-hidden="true" />
              </div>
              <ProgressBar value={percent} label={`Hoàn thành ${label}`} />
            </header>

            <ul className="roadmap-activities">
              {stage.items.map((item) => (
                <li key={item.title} className={item.done ? 'is-done' : undefined}>
                  <div className="roadmap-activity-line">
                    <PillarBadge pillar={item.pillar} />
                    <Checkbox
                      className="roadmap-activity-check"
                      label={item.title}
                      checked={item.done}
                      onChange={keepChecked}
                      tabIndex={-1}
                    />
                    {item.type && <Badge size="sm">{ACTIVITY_TYPE_LABEL[item.type]}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  </div>
);

/* ==========================================================================
   THEO DÕI CUỘN & THANH TIẾN ĐỘ DỌC MƯỢT MÀ
   ========================================================================== */

const LINE_DESKTOP = 0.5;
/** Màn hình hẹp: các bước thành dải thẻ lướt ngang, bước đang xem là thẻ nằm ở mép trái dải */
const MOBILE_QUERY = '(max-width: 960px)';

const startPadding = (list: HTMLElement) => parseFloat(getComputedStyle(list).paddingLeft) || 0;

function useJourneyProgress(listRef: React.RefObject<HTMLOListElement | null>) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const mobile = window.matchMedia(MOBILE_QUERY);
    let frame = 0;
    let near = false;

    const updateSwipe = () => {
      const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-step]:not(.journey-end)'));
      const start = list.getBoundingClientRect().left + startPadding(list);
      let next = 0;
      let best = Infinity;
      cards.forEach((card, i) => {
        const distance = Math.abs(card.getBoundingClientRect().left - start);
        if (distance < best) {
          best = distance;
          next = i;
        }
      });
      if (list.scrollLeft > 0 && list.scrollLeft + list.clientWidth >= list.scrollWidth - 2) next = cards.length - 1;
      setActive((prev) => (prev === next ? prev : next));
    };

    const update = () => {
      frame = 0;
      if (mobile.matches) {
        updateSwipe();
        return;
      }
      const line = window.innerHeight * LINE_DESKTOP;
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
    const scheduleSwipe = () => {
      if (!frame) frame = requestAnimationFrame(update);
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
    list.addEventListener('scroll', scheduleSwipe, { passive: true });
    mobile.addEventListener('change', scheduleSwipe);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      list.removeEventListener('scroll', scheduleSwipe);
      mobile.removeEventListener('change', scheduleSwipe);
      cancelAnimationFrame(frame);
    };
  }, [listRef]);

  return active;
}

/**
 * Hành trình 5 bước trên nền sáng: bước bên trái là chữ trần phân tách bằng đường kẻ,
 * sân khấu bên phải là mặt giấy trắng viền mảnh, cảnh minh họa chuyển tầng bậc theo cuộn;
 * thanh đầu sân khấu cho biết đang ở bước nào (số bước cuộn dọc, tên bước, vạch tiến độ).
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
      scene: <Rater360Artifact raters={raters} active={shown === 1} />,
    },
    {
      key: 'fit',
      stepId: 'step-fit',
      title: 'Nghề phù hợp',
      facts: [
        careers !== null ? `Đối chiếu ${careers.toLocaleString('vi-VN')} nghề nghiệp chuẩn hóa` : 'Đối chiếu danh mục nghề nghiệp chuẩn hóa',
        'Xếp hạng theo Năng lực, Sở thích & Động lực',
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
        'Chia chặng theo tháng, tick hoàn thành từng hoạt động',
        '3 trụ cột: Kiến thức · Kinh nghiệm · Trải nghiệm',
        'Theo dõi tiến độ so với kế hoạch tới mục tiêu nghề nghiệp',
      ],
      icon: Route,
      scene: <RoadmapArtifact />,
    },
  ];

  const scrollToStep = (stepId: string) => {
    const el = document.getElementById(stepId);
    if (!el) return;
    const list = listRef.current;
    if (list && window.matchMedia(MOBILE_QUERY).matches) {
      const offset = el.getBoundingClientRect().left - list.getBoundingClientRect().left - startPadding(list);
      list.scrollBy({ left: offset, behavior: 'smooth' });
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cta = canExplore && (
    <Link to={testPath} className="journey-cta-btn btn-fill btn-fill-ink">
      <RollText text="Bắt đầu làm bài đánh giá ngay" />
      <ArrowRight size={18} className="btn-arrow-slide" aria-hidden="true" />
    </Link>
  );

  return (
    <section id={id} className="journey" aria-labelledby={`${id}-title`}>
      <div className="journey-head">
        <div className="journey-head-row">
          <h2 id={`${id}-title`} className="journey-title">
            <SplitText text="Từ thấu hiểu bản thân đến mục tiêu nghề nghiệp" staggerMs={55} />
          </h2>

          <ol className="journey-quick-tabs" aria-label="Chọn nhanh bước">
            {steps.map((s, idx) => (
              <li key={s.key}>
                <button
                  type="button"
                  className={`journey-quick-tab roll-trigger ${idx === shown ? 'is-active' : idx < shown ? 'is-done' : ''}`}
                  onClick={() => scrollToStep(s.stepId)}
                >
                  <RollText text={s.title} />
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
                <span className="journey-meta">0{i + 1}</span>
                <span className="journey-rail" aria-hidden="true">
                  <span className="journey-dot">
                    <span className="journey-dot-core" />
                  </span>
                  <span className="journey-segment" />
                </span>
                <div className="journey-content" onClick={() => scrollToStep(step.stepId)}>
                  <div className="journey-step-top">
                    <span className="journey-step-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <div className="journey-step-heading">
                      <h3 className="journey-step-title">{step.title}</h3>
                    </div>
                    <ArrowUpRight size={18} className="journey-step-arrow" aria-hidden="true" />
                  </div>

                  <ul className="journey-facts">
                    {step.facts.map((fact) => (
                      <li key={fact}>
                        <span className="journey-fact-check" aria-hidden="true">
                          <Check size={12} strokeWidth={2.8} />
                        </span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}

          <li data-step className={`journey-step journey-end ${scrollActive >= steps.length ? 'is-current' : ''}`}>
            <span className="journey-meta" />
            <span className="journey-rail" aria-hidden="true">
              <span className="journey-dot">
                <span className="journey-dot-core" />
              </span>
            </span>
            <div className="journey-end-cta">
              {cta && (
                <Magnetic strength={0.15} className="journey-cta-wrap">
                  {cta}
                </Magnetic>
              )}
            </div>
          </li>
        </ol>

        <div className="journey-aside">
          <div className="journey-stage" aria-hidden="true">
            <span className="journey-stage-glow" />

            <div className="journey-stage-head">
              <span className="journey-stage-count">
                <span className="journey-stage-count-window">
                  <span className="journey-stage-count-strip" style={{ '--count-i': shown } as React.CSSProperties}>
                    {steps.map((step, i) => (
                      <span key={step.key}>0{i + 1}</span>
                    ))}
                  </span>
                </span>
                <span className="journey-stage-total">/ 0{steps.length}</span>
              </span>
              <span key={steps[shown].key} className="journey-stage-title">
                {steps[shown].title}
              </span>
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

            <div className="journey-stage-body">
              {steps.map((step, i) => (
                <div
                  key={step.key}
                  className={`journey-scene journey-scene-${step.key} ${i === shown ? 'is-active' : ''}`}
                >
                  {step.scene}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {cta && <div className="journey-swipe-cta">{cta}</div>}
    </section>
  );
};
