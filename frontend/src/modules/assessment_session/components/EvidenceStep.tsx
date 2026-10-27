import React from 'react';
import { Check } from 'lucide-react';
import { Alert, Button, Card, Input, Textarea } from '../../../components/common';
import type { EvidenceValues } from '../assessmentSession.types';
import './EvidenceStep.css';

export interface EvidenceStepProps {
  values: EvidenceValues;
  isSaving: boolean;
  showInsufficientWarning: boolean;
  error: string | null;
  onChange: (values: EvidenceValues) => void;
  onFinish: () => void;
}

export const EvidenceStep: React.FC<EvidenceStepProps> = ({ values, isSaving, showInsufficientWarning, error, onChange, onFinish }) => (
  <Card title="Minh chứng bổ trợ" className="evidence-step">
    {showInsufficientWarning && (
      <Alert variant="warning" title="Thiếu dữ liệu đánh giá">
        Bạn đã chọn Không đủ cơ sở ở hơn 40% tiêu chí.
      </Alert>
    )}
    {error && <Alert variant="danger">{error}</Alert>}

    <div className="evidence-fields">
      <Input
        label="Điểm trung bình"
        inputMode="decimal"
        value={values.gradePointAverage}
        onChange={(e) => onChange({ ...values, gradePointAverage: e.target.value })}
      />
      <Textarea
        label="Chứng chỉ"
        value={values.certificates}
        onChange={(e) => onChange({ ...values, certificates: e.target.value })}
      />
      <Textarea
        label="Thành tích"
        value={values.achievements}
        onChange={(e) => onChange({ ...values, achievements: e.target.value })}
      />
    </div>

    <div className="evidence-actions">
      <Button size="lg" isLoading={isSaving} onClick={onFinish} leftIcon={<Check size={18} />}>
        Hoàn thành
      </Button>
    </div>
  </Card>
);
