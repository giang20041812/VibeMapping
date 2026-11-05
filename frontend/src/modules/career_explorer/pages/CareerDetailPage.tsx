import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, GitCompare, Target } from 'lucide-react';
import { Alert, Badge, Breadcrumb, Button, Skeleton } from '../../../components/common';
import { PolygonChart } from '../../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis } from '../../../components/charts/PolygonChart/PolygonChart';
import { readCareerCompare, toggleCareerCompare } from '../../../lib/selectionCart';
import { GROUP_ICONS, GROUP_SHORT_LABELS } from '../../assessment_result/assessmentResult.constants';
import { useAuth } from '../../auth/AuthContext';
import {
  listSavedCareers,
  loadCareerDetail,
  removeCareerBookmark,
  saveCareerBookmark,
  type CareerBookmarkKind,
  type CareerDetail,
} from '../career.service';
import {
  FIT_DISCLAIMER,
  PRELIMINARY_NOTE,
  RATER_GROUP_LABEL,
  RESULT_STATUS_LABEL,
  TARGET_LIMIT_NOTE,
  formatPercent,
  formatScore,
  interestLabel,
} from '../careerFit.constants';
import { CompareSidebar } from '../components/CompareSidebar';
import { CareerProfile } from '../components/CareerProfile';
import { CriterionExplanation } from '../components/CriterionExplanation';
import { FitBars } from '../components/FitBars';
import { FitRing } from '../components/FitRing';
import './CareerPages.css';
import './CareerFit.css';

export function percentText(value: number | null, decimals = 1): string {
  return formatPercent(value, decimals);
}

/** Điểm yêu cầu của nghề và điểm của người học theo nhóm tiêu chí, thang 0–100 */
function groupAxes(detail: CareerDetail): PolygonAxis[] {
  const byGroup = new Map<string, { w: number; req: number; user: number; userW: number }>();
  for (const row of detail.components.criteriaEvaluations) {
    if (!(row.careerWeight > 0)) continue;
    const entry = byGroup.get(row.groupCode) ?? { w: 0, req: 0, user: 0, userW: 0 };
    entry.w += row.careerWeight;
    entry.req += row.careerWeight * (row.requiredScore / 5);
    if (row.userScore !== null) {
      entry.userW += row.careerWeight;
      entry.user += row.careerWeight * (row.userScore / 5);
    }
    byGroup.set(row.groupCode, entry);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, e]) => ({
      key: code,
      label: GROUP_SHORT_LABELS[code] ?? code,
      value: e.userW > 0 ? Math.round((e.user / e.userW) * 100) : null,
      reference: Math.round((e.req / e.w) * 100),
      icon: GROUP_ICONS[code] ?? GROUP_ICONS.G1,
    }));
}

const joinVi = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} và ${items[items.length - 1]}`;

/** Lý do gợi ý: điểm giao giữa năng lực, sở thích và động lực, lấy từ số liệu đã tính */
function reasonText(detail: CareerDetail): string | null {
  const { components, career } = detail;
  const strengths = components.criteriaEvaluations
    .filter((row) => row.status === 'met')
    .sort((a, b) => b.contributionPoints - a.contributionPoints)
    .slice(0, 3)
    .map((row) => (row.name ?? row.dimensionCode).toLowerCase());
  const parts: string[] = [];
  if (strengths.length > 0) parts.push(`Bạn đáp ứng tốt ${joinVi(strengths)}`);
  if (components.g6.matchPercent !== null) {
    const interest = career.holland_top3 ? ` (${interestLabel(career.holland_top3)})` : '';
    parts.push(`sở thích${interest} khớp ${formatPercent(components.g6.matchPercent, 0)}`);
  }
  if (components.g7.matchPercent !== null) parts.push(`động lực khớp ${formatPercent(components.g7.matchPercent, 0)}`);
  if (parts.length === 0) return null;
  const text = parts.join(', ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

export const CareerDetailPage: React.FC = () => {
  const { careerId = '' } = useParams();
  const [params] = useSearchParams();
  const subjectUserId = params.get('con') ?? undefined;
  const { session, profile } = useAuth();
  const [detail, setDetail] = useState<CareerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warning'; text: string; roadmap?: boolean } | null>(null);
  const [marks, setMarks] = useState<Set<CareerBookmarkKind>>(new Set());
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(() => readCareerCompare());
  const [compareOpen, setCompareOpen] = useState(false);
  const isLearner = !subjectUserId && (profile?.role === 'student' || profile?.role === 'university_student');

  const reloadMarks = useCallback(async () => {
    if (!isLearner) return;
    const saved = await listSavedCareers();
    setMarks(new Set((saved ?? []).filter((item) => item.career_id === careerId).map((item) => item.kind)));
  }, [careerId, isLearner]);

  useEffect(() => {
    if (!session?.user.id || !careerId) return;
    let active = true;
    setLoading(true);
    loadCareerDetail(careerId, subjectUserId)
      .then((value) => {
        if (!active) return;
        setDetail(value);
        setError(value ? null : 'Không tìm thấy nghề hoặc nghề chưa được công bố.');
      })
      .catch(() => active && setError('Không tải được hồ sơ nghề.'))
      .finally(() => active && setLoading(false));
    reloadMarks().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [careerId, session?.user.id, subjectUserId, reloadMarks]);

  const axes = useMemo(() => (detail ? groupAxes(detail) : []), [detail]);

  const toggleMark = async (kind: CareerBookmarkKind) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const on = marks.has(kind);
    try {
      if (on) await removeCareerBookmark(careerId, kind);
      else await saveCareerBookmark(careerId, kind);
      await reloadMarks();
      if (kind === 'target') {
        setNotice({ tone: 'info', text: on ? 'Đã bỏ nghề mục tiêu.' : 'Đã đặt làm nghề mục tiêu.', roadmap: true });
      } else {
        setNotice({ tone: 'info', text: on ? 'Đã bỏ lưu nghề.' : 'Đã lưu vào nghề quan tâm.' });
      }
    } catch (caught) {
      const message = String((caught as { message?: string })?.message ?? caught);
      setNotice({ tone: 'warning', text: message.includes('target_career_limit') ? TARGET_LIMIT_NOTE : 'Không lưu được nghề.' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="module-page"><Skeleton shape="block" /></div>;
  if (error || !detail) return <div className="module-page"><Alert variant="danger">{error ?? 'Không tìm thấy nghề.'}</Alert></div>;

  const { components, policy } = detail;
  const fit = components.careerFitPercent;
  const showFit = detail.hasUserScores && fit !== null;
  const unmet = components.criteriaEvaluations.filter((row) => row.status === 'gap').sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  const reason = showFit ? reasonText(detail) : null;
  const backHref = subjectUserId ? `/bao-cao-con/${subjectUserId}` : '/nghe';
  return (
    <div className="module-page career-detail">
      <Breadcrumb items={[{ label: subjectUserId ? 'Kết quả được chia sẻ' : 'Danh sách nghề', to: backHref }, { label: detail.career.career_name }]} />
      <header className="career-detail-head">
        {showFit && <FitRing percent={fit} size={104} />}
        <div className="career-detail-title">
          <h1>{detail.career.career_name}</h1>
          <div className="career-chips">
            {showFit && detail.statusLabel && <Badge variant="info">{RESULT_STATUS_LABEL[detail.statusLabel] ?? detail.statusLabel}</Badge>}
            {showFit && detail.rank !== null && <Badge variant="success">Hạng {detail.rank}</Badge>}
            {showFit && fit <= policy.minFitPercent && <Badge variant="warning">Nghề gần đạt</Badge>}
            {showFit && components.componentCompleteness < 1 && <Badge>Dữ liệu {Math.round(components.componentCompleteness * 100)}%</Badge>}
            {marks.has('target') && <Badge variant="success">Mục tiêu</Badge>}
          </div>
        </div>
        {isLearner && (
          <div className="fit-actions">
            <Button
              variant={marks.has('saved') ? 'primary' : 'outline'}
              leftIcon={marks.has('saved') ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              disabled={busy}
              onClick={() => void toggleMark('saved')}
            >
              {marks.has('saved') ? 'Bỏ lưu' : 'Lưu quan tâm'}
            </Button>
            <Button
              variant={marks.has('target') ? 'outline' : 'primary'}
              leftIcon={<Target size={16} />}
              disabled={busy}
              onClick={() => void toggleMark('target')}
            >
              {marks.has('target') ? 'Bỏ mục tiêu' : 'Đặt làm mục tiêu'}
            </Button>
            <Button
              variant={picked.includes(careerId) ? 'primary' : 'outline'}
              leftIcon={<GitCompare size={16} />}
              onClick={() => {
                const next = toggleCareerCompare(careerId);
                setPicked(next.ids);
                if (next.message) setNotice({ tone: 'info', text: next.message });
                if (next.ids.includes(careerId)) setCompareOpen(true);
              }}
            >
              {picked.includes(careerId) ? 'Bỏ so sánh' : 'So sánh'}
            </Button>
          </div>
        )}
      </header>
      {notice && (
        <Alert variant={notice.tone}>
          {notice.text}
          {notice.roadmap && <> <Link to={`/lo-trinh?nghe=${careerId}`}>Tạo lại lộ trình</Link></>}
        </Alert>
      )}
      {showFit && detail.statusLabel === 'self_assessment' && <Alert variant="warning">{PRELIMINARY_NOTE}</Alert>}

      {showFit ? (
        <section className="career-block">
          <h2>Vì sao phù hợp</h2>
          {reason && <p className="career-reason">{reason}</p>}
          <div className="career-why">
            <FitBars result={components} />
            {axes.length >= 3 && (
              <div className="career-why-chart">
                <PolygonChart axes={axes} valueLabel="Bạn" referenceLabel="Yêu cầu nghề" showReadout={false} showNodeValues autoCycleMs={0} />
              </div>
            )}
          </div>
          {unmet.length === 0 ? (
            <Alert variant="success">Bạn đã đáp ứng toàn diện tiêu chuẩn năng lực của nghề này.</Alert>
          ) : (
            <div className="career-gaps">
              <h3>Cần bổ sung</h3>
              <ul className="career-chips">
                {unmet.slice(0, 8).map((row) => (
                  <li key={row.criteriaId}><Badge variant="warning">{row.name ?? row.dimensionCode} · thiếu {formatScore(row.gap)}</Badge></li>
                ))}
              </ul>
            </div>
          )}
          <details className="career-more">
            <summary>Xem vì sao</summary>
            <CriterionExplanation result={components} rows={components.criteriaEvaluations} />
          </details>
        </section>
      ) : detail.hasUserScores ? (
        <Alert variant="info">Đang cập nhật nguồn xác thực</Alert>
      ) : (
        <div className="fit-empty">
          <h2>{subjectUserId ? 'Chưa có kết quả đánh giá' : 'Làm bài kiểm tra đánh giá để mở khóa % phù hợp của bạn với nghề này'}</h2>
          {!subjectUserId && <Link className="compare-side-go" to="/danh-gia-360">Làm bài đánh giá</Link>}
        </div>
      )}

      {showFit && (detail.perceptionGaps.length > 0 || detail.hasGroupScores) && (
        <section className="career-block">
          <h2>Lệch góc nhìn</h2>
          {detail.perceptionGaps.length === 0 ? (
            <Alert variant="success">Các bên đánh giá đồng thuận cao ở các tiêu chí cốt lõi của nghề.</Alert>
          ) : (
            <ul className="module-list">
              {detail.perceptionGaps.map((gap) => (
                <li key={`${gap.dimensionCode}-${gap.group}`}>
                  <span>{gap.dimensionName}</span>
                  <span>Tự đánh giá {Math.round(gap.selfPercent)}%</span>
                  <span>{RATER_GROUP_LABEL[gap.group]} {Math.round(gap.groupPercent)}%</span>
                  <Badge variant="warning">Chênh {Math.abs(Math.round(gap.deltaPercent))} điểm</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <CareerProfile careerId={careerId} />

      <p className="explain-note">{FIT_DISCLAIMER}</p>
      {isLearner && (
        <CompareSidebar
          picked={picked}
          open={compareOpen}
          onOpenChange={setCompareOpen}
          onRemove={(id) => setPicked(toggleCareerCompare(id).ids)}
          onClear={() => {
            picked.forEach((id) => toggleCareerCompare(id));
            setPicked(readCareerCompare());
          }}
        />
      )}
    </div>
  );
};
