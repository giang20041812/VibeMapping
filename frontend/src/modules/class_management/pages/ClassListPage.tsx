import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, Plus, UserPlus } from 'lucide-react';
import { Alert, Button, Card, DataTable, Input } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { useAdminFilter } from '../../admin/useAdminFilter';
import { useAuth } from '../../auth/AuthContext';
import { JOIN_ERROR_TEXT, STAFF_ERROR_TEXT } from '../class_management.constants';
import {
  addSchoolStaff,
  findMyMemberId,
  joinClassByCode,
  leaveClass,
  listClasses,
  listJoinedClasses,
  listSchools,
} from '../class_management.service';
import type { ClassRow, JoinedClass, School } from '../class_management.types';
import { ClassFormModal } from '../components/ClassFormModal';
import { EmailRoleModal } from '../components/EmailRoleModal';
import '../ClassManagement.css';

const EMPTY_FILTER = { keyword: '' };
const TEACHER_ONLY_OPTION = [{ value: 'teacher', label: 'Giáo viên' }];

const StudentClasses: React.FC<{ userId: string }> = ({ userId }) => {
  const [classes, setClasses] = useState<JoinedClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [classCode, setClassCode] = useState(searchParams.get('ma') ?? '');
  const [studentCode, setStudentCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listJoinedClasses(userId)
      .then((list) => active && setClasses(list))
      .catch(() => active && setError('Không tải được danh sách lớp.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!classCode.trim()) return;
    setIsJoining(true);
    setError(null);
    setNotice(null);
    try {
      const result = await joinClassByCode(classCode, studentCode);
      if (result.ok) {
        setNotice(`Đã tham gia lớp ${result.class_name ?? ''}.`);
        setClassCode('');
        setStudentCode('');
        setReloadKey((value) => value + 1);
      } else {
        setError(JOIN_ERROR_TEXT[result.reason ?? ''] ?? 'Không tham gia được lớp.');
      }
    } catch {
      setError('Không tham gia được lớp. Thử lại sau.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = useCallback(
    async (row: JoinedClass) => {
      if (!window.confirm(`Rời lớp ${row.class_name}?`)) return;
      try {
        const memberId = await findMyMemberId(row.id, userId);
        if (memberId) await leaveClass(memberId);
        setReloadKey((value) => value + 1);
      } catch {
        setError('Không rời được lớp. Thử lại sau.');
      }
    },
    [userId],
  );

  const columns = useMemo<DataTableColumn<JoinedClass>[]>(
    () => [
      { key: 'class_name', header: 'Tên lớp', render: (row) => row.class_name },
      { key: 'grade', header: 'Khối', align: 'center', nowrap: true, render: (row) => row.grade ?? '—' },
      { key: 'school_year', header: 'Năm học', nowrap: true, render: (row) => row.school_year },
      {
        key: 'actions',
        header: '',
        align: 'right',
        nowrap: true,
        render: (row) => (
          <Button type="button" size="sm" variant="outline" leftIcon={<LogOut size={14} />} onClick={() => void handleLeave(row)}>
            Rời lớp
          </Button>
        ),
      },
    ],
    [handleLeave],
  );

  return (
    <>
      <div className="class-page-header">
        <h1 className="page-title">Lớp học</h1>
      </div>
      {(error || notice) && (
        <div className="class-alert-slot">
          {error && <Alert variant="danger">{error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
        </div>
      )}
      <div className="class-stack">
        <Card title="Tham gia lớp">
          <form className="class-join-form" onSubmit={handleJoin}>
            <Input label="Mã lớp" value={classCode} onChange={(event) => setClassCode(event.target.value)} required />
            <Input label="Mã học sinh" value={studentCode} onChange={(event) => setStudentCode(event.target.value)} />
            <Button type="submit" isLoading={isJoining} disabled={!classCode.trim()}>
              Tham gia
            </Button>
          </form>
        </Card>
        <Card noPadding>
          <DataTable columns={columns} rows={classes} rowKey={(row) => row.id} isLoading={isLoading} emptyText="Chưa tham gia lớp nào" caption="Lớp đã tham gia" />
        </Card>
      </div>
    </>
  );
};

const StaffClasses: React.FC<{ isSchoolAdmin: boolean }> = ({ isSchoolAdmin }) => {
  const navigate = useNavigate();
  const { draft, applied, patch, reset } = useAdminFilter(EMPTY_FILTER);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isStaffOpen, setIsStaffOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listClasses(), listSchools()])
      .then(([classList, schoolList]) => {
        if (!active) return;
        setClasses(classList);
        setSchools(schoolList);
      })
      .catch(() => active && setError('Không tải được danh sách lớp.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const hasNoSchool = !isLoading && !error && schools.length === 0;
  const schoolName = useMemo(() => new Map(schools.map((school) => [school.id, school.school_name])), [schools]);

  const rows = useMemo(() => {
    const keyword = applied.keyword.trim().toLowerCase();
    if (!keyword) return classes;
    return classes.filter((item) => `${item.class_name} ${item.school_year}`.toLowerCase().includes(keyword));
  }, [classes, applied.keyword]);

  const columns = useMemo<DataTableColumn<ClassRow>[]>(
    () => [
      { key: 'class_name', header: 'Tên lớp', render: (row) => row.class_name },
      { key: 'grade', header: 'Khối', align: 'center', nowrap: true, render: (row) => row.grade ?? '—' },
      { key: 'school_year', header: 'Năm học', nowrap: true, render: (row) => row.school_year },
      { key: 'class_code', header: 'Mã lớp', nowrap: true, render: (row) => <span className="class-code">{row.class_code}</span> },
      ...(schools.length > 1
        ? [{ key: 'school', header: 'Trường', render: (row: ClassRow) => schoolName.get(row.school_id) ?? '—' }]
        : []),
    ],
    [schools.length, schoolName],
  );

  return (
    <>
      <div className="class-page-header">
        <h1 className="page-title">Lớp học</h1>
        <div className="class-header-actions">
          {isSchoolAdmin && (
            <Button type="button" variant="outline" leftIcon={<UserPlus size={16} />} onClick={() => setIsStaffOpen(true)}>
              Thêm giáo viên
            </Button>
          )}
          <Button type="button" leftIcon={<Plus size={16} />} onClick={() => setIsFormOpen(true)} disabled={schools.length === 0}>
            Tạo lớp
          </Button>
        </div>
      </div>
      {(error || notice || hasNoSchool) && (
        <div className="class-alert-slot">
          {error && <Alert variant="danger">{error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
          {hasNoSchool && <Alert variant="warning">Tài khoản chưa thuộc trường nào. Nhờ quản trị trường thêm bạn vào trường.</Alert>}
        </div>
      )}
      <div className="class-stack">
        <FilterBar onReset={reset} totalResults={rows.length}>
          <Input
            aria-label="Tìm lớp"
            placeholder="Tìm theo tên lớp"
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </FilterBar>
        <Card noPadding>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            emptyText="Chưa có lớp"
            caption="Danh sách lớp"
            onRowClick={(row) => navigate(`/lop-hoc/${row.id}`)}
          />
        </Card>
      </div>

      <ClassFormModal
        open={isFormOpen}
        schools={schools}
        onClose={() => setIsFormOpen(false)}
        onSaved={(classId) => navigate(`/lop-hoc/${classId}`)}
      />
      <EmailRoleModal
        open={isStaffOpen}
        title="Thêm giáo viên vào trường"
        roleLabel="Vai trò"
        roleOptions={TEACHER_ONLY_OPTION}
        onSubmit={async (email) => {
          const schoolId = schools[0]?.id;
          if (!schoolId) return 'Chưa có trường.';
          const result = await addSchoolStaff(schoolId, email, 'teacher');
          return result.ok ? null : (STAFF_ERROR_TEXT[result.reason ?? ''] ?? 'Không thêm được giáo viên.');
        }}
        onClose={() => setIsStaffOpen(false)}
        onSaved={() => {
          setIsStaffOpen(false);
          setNotice('Đã thêm giáo viên vào trường.');
        }}
      />
    </>
  );
};

export const ClassListPage: React.FC = () => {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role === 'teacher' || profile.role === 'school_admin' || profile.role === 'system_admin') {
    return <StaffClasses isSchoolAdmin={profile.role === 'school_admin'} />;
  }
  return <StudentClasses userId={profile.id} />;
};
