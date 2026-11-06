import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Alert, Badge, Button, Card, Spinner } from '../../../components/common';
import { addProgramToDecisionCompare } from '../compareProgram';
import { INSTITUTION_TYPE_LABEL, OWNERSHIP_LABEL } from '../school_explorer.constants';
import { formatTuition, loadCareerMap, loadInstitution, loadMajor, loadProgram, programVariant, type ProgramSummary } from '../education.service';
import '../../career_explorer/pages/CareerPages.css';
import './EducationDetailPages.css';

const RESEARCH_LABEL: Record<string, string> = {
  verified: 'Đã xác minh',
  partially_verified: 'Xác minh một phần',
  supplemented: 'Đã bổ sung',
  needs_supplement: 'Cần bổ sung',
  unverified: 'Chưa xác minh',
};

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(null);
    load().then((value) => active && setData(value)).catch(() => active && setError('Không tải được dữ liệu.'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

const ProgramList: React.FC<{ programs: ProgramSummary[]; show: 'institution' | 'major'; careerId?: string }> = ({ programs, show, careerId }) => {
  const [notice, setNotice] = useState<string | null>(null);
  if (programs.length === 0) return <p>Đang cập nhật chương trình đào tạo.</p>;
  return (
    <>
      {notice && <Alert variant="info">{notice}</Alert>}
      <ul className="module-list">
        {programs.map((p) => (
          <li key={p.id}>
            <Link to={`/kham-pha-truong/chuong-trinh/${p.id}`}>{show === 'institution' ? p.institutionName : p.majorName}</Link>
            {programVariant(p) && <span>{programVariant(p)}</span>}
            {p.programType && <span>{p.programType}</span>}
            {show === 'institution' && p.city && <span>{p.city}</span>}
            <span>{formatTuition(p)}</span>
            <Badge variant={p.researchStatus === 'verified' ? 'success' : 'default'}>{RESEARCH_LABEL[p.researchStatus] ?? p.researchStatus}</Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const next = addProgramToDecisionCompare(p, { careerId });
                setNotice(next.message ?? `Đã thêm. Mở so sánh phương án khi đủ 2 chương trình (${next.items.length}/4).`);
              }}
            >
              Thêm vào so sánh
            </Button>
          </li>
        ))}
      </ul>
      <p className="explain-note"><Link to="/so-sanh">Mở so sánh phương án</Link></p>
    </>
  );
};

export const InstitutionDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { data, error } = useLoad(() => loadInstitution(id), [id]);
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  if (!data.institution) return <Alert variant="info">Không tìm thấy trường.</Alert>;
  const inst = data.institution;
  return (
    <div className="module-page">
      <p><Link to="/kham-pha-truong">Danh sách trường</Link></p>
      <h1>{inst.institution_name}</h1>
      <Card title="Thông tin trường">
        <div className="module-actions">
          <Badge variant="info">{INSTITUTION_TYPE_LABEL[inst.institution_type as keyof typeof INSTITUTION_TYPE_LABEL] ?? inst.institution_type}</Badge>
          {inst.ownership && <Badge>{OWNERSHIP_LABEL[inst.ownership as keyof typeof OWNERSHIP_LABEL] ?? inst.ownership}</Badge>}
        </div>
        <p>{[inst.address, inst.city].filter(Boolean).join(', ') || 'Địa chỉ đang cập nhật'}</p>
        {inst.website_url && (
          <a href={inst.website_url} target="_blank" rel="noopener noreferrer">Website <ExternalLink size={14} aria-hidden="true" /></a>
        )}
      </Card>
      <Card title={`Chương trình đào tạo (${data.programs.length})`}>
        <ProgramList programs={data.programs} show="major" />
      </Card>
    </div>
  );
};

export const MajorDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { data, error } = useLoad(() => loadMajor(id), [id]);
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  if (!data.major) return <Alert variant="info">Không tìm thấy ngành.</Alert>;
  return (
    <div className="module-page">
      <h1>Ngành {data.major.major_name}</h1>
      <Card title="Nghề liên quan">
        {data.careers.length === 0 ? <p>Đang cập nhật liên kết nghề.</p> : (
          <ul className="module-list">
            {data.careers.map((c) => (
              <li key={c.id}><Link to={`/nghe/${c.id}`}>{c.name}</Link><Badge>{c.level === 'direct' ? 'Trực tiếp' : 'Gián tiếp'}</Badge></li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Trường đào tạo (${data.programs.length})`}>
        <ProgramList programs={data.programs} show="institution" />
      </Card>
    </div>
  );
};

export const ProgramDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { data, error } = useLoad(() => loadProgram(id), [id]);
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (data === undefined) return <Spinner />;
  if (data === null) return <Alert variant="info">Không tìm thấy chương trình.</Alert>;
  const p = data.program;
  return (
    <div className="module-page">
      <p>
        <Link to={`/kham-pha-truong/truong/${p.institutionId}`}>{p.institutionName}</Link> ·{' '}
        <Link to={`/kham-pha-truong/nganh/${p.majorId}`}>Ngành {p.majorName}</Link>
      </p>
      <h1>{p.majorName}{p.specialization ? ` – ${p.specialization}` : ''}</h1>
      <Card title="Chương trình">
        <ul className="module-list">
          <li><span>Hệ đào tạo</span><span>{p.programType ?? 'Đang cập nhật'}</span></li>
          <li><span>Khoa</span><span>{data.faculty ?? 'Đang cập nhật'}</span></li>
          <li><span>Thời gian</span><span>{data.studyYears ? `${data.studyYears} năm` : 'Đang cập nhật'}</span></li>
          <li><span>Học phí</span><span>{formatTuition(p)}</span></li>
          <li><span>Trạng thái dữ liệu</span><Badge>{RESEARCH_LABEL[p.researchStatus] ?? p.researchStatus}</Badge></li>
        </ul>
        {data.summary && <p>{data.summary}</p>}
        {data.url && <a href={data.url} target="_blank" rel="noopener noreferrer">Trang chương trình <ExternalLink size={14} aria-hidden="true" /></a>}
        {data.source && <p className="explain-note">Nguồn: {data.source}</p>}
        <AddProgramButton program={p} admission={data.admissions} />
      </Card>
      <Card title="Tuyển sinh và điểm chuẩn lịch sử">
        {data.admissions.length === 0 ? (
          <Alert variant="info">Đang cập nhật dữ liệu tuyển sinh. Bộ dữ liệu nghiên cứu hiện có chưa gồm điểm chuẩn và chỉ tiêu.</Alert>
        ) : (
          <div className="explain-table-wrap">
            <table className="explain-table">
              <thead><tr><th>Năm</th><th>Phương thức</th><th>Tổ hợp</th><th>Chỉ tiêu</th><th>Điểm chuẩn</th><th>Ngưỡng đăng ký</th><th>Nguồn</th></tr></thead>
              <tbody>
                {data.admissions.map((a, index) => (
                  <tr key={`${a.year}-${a.method}-${index}`}>
                    <td>{a.year}</td><td>{a.method}</td><td>{a.subjectCombination ?? '–'}</td><td>{a.quota ?? '–'}</td>
                    <td>{a.cutoffScore ?? '–'}</td><td>{a.minimumScore ?? '–'}</td>
                    <td>{a.sourceUrl ? <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer">Xem</a> : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="explain-note">Điểm chuẩn lịch sử chỉ để tham khảo, không cam kết trúng tuyển.</p>
      </Card>
    </div>
  );
};

type MapPick =
  | { kind: 'career'; name: string }
  | { kind: 'major'; id: string; name: string; verified: boolean }
  | { kind: 'program'; program: ProgramSummary };

/** F05.02: bản đồ liên kết; click node xem card tại chỗ; màn hẹp xếp danh mục */
export const CareerEducationMapPage: React.FC = () => {
  const { careerId = '' } = useParams();
  const { data, error } = useLoad(() => loadCareerMap(careerId), [careerId]);
  const [pick, setPick] = useState<MapPick | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  if (!data.career) return <Alert variant="info">Không tìm thấy nghề hoặc nghề chưa được công bố.</Alert>;
  return (
    <div className="module-page">
      <p><Link to={`/nghe/${careerId}`}>Quay lại nghề</Link></p>
      <h1>Bản đồ Liên kết Trực quan: Nghề – Ngành – Trường</h1>
      {notice && <Alert variant="info">{notice}</Alert>}
      <div className="edu-map">
        <button type="button" className="edu-map-node edu-map-career" onClick={() => setPick({ kind: 'career', name: data.career!.career_name })}>
          {data.career.career_name}
        </button>
        {data.majors.length === 0 && <Alert variant="info">Đang cập nhật ngành đào tạo cho nghề này.</Alert>}
        <ul className="edu-map-majors">
          {data.majors.map((m) => (
            <li key={m.id}>
              <button type="button" className="edu-map-node edu-map-major" onClick={() => setPick({ kind: 'major', id: m.id, name: m.name, verified: m.verified })}>
                {m.name} {!m.verified && <Badge>Chưa xác minh</Badge>}
              </button>
              {m.programs.length === 0 ? <p className="explain-note">Đang cập nhật trường đào tạo.</p> : (
                <ul className="edu-map-schools">
                  {m.programs.slice(0, 12).map((p) => (
                    <li key={p.id}>
                      <button type="button" className="edu-map-node edu-map-school" onClick={() => setPick({ kind: 'program', program: p })}>
                        {p.institutionName}
                      </button>
                    </li>
                  ))}
                  {m.programs.length > 12 && <li><Link to={`/kham-pha-truong/nganh/${m.id}`}>Xem thêm {m.programs.length - 12} trường</Link></li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      {pick && (
        <Card title={pick.kind === 'career' ? pick.name : pick.kind === 'major' ? pick.name : pick.program.institutionName}>
          {pick.kind === 'career' && (
            <p><Link to={`/nghe/${careerId}`}>Mở trang nghề</Link></p>
          )}
          {pick.kind === 'major' && (
            <p>
              {pick.verified ? 'Liên kết đã xác minh.' : 'Chưa xác minh.'}{' '}
              <Link to={`/kham-pha-truong/nganh/${pick.id}`}>Mở trang ngành</Link>
            </p>
          )}
          {pick.kind === 'program' && (
            <>
              <p>{pick.program.majorName} · {formatTuition(pick.program)}</p>
              <div className="module-actions">
                <Link to={`/kham-pha-truong/chuong-trinh/${pick.program.id}`}>Mở chương trình</Link>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const next = addProgramToDecisionCompare(pick.program, { careerId });
                    setNotice(next.message ?? 'Đã thêm vào so sánh phương án.');
                  }}
                >
                  Thêm vào so sánh
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
};

const AddProgramButton: React.FC<{ program: ProgramSummary; admission?: import('../education.service').AdmissionRow[] }> = ({ program, admission }) => {
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="module-actions">
      <Button
        type="button"
        onClick={() => {
          const next = addProgramToDecisionCompare(program, { admission });
          setText(next.message ?? 'Đã thêm. Mở So sánh phương án để xếp hạng.');
        }}
      >
        Thêm vào so sánh
      </Button>
      <Link to="/so-sanh">Mở so sánh phương án</Link>
      {text && <span className="explain-note">{text}</span>}
    </div>
  );
};
