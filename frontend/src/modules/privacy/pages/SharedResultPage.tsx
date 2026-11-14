import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ResultInsightsPanel } from '../../assessment_result/components/ResultInsightsPanel';
import { TopCareers } from '../../career_explorer/components/TopCareers';
import '../../career_explorer/pages/CareerPages.css';

/** Phụ huynh / giáo viên / mentor xem kết quả tổng hợp được chia sẻ; quyền đọc do RLS can_view_result_of quyết định */
export const SharedResultPage: React.FC = () => {
  const { userId = '' } = useParams();
  return (
    <div className="module-page">
      <p><Link to="/quyen-rieng-tu">Quay lại liên kết</Link></p>
      <ResultInsightsPanel userId={userId} isOwner={false} />
      <section className="career-mine">
        <h2>Nghề phù hợp</h2>
        <TopCareers subjectUserId={userId} />
      </section>
    </div>
  );
};
