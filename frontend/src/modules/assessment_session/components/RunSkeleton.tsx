import React from 'react';
import { Card, Skeleton, SkeletonRegion } from '../../../components/common';
import { PARTS, SCALE_VALUES } from '../assessmentSession.constants';
import '../pages/AssessmentRunPage.css';
import './PartStepper.css';
import './QuestionCard.css';
import './RunSkeleton.css';

/** Khung chờ của màn hình làm bài: nút lưu tạm, thanh bốn phần, thẻ câu hỏi với năm mức trả lời và hàng điều hướng */
export const RunSkeleton: React.FC = () => (
  <SkeletonRegion className="run-layout">
    <div className="run-top" aria-hidden="true">
      <Skeleton shape="button-sm" className="run-exit" />
      <ol className="part-stepper">
        {PARTS.map((part) => (
          <li key={part.number} className="part-step">
            <div className="part-step-button run-skeleton-step">
              <Skeleton shape="circle" className="run-skeleton-marker" />
              <Skeleton shape="text" width={60} />
            </div>
          </li>
        ))}
      </ol>
    </div>

    <Card className="run-card">
      <div className="run-progress" aria-hidden="true">
        <Skeleton shape="text" width={35} />
        <Skeleton shape="bar" />
      </div>

      <div className="question-card" aria-hidden="true">
        <Skeleton shape="chip" width={30} />
        <div className="run-skeleton-question">
          <Skeleton shape="heading" width={90} />
          <Skeleton shape="heading" width={60} />
        </div>
        <div className="question-options">
          {SCALE_VALUES.map((score) => (
            <Skeleton key={score} shape="block" className="run-skeleton-option" />
          ))}
        </div>
        <Skeleton shape="text" width={40} />
      </div>

      <div className="run-nav" aria-hidden="true">
        <Skeleton shape="button-lg" />
        <Skeleton shape="button-lg" />
      </div>
    </Card>
  </SkeletonRegion>
);
