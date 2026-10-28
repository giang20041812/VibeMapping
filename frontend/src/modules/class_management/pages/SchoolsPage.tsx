import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { Alert, Button, DataTable, Card, Input, Modal, Pagination } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { ADMIN_PAGE_SIZE } from '../../admin/admin.constants';
import { useAdminFilter } from '../../admin/useAdminFilter';
import { STAFF_ERROR_TEXT } from '../class_management.constants';
import { addSchoolStaff, getSchoolReport, listSchools } from '../class_management.service';
import type { ClassReport, School } from '../class_management.types';
import { ClassReportCard } from '../components/ClassReportCard';
import { EmailRoleModal } from '../components/EmailRoleModal';
import { SchoolFormModal } from '../components/SchoolFormModal';
import '../ClassManagement.css';

const EMPTY_FILTER = { keyword: '' };
const STAFF_ROLE_OPTIONS = [
  { value: 'school_admin', label: 'Quản trị trường' },
  { value: 'teacher', label: 'Giáo viên' },
];

export const SchoolsPage: React.FC = () => {
  const { draft, applied, patch, reset } = useAdminFilter(EMPTY_FILTER);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [isSchoolFormOpen, setIsSchoolFormOpen] = useState(false);
  const [staffSchool, setStaffSchool] = useState<School | null>(null);
  const [reportSchool, setReportSchool] = useState<School | null>(null);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listSchools()
      .then((list) => {
        if (!active) return;
        setSchools(list);
        setError(null);
      })
      .catch(() => active && setError('Không tải được danh sách trường.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!reportSchool) return;
    let active = true;
    setReport(null);
    setReportError(null);
    setIsReportLoading(true);
    getSchoolReport(reportSchool.id)
      .then((value) => active && setReport(value))
      .catch(() => active && setReportError('Không tải được báo cáo trường.'))
      .finally(() => active && setIsReportLoading(false));
    return () => {
      active = false;
    };
  }, [reportSchool]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  const filteredSchools = useMemo(() => {
    const keyword = applied.keyword.trim().toLowerCase();
    if (!keyword) return schools;
    return schools.filter((school) => `${school.school_name} ${school.city ?? ''}`.toLowerCase().includes(keyword));
  }, [schools, applied.keyword]);

  useEffect(() => setPage(1), [applied.keyword]);

  const rows = useMemo(
    () => filteredSchools.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE),
    [filteredSchools, page],
  );

  const columns = useMemo<DataTableColumn<School>[]>(
    () => [
      { key: 'school_name', header: 'Tên trường', render: (row) => <span className="admin-cell-text">{row.school_name}</span> },
      { key: 'city', header: 'Tỉnh/Thành phố', nowrap: true, render: (row) => row.city ?? '—' },
      { key: 'address', header: 'Địa chỉ', render: (row) => row.address ?? '—' },
      {
        key: 'actions',
        header: '',
        align: 'right',
        nowrap: true,
        render: (row) => (
          <div className="class-row-actions">
            <Button type="button" size="sm" variant="outline" leftIcon={<UserPlus size={14} />} onClick={() => setStaffSchool(row)}>
              Thêm nhân sự
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setReportSchool(row)}>
              Báo cáo
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <div className="class-page-header">
        <h1 className="page-title">Trường học</h1>
        <Button type="button" leftIcon={<Plus size={16} />} onClick={() => setIsSchoolFormOpen(true)}>
          Thêm trường
        </Button>
      </div>

      {(error || notice) && (
        <div className="class-alert-slot">
          {error && <Alert variant="danger">{error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
        </div>
      )}

      <div className="class-stack">
        <FilterBar onReset={reset} totalResults={filteredSchools.length}>
          <Input
            aria-label="Tìm trường"
            placeholder="Tìm theo tên trường"
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </FilterBar>
        <Card noPadding>
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} isLoading={isLoading} emptyText="Chưa có trường" caption="Danh sách trường" />
        </Card>
        <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={filteredSchools.length} onChange={setPage} disabled={isLoading} />
      </div>

      <SchoolFormModal
        open={isSchoolFormOpen}
        onClose={() => setIsSchoolFormOpen(false)}
        onSaved={() => {
          setIsSchoolFormOpen(false);
          reload();
        }}
      />
      <EmailRoleModal
        open={staffSchool !== null}
        title={staffSchool ? `Thêm nhân sự – ${staffSchool.school_name}` : 'Thêm nhân sự'}
        roleLabel="Vai trò"
        roleOptions={STAFF_ROLE_OPTIONS}
        onSubmit={async (email, role) => {
          if (!staffSchool) return null;
          const result = await addSchoolStaff(staffSchool.id, email, role as 'school_admin' | 'teacher');
          return result.ok ? null : (STAFF_ERROR_TEXT[result.reason ?? ''] ?? 'Không thêm được nhân sự.');
        }}
        onClose={() => setStaffSchool(null)}
        onSaved={() => {
          setStaffSchool(null);
          setNotice('Đã thêm nhân sự vào trường.');
        }}
      />
      <Modal open={reportSchool !== null} title={reportSchool?.school_name ?? 'Báo cáo trường'} onClose={() => setReportSchool(null)} wide>
        <ClassReportCard title="Điểm trung bình toàn trường" report={report} isLoading={isReportLoading} error={reportError} />
      </Modal>
    </>
  );
};
