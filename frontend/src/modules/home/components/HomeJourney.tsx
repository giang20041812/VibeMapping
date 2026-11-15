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
  Sparkles,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../../../components/common';
import { PolygonChart, type PolygonAxis, type PolygonLevel } from '../../../components/charts/PolygonChart/PolygonChart';
import { PolygonChartSkeleton } from '../../../components/charts/PolygonChart/PolygonChartSkeleton';
import { Rater360, type RaterNode } from '../../../components/charts/Rater360/Rater360';
import { PARTS } from '../../assessment_session/assessmentSession.constants';
import { useInView } from '../../../hooks/useInView';
import './HomeJourney.css';

export interface HomeJourneyProps {
  id: string;
  canExplore: boolean;
  testPath: string;
  questionRange: string;
  minuteRange: string;
  raters: RaterNode[];
  ratersPerGroup: number;
  /** Số nghề trong danh mục; null khi chưa tải được */
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
  detail: string;
  facts: string[];
  icon: LucideIcon;
  scene: React.ReactNode;
}

/* ==========================================================================
   ARTIFACT BƯỚC 1: ĐÁNH GIÁ CÁ NHÂN (TỰ ĐÁNH GIÁ)
   Cấu trúc UI như trang Làm bài & Kết quả cá nhân:
   Thanh tiến trình 4 phần + Bản đồ 7 nhóm tố chất + Bảng điểm nhóm & Giá trị cốt lõi
   ========================================================================== */

const SELF_CORE_VALUES = ['Tư duy logic', 'Sáng tạo công nghệ', 'Học hỏi liên tục'];

function levelLabelOf(score: number): string {
  if (score >= 80) return 'Rất cao';
  if (score >= 65) return 'Cao';
  if (score >= 50) return 'Trung bình';
  return 'Thấp';
}

const SelfAssessmentArtifact: React.FC<{
  axes: PolygonAxis[];
  levels: PolygonLevel[];
  isOwnResult: boolean;
  isLoading: boolean;
}> = ({ axes, levels, isOwnResult, isLoading }) => {
  const top = axes.reduce<PolygonAxis | null>(
    (best, a) => (a.value !== null && (best === null || (best.value ?? -1) < a.value) ? a : best),
    null,
  );
  const topGroups = [...axes]
    .filter((a): a is PolygonAxis & { value: number } => a.value !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  return (
    <div className="artifact-window artifact-self">
      {/* Thanh đầu thẻ: 4 phần đánh giá đã hoàn tất + nhãn kết quả */}
      <div className="artifact-topbar">
        <ol className="artifact-part-stepper" aria-label="Bốn phần tự đánh giá">
          {PARTS.map((part, idx) => (
            <li key={part.number} className="artifact-part-pill" style={{ '--i': idx } as React.CSSProperties}>
              <span className="artifact-part-check" aria-hidden="true">
                <Check size={11} strokeWidth={3} />
              </span>
              <span>{part.short}</span>
            </li>
          ))}
        </ol>
        <div className="artifact-badges">
          <span className="artifact-badge">{isOwnResult ? 'Kết quả của bạn' : 'Mẫu minh họa · Gói 50 câu'}</span>
          {top && top.value !== null && (
            <span className="artifact-badge is-coral">
              <Trophy size={12} aria-hidden="true" />
              Nổi bật · {top.shortLabel ?? top.label} ({Math.round(top.value)}%)
            </span>
          )}
        </div>
      </div>

      {/* Thân thẻ: Bản đồ đa giác 7 nhóm tố chất + Bảng điểm chi tiết như trang Kết quả */}
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
              <span className="artifact-panel-title">Điểm nhóm tố chất dẫn đầu</span>
              <span className="artifact-badge is-sky">Holland: I-R-C</span>
            </div>
            <ul className="artifact-score-list">
              {topGroups.map((group, idx) => (
                <li
                  key={group.key}
                  className="artifact-score-row"
                  style={{ '--i': idx, '--w': `${Math.round(group.value)}%` } as React.CSSProperties}
                >
                  <div className="artifact-score-meta">
                    <span className="artifact-score-name">{group.label}</span>
                    <span className="artifact-score-level">{levelLabelOf(group.value)}</span>
                    <strong className="artifact-score-val">{Math.round(group.value)}%</strong>
                  </div>
                  <span className="scene-track">
                    <span className={`scene-fill ${idx === 0 ? 'is-coral' : ''}`} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="artifact-panel-block artifact-values-block">
            <span className="artifact-panel-title">Giá trị cốt lõi ưu tiên</span>
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
   ARTIFACT BƯỚC 2: ĐÁNH GIÁ 360°
   Cấu trúc UI như trang Đánh giá 360:
   Thanh công tắc mời đánh giá + Sơ đồ 4 nhóm (Phụ huynh, Giáo viên, Bạn bè, Người hướng dẫn)
   với icon thiết kế riêng + Bảng đối chiếu Tự đánh giá vs Sau 360°
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
      {/* Thanh trạng thái công tắc 360° như trên InvitePanel */}
      <div className="artifact-topbar">
        <div className="artifact-switch-pill">
          <span className="artifact-switch-dot" aria-hidden="true" />
          <span>Cho phép người khác đánh giá · Đang bật</span>
        </div>
        <div className="artifact-badges">
          <span className="artifact-badge is-sky">Đã duyệt 8/8 phản hồi</span>
          <span className="artifact-badge is-coral">Độ tin cậy: Cao</span>
        </div>
      </div>

      {/* Sơ đồ 360° trung tâm với 4 nhóm đánh giá có icon thiết kế riêng */}
      <div className="artifact-360-stage">
        <Rater360 nodes={enrichedNodes} centerLabel="Bạn" centerSub="Tổng hợp 360°" />
      </div>

      {/* Bảng đối chiếu điểm Tự đánh giá và Sau 360° như trong ResultView */}
      <div className="artifact-360-compare">
        <div className="artifact-360-compare-head">
          <span>Nhóm tiêu chí đối chiếu</span>
          <span>Tự đánh giá</span>
          <span>Sau 360°</span>
        </div>
        <ul className="artifact-360-compare-list">
          {CALIBRATION_ROWS.map((row, idx) => (
            <li key={row.label} className="artifact-360-compare-row" style={{ '--i': idx } as React.CSSProperties}>
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
   ARTIFACT BƯỚC 3: NGHỀ PHÙ HỢP
   Cấu trúc UI tương tự TopCareers.tsx:
   Thanh độ đầy đủ dữ liệu + Thẻ Hạng 1 nổi bật có vòng tròn % & 3 thanh thành phần + Danh sách #2, #3
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
    tag: 'Đang chọn so sánh',
  },
  {
    rank: 3,
    name: 'Kỹ sư hệ thống & Điện toán đám mây (Cloud / DevOps)',
    holland: 'R-I-C · Kỹ thuật – Nghiên cứu',
    fit: 84,
    tag: 'Phù hợp cao',
  },
];

const CareerFitArtifact: React.FC = () => (
  <div className="artifact-window artifact-fit">
    {/* Thanh trạng thái đầu trang Nghề phù hợp */}
    <div className="artifact-topbar">
      <div className="artifact-badges">
        <span className="artifact-badge is-sky">Cuối cùng 360°</span>
        <span className="artifact-badge">Độ đầy đủ dữ liệu: 96%</span>
      </div>
      <span className="artifact-badge is-coral">
        <Sparkles size={12} aria-hidden="true" />
        Hạng 1 phù hợp nhất
      </span>
    </div>

    {/* Thẻ Nghề Hạng 1 nổi bật (cấu trúc giống fit-hero trong TopCareers.tsx) */}
    <div className="artifact-fit-hero">
      <div className="artifact-fit-ring-col">
        <span className="artifact-fit-crown">
          <Trophy size={12} aria-hidden="true" />
          Hạng 1
        </span>
        <div className="artifact-fit-ring" aria-label="Độ phù hợp 94%">
          <svg viewBox="0 0 88 88" aria-hidden="true">
            <circle cx="44" cy="44" r="37" className="artifact-ring-track" />
            <circle cx="44" cy="44" r="37" className="artifact-ring-fill" pathLength={100} strokeDasharray="94 100" />
          </svg>
          <strong className="artifact-ring-value">94%</strong>
        </div>
        <span className="artifact-fit-target">Mục tiêu</span>
      </div>

      <div className="artifact-fit-main">
        <div className="artifact-fit-head">
          <h4 className="artifact-fit-title">Kỹ sư phần mềm (Software Engineer)</h4>
          <span className="artifact-fit-sub">Công nghệ thông tin · Thu nhập: 18–45 triệu/tháng · Tăng trưởng rất cao</span>
        </div>

        <ul className="artifact-fit-bars">
          {TOP_CAREER_BARS.map((bar, idx) => (
            <li
              key={bar.label}
              className="artifact-fit-bar-item"
              style={{ '--i': idx, '--w': `${bar.value}%` } as React.CSSProperties}
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

    {/* Các nghề phù hợp tiếp theo (#2, #3) */}
    <ul className="artifact-fit-next">
      {NEXT_CAREERS.map((row, idx) => (
        <li
          key={row.rank}
          className="artifact-fit-next-row"
          style={{ '--i': idx + 2, '--w': `${row.fit}%` } as React.CSSProperties}
        >
          <span className="artifact-fit-rank">#{row.rank}</span>
          <span className="artifact-fit-next-icon" aria-hidden="true">
            <Briefcase size={16} />
          </span>
          <div className="artifact-fit-next-body">
            <div className="artifact-fit-next-top">
              <strong className="artifact-fit-next-name">{row.name}</strong>
              <span className="artifact-fit-next-tag">{row.tag}</span>
            </div>
            <span className="artifact-fit-next-holland">{row.holland}</span>
          </div>
          <strong className="artifact-fit-next-score">{row.fit}%</strong>
        </li>
      ))}
    </ul>
  </div>
);

/* ==========================================================================
   ARTIFACT BƯỚC 4: SO SÁNH PHƯƠNG ÁN
   Cấu trúc UI tương tự DecisionComparePage.tsx:
   Thanh thông số đầu vào của người học + Bảng đặt 2 phương án Trường – Ngành cạnh nhau
   ========================================================================== */

const COMPARE_PLANS = [
  {
    rank: 1,
    preferred: true,
    school: 'ĐH Bách khoa Hà Nội (HUST)',
    program: 'Khoa học Máy tính (IT1)',
    career: 'Kỹ sư phần mềm · 94%',
    cutoff: '26.85 (Khối A00)',
    admissionStatus: 'Đáp ứng (+0.65đ)',
    tuition: '34 triệu / năm',
    location: 'Hà Nội · 4 năm',
    totalScore: '92.4 / 100',
    criteriaNote: 'Đủ 4/4 tiêu chí · Hạng 1',
  },
  {
    rank: 2,
    preferred: false,
    school: 'ĐH Công nghệ – ĐHQGHN (UET)',
    program: 'Kỹ thuật Phần mềm (CN8)',
    career: 'Kỹ sư phần mềm · 94%',
    cutoff: '26.40 (Khối A00)',
    admissionStatus: 'Đáp ứng (+1.10đ)',
    tuition: '31.5 triệu / năm',
    location: 'Hà Nội · 4 năm',
    totalScore: '89.8 / 100',
    criteriaNote: 'Đủ 4/4 tiêu chí · Dự phòng',
  },
];

const DecisionCompareArtifact: React.FC = () => (
  <div className="artifact-window artifact-compare">
    {/* Thanh thông số đầu vào của học sinh như trên DecisionComparePage */}
    <div className="artifact-topbar">
      <div className="artifact-badges">
        <span className="artifact-badge">Điểm của bạn: 27.50 (A00)</span>
        <span className="artifact-badge">Ngân sách: 45 triệu/năm</span>
        <span className="artifact-badge">Ưu tiên: Hà Nội</span>
      </div>
      <span className="artifact-badge is-sky">4 tiêu chí trọng số</span>
    </div>

    {/* Hai thẻ phương án đặt cạnh nhau theo đúng hàng tiêu chí của bảng so sánh */}
    <div className="artifact-compare-grid">
      {COMPARE_PLANS.map((plan, idx) => (
        <div
          key={plan.school}
          className={`artifact-plan-card ${plan.preferred ? 'is-preferred' : ''}`}
          style={{ '--i': idx } as React.CSSProperties}
        >
          <div className="artifact-plan-head">
            <span className="artifact-plan-rank">
              {plan.preferred && <Star size={12} aria-hidden="true" />}
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
              <dt>Điểm chuẩn & Đầu vào</dt>
              <dd>
                <span>{plan.cutoff}</span>
                <span className="artifact-plan-pill is-ok">{plan.admissionStatus}</span>
              </dd>
            </div>
            <div className="artifact-plan-row">
              <dt>Học phí mỗi năm</dt>
              <dd>{plan.tuition}</dd>
            </div>
            <div className="artifact-plan-row">
              <dt>Địa điểm & Thời gian</dt>
              <dd>{plan.location}</dd>
            </div>
          </dl>

          <div className="artifact-plan-foot">
            <div>
              <span className="artifact-plan-foot-label">Điểm tổng hợp</span>
              <span className="artifact-plan-foot-sub">{plan.criteriaNote}</span>
            </div>
            <strong className="artifact-plan-total">{plan.totalScore}</strong>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   ARTIFACT BƯỚC 5: LỘ TRÌNH CÁ NHÂN
   Cấu trúc UI như RoadmapStageCard & RoadmapPlan:
   Học C++ => Học cấu trúc dữ liệu & Giải thuật => Xây dựng Web bán hàng Full-stack => Mục tiêu: Trở thành Lập trình viên
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
      { pillar: 'Kiến thức', text: 'Học Cấu trúc dữ liệu & Giải thuật (Mảng, Cây, Đồ thị, Quy hoạch động)', done: true },
      { pillar: 'Kỹ năng', text: 'Thiết kế Cơ sở dữ liệu SQL (PostgreSQL) & RESTful API', done: true },
    ],
  },
  {
    stepCode: 'Chặng 3',
    title: 'Xây dựng dự án thực tế & Thực tập doanh nghiệp',
    statusLabel: 'Đang thực hiện',
    statusKind: 'current',
    percent: 50,
    items: [
      { pillar: 'Trải nghiệm', text: 'Xây dựng Web bán hàng Full-stack (React, TypeScript, Node.js)', done: true },
      { pillar: 'Trải nghiệm', text: 'Triển khai Docker, CI/CD & Thực tập tại công ty công nghệ', done: false },
    ],
  },
];

const RoadmapArtifact: React.FC = () => (
  <div className="artifact-window artifact-roadmap">
    {/* Thanh tổng quan lộ trình và tiến độ tổng thể */}
    <div className="artifact-topbar">
      <div className="artifact-badges">
        <span className="artifact-badge is-sky">Lộ trình cá nhân hóa</span>
        <span className="artifact-badge">ĐH Bách khoa Hà Nội · Khoa học Máy tính</span>
      </div>
      <span className="artifact-badge is-coral">Tiến độ: 83%</span>
    </div>

    {/* Dòng chảy các chặng học tập nối tiếp tới mục tiêu */}
    <ol className="artifact-roadmap-list">
      {SAMPLE_ROADMAP_STAGES.map((stage, idx) => (
        <li
          key={stage.stepCode}
          className={`artifact-roadmap-stage is-${stage.statusKind}`}
          style={{ '--i': idx } as React.CSSProperties}
        >
          <div className="artifact-roadmap-stage-head">
            <span className="artifact-roadmap-code">{stage.stepCode}</span>
            <strong className="artifact-roadmap-title">{stage.title}</strong>
            <span className={`artifact-roadmap-status is-${stage.statusKind}`}>{stage.statusLabel}</span>
            <span className="artifact-roadmap-pct">{stage.percent}%</span>
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

      {/* Đích đến: Mục tiêu nghề nghiệp */}
      <li className="artifact-roadmap-goal" style={{ '--i': SAMPLE_ROADMAP_STAGES.length } as React.CSSProperties}>
        <span className="artifact-goal-pin" aria-hidden="true">
          <MapPin size={18} />
        </span>
        <div className="artifact-goal-body">
          <span className="artifact-goal-eyebrow">Mục tiêu quyết định</span>
          <strong className="artifact-goal-title">Trở thành Lập trình viên (Kỹ sư phần mềm)</strong>
          <span className="artifact-goal-sub">
            Hoàn thiện Portfolio 3 dự án thực chiến trên GitHub · Sẵn sàng ứng tuyển Fresher / Junior Developer
          </span>
        </div>
      </li>
    </ol>
  </div>
);

/* ==========================================================================
   THEO DÕI CUỘN: VẠCH TIẾN ĐỘ DỌC & ĐỔI CẢNH THEO BƯỚC
   ========================================================================== */

const LINE_DESKTOP = 0.52;
const LINE_MOBILE = 0.68;

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
 * Hành trình 5 bước hướng nghiệp theo đúng thứ tự sử dụng sản phẩm.
 * Bên trái là dòng thời gian tuần tự có thể cuộn hoặc bấm chọn;
 * bên phải là khung sân khấu dính hiển thị UI Artifact chuẩn xác như khi chức năng được sử dụng.
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
  const { ref: stageRef, seen } = useInView<HTMLDivElement>(0.2);
  const STEP_COUNT = 5;
  const shown = Math.min(Math.max(scrollActive, 0), STEP_COUNT - 1);

  /* Mỗi lần đổi bước đang xem thì kích hoạt lại animation mở đầu kiểu Apple/Google cho cảnh mới */
  const [runs, setRuns] = useState<number[]>([0, 0, 0, 0, 0]);
  useEffect(() => {
    setRuns((r) => r.map((v, i) => (i === shown ? v + 1 : v)));
  }, [shown]);

  const steps: Step[] = [
    {
      key: 'self',
      stepId: 'step-self',
      title: 'Tự đánh giá',
      detail:
        'Trả lời bộ câu hỏi chuẩn hóa qua 4 phần (Tính cách, Giá trị, Sở thích nghề nghiệp, Năng lực chuyên môn) để phác họa bản đồ 7 nhóm tố chất và mã Holland.',
      facts: [`${questionRange} câu hỏi`, `${minuteRange.replace('′', '')} phút`, '7 nhóm tố chất'],
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
      detail:
        'Mời Phụ huynh, Giáo viên, Bạn bè và Người hướng dẫn cùng đánh giá qua đường dẫn hoặc mã QR để hiệu chỉnh điểm mù và tăng độ tin cậy cho hồ sơ năng lực.',
      facts: [`${raters.length} nhóm người đánh giá`, `Tối đa ${ratersPerGroup} người/nhóm`, 'Đối chiếu đa chiều'],
      icon: Users,
      scene: <Rater360Artifact raters={raters} />,
    },
    {
      key: 'fit',
      stepId: 'step-fit',
      title: 'Nghề phù hợp',
      detail:
        'Hệ thống đối chiếu hồ sơ năng lực 360° với ma trận tiêu chí chuẩn để xếp hạng các nghề nghiệp phù hợp nhất kèm phân tích chi tiết từng chiều.',
      facts: careers !== null ? [`${careers.toLocaleString('vi-VN')} nghề nghiệp`, 'Xếp hạng độ tương thích'] : ['Xếp hạng độ tương thích'],
      icon: Compass,
      scene: <CareerFitArtifact />,
    },
    {
      key: 'compare',
      stepId: 'step-compare',
      title: 'So sánh phương án',
      detail:
        'Đặt các phương án Trường – Ngành – Nghề cạnh nhau theo 4 tiêu chí trọng số: độ phù hợp nghề, điểm chuẩn đầu vào, học phí mỗi năm và địa điểm đào tạo.',
      facts: ['4 tiêu chí trọng số', 'Kiểm tra điểm chuẩn & học phí'],
      icon: Scale,
      scene: <DecisionCompareArtifact />,
    },
    {
      key: 'roadmap',
      stepId: 'step-roadmap',
      title: 'Lộ trình',
      detail:
        'Xây dựng kế hoạch hành động cụ thể theo từng chặng từ kiến thức nền tảng, kỹ năng cốt lõi đến dự án thực chiến để vươn tới nghề mục tiêu.',
      facts: ['3 trụ cột: Kiến thức · Kỹ năng · Trải nghiệm', 'Theo dõi tiến độ từng chặng'],
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
        <span className="journey-eyebrow">Hành trình định hướng 5 bước</span>
        <div className="journey-head-row">
          <h2 id={`${id}-title`} className="journey-title">
            Từ thấu hiểu bản thân đến lộ trình sự nghiệp rõ ràng
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
          <li data-step className={`journey-step journey-end ${scrollActive >= steps.length ? 'is-current' : ''}`}>
            <span className="journey-meta" />
            <span className="journey-rail" aria-hidden="true">
              <span className="journey-dot" />
            </span>
            <div className="journey-content">
              {canExplore && (
                <Link to={testPath} className="journey-cta">
                  <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                    <span className="roll">
                      <span className="roll-inner" data-text="Bắt đầu làm bài đánh giá ngay">
                        Bắt đầu làm bài đánh giá ngay
                      </span>
                    </span>
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
                <div
                  key={`${step.key}-${runs[i]}`}
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
