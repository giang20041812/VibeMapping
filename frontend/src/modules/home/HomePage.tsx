import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Alert, Button, LogoMark, Stage } from '../../components/common';
import { Globe360 } from '../../components/charts/Globe360/Globe360';
import { PolygonChart } from '../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis } from '../../components/charts/PolygonChart/PolygonChart';
import { COMPETENCY_LEVELS, GROUP_ICONS, GROUP_SHORT_LABELS } from '../assessment_result/assessmentResult.constants';
import { GLOBE_NODES } from '../assessment_360/assessment360.constants';
import { useAuth } from '../auth/AuthContext';
import { isLearnerRole } from '../profile/profile.logic';
import { useInView } from '../../hooks/useInView';
import { HomeBackdrop } from './HomeBackdrop';
import './HomePage.css';

interface RouteState {
  draftSaved?: boolean;
}

/* Số liệu mẫu cho biểu đồ minh họa: đủ các nhóm tiêu chí như trong đánh giá cá nhân */
const SAMPLE_SCORES: Record<string, number> = { G1: 78, G2: 88, G3: 70, G4: 84, G5: 62, G6: 91, G7: 74 };
const POLYGON_AXES: PolygonAxis[] = Object.keys(GROUP_SHORT_LABELS).map((code) => ({
  key: code,
  label: GROUP_SHORT_LABELS[code],
  value: SAMPLE_SCORES[code] ?? 0,
  icon: GROUP_ICONS[code],
}));
const POLYGON_LEVELS = COMPETENCY_LEVELS.map(({ min, label }) => ({ min, label }));

interface FeatureProps {
  id: string;
  /** Đưa hình minh họa sang bên trái, chữ sang bên phải */
  flip?: boolean;
  visual: React.ReactNode;
  children: React.ReactNode;
}

/** Một hàng giới thiệu: chữ một bên, hình minh họa một bên; hàng sau đổi bên so với hàng trước */
const Feature: React.FC<FeatureProps> = ({ id, flip = false, visual, children }) => {
  const { ref, seen } = useInView<HTMLElement>(0.15);
  return (
    <section ref={ref} className={`feature ${flip ? 'feature-flip' : ''} ${seen ? 'is-visible' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="feature-copy">{children}</div>
      <div className="feature-visual">{visual}</div>
    </section>
  );
};

export const HomePage: React.FC = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const draftSaved = (location.state as RouteState | null)?.draftSaved;
  const learner = isLearnerRole(profile?.role);

  return (
    <div className="home">
      <HomeBackdrop />

      {draftSaved && <Alert variant="success">Đã lưu tạm. Bạn có thể quay lại làm tiếp trong 7 ngày.</Alert>}

      <header className="home-brand">
        <h1 className="home-brand-title" aria-label="Vibe Mapping">
          <span className="home-brand-word">
            <span className="home-brand-mark" aria-hidden="true">
              <LogoMark animated />
            </span>
            <span className="home-brand-vibe">ibe</span>
          </span>
          <span className="home-brand-mapping">Mapping</span>
        </h1>
        <p className="home-brand-lead">Biết mình là ai, vững bước tương lai.</p>
      </header>

      {!learner && <Alert variant="info">Tài khoản của bạn chưa có chức năng nào trong giai đoạn này.</Alert>}

      <Feature
        id="feature-self"
        visual={
          <Stage className="feature-stage">
            <PolygonChart axes={POLYGON_AXES} levels={POLYGON_LEVELS} />
          </Stage>
        }
      >
        <h2 id="feature-self-title" className="feature-title">
          Tự đánh giá qua biểu đồ <span className="text-spectrum">{POLYGON_AXES.length} nhóm tiêu chí</span>
        </h2>
        <p className="feature-lead">Trả lời từng câu hỏi ngắn, xem tố chất của bạn hiện lên thành một biểu đồ.</p>
        {learner && (
          <Link to="/danh-gia-ca-nhan" className="feature-link">
            <Button size="lg" rightIcon={<ArrowRight size={18} />}>
              Khám phá
            </Button>
          </Link>
        )}
      </Feature>

      <Feature
        id="feature-360"
        flip
        visual={
          <Stage className="feature-stage">
            <Globe360 nodes={GLOBE_NODES} />
          </Stage>
        }
      >
        <h2 id="feature-360-title" className="feature-title">
          Đánh giá <span className="text-spectrum">360°</span> từ những người hiểu bạn
        </h2>
        <p className="feature-lead">
          Phụ huynh, bạn bè, giáo viên và người hướng dẫn cùng góp góc nhìn để kết quả không chỉ là cảm nhận của riêng bạn.
        </p>
        {learner && (
          <Link to="/danh-gia-360" className="feature-link">
            <Button size="lg" rightIcon={<ArrowRight size={18} />}>
              Khám phá
            </Button>
          </Link>
        )}
      </Feature>
    </div>
  );
};
