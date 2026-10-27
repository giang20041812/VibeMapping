import React from 'react';
import { ResultView } from '../components/ResultView';
import type { AssessmentResultSummary } from '../assessmentResult.types';

/** Dữ liệu mẫu để xem giao diện khi chưa có kết quả thật. Chỉ có trong môi trường phát triển. */
const SAMPLE: AssessmentResultSummary = {
  id: 'sample',
  statusLabel: 'temporary',
  acceptedCount: 3,
  expectedCount: 5,
  groupsCount: 2,
  thinDataFlag: false,
  insufficientBasisWarning: false,
  calculatedAt: null,
  finalizedAt: null,
  groups: [
    { groupCode: 'G1', name: 'Tính cách cá nhân', sortOrder: 1, self: 78, combined: 72 },
    { groupCode: 'G2', name: 'Tư duy & Năng lực học tập', sortOrder: 2, self: 64, combined: 70 },
    { groupCode: 'G3', name: 'Giao tiếp & Xã hội', sortOrder: 3, self: 82, combined: 68 },
    { groupCode: 'G4', name: 'Thái độ & Tinh thần làm việc', sortOrder: 4, self: 71, combined: 76 },
    { groupCode: 'G5', name: 'Lãnh đạo & Tổ chức', sortOrder: 5, self: 52, combined: 58 },
    { groupCode: 'G6', name: 'Sở thích cá nhân tương thích giá trị nghề nghiệp', sortOrder: 6, self: 88, combined: 84 },
    { groupCode: 'G7', name: 'Động lực', sortOrder: 7, self: 66, combined: 62 },
  ],
};

export const AssessmentResultSamplePage: React.FC = () => (
  <>
    <h1 className="page-title">Đánh giá cá nhân</h1>
    <ResultView result={SAMPLE} />
  </>
);
