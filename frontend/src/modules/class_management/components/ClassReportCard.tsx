import React from 'react';
import { Alert, Card, ProgressBar, Skeleton } from '../../../components/common';
import { REPORT_MIN_STUDENTS } from '../class_management.constants';
import type { ClassReport } from '../class_management.types';
import '../ClassManagement.css';

export interface ClassReportCardProps {
  title: string;
  report: ClassReport | null;
  isLoading: boolean;
  error: string | null;
}

export const ClassReportCard: React.FC<ClassReportCardProps> = ({ title, report, isLoading, error }) => (
  <Card title={title}>
    {error && <Alert variant="danger">{error}</Alert>}
    {isLoading && !report && <Skeleton shape="heading" />}
    {report && !report.ok && (
      <Alert variant="info">
        Cần từ {REPORT_MIN_STUDENTS} học sinh đã có kết quả để hiển thị báo cáo (hiện có {report.student_count}).
      </Alert>
    )}
    {report?.ok && (
      <div className="class-stack">
        <div className="class-meta">
          <div className="class-meta-item">
            <span className="class-meta-label">Học sinh đã tham gia</span>
            <span className="class-meta-value">{report.joined_count}</span>
          </div>
          <div className="class-meta-item">
            <span className="class-meta-label">Học sinh có kết quả</span>
            <span className="class-meta-value">{report.student_count}</span>
          </div>
          {report.graded_count !== undefined && (
            <div className="class-meta-item">
              <span className="class-meta-label">Học sinh đã được chấm</span>
              <span className="class-meta-value">{report.graded_count}</span>
            </div>
          )}
        </div>
        <div className="class-report-bars">
          {report.groups.map((group) => (
            <div key={group.group_code}>
              <div className="class-report-bar-label">
                <span>
                  {group.group_code} · {group.name}
                </span>
                <span>{group.average_percent === null ? '—' : `${group.average_percent}%`}</span>
              </div>
              <ProgressBar value={group.average_percent} label={`Điểm trung bình ${group.name}`} />
            </div>
          ))}
        </div>
      </div>
    )}
  </Card>
);
