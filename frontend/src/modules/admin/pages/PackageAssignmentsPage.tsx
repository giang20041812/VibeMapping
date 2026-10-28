import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, DataTable, Pagination, Select, Skeleton } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { ADMIN_PAGE_SIZE, DETAIL_LEVEL_LABEL, PACKAGE_NAMES, PACKAGE_SIZES, type PackageSize } from '../admin.constants';
import type { Criteria, CriteriaGroup } from '../admin.types';
import { QuestionFilterFields } from '../components/QuestionFilterFields';
import { listCriteria, listCriteriaGroups } from '../criteria.service';
import {
  countPackageAssignments,
  listAssignableQuestions,
  setPackageAssignments,
  type AssignableQuestion,
} from '../package_assignments.service';
import { EMPTY_QUESTION_FILTER } from '../questions.service';
import { useAdminFilter } from '../useAdminFilter';
import './AdminPages.css';

const PACKAGE_SELECT_OPTIONS = PACKAGE_SIZES.map((size) => ({ value: String(size), label: `${PACKAGE_NAMES[size]} (${size})` }));

export const PackageAssignmentsPage: React.FC = () => {
  const { draft, applied, patch, apply, reset } = useAdminFilter(EMPTY_QUESTION_FILTER);
  const [groups, setGroups] = useState<CriteriaGroup[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [rows, setRows] = useState<AssignableQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState<Record<PackageSize, number> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSize, setBulkSize] = useState<string>(String(PACKAGE_SIZES[0]));
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  useEffect(() => {
    Promise.all([listCriteriaGroups(), listCriteria()])
      .then(([groupList, criteriaList]) => {
        setGroups(groupList);
        setCriteria(criteriaList);
      })
      .catch(() => setError('Không tải được danh sách nhóm tiêu chí.'));
  }, []);

  const refreshCounts = useCallback(() => {
    countPackageAssignments()
      .then(setCounts)
      .catch(() => setError('Không đếm được số câu trong từng gói.'));
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setSelected(new Set());
    listAssignableQuestions(applied, page)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => active && setError('Không tải được danh sách câu hỏi.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [applied, page]);

  const applyLocal = useCallback((ids: string[], size: PackageSize, assigned: boolean) => {
    const idSet = new Set(ids);
    setRows((current) =>
      current.map((row) => {
        if (!idSet.has(row.id)) return row;
        const without = row.packages.filter((item) => item !== size);
        return { ...row, packages: assigned ? [...without, size] : without };
      }),
    );
  }, []);

  const handleToggle = useCallback(
    async (row: AssignableQuestion, size: PackageSize, assigned: boolean) => {
      setNotice(null);
      applyLocal([row.id], size, assigned);
      try {
        await setPackageAssignments([row.id], size, assigned);
        refreshCounts();
      } catch {
        applyLocal([row.id], size, !assigned);
        setError('Không lưu được thay đổi gói. Thử lại sau.');
      }
    },
    [applyLocal, refreshCounts],
  );

  const handleBulk = async (assigned: boolean) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const size = Number(bulkSize) as PackageSize;
    setIsBulkBusy(true);
    setNotice(null);
    try {
      const changed = await setPackageAssignments(ids, size, assigned);
      applyLocal(ids, size, assigned);
      refreshCounts();
      setError(null);
      setNotice(
        assigned
          ? `Đã thêm ${changed} câu vào gói ${PACKAGE_NAMES[size]}.`
          : `Đã gỡ ${changed} câu khỏi gói ${PACKAGE_NAMES[size]}.`,
      );
    } catch {
      setError('Không lưu được thay đổi gói. Thử lại sau.');
    } finally {
      setIsBulkBusy(false);
    }
  };

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set());
  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const columns = useMemo<DataTableColumn<AssignableQuestion>[]>(
    () => [
      {
        key: 'select',
        header: <Checkbox aria-label="Chọn tất cả" checked={allSelected} indeterminate={selected.size > 0} onChange={toggleAll} />,
        align: 'center',
        render: (row) => (
          <Checkbox aria-label={`Chọn ${row.question_code}`} checked={selected.has(row.id)} onChange={(checked) => toggleOne(row.id, checked)} />
        ),
      },
      { key: 'question_code', header: 'Mã câu hỏi', nowrap: true, render: (row) => <span className="admin-code">{row.question_code}</span> },
      {
        key: 'criteria',
        header: 'Tiêu chí',
        render: (row) => (
          <span className="admin-cell-text">
            {row.dimension_code} · {row.criteria_name}
            <span className="admin-cell-sub">{row.group_code}</span>
          </span>
        ),
      },
      { key: 'assessment_part', header: 'Phần', align: 'center', nowrap: true, render: (row) => row.assessment_part ?? '—' },
      {
        key: 'detail_level',
        header: 'Mức chi tiết',
        nowrap: true,
        render: (row) => (row.detail_level ? DETAIL_LEVEL_LABEL[row.detail_level] : '—'),
      },
      { key: 'content', header: 'Nội dung', render: (row) => <span className="admin-cell-text">{row.content}</span> },
      ...PACKAGE_SIZES.map<DataTableColumn<AssignableQuestion>>((size) => ({
        key: `package-${size}`,
        header: `${PACKAGE_NAMES[size]} (${size})`,
        align: 'center',
        render: (row) => (
          <Checkbox
            aria-label={`${row.question_code} thuộc gói ${PACKAGE_NAMES[size]}`}
            checked={row.packages.includes(size)}
            onChange={(checked) => handleToggle(row, size, checked)}
          />
        ),
      })),
    ],
    [allSelected, selected, toggleOne, handleToggle],
  );

  return (
    <>
      <div className="admin-page-header">
        <h1 className="page-title">Gán câu hỏi vào gói</h1>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="admin-alert-slot">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}

      <div className="admin-summary">
        {PACKAGE_SIZES.map((size) => (
          <div key={size} className="admin-summary-item">
            <span className="admin-summary-label">
              {PACKAGE_NAMES[size]} ({size})
            </span>
            <span className="admin-summary-value">{counts ? counts[size] : isLoading ? <Skeleton shape="heading" width={30} className="admin-skeleton-count" /> : '—'}</span>
          </div>
        ))}
      </div>

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={total}>
        <QuestionFilterFields draft={draft} onChange={patch} groups={groups} criteria={criteria} showRaterGroup={false} />
      </FilterBar>

      <Card noPadding>
        {selected.size > 0 && (
          <div className="admin-bulk-bar">
            <span className="admin-bulk-count">
              <Badge variant="info">{selected.size}</Badge> câu đã chọn
            </span>
            <Select label="Gói" options={PACKAGE_SELECT_OPTIONS} value={bulkSize} onChange={setBulkSize} />
            <Button type="button" size="md" isLoading={isBulkBusy} onClick={() => handleBulk(true)}>
              Thêm vào gói
            </Button>
            <Button type="button" size="md" variant="outline" disabled={isBulkBusy} onClick={() => handleBulk(false)}>
              Gỡ khỏi gói
            </Button>
          </div>
        )}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyText="Không có câu hỏi phù hợp"
          caption="Danh sách câu hỏi tự đánh giá"
        />
        <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} onChange={setPage} disabled={isLoading} />
      </Card>
    </>
  );
};
