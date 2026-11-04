import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Skeleton } from '../../../components/common';
import { db } from '../../../lib/rpc';
import { CareerProfile } from '../components/CareerProfile';
import './CareerPages.css';
import './CareerFit.css';

interface PublicCareer {
  id: string;
  career_name: string;
  holland_top3: string | null;
  field_name: string | null;
}

/** Xem nghề đã công bố khi chưa đăng nhập; không hiện mức phù hợp của người học */
export const PublicCareerDetailPage: React.FC = () => {
  const { careerId } = useParams();
  const [row, setRow] = useState<PublicCareer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!careerId) return;
    let active = true;
    db.from('careers')
      .select('id, career_name, holland_top3, field:career_fields(field_name)')
      .eq('id', careerId)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError || !data) {
          setError('Không tìm thấy nghề đã công bố.');
          return;
        }
        const field = data.field as { field_name: string } | { field_name: string }[] | null;
        setRow({
          id: data.id,
          career_name: data.career_name,
          holland_top3: data.holland_top3,
          field_name: Array.isArray(field) ? field[0]?.field_name ?? null : field?.field_name ?? null,
        });
      });
    return () => {
      active = false;
    };
  }, [careerId]);

  if (error) return <div className="module-page"><Alert variant="danger">{error}</Alert></div>;
  if (!row) return <div className="module-page"><Skeleton shape="block" /></div>;

  return (
    <div className="module-page career-detail">
      <Link to="/danh-muc-nghe" className="career-back">← Danh mục nghề</Link>
      <header className="career-detail-head">
        <div className="career-detail-title">
          <h1>{row.career_name}</h1>
          <div className="career-chips">
            {row.field_name && <Badge variant="info">{row.field_name}</Badge>}
          </div>
        </div>
        <Link to="/dang-ky"><Button>Đăng ký để xem % phù hợp</Button></Link>
      </header>
      <CareerProfile careerId={row.id} publicView />
    </div>
  );
};
