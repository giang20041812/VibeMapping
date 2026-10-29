import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Download, Trash2, Upload, UserPlus } from 'lucide-react';
import { Alert, Badge, Button, Card, DataTable } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterSearch } from '../../../components/filters/FilterSearch/FilterSearch';
import { useDebounce } from '../../../hooks/useDebounce';
import { useAuth } from '../../auth/AuthContext';
import { qrDataUrl } from '../../invitation_link/invitation.service';
import { ClassGradeTable } from '../../class_assessment_grid/components/ClassGradeTable';
import { getClassGrid } from '../../class_assessment_grid/class_assessment_grid.service';
import type { GridData } from '../../class_assessment_grid/class_assessment_grid.types';
import { MEMBER_ROLE_LABEL, STAFF_ERROR_TEXT } from '../class_management.constants';
import {
  assignClassTeacher,
  getClass,
  getClassOverview,
  getClassReport,
  removeClassMember,
} from '../class_management.service';
import type { ClassMember, ClassReport, ClassRow } from '../class_management.types';
import { ClassReportCard } from '../components/ClassReportCard';
import { EmailRoleModal } from '../components/EmailRoleModal';
import { RosterImportModal } from '../components/RosterImportModal';
import { downloadClassReport } from '../roster.logic';
import '../../../components/filters/filterControls.css';
import '../ClassManagement.css';

const TEACHER_ROLE_OPTIONS = [
  { value: 'homeroom_teacher', label: 'Giáo viên chủ nhiệm' },
  { value: 'subject_teacher', label: 'Giáo viên bộ môn' },
];

function joinLink(classCode: string): string {
  return `${window.location.origin}/lop-hoc?ma=${encodeURIComponent(classCode)}`;
}

export const ClassDetailPage: React.FC = () => {
  const { classId = '' } = useParams();
  const { profile } = useAuth();
  const [keyword, setKeyword] = useState('');
  const appliedKeyword = useDebounce(keyword, 300);
  const [classRow, setClassRow] = useState<ClassRow | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportLoading, setIsReportLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTeacherOpen, setIsTeacherOpen] = useState(false);
  const [grid, setGrid] = useState<GridData | null>(null);
  const [gridKey, setGridKey] = useState(0);
  /** Tải lại riêng bảng điểm (sau khi đổi gói câu hỏi) */
  const [gridReloadKey, setGridReloadKey] = useState(0);

  const isTeacher = profile?.role === 'teacher';

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([getClass(classId), getClassOverview(classId)])
      .then(([row, list]) => {
        if (!active) return;
        setClassRow(row);
        setMembers(list);
        setError(row ? null : 'Không tìm thấy lớp.');
      })
      .catch(() => active && setError('Không tải được thông tin lớp.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [classId, reloadKey]);

  useEffect(() => {
    let active = true;
    setIsReportLoading(true);
    getClassReport(classId)
      .then((value) => active && setReport(value))
      .catch(() => active && setReportError('Không tải được báo cáo lớp.'))
      .finally(() => active && setIsReportLoading(false));
    return () => {
      active = false;
    };
  }, [classId, reloadKey]);

  // Chỉ giáo viên của lớp mở được bảng điểm; không mở được thì giữ danh sách thành viên
  useEffect(() => {
    if (!isTeacher) {
      setGrid(null);
      return;
    }
    let active = true;
    getClassGrid(classId)
      .then((gridData) => {
        if (!active) return;
        setGrid(gridData);
        setGridKey((value) => value + 1);
      })
      .catch(() => active && setGrid(null));
    return () => {
      active = false;
    };
  }, [classId, isTeacher, reloadKey, gridReloadKey]);

  useEffect(() => {
    if (!classRow) return;
    let active = true;
    qrDataUrl(joinLink(classRow.class_code))
      .then((url) => active && setQrUrl(url))
      .catch(() => active && setQrUrl(null));
    return () => {
      active = false;
    };
  }, [classRow]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  const handleRemove = useCallback(
    async (member: ClassMember) => {
      if (!window.confirm(`Xóa ${member.full_name || 'thành viên này'} khỏi lớp?`)) return;
      try {
        await removeClassMember(member.member_id);
        reload();
      } catch {
        setError('Không xóa được thành viên. Thử lại sau.');
      }
    },
    [reload],
  );

  const handleCopy = async () => {
    if (!classRow) return;
    try {
      await navigator.clipboard.writeText(classRow.class_code);
      setNotice('Đã sao chép mã lớp.');
    } catch {
      setNotice(null);
    }
  };

  const rows = useMemo(() => {
    const text = appliedKeyword.trim().toLowerCase();
    if (!text) return members;
    return members.filter((member) => `${member.full_name} ${member.student_code ?? ''}`.toLowerCase().includes(text));
  }, [members, appliedKeyword]);

  const columns = useMemo<DataTableColumn<ClassMember>[]>(
    () => [
      { key: 'student_code', header: 'Mã học sinh', nowrap: true, render: (row) => row.student_code ?? '—' },
      { key: 'full_name', header: 'Họ và tên', render: (row) => row.full_name || '—' },
      { key: 'member_role', header: 'Vai trò', nowrap: true, render: (row) => MEMBER_ROLE_LABEL[row.member_role] },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (row) =>
          row.member_role !== 'student' ? (
            <Badge variant="success">Đã tham gia</Badge>
          ) : (
            <div className="admin-badge-list">
              <Badge variant={row.status === 'joined' ? 'success' : 'default'}>
                {row.status === 'joined' ? 'Đã tham gia' : 'Chưa tham gia'}
              </Badge>
              {row.has_result && <Badge variant="info">Đã làm bài</Badge>}
              {row.is_graded && <Badge variant="info">Đã được chấm</Badge>}
              {row.guardian_pending && <Badge variant="warning">Chờ người giám hộ</Badge>}
            </div>
          ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        nowrap: true,
        render: (row) => (
          <Button type="button" size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => void handleRemove(row)}>
            Xóa
          </Button>
        ),
      },
    ],
    [handleRemove],
  );

  const students = members.filter((member) => member.member_role === 'student');
  const gradeRows = useMemo(() => rows.filter((member) => member.member_role === 'student'), [rows]);
  const showGrid = !isLoading && grid !== null;

  return (
    <>
      <div className="class-page-header">
        <h1 className="page-title">{classRow ? `Lớp ${classRow.class_name}` : 'Lớp học'}</h1>
      </div>

      {(error || notice) && (
        <div className="class-alert-slot">
          {error && <Alert variant="danger">{error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
        </div>
      )}

      <div className="class-stack">
        <div className="class-toolbar">
          <div className="class-toolbar-main">
            <div className="class-header-actions">
              <Button type="button" variant="outline" leftIcon={<UserPlus size={16} />} onClick={() => setIsTeacherOpen(true)}>
                Gán giáo viên
              </Button>
              <Button type="button" variant="outline" leftIcon={<Upload size={16} />} onClick={() => setIsImportOpen(true)}>
                Nhập danh sách
              </Button>
              <Button
                type="button"
                variant="outline"
                leftIcon={<Download size={16} />}
                onClick={() => void downloadClassReport(classRow?.class_name ?? 'lop', members, report, 'all').catch(() => setError('Không xuất được báo cáo. Thử lại sau.'))}
              >
                Xuất báo cáo
              </Button>
            </div>
            <div className="class-toolbar-search">
              <FilterSearch placeholder="Họ tên hoặc mã học sinh" value={keyword} onChange={setKeyword} />
            </div>
          </div>

          {classRow && (
            <Card className="class-info-card" title="Thông tin lớp">
              <div className="class-qr-row">
                {qrUrl && <img className="class-qr" src={qrUrl} alt="Mã QR tham gia lớp" />}
                <div className="class-meta">
                  <div className="class-meta-item">
                    <span className="class-meta-label">Mã lớp</span>
                    <span className="class-meta-value class-code">{classRow.class_code}</span>
                  </div>
                  <div className="class-meta-item">
                    <span className="class-meta-label">Khối</span>
                    <span className="class-meta-value">{classRow.grade ?? '—'}</span>
                  </div>
                  <div className="class-meta-item">
                    <span className="class-meta-label">Năm học</span>
                    <span className="class-meta-value">{classRow.school_year}</span>
                  </div>
                  <div className="class-meta-item">
                    <span className="class-meta-label">Học sinh</span>
                    <span className="class-meta-value">
                      {students.filter((student) => student.status === 'joined').length}/{students.length}
                    </span>
                  </div>
                </div>
                <Button type="button" variant="outline" leftIcon={<Copy size={16} />} onClick={() => void handleCopy()}>
                  Sao chép mã
                </Button>
              </div>
            </Card>
          )}
        </div>

        {showGrid ? (
          <ClassGradeTable
            key={gridKey}
            members={gradeRows}
            allMembers={students}
            initialGrid={grid}
            onRemove={(member) => void handleRemove(member)}
            onSubmitted={reload}
            onPackageChanged={() => setGridReloadKey((value) => value + 1)}
            onError={setError}
            onNotice={setNotice}
          />
        ) : (
          <Card noPadding title="Thành viên">
            <DataTable columns={columns} rows={rows} rowKey={(row) => row.member_id} isLoading={isLoading} emptyText="Lớp chưa có thành viên" caption="Thành viên lớp" />
          </Card>
        )}

        <ClassReportCard title="Báo cáo lớp" report={report} isLoading={isReportLoading} error={reportError} />
      </div>

      <RosterImportModal
        open={isImportOpen}
        classId={classId}
        onClose={() => setIsImportOpen(false)}
        onImported={reload}
      />
      <EmailRoleModal
        open={isTeacherOpen}
        title="Gán giáo viên vào lớp"
        roleLabel="Vai trò trong lớp"
        roleOptions={TEACHER_ROLE_OPTIONS}
        onSubmit={async (email, role) => {
          const result = await assignClassTeacher(classId, email, role as 'homeroom_teacher' | 'subject_teacher');
          return result.ok ? null : (STAFF_ERROR_TEXT[result.reason ?? ''] ?? 'Không gán được giáo viên.');
        }}
        onClose={() => setIsTeacherOpen(false)}
        onSaved={() => {
          setIsTeacherOpen(false);
          reload();
        }}
      />
    </>
  );
};
