import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Alert, Button, Card, ProgressBar } from '../../../components/common';
import { DISCLAIMER_TEXT, NO_DATA_LABEL } from '../../assessment_result/assessmentResult.constants';
import { criteriaPercents, topHolland } from '../assessmentScores';
import type { AnswerMap, BankQuestion } from '../assessmentSession.types';
import './PartReports.css';

interface ReportProps {
  questions: BankQuestion[];
  answers: AnswerMap;
  onContinue: () => void;
}

/** Báo cáo cuối Phần 1: các nét tính cách (nhóm G1) kèm khuyến cáo */
export const PersonalityReport: React.FC<ReportProps> = ({ questions, answers, onContinue }) => {
  const rows = criteriaPercents(
    questions.filter((q) => q.groupCode === 'G1'),
    answers,
  );

  return (
    <Card title="Báo cáo tính cách" className="part-report">
      <ul className="trait-list">
        {rows.map((row, index) => (
          <li key={row.criteriaId} className={`trait-row trait-row-${(index % 5) + 1}`}>
            <div className="trait-head">
              <span className="trait-name">{row.name}</span>
              <span className="trait-value">{row.percent === null ? NO_DATA_LABEL : `${Math.round(row.percent)}%`}</span>
            </div>
            <ProgressBar tone="accent" value={row.percent} label={row.name} className="trait-bar" />
          </li>
        ))}
      </ul>
      <Alert variant="info">Đây là xu hướng của bạn, không phải chẩn đoán tâm lý. {DISCLAIMER_TEXT}</Alert>
      <div className="part-report-actions">
        <Button size="lg" onClick={onContinue} rightIcon={<ArrowRight size={18} />}>
          Tiếp tục sang phần sau
        </Button>
      </div>
    </Card>
  );
};

/** Báo cáo cuối Phần 3: ba chữ Holland nổi trội nhất */
export const HollandReport: React.FC<ReportProps> = ({ questions, answers, onContinue }) => {
  const top = topHolland(
    criteriaPercents(
      questions.filter((q) => q.groupCode === 'G6'),
      answers,
    ),
  );

  return (
    <Card title="Mã Holland" className="part-report">
      {top.length === 0 ? (
        <Alert variant="warning" title="Thiếu dữ liệu đánh giá">
          Chưa đủ câu trả lời để xác định mã Holland.
        </Alert>
      ) : (
        <ul className="holland-list">
          {top.map((row, index) => (
            <li
              key={row.criteriaId}
              className={`holland-card holland-card-${index + 1} holland-${(row.hollandCode ?? '').toLowerCase()}`}
            >
              <span className="holland-letter">{row.hollandCode}</span>
              <span className="holland-name">{row.name}</span>
              <span className="holland-value">{Math.round(row.percent as number)}%</span>
            </li>
          ))}
        </ul>
      )}
      <Alert variant="info">{DISCLAIMER_TEXT}</Alert>
      <div className="part-report-actions">
        <Button size="lg" onClick={onContinue} rightIcon={<ArrowRight size={18} />}>
          Tiếp tục sang phần sau
        </Button>
      </div>
    </Card>
  );
};
