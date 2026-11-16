import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Clock, Users, Wallet } from 'lucide-react';
import { Badge, Skeleton, Tabs } from '../../../components/common';
import {
  BENEFIT_TIER_LABEL,
  FRAMEWORK_SECTION_LABEL,
  FRAMEWORK_TIER_LABEL,
  FRAMEWORK_TIER_VARIANT,
  REQUIREMENT_SECTIONS,
  formatSalaryRange,
  salarySpan,
} from '../careerLevelFramework.constants';
import { listPublishedLevelFrameworks } from '../careerLevelFramework.service';
import type { CareerLevelFramework, CareerLevelFrameworkItem, CareerMoveTarget, FrameworkSection, FrameworkTier } from '../careerLevelFramework.types';
import './CareerLevelLadder.css';

interface Props {
  careerId: string;
  /** Đường dẫn trang nghề đích: trang công khai hoặc trang của người đã đăng nhập */
  careerLinkBase: string;
  onLoaded?: (hasFrameworks: boolean) => void;
}

const DETAIL_TABS = [
  { value: 'work', label: 'Công việc' },
  { value: 'requirements', label: 'Yêu cầu' },
  { value: 'income', label: 'Thu nhập' },
  { value: 'competency', label: 'Năng lực' },
  { value: 'growth', label: 'Phát triển' },
];

const TIER_ORDER: Record<FrameworkTier, number> = { required: 0, common: 1, advantage: 2 };
const byTier = (a: CareerLevelFrameworkItem, b: CareerLevelFrameworkItem) =>
  (a.tier ? TIER_ORDER[a.tier] : 3) - (b.tier ? TIER_ORDER[b.tier] : 3) || a.sort_order - b.sort_order;

const pick = (fw: CareerLevelFramework, section: FrameworkSection) => fw.items.filter((item) => item.section === section);
const lines = (text: string | null) => (text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

const TierBadge: React.FC<{ tier: FrameworkTier | null; labels?: Record<FrameworkTier, string> }> = ({ tier, labels = FRAMEWORK_TIER_LABEL }) =>
  tier ? <Badge size="sm" variant={FRAMEWORK_TIER_VARIANT[tier]}>{labels[tier]}</Badge> : null;

/** Thang bậc của nghề và khung JD của từng bậc */
export const CareerLevelLadder: React.FC<Props> = ({ careerId, careerLinkBase, onLoaded }) => {
  const [frameworks, setFrameworks] = useState<CareerLevelFramework[] | null>(null);
  const [targets, setTargets] = useState<CareerMoveTarget[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState('work');

  useEffect(() => {
    let active = true;
    setFrameworks(null);
    listPublishedLevelFrameworks(careerId)
      .then((result) => {
        if (!active) return;
        setFrameworks(result.frameworks);
        setTargets(result.targets);
        setSelected(result.frameworks[0]?.career_level ?? null);
        onLoaded?.(result.frameworks.length > 0);
      })
      .catch(() => {
        if (!active) return;
        setFrameworks([]);
        onLoaded?.(false);
      });
    return () => {
      active = false;
    };
  }, [careerId, onLoaded]);

  const targetName = useMemo(() => new Map(targets.map((t) => [t.id, t.career_name])), [targets]);

  if (frameworks === null) return <Skeleton shape="block" />;
  if (frameworks.length === 0) return null;

  const index = frameworks.findIndex((fw) => fw.career_level === selected);
  const fw = frameworks[Math.max(index, 0)];
  const next = frameworks[Math.max(index, 0) + 1];
  const salaries = pick(fw, 'salary');
  const requirementSections = REQUIREMENT_SECTIONS.filter((section) => pick(fw, section).length > 0);

  return (
    <section className="career-block level-ladder">
      <h2>Cấp bậc</h2>

      <ol className="level-steps" aria-label="Các bậc của nghề">
        {frameworks.map((step) => {
          const isActive = step.career_level === fw.career_level;
          const span = salarySpan(step.items);
          return (
            <li key={step.id}>
              <button type="button" className={`level-step ${isActive ? 'is-active' : ''}`} aria-pressed={isActive}
                onClick={() => setSelected(step.career_level)}>
                <span className="level-step-name">{step.level_name}</span>
                {step.experience_text && <span className="level-step-meta">{step.experience_text}</span>}
                {span && <span className="level-step-salary">{span}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="level-detail">
        {fw.career_summary && <p className="level-summary">{fw.career_summary}</p>}

        <dl className="level-facts">
          {fw.experience_text && (
            <div><dt><Clock size={16} aria-hidden="true" />Kinh nghiệm</dt><dd>{fw.experience_text}</dd></div>
          )}
          {salarySpan(fw.items) && (
            <div><dt><Wallet size={16} aria-hidden="true" />Thu nhập</dt><dd>{salarySpan(fw.items)} / tháng</dd></div>
          )}
          {fw.reports_to && (
            <div><dt><Users size={16} aria-hidden="true" />Báo cáo cho</dt><dd>{fw.reports_to}</dd></div>
          )}
          {fw.work_mode && (
            <div><dt><Briefcase size={16} aria-hidden="true" />Hình thức</dt><dd>{fw.work_mode}</dd></div>
          )}
        </dl>

        <Tabs label="Nội dung bậc" items={DETAIL_TABS} value={tab} onChange={setTab} />

        {tab === 'work' && (
          <div className="level-panel">
            {lines(fw.position_objectives).length > 0 && (
              <div className="level-group">
                <h3>Mục tiêu</h3>
                <ul className="level-list">{lines(fw.position_objectives).map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
            )}
            {pick(fw, 'task').length > 0 && (
              <div className="level-group">
                <h3>{FRAMEWORK_SECTION_LABEL.task}</h3>
                <ul className="level-tasks">
                  {pick(fw, 'task').sort(byTier).map((item) => (
                    <li key={item.id}>
                      <div className="level-task-head">
                        {item.group_label && <strong>{item.group_label}</strong>}
                        <TierBadge tier={item.tier} />
                      </div>
                      <p>{item.content}</p>
                      {item.detail && <p className="level-sub">{item.detail}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pick(fw, 'output').length > 0 && (
              <div className="level-group">
                <h3>{FRAMEWORK_SECTION_LABEL.output}</h3>
                <ul className="level-list">{pick(fw, 'output').map((item) => <li key={item.id}>{item.content}</li>)}</ul>
              </div>
            )}
            {pick(fw, 'stakeholder').length > 0 && (
              <div className="level-group">
                <h3>{FRAMEWORK_SECTION_LABEL.stakeholder}</h3>
                <ul className="level-pairs">
                  {pick(fw, 'stakeholder').map((item) => (
                    <li key={item.id}>
                      <strong>{item.group_label ?? item.content}</strong>
                      <span>{item.group_label ? item.content : ''}{item.detail ? `${item.group_label ? ' — ' : ''}${item.detail}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'requirements' && (
          <div className="level-panel">
            <div className="level-req-grid">
              {requirementSections.map((section) => (
                <div key={section} className="level-req">
                  <h3>{FRAMEWORK_SECTION_LABEL[section]}</h3>
                  <ul>
                    {pick(fw, section).sort(byTier).map((item) => (
                      <li key={item.id} className={item.tier ? `tier-${item.tier}` : ''}>
                        <span>{item.content}</span>
                        <TierBadge tier={item.tier} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {pick(fw, 'industry_variant').length + pick(fw, 'company_variant').length > 0 && (
              <div className="level-group">
                <h3>Khác nhau theo ngành và loại công ty</h3>
                <ul className="level-variants">
                  {[...pick(fw, 'industry_variant'), ...pick(fw, 'company_variant')].map((item) => (
                    <li key={item.id}>
                      <strong>{item.group_label}</strong>
                      <p>{item.content}</p>
                      {item.detail && <p className="level-sub">{item.detail}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'income' && (
          <div className="level-panel">
            {salaries.length > 0 && (
              <div className="level-group">
                <h3>{FRAMEWORK_SECTION_LABEL.salary}</h3>
                <ul className="level-salaries">
                  {salaries.map((item) => (
                    <li key={item.id}>
                      <span className="level-salary-group">{item.group_label ?? item.content}</span>
                      <b>{formatSalaryRange(item.salary_min, item.salary_max) || item.note || '—'}</b>
                      {item.detail && <span className="level-sub">Thực nhận {item.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pick(fw, 'benefit').length > 0 && (
              <div className="level-group">
                <h3>{FRAMEWORK_SECTION_LABEL.benefit}</h3>
                <ul className="level-list">
                  {pick(fw, 'benefit').sort(byTier).map((item) => (
                    <li key={item.id}><TierBadge tier={item.tier} labels={BENEFIT_TIER_LABEL} /> {item.content}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'competency' && (
          <div className="level-panel">
            <ul className="level-competencies">
              {pick(fw, 'competency').map((item) => (
                <li key={item.id}>
                  {item.group_label && <strong>{item.group_label}</strong>}
                  <p>{item.content}</p>
                  {item.detail && item.detail !== item.content && <p className="level-sub">{item.detail}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'growth' && (
          <div className="level-panel">
            {next && (
              <button type="button" className="level-next" onClick={() => setSelected(next.career_level)}>
                <span>{next.level_name}</span>
                {next.experience_text && <span className="level-sub">{next.experience_text}</span>}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            )}
            <ul className="level-moves">
              {pick(fw, 'career_move').map((item) => {
                const target = item.target_career_id && item.target_career_id !== careerId ? targetName.get(item.target_career_id) : undefined;
                return (
                  <li key={item.id}>
                    {item.group_label && <strong>{item.group_label}</strong>}
                    <p>{item.content}</p>
                    {target && (
                      <Link className="level-move-link" to={`${careerLinkBase}/${item.target_career_id}`}>
                        <span>{target}</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
