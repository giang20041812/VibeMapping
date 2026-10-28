import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardPaste, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Modal, ProgressBar, Select, Skeleton, Textarea } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { useAdminFilter } from '../../admin/useAdminFilter';
import { getClass } from '../../class_management/class_management.service';
import { GRID_BLOCK_TEXT } from '../../class_management/class_management.constants';
import { DEPTH_OPTIONS, DURATION_OPTIONS, FREQUENCY_OPTIONS } from '../../guest_assessment/guest.constants';
import {
  getClassGrid,
  listShortSetCriteria,
  saveCells,
  saveGridDefaults,
  saveStudentUnderstanding,
  submitGrid,
  type CellChange,
  type Understanding,
} from '../class_assessment_grid.service';
import type { CellValue, GridData, GridStudent, ShortCriteria } from '../class_assessment_grid.types';
import { CELL_OPTIONS, cellKey, cellToDb, countEmptyCells, parsePaste, toCellMap } from '../grid.logic';
import './ClassGridPage.css';

const EMPTY_FILTER = { keyword: '', groupCode: '' };

const toOptions = (items: { label: string; value: number }[]) =>
  items.map((item) => ({ value: String(item.value), label: item.label }));
const DURATION = toOptions(DURATION_OPTIONS);
const FREQUENCY = toOptions(FREQUENCY_OPTIONS);
const DEPTH = toOptions(DEPTH_OPTIONS);

const toNumber = (value: string) => (value === '' ? null : Number(value));
const fromNumber = (value: number | null) => (value === null ? '' : String(value));

interface UnderstandingFieldsProps {
  value: Understanding;
  emptyLabel: string;
  onChange: (value: Understanding) => void;
}

const UnderstandingFields: React.FC<UnderstandingFieldsProps> = ({ value, emptyLabel, onChange }) => (
  <div className="grid-understanding">
    <Select
      label="Thời gian quen biết"
      emptyLabel={emptyLabel}
      options={DURATION}
      value={fromNumber(value.acquaintance_duration)}
      onChange={(next) => onChange({ ...value, acquaintance_duration: toNumber(next) })}
    />
    <Select
      label="Tần suất tiếp xúc"
      emptyLabel={emptyLabel}
      options={FREQUENCY}
      value={fromNumber(value.contact_frequency)}
      onChange={(next) => onChange({ ...value, contact_frequency: toNumber(next) })}
    />
    <Select
      label="Mức độ hiểu"
      emptyLabel={emptyLabel}
      options={DEPTH}
      value={fromNumber(value.observation_depth)}
      onChange={(next) => onChange({ ...value, observation_depth: toNumber(next) })}
    />
  </div>
);

export const ClassGridPage: React.FC = () => {
  const { classId = '' } = useParams();
  const { draft, applied, patch, reset } = useAdminFilter(EMPTY_FILTER);
  const [className, setClassName] = useState('');
  const [grid, setGrid] = useState<GridData | null>(null);
  const [criteria, setCriteria] = useState<ShortCriteria[]>([]);
  const [cells, setCells] = useState<Map<string, CellValue>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fillCriteria, setFillCriteria] = useState('');
  const [fillValue, setFillValue] = useState<CellValue>('3');
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [editing, setEditing] = useState<GridStudent | null>(null);
  const [editingValue, setEditingValue] = useState<Understanding>({
    acquaintance_duration: null,
    contact_frequency: null,
    observation_depth: null,
  });

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([getClassGrid(classId), listShortSetCriteria(), getClass(classId)])
      .then(([gridData, criteriaList, classRow]) => {
        if (!active) return;
        setGrid(gridData);
        setCriteria(criteriaList);
        setCells(toCellMap(gridData));
        setClassName(classRow?.class_name ?? '');
        setFillCriteria(criteriaList[0]?.id ?? '');
        setError(null);
      })
      .catch(() => active && setError('Không mở được bảng lưới.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [classId]);

  const isLocked = grid?.status === 'submitted';

  const groupOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of criteria) seen.set(item.group_code, `${item.group_code} · ${item.group_name}`);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [criteria]);

  const visibleCriteria = useMemo(
    () => (applied.groupCode ? criteria.filter((item) => item.group_code === applied.groupCode) : criteria),
    [criteria, applied.groupCode],
  );

  const visibleStudents = useMemo(() => {
    const keyword = applied.keyword.trim().toLowerCase();
    const students = grid?.students ?? [];
    return keyword ? students.filter((student) => student.full_name.toLowerCase().includes(keyword)) : students;
  }, [grid, applied.keyword]);

  const totalCells = (grid?.students.length ?? 0) * criteria.length;
  const emptyCells = grid ? countEmptyCells(grid.students, criteria, cells) : 0;
  const pendingGuardian = (grid?.students ?? []).filter((student) => student.guardian_pending);

  const applyChanges = useCallback(
    async (changes: { gridStudentId: string; criteriaId: string; value: CellValue }[]) => {
      if (changes.length === 0) return;
      const previous = cells;
      setCells((current) => {
        const next = new Map(current);
        for (const change of changes) {
          const key = cellKey(change.gridStudentId, change.criteriaId);
          if (change.value === '') next.delete(key);
          else next.set(key, change.value);
        }
        return next;
      });
      try {
        const payload: CellChange[] = changes.map((change) => ({
          gridStudentId: change.gridStudentId,
          criteriaId: change.criteriaId,
          value: cellToDb(change.value),
        }));
        await saveCells(payload);
        setNotice(null);
      } catch {
        setCells(previous);
        setError('Không lưu được điểm. Thử lại sau.');
      }
    },
    [cells],
  );

  const handleFillColumn = () => {
    if (!grid || !fillCriteria) return;
    void applyChanges(grid.students.map((student) => ({ gridStudentId: student.grid_student_id, criteriaId: fillCriteria, value: fillValue })));
  };

  const handlePaste = () => {
    if (!grid) return;
    const result = parsePaste(pasteText, visibleStudents, visibleCriteria);
    void applyChanges(result.changes);
    setIsPasteOpen(false);
    setPasteText('');
    setNotice(result.invalid > 0 ? `Đã dán ${result.changes.length} ô, bỏ qua ${result.invalid} ô sai giá trị.` : `Đã dán ${result.changes.length} ô.`);
  };

  const handleDefaults = async (value: Understanding) => {
    if (!grid) return;
    setGrid({
      ...grid,
      default_acquaintance_duration: value.acquaintance_duration,
      default_contact_frequency: value.contact_frequency,
      default_observation_depth: value.observation_depth,
    });
    try {
      await saveGridDefaults(grid.grid_id, value);
    } catch {
      setError('Không lưu được mức thấu hiểu của lớp.');
    }
  };

  const openEditing = (student: GridStudent) => {
    setEditing(student);
    setEditingValue({
      acquaintance_duration: student.acquaintance_duration,
      contact_frequency: student.contact_frequency,
      observation_depth: student.observation_depth,
    });
  };

  const handleSaveEditing = async () => {
    if (!grid || !editing) return;
    try {
      await saveStudentUnderstanding(editing.grid_student_id, editingValue);
      setGrid({
        ...grid,
        students: grid.students.map((student) =>
          student.grid_student_id === editing.grid_student_id ? { ...student, ...editingValue } : student,
        ),
      });
      setEditing(null);
    } catch {
      setError('Không lưu được mức thấu hiểu của học sinh.');
    }
  };

  const handleSubmit = async () => {
    if (!grid) return;
    if (!window.confirm('Nộp bảng điểm? Sau khi nộp không sửa được.')) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitGrid(grid.grid_id);
      if (result.ok) {
        setGrid({ ...grid, status: 'submitted' });
        setNotice('Đã nộp bảng điểm.');
      } else if (result.reason === 'short_set_not_configured') {
        setError('Chưa có tiêu chí nào thuộc bộ câu hỏi rút gọn.');
      } else {
        setError(GRID_BLOCK_TEXT[result.reason] ?? 'Chưa nộp được bảng điểm.');
      }
    } catch {
      setError('Không nộp được bảng điểm. Thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaults: Understanding = {
    acquaintance_duration: grid?.default_acquaintance_duration ?? null,
    contact_frequency: grid?.default_contact_frequency ?? null,
    observation_depth: grid?.default_observation_depth ?? null,
  };

  return (
    <>
      <div className="class-page-header">
        <h1 className="page-title">{className ? `Bảng lưới – Lớp ${className}` : 'Bảng lưới chấm điểm'}</h1>
        <div className="class-header-actions">
          <Link to={`/lop-hoc/${classId}`}>
            <Button type="button" variant="outline" leftIcon={<ArrowLeft size={16} />}>
              Về lớp
            </Button>
          </Link>
          <Button type="button" variant="outline" leftIcon={<ClipboardPaste size={16} />} onClick={() => setIsPasteOpen(true)} disabled={isLocked || criteria.length === 0}>
            Dán từ Excel
          </Button>
          <Button type="button" leftIcon={<Send size={16} />} onClick={() => void handleSubmit()} isLoading={isSubmitting} disabled={isLocked || !grid || grid.students.length === 0}>
            Nộp bảng điểm
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <div className="class-alert-slot">
          {error && <Alert variant="danger">{error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
        </div>
      )}

      {isLoading && <Skeleton shape="heading" />}

      {!isLoading && grid && criteria.length === 0 && (
        <Alert variant="warning">Chưa có tiêu chí nào thuộc bộ câu hỏi rút gọn. Quản trị hệ thống cần đánh dấu tiêu chí trước khi chấm.</Alert>
      )}

      {!isLoading && grid && criteria.length > 0 && (
        <div className="class-stack">
          {isLocked && <Alert variant="info">Bảng điểm đã nộp.</Alert>}
          {pendingGuardian.length > 0 && (
            <Alert variant="warning">
              Chưa nộp được khi còn học sinh dưới 16 tuổi chưa có xác nhận của người giám hộ: {pendingGuardian.map((student) => student.full_name).join(', ')}.
            </Alert>
          )}

          <Card title="Mức thấu hiểu của cả lớp">
            <UnderstandingFields value={defaults} emptyLabel="Chưa chọn" onChange={(value) => void handleDefaults(value)} />
          </Card>

          <Card title="Tiến độ chấm">
            <ProgressBar value={totalCells === 0 ? null : ((totalCells - emptyCells) / totalCells) * 100} label="Tiến độ chấm" />
            <p className="grid-progress-text">
              {totalCells - emptyCells}/{totalCells} ô
            </p>
          </Card>

          <FilterBar onReset={reset} totalResults={visibleStudents.length}>
            <Input
              aria-label="Tìm học sinh"
              placeholder="Tìm theo tên"
              value={draft.keyword}
              onChange={(event) => patch({ keyword: event.target.value })}
            />
            <Select
              aria-label="Nhóm tiêu chí"
              emptyLabel="Mọi nhóm tiêu chí"
              options={groupOptions}
              value={draft.groupCode}
              onChange={(value) => {
                patch({ groupCode: value });
              }}
            />
          </FilterBar>

          {!isLocked && (
            <div className="grid-fill-bar">
              <Select
                label="Điền cả cột"
                options={criteria.map((item) => ({ value: item.id, label: `${item.dimension_code} · ${item.name}` }))}
                value={fillCriteria}
                onChange={setFillCriteria}
              />
              <Select label="Giá trị" options={CELL_OPTIONS.filter((option) => option.value !== '')} value={fillValue} onChange={(value) => setFillValue(value as CellValue)} />
              <Button type="button" variant="outline" onClick={handleFillColumn}>
                Điền cho tất cả học sinh
              </Button>
            </div>
          )}

          <Card noPadding>
            <div className="app-table-scroll">
              <table className="app-table grid-table">
                <caption className="app-table-caption">Bảng lưới học sinh theo tiêu chí</caption>
                <thead>
                  <tr>
                    <th scope="col" className="grid-sticky">Học sinh</th>
                    {visibleCriteria.map((item) => (
                      <th key={item.id} scope="col" className="align-center" title={item.name}>
                        <span className="grid-head-code">{item.dimension_code}</span>
                        <span className="grid-head-name">{item.name}</span>
                      </th>
                    ))}
                    <th scope="col" className="align-center">Thấu hiểu</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.length === 0 && (
                    <tr>
                      <td colSpan={visibleCriteria.length + 2}>Không có học sinh</td>
                    </tr>
                  )}
                  {visibleStudents.map((student) => (
                    <tr key={student.grid_student_id}>
                      <th scope="row" className="grid-sticky">
                        {student.full_name || '—'}
                        {student.guardian_pending && (
                          <>
                            {' '}
                            <Badge variant="warning" size="sm">Chờ người giám hộ</Badge>
                          </>
                        )}
                      </th>
                      {visibleCriteria.map((item) => {
                        const value = cells.get(cellKey(student.grid_student_id, item.id)) ?? '';
                        return (
                          <td key={item.id} className="align-center">
                            <select
                              className={`grid-cell-select ${value === '' ? 'is-empty' : ''}`}
                              aria-label={`${student.full_name} – ${item.name}`}
                              value={value}
                              disabled={isLocked}
                              onChange={(event) =>
                                void applyChanges([
                                  { gridStudentId: student.grid_student_id, criteriaId: item.id, value: event.target.value as CellValue },
                                ])
                              }
                            >
                              {CELL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                      <td className="align-center">
                        <Button type="button" size="sm" variant="ghost" onClick={() => openEditing(student)} disabled={isLocked}>
                          {student.acquaintance_duration || student.contact_frequency || student.observation_depth ? 'Riêng' : 'Theo lớp'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={isPasteOpen}
        title="Dán từ Excel"
        onClose={() => setIsPasteOpen(false)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setIsPasteOpen(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={handlePaste} disabled={pasteText.trim() === ''}>
              Dán
            </Button>
          </>
        }
      >
        <Textarea
          label="Điểm theo thứ tự học sinh và tiêu chí đang hiển thị"
          rows={8}
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
        />
      </Modal>

      <Modal
        open={editing !== null}
        title={editing ? `Mức thấu hiểu – ${editing.full_name}` : 'Mức thấu hiểu'}
        onClose={() => setEditing(null)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void handleSaveEditing()}>
              Lưu
            </Button>
          </>
        }
      >
        <UnderstandingFields value={editingValue} emptyLabel="Theo cả lớp" onChange={setEditingValue} />
      </Modal>
    </>
  );
};
