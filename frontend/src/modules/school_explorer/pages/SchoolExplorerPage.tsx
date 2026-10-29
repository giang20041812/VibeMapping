import React from 'react';
import { School } from 'lucide-react';
import './SchoolExplorerPage.css';

export const SchoolExplorerPage: React.FC = () => (
  <>
    <h1 className="page-title">Khám phá trường</h1>
    <div className="school-explorer-empty" role="status">
      <School size={40} aria-hidden="true" />
      <span>Đang cập nhật</span>
    </div>
  </>
);
