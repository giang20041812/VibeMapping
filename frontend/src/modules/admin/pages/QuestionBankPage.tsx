import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus } from 'lucide-react';
import { Alert, Badge, Button, Card, DataTable, Pagination } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { ADMIN_PAGE_SIZE, DETAIL_LEVEL_LABEL, RATER_GROUP_LABEL } from '../admin.constants';
import type { Criteria, CriteriaGroup, QuestionRow } from '../admin.types';
import { QuestionFilterFields } from '../components/QuestionFilterFields';
import { QuestionFormModal } from '../components/QuestionFormModal';
import { listCriteria, listCriteriaGroups } from '../criteria.service';
import { EMPTY_QUESTION_FILTER, listQuestions, setQuestionActive } from '../questions.service';
import { useAdminFilter } from '../useAdminFilter';
import './AdminPages.css';

export const QuestionBankPage: React.FC = () => {
  const { draft, applied, patch, apply, reset } = useAdminFilter(EMPTY_QUESTION_FILTER);
  const [groups, setGroups] = useState<CriteriaGroup[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCriteriaGroups(), listCriteria()])
      .then(([groupList, criteriaList]) => {
        setGroups(groupList);
        setCriteria(criteriaList);
      })
      .catch(() => setError('Không tải được danh sách nhóm tiêu chí.'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listQuestions(applied, page)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => active && setError('Không tải được ngân hàng câu hỏi.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [applied, page, reloadKey]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = useCallback((row: QuestionRow) => {
    setEditing(row);
    setFormOpen(true);
  }, []);

  const handleToggleActive = useCallback(async (row: QuestionRow) => {
    setBusyId(row.id);
    try {
      await setQuestionActive(row.id, !row.is_active);
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, is_active: !row.is_active } : item)));
      setError(null);
    } catch {
      setError('Không đổi được trạng thái câu hỏi. Thử lại sau.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const columns = useMemo<DataTableColumn<QuestionRow>[]>(
    () => [
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
      { key: 'rater_group', header: 'Góc nhìn', nowrap: true, render: (row) => RATER_GROUP_LABEL[row.rater_group] },
      { key: 'assessment_part', header: 'Phần', align: 'center', nowrap: true, render: (row) => row.assessment_part ?? '—' },
      {
        key: 'detail_level',
        header: 'Mức chi tiết',
        nowrap: true,
        render: (row) => (row.detail_level ? DETAIL_LEVEL_LABEL[row.detail_level] : '—'),
      },
      { key: 'content', header: 'Nội dung', render: (row) => <span className="admin-cell-text">{row.content}</span> },
      {
        key: 'is_active',
        header: 'Trạng thái',
        nowrap: true,
        render: (row) => <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Đang dùng' : 'Đã ẩn'}</Badge>,
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        nowrap: true,
        render: (row) => (
          <div className="admin-row-actions">
            <Button type="button" size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => openEdit(row)}>
              Sửa
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              leftIcon={row.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
              disabled={busyId === row.id}
              onClick={() => handleToggleActive(row)}
            >
              {row.is_active ? 'Ẩn' : 'Hiện'}
            </Button>
          </div>
        ),
      },
    ],
    [busyId, handleToggleActive, openEdit],
  );

  return (
    <>
      <div className="admin-page-header">
        <h1 className="page-title">Ngân hàng câu hỏi</h1>
        <Button type="button" leftIcon={<Plus size={16} />} onClick={openCreate}>
          Thêm câu hỏi
        </Button>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={total}>
        <QuestionFilterFields draft={draft} onChange={patch} groups={groups} criteria={criteria} />
      </FilterBar>

      <Card noPadding>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyText="Không có câu hỏi phù hợp"
          caption="Ngân hàng câu hỏi"
        />
        <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} onChange={setPage} disabled={isLoading} />
      </Card>

      <QuestionFormModal
        open={formOpen}
        question={editing}
        criteria={criteria}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          setReloadKey((value) => value + 1);
        }}
      />
    </>
  );
};
