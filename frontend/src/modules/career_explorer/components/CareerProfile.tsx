import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Skeleton } from '../../../components/common';
import { loadCareerProfileInfo, type CareerProfileInfo } from '../career.service';

/** Mô tả nghề tổng hợp từ JD và các ngành liên quan */
export const CareerProfile: React.FC<{ careerId: string; publicView?: boolean }> = ({ careerId, publicView = false }) => {
  const [info, setInfo] = useState<CareerProfileInfo | null>(null);
  useEffect(() => {
    let active = true;
    loadCareerProfileInfo(careerId).then((value) => active && setInfo(value)).catch(() => active && setInfo({ sections: [], majors: [] }));
    return () => {
      active = false;
    };
  }, [careerId]);

  if (!info) return <Skeleton shape="block" />;
  return (
    <>
      <section className="career-block">
        <h2>Mô tả nghề</h2>
        {info.sections.length === 0 ? <p className="career-muted">Chưa có mô tả</p> : (
          <div className="career-profile-grid">
            {info.sections.map((section) => (
              <div key={section.key} className="career-profile-item">
                <h3>{section.title}</h3>
                <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="career-block">
        <h2>Ngành đào tạo</h2>
        {info.majors.length === 0 ? <p className="career-muted">Chưa có ngành liên quan</p> : (
          <ul className="career-chips">
            {info.majors.map((major) => (
              <li key={major.id}><Badge variant={major.direct ? 'success' : 'default'}>{major.name}</Badge></li>
            ))}
          </ul>
        )}
        {!publicView && <Link to={`/ban-do/${careerId}`}>Xem trường đào tạo</Link>}
      </section>
    </>
  );
};
