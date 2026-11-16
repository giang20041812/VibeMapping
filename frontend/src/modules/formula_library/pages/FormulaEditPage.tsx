import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

/** Sửa công thức ngay trên dòng của danh sách: đường dẫn cũ chuyển về danh sách, mở sẵn dòng cần sửa */
export const FormulaEditPage: React.FC = () => {
  const { id } = useParams();
  return <Navigate to={id ? `/quan-tri/cong-thuc?sua=${encodeURIComponent(id)}` : '/quan-tri/cong-thuc'} replace />;
};
