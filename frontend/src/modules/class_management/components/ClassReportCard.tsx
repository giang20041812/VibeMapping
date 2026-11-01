import React from 'react';
import { Alert, Card, ProgressBar, Skeleton } from '../../../components/common';
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
      <div className="class-stack">
        <ProgressBar
          value={report.member_count === 0 ? null : (report.joined_count / report.member_count) * 100}
          label="Tiến độ tham gia"
        />
        <p className="class-meta-label">
          {report.joined_count}/{report.member_count} học sinh đã tham gia
        </p>
      </div>
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
        <div className="class-stack">
          <span className="class-meta-label">Nghề được quan tâm</span>
          {(report.career_interests ?? []).length === 0 ? (
            <p className="class-meta-label">Học sinh chưa lưu nghề nào.</p>
          ) : (
            <div className="class-report-bars">
              {report.career_interests!.map((item) => (
                <div key={item.career_name}>
                  <div className="class-report-bar-label">
                    <span>{item.career_name}</span>
                    <span>{item.student_count} em</span>
                  </div>
                  <ProgressBar value={(item.student_count / Math.max(report.student_count, 1)) * 100} label={`Tỷ lệ quan tâm ${item.career_name}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </Card>
);
