import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, History } from 'lucide-react';
import { downloadPdf, printOrientationProfile } from '../../../lib/printProfile';
import { Alert, Badge, Button, Card, Spinner } from '../../../components/common';
import { TopCareers } from '../../career_explorer/components/TopCareers';
import { loadResultInsights, type ResultInsights } from '../resultInsights.service';
import '../../career_explorer/pages/CareerPages.css';
import './ResultInsightsPanel.css';

const CONFIDENCE_LABEL = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' } as const;
const STATUS_LABEL: Record<string, string> = {
  self_assessment: 'Tự đánh giá',
  temporary: 'Tạm thời',
  final_360: 'Cuối cùng 360°',
};
const WEIGHT_NOTE: Record<string, string | null> = {
  not_applicable: null,
  included: null,
  equal_fallback: 'Mọi bài 360° đã chấp nhận có mức thấu hiểu thấp nhất (TH = 3) nên được chia đều trọng số (tham số zero_weight_equal_fallback).',
  pending_review: 'Bài 360° đã chấp nhận đang chờ chấm định tính nên chưa được tính vào điểm tổng hợp.',
};

interface Props {
  userId: string;
  /** Chủ kết quả xem được giá trị cốt lõi, minh chứng, Top nghề và xuất PDF */
  isOwner: boolean;
  ownerName?: string;
}

/** Phần mở rộng của Hồ sơ định hướng (FR01.03): điểm theo nhóm người chấm, Coverage/Confidence, Holland, giá trị cốt lõi, hiệu lực, nghề phù hợp */
export const ResultInsightsPanel: React.FC<Props> = ({ userId, isOwner, ownerName }) => {
  const [data, setData] = useState<ResultInsights | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(undefined);
    loadResultInsights(userId, isOwner)
      .then((value) => active && setData(value))
      .catch(() => active && setError('Không tải được chi tiết kết quả.'));
    return () => {
      active = false;
    };
  }, [userId, isOwner]);

  const groups = useMemo(() => {
    const map = new Map<string, ResultInsights['criteria']>();
    for (const c of data?.criteria ?? []) {
      const list = map.get(c.groupCode) ?? [];
      list.push(c);
      map.set(c.groupCode, list);
    }
    return [...map.entries()];
  }, [data]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (data === undefined) return <Spinner label="Đang tải chi tiết kết quả" />;
  if (data === null) return isOwner ? null : <Alert variant="info">Chưa có kết quả được chia sẻ.</Alert>;

  const weightNote = WEIGHT_NOTE[data.qualitativeWeightStatus] ?? null;

  return (
    <div className="insights print-area">
      <div className="insights-head">
        <h2>Hồ sơ định hướng {ownerName ? `– ${ownerName}` : ''}</h2>
        <div className="module-actions no-print">
          {isOwner && (
            <Link to="/lich-su-ket-qua" className="insights-link">
              <History size={16} aria-hidden="true" /> Lịch sử kết quả
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            leftIcon={<Download size={16} />}
            onClick={() => {
              const input = {
              ownerName: ownerName ?? 'Học sinh/Sinh viên',
              status: STATUS_LABEL[data.statusLabel] ?? data.statusLabel,
              holland: data.holland,
              validity: data.validity.expiresAt
                ? `Hiệu lực đến ${new Date(data.validity.expiresAt).toLocaleDateString('vi-VN')}`
                : 'Chưa có mốc hiệu lực',
              versions: data.versions
                ? [data.versions.framework, data.versions.question_bank, data.versions.parameters, data.versions.career_matrix].filter(Boolean).join(' · ')
                : '',
              groups: groups.map(([code, items]) => ({
                code,
                percent: items[0]?.bySource.combined_360 !== undefined || items[0]?.bySource.self !== undefined
                  ? `${Math.round(items.reduce((s, c) => s + (c.bySource.combined_360 ?? c.bySource.self ?? 0), 0) / items.length)}%`
                  : 'Chưa đủ dữ liệu',
              })),
              criteria: data.criteria.map((c) => ({
                name: `${c.dimensionCode} · ${c.name}`,
                score: c.bySource.combined_360 !== undefined ? `${Math.round(c.bySource.combined_360)}%` : (c.bySource.self !== undefined ? `${Math.round(c.bySource.self)}%` : '–'),
                coverage: c.coverage === null ? '–' : `${Math.round(c.coverage * 100)}%`,
                confidence: c.confidence ? CONFIDENCE_LABEL[c.confidence] : '–',
              })),
              coreValues: data.coreValues,
              topCareers: [],
              notes: [WEIGHT_NOTE[data.qualitativeWeightStatus] ?? ''].filter(Boolean),
            };
              downloadPdf('ho-so-dinh-huong.pdf', [
                'Ho so dinh huong ca nhan',
                input.ownerName,
                input.status,
                input.holland ? `Holland ${input.holland}` : '',
                input.validity,
                ...input.groups.map((group) => `${group.code}: ${group.percent}`),
                ...input.notes,
              ].filter(Boolean));
              printOrientationProfile(input);
            }}
          >
            Tải PDF
          </Button>
        </div>
      </div>

      <Card title="Trạng thái và hiệu lực">
        <div className="insights-badges">
          <Badge variant="info">{STATUS_LABEL[data.statusLabel] ?? data.statusLabel}</Badge>
          {data.validity.kind === 'active' && <Badge variant="success">Đang dùng</Badge>}
          {data.validity.kind === 'reassess' && <Badge variant="warning">Cần đánh giá lại</Badge>}
          {data.validity.kind === 'policy_pending' && <Badge>Chưa có mốc hiệu lực</Badge>}
          {data.holland && <Badge>Holland {data.holland}</Badge>}
        </div>
        {data.validity.expiresAt && (
          <p>
            Hiệu lực đến {new Date(data.validity.expiresAt).toLocaleDateString('vi-VN')} ({data.validity.months} tháng, P17 –{' '}
            {data.validity.verification === 'demo' ? 'mức Demo' : 'theo tài liệu'}).
          </p>
        )}
        {data.versions && (
          <p className="explain-note">
            Phiên bản: {data.versions.framework ?? '–'} · {data.versions.question_bank ?? '–'} · {data.versions.parameters ?? '–'} ·{' '}
            {data.versions.career_matrix ?? '–'}
          </p>
        )}
        {weightNote && <Alert variant="warning">{weightNote}</Alert>}
      </Card>

      {isOwner && (data.coreValues.length > 0 || data.evidences.length > 0) && (
        <Card title="Giá trị cốt lõi và minh chứng">
          {data.coreValues.length > 0 && (
            <ol className="insights-values">
              {data.coreValues.map((value) => <li key={value}>{value}</li>)}
            </ol>
          )}
          {data.evidences.length > 0 && (
            <ul className="module-list">
              {data.evidences.map((e, index) => <li key={`${e.kind}-${index}`}><span>{e.kind}</span><span>{e.content}</span></li>)}
            </ul>
          )}
        </Card>
      )}

      {isOwner && <TopCareers />}
    </div>
  );
};
