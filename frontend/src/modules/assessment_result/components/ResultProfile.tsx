import React from 'react';
import { CalendarDays, Download } from 'lucide-react';
import { downloadPdf, printOrientationProfile } from '../../../lib/printProfile';
import { Alert, Badge, Button, Input, Select } from '../../../components/common';
import type { AssessmentResultListItem } from '../assessmentResult.service';
import type { ResultInsights } from '../resultInsights.service';
import './ResultProfile.css';

const CONFIDENCE_LABEL = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' } as const;
export const STATUS_LABEL: Record<string, string> = {
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

const toDateKey = (iso: string) => {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

interface HeaderProps {
  insights: ResultInsights | null;
  history: AssessmentResultListItem[];
  selectedId: string | null;
  onSelect: (resultId: string) => void;
  ownerName?: string;
}

/** Đầu thẻ điểm: lịch, danh sách chọn lần xem lại, tải PDF, trạng thái và hiệu lực */
export const ResultProfileHeader: React.FC<HeaderProps> = ({ insights, history, selectedId, onSelect, ownerName }) => {
  const options = history.map((item) => ({
    value: item.id,
    label: `${new Date(item.createdAt).toLocaleString('vi-VN')} · ${STATUS_LABEL[item.statusLabel] ?? item.statusLabel}`,
  }));
  const selected = history.find((item) => item.id === selectedId);
  const dateValue = selected ? toDateKey(selected.createdAt) : '';
  const oldest = history.length ? toDateKey(history[history.length - 1].createdAt) : undefined;
  const newest = history.length ? toDateKey(history[0].createdAt) : undefined;

  const pickDate = (value: string) => {
    if (!value) return;
    // Lần gần nhất tính đến hết ngày được chọn
    const match = history.find((item) => toDateKey(item.createdAt) <= value);
    if (match) onSelect(match.id);
  };

  const weightNote = insights ? WEIGHT_NOTE[insights.qualitativeWeightStatus] ?? null : null;

  const exportPdf = () => {
    if (!insights) return;
    const groups = new Map<string, ResultInsights['criteria']>();
    for (const c of insights.criteria) groups.set(c.groupCode, [...(groups.get(c.groupCode) ?? []), c]);
    const scoreOf = (c: ResultInsights['criteria'][number]) => c.bySource.combined_360 ?? c.bySource.self;
    const input = {
      ownerName: ownerName ?? 'Học sinh/Sinh viên',
      status: STATUS_LABEL[insights.statusLabel] ?? insights.statusLabel,
      holland: insights.holland,
      validity: insights.validity.expiresAt
        ? `Hiệu lực đến ${new Date(insights.validity.expiresAt).toLocaleDateString('vi-VN')}`
        : 'Chưa có mốc hiệu lực',
      versions: insights.versions
        ? [insights.versions.framework, insights.versions.question_bank, insights.versions.parameters, insights.versions.career_matrix].filter(Boolean).join(' · ')
        : '',
      groups: [...groups.entries()].map(([code, items]) => {
        const scored = items.map(scoreOf).filter((v): v is number => v !== undefined);
        return { code, percent: scored.length ? `${Math.round(scored.reduce((sum, v) => sum + v, 0) / scored.length)}%` : 'Chưa đủ dữ liệu' };
      }),
      criteria: insights.criteria.map((c) => {
        const score = scoreOf(c);
        return {
          name: `${c.dimensionCode} · ${c.name}`,
          score: score === undefined ? '–' : `${Math.round(score)}%`,
          coverage: c.coverage === null ? '–' : `${Math.round(c.coverage * 100)}%`,
          confidence: c.confidence ? CONFIDENCE_LABEL[c.confidence] : '–',
        };
      }),
      coreValues: insights.coreValues,
      topCareers: [],
      notes: [weightNote ?? ''].filter(Boolean),
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
  };

  return (
    <div className="result-profile-head">
      <div className="result-profile-toolbar no-print">
        <Input
          type="date"
          aria-label="Chọn ngày xem kết quả"
          leftIcon={<CalendarDays size={16} aria-hidden="true" />}
          value={dateValue}
          min={oldest}
          max={newest}
          onChange={(event) => pickDate(event.target.value)}
          className="result-profile-date"
        />
        <Select
          aria-label="Chọn lần kết quả"
          options={options}
          value={selectedId ?? ''}
          onChange={onSelect}
          className="result-profile-history"
        />
        <Button type="button" variant="outline" leftIcon={<Download size={16} />} onClick={exportPdf} disabled={!insights}>
          Tải PDF
        </Button>
      </div>
      {insights && (
        <>
          <div className="result-profile-badges">
            <Badge variant="info">{STATUS_LABEL[insights.statusLabel] ?? insights.statusLabel}</Badge>
            {insights.validity.kind === 'active' && <Badge variant="success">Đang dùng</Badge>}
            {insights.validity.kind === 'reassess' && <Badge variant="warning">Cần đánh giá lại</Badge>}
            {insights.validity.kind === 'policy_pending' && <Badge>Chưa có mốc hiệu lực</Badge>}
            {insights.holland && <Badge>Holland {insights.holland}</Badge>}
            {insights.validity.expiresAt && (
              <span className="result-profile-expiry">
                Hiệu lực đến {new Date(insights.validity.expiresAt).toLocaleDateString('vi-VN')} ({insights.validity.months} tháng)
              </span>
            )}
          </div>
          {weightNote && <Alert variant="warning">{weightNote}</Alert>}
        </>
      )}
    </div>
  );
};

/** Cuối thẻ điểm: giá trị cốt lõi và minh chứng của lần được chọn */
export const ResultProfileFooter: React.FC<{ insights: ResultInsights | null }> = ({ insights }) => {
  if (!insights || (insights.coreValues.length === 0 && insights.evidences.length === 0)) return null;
  return (
    <div className="result-profile-foot">
      {insights.coreValues.length > 0 && (
        <section>
          <h3>Giá trị cốt lõi</h3>
          <ol className="result-profile-values">
            {insights.coreValues.map((value) => <li key={value}>{value}</li>)}
          </ol>
        </section>
      )}
      {insights.evidences.length > 0 && (
        <section>
          <h3>Minh chứng</h3>
          <ul className="module-list">
            {insights.evidences.map((e, index) => <li key={`${e.kind}-${index}`}><span>{e.kind}</span><span>{e.content}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
};
