import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Badge, Card, Spinner } from '../../../components/common';
import { db } from '../../../lib/rpc';

interface PublicCareer {
  id: string;
  career_code: string;
  career_name: string;
  holland_top3: string | null;
  qualifying_jd_count: number;
  data_checked_at: string | null;
  field_name: string | null;
}

/** FR04.01.03: xem nghề đã công bố khi chưa đăng nhập. Không hiện điểm phù hợp của người học. */
export const PublicCareerDetailPage: React.FC = () => {
  const { careerId } = useParams();
  const [row, setRow] = useState<PublicCareer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!careerId) return;
    let active = true;
    db.from('careers')
      .select('id, career_code, career_name, holland_top3, qualifying_jd_count, data_checked_at, field:career_fields(field_name)')
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
        const fieldName = Array.isArray(field) ? field[0]?.field_name ?? null : field?.field_name ?? null;
        setRow({
          id: data.id,
          career_code: data.career_code,
          career_name: data.career_name,
          holland_top3: data.holland_top3,
          qualifying_jd_count: data.qualifying_jd_count,
          data_checked_at: data.data_checked_at,
          field_name: fieldName,
        });
      });
    return () => {
      active = false;
    };
  }, [careerId]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!row) return <Spinner />;

  return (
    <div className="module-page">
      <p><Link to="/danh-muc-nghe">Danh mục nghề</Link></p>
      <Card title={row.career_name}>
        <p>{row.career_code}{row.field_name ? ` · ${row.field_name}` : ''}</p>
        {row.holland_top3 && <Badge>Holland {row.holland_top3}</Badge>}
        <p>{row.qualifying_jd_count} JD L0–L2</p>
        <p className="explain-note">Ngày kiểm tra dữ liệu: {row.data_checked_at ?? 'chưa có'}</p>
        <p>Đăng nhập để xem mức phù hợp với hồ sơ của bạn.</p>
        <Link to="/dang-nhap">Đăng nhập</Link>
      </Card>
    </div>
  );
};
