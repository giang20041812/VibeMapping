import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookMarked,
  Briefcase,
  Building2,
  ClipboardList,
  Cpu,
  FileText,
  GraduationCap,
  Landmark,
  MapPin,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge, Skeleton, stickerToneAt } from '../../../components/common';
import { loadCareerProfileInfo, type CareerMajorSchoolRow, type CareerProfileInfo } from '../career.service';

const SECTION_ICON: Record<string, React.ReactNode> = {
  career_description: <FileText size={18} />,
  main_tasks: <ClipboardList size={18} />,
  professional_skills: <Award size={18} />,
  soft_skills: <Users size={18} />,
  tools_technologies: <Cpu size={18} />,
  work_environment: <Building2 size={18} />,
  career_path: <TrendingUp size={18} />,
  salary_reference: <Wallet size={18} />,
};

const schoolVariant = (school: CareerMajorSchoolRow): string =>
  [school.specialization, school.qualifier, school.faculty].filter(Boolean).join(' · ');

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
            {info.sections.map((section, index) => (
              <div key={section.key} className={`career-profile-item sticker-tone-${stickerToneAt(index)}`}>
                <div className="career-profile-head">
                  <span className="career-profile-icon" aria-hidden="true">
                    {SECTION_ICON[section.key] ?? <Briefcase size={18} />}
                  </span>
                  <h3>{section.title}</h3>
                </div>
                <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="career-block">
        <div className="career-block-head">
          <h2>Ngành đào tạo</h2>
          {!publicView && info.majors.length > 0 && (
            <Link className="career-map-link" to={`/ban-do/${careerId}`}>
              <span>Bản đồ nghề – ngành – trường</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        {info.majors.length === 0 ? <p className="career-muted">Chưa có ngành liên quan</p> : (
          <ul className="career-major-columns" aria-label="Danh sách ngành và trường đào tạo">
            {info.majors.map((major, index) => (
              <li key={major.id} className={`career-major-col sticker-tone-${stickerToneAt(index)}`}>
                <header className="career-major-col-head">
                  <span className="career-major-col-icon" aria-hidden="true">
                    <GraduationCap size={18} />
                  </span>
                  <div className="career-major-col-title-wrap">
                    <Link className="career-major-col-title" to={`/kham-pha-truong/nganh/${major.id}`}>
                      {major.name}
                    </Link>
                    <div className="career-major-col-meta">
                      <Badge variant={major.direct ? 'success' : 'default'}>
                        {major.direct ? 'Trực tiếp' : 'Liên quan'}
                      </Badge>
                      <span className="career-major-col-count">
                        {major.schools.length} trường
                      </span>
                    </div>
                  </div>
                </header>
                {major.schools.length === 0 ? (
                  <div className="career-major-empty">
                    <BookMarked size={18} aria-hidden="true" />
                    <span>Đang cập nhật trường đào tạo</span>
                  </div>
                ) : (
                  <ul className="career-major-school-list" aria-label={`Trường đào tạo ngành ${major.name}`}>
                    {major.schools.map((school) => {
                      const variant = schoolVariant(school);
                      return (
                        <li key={school.programId} className="career-major-school-row">
                          <div className="career-major-school-main">
                            <span className="career-major-school-bullet" aria-hidden="true">
                              <Landmark size={14} />
                            </span>
                            <div className="career-major-school-info">
                              <Link className="career-major-school-name" to={`/kham-pha-truong/chuong-trinh/${school.programId}`}>
                                {school.institutionName}
                              </Link>
                              {variant && <div className="career-major-school-sub">{variant}</div>}
                            </div>
                          </div>
                          {(school.city || school.programType) && (
                            <div className="career-major-school-tags">
                              {school.city && (
                                <span className="career-major-school-city">
                                  <MapPin size={12} aria-hidden="true" />
                                  {school.city}
                                </span>
                              )}
                              {school.programType && <Badge>{school.programType}</Badge>}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <footer className="career-major-col-foot">
                  <Link className="career-major-col-more" to={`/kham-pha-truong/nganh/${major.id}`}>
                    <span>Chi tiết ngành</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </footer>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};
