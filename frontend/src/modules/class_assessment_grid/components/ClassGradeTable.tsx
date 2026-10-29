import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, Modal, ProgressBar, Select } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { GRID_BLOCK_TEXT } from '../../class_management/class_management.constants';
import type { ClassMember } from '../../class_management/class_management.types';
import {
  saveCells,
  saveGridDefaults,
  saveStudentUnderstanding,
  submitGrid,
  type CellChange,
  type Understanding,
} from '../class_assessment_grid.service';
import type { CellValue, GridData, GridStudent, ShortCriteria } from '../class_assessment_grid.types';
import { downloadGradeTemplate } from '../grade_template';
import {
  CELL_OPTIONS,
  cellToDb,
  fillDownChanges,
  parseCellText,
  parsePastedText,
  toScoreMap,
  type GradeSheetResult,
  type ScoreMap,
} from '../grid.logic';
import { addPending, isNetworkFailure, loadPending, removePending, clearPending } from '../grid_offline';
import { GradeImportModal } from './GradeImportModal';
import { GradeRow } from './GradeRow';
import { GroupAssignModal } from './GroupAssignModal';
import { GradeStudentModal } from './GradeStudentModal';
import { UnderstandingFields } from './UnderstandingFields';
import '../../../components/filters/filterControls.css';
import './ClassGradeTable.css';

const NO_SCORES = new Map<string, CellValue>();

interface ClassGradeTableProps {
  /** Học sinh của lớp (đã lọc theo từ khóa), mỗi người một dòng */
  members: ClassMember[];
  /** Toàn bộ học sinh của lớp, để khớp dòng trong tệp Excel */
  allMembers: ClassMember[];
  /** Bảng điểm vừa tải; cha gắn `key` theo lần tải để tải lại là làm mới */
  initialGrid: GridData;
  /** Toàn bộ tiêu chí của bộ rút gọn */
  criteria: ShortCriteria[];
  /** Chỉ hiện tiêu chí của nhóm này; rỗng là hiện hết */
  groupCode: string;
  onRemove: (member: ClassMember) => void;
  /** Gọi sau khi nộp bảng điểm xong; cha tải lại lớp */
  onSubmitted: () => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

export const ClassGradeTable: React.FC<ClassGradeTableProps> = ({
  members,
  allMembers,
  initialGrid,
  criteria,
  groupCode,
  onRemove,
  onSubmitted,
  onError,
  onNotice,
}) => {
  const [grid, setGrid] = useState(initialGrid);
  /** Điểm theo từng học sinh; chỉ học sinh vừa sửa mới có bảng điểm mới nên các dòng khác không vẽ lại */
  const [scores, setScores] = useState<ScoreMap>(() => toScoreMap(initialGrid));
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Lý do chưa nộp được, hiện trong hộp thoại xác nhận */
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);
  const [fillCriteria, setFillCriteria] = useState(criteria[0]?.id ?? '');
  const [fillValue, setFillValue] = useState<CellValue>('3');
  const [isImportOpen, setIsImportOpen] = useState(false);
  /** Học sinh đang mở hộp thoại chấm điểm riêng */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Học sinh được chọn để gán cùng một bộ điểm */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  /** Tô đỏ ô còn trống sau khi nộp bị chặn vì thiếu điểm */
  const [highlightMissing, setHighlightMissing] = useState(false);

  // Hàm xử lý của dòng giữ nguyên danh tính qua các lần vẽ; đọc dữ liệu mới nhất qua ref
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const callbacksRef = useRef({ onRemove, onSubmitted, onError, onNotice });
  callbacksRef.current = { onRemove, onSubmitted, onError, onNotice };
  const isLocked = grid.status === 'submitted';

  const gridStudents = useMemo(() => new Map(grid.students.map((student) => [student.student_id, student])), [grid]);
  const gridStudentsById = useMemo(() => new Map(grid.students.map((student) => [student.grid_student_id, student])), [grid]);

  const visibleCriteria = useMemo(
    () => (groupCode ? criteria.filter((item) => item.group_code === groupCode) : criteria),
    [criteria, groupCode],
  );

  const visibleGridStudents = useMemo(
    () => members.flatMap((member) => (member.user_id && gridStudents.get(member.user_id) ? [gridStudents.get(member.user_id)!] : [])),
    [members, gridStudents],
  );

  let totalCells = 0;
  let filledCells = 0;
  let gradedStudents = 0;
  for (const student of grid.students) {
    const own = scores.get(student.grid_student_id);
    totalCells += criteria.length;
    let filledOfStudent = 0;
    if (own) for (const item of criteria) if (own.get(item.id)) filledOfStudent += 1;
    filledCells += filledOfStudent;
    if (criteria.length > 0 && filledOfStudent === criteria.length) gradedStudents += 1;
  }

  const applyChanges = useCallback(async (changes: { gridStudentId: string; criteriaId: string; value: CellValue }[]) => {
    if (changes.length === 0 || gridRef.current.status === 'submitted') return;
    const previous = scoresRef.current;
    const next: ScoreMap = new Map(previous);
    const touched = new Map<string, Map<string, CellValue>>();
    for (const change of changes) {
      let own = touched.get(change.gridStudentId);
      if (!own) {
        own = new Map(previous.get(change.gridStudentId));
        touched.set(change.gridStudentId, own);
        next.set(change.gridStudentId, own);
      }
      if (change.value === '') own.delete(change.criteriaId);
      else own.set(change.criteriaId, change.value);
    }
    setScores(next);
    try {
      const payload: CellChange[] = changes.map((change) => ({
        gridStudentId: change.gridStudentId,
        criteriaId: change.criteriaId,
        value: cellToDb(change.value),
      }));
      await saveCells(payload);
      removePending(gridRef.current.grid_id, changes);
      callbacksRef.current.onNotice(null);
    } catch (cause) {
      if (isNetworkFailure(cause)) {
        // Mất mạng: giữ điểm trên màn hình, lưu tạm ở máy và đồng bộ khi có mạng lại
        addPending(gridRef.current.grid_id, changes);
        callbacksRef.current.onNotice('Mất kết nối. Điểm được lưu tạm trên máy và sẽ đồng bộ khi có mạng.');
      } else {
        setScores(previous);
        callbacksRef.current.onError('Không lưu được điểm. Thử lại sau.');
      }
    }
  }, []);

  /** Đẩy các thay đổi đang lưu tạm trên máy lên máy chủ */
  const flushPending = useCallback(async () => {
    const gridId = gridRef.current.grid_id;
    const pending = loadPending(gridId);
    if (pending.length === 0 || gridRef.current.status === 'submitted') return;
    try {
      await saveCells(pending.map((item) => ({ gridStudentId: item.gridStudentId, criteriaId: item.criteriaId, value: cellToDb(item.value) })));
      removePending(gridId, pending);
      callbacksRef.current.onNotice('Đã đồng bộ điểm lưu tạm trên máy.');
    } catch (cause) {
      if (isNetworkFailure(cause)) return;
      clearPending(gridId);
      callbacksRef.current.onError('Không đồng bộ được điểm lưu tạm trên máy.');
    }
  }, []);

  // Mở lại bảng: điểm lưu tạm chưa đồng bộ hiện lên trước, rồi đồng bộ khi có mạng
  useEffect(() => {
    const pending = loadPending(initialGrid.grid_id);
    if (pending.length > 0 && initialGrid.status !== 'submitted') {
      setScores((current) => {
        const next: ScoreMap = new Map(current);
        for (const item of pending) {
          const own = new Map(next.get(item.gridStudentId));
          if (item.value === '') own.delete(item.criteriaId);
          else own.set(item.criteriaId, item.value);
          next.set(item.gridStudentId, own);
        }
        return next;
      });
    }
    if (navigator.onLine) void flushPending();
    const handleOnline = () => void flushPending();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [initialGrid.grid_id, initialGrid.status, flushPending]);

  const handleChangeCell = useCallback(
    (gridStudentId: string, criteriaId: string, value: CellValue) => void applyChanges([{ gridStudentId, criteriaId, value }]),
    [applyChanges],
  );

  const handleFillColumn = () => {
    if (!fillCriteria) return;
    void applyChanges(visibleGridStudents.map((student) => ({ gridStudentId: student.grid_student_id, criteriaId: fillCriteria, value: fillValue })));
  };

  /** Điền xuống: ô trống nhận điểm của ô có điểm gần nhất phía trên, theo tiêu chí đang chọn */
  const handleFillDown = () => {
    if (!fillCriteria) return;
    void applyChanges(fillDownChanges(visibleGridStudents.map((student) => student.grid_student_id), fillCriteria, scoresRef.current));
  };

  /** Dán từ bảng tính: bắt đầu từ ô đang chọn, đi sang phải theo tiêu chí và xuống dưới theo học sinh */
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (isLocked) return;
    const target = event.target as HTMLElement;
    const startStudent = target.getAttribute?.('data-student');
    const startCriteria = target.getAttribute?.('data-criteria');
    if (!startStudent || !startCriteria) return;
    const matrix = parsePastedText(event.clipboardData.getData('text'));
    if (matrix.length === 0) return;
    event.preventDefault();

    const rowStart = visibleGridStudents.findIndex((student) => student.grid_student_id === startStudent);
    const columnStart = visibleCriteria.findIndex((item) => item.id === startCriteria);
    const changes: { gridStudentId: string; criteriaId: string; value: CellValue }[] = [];
    let invalid = 0;
    matrix.forEach((line, rowOffset) =>
      line.forEach((text, columnOffset) => {
        const student = visibleGridStudents[rowStart + rowOffset];
        const item = visibleCriteria[columnStart + columnOffset];
        if (!student || !item) return;
        const parsed = parseCellText(text);
        if (parsed === null) invalid += 1;
        else if (parsed !== '') changes.push({ gridStudentId: student.grid_student_id, criteriaId: item.id, value: parsed });
      }),
    );
    void applyChanges(changes);
    onNotice(`Đã dán ${changes.length} ô${invalid > 0 ? `, bỏ qua ${invalid} ô sai giá trị` : ''}.`);
  };

  const handleToggle = useCallback((gridStudentId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(gridStudentId)) next.delete(gridStudentId);
      else next.add(gridStudentId);
      return next;
    });
  }, []);

  const allVisibleSelected = visibleGridStudents.length > 0 && visibleGridStudents.every((student) => selectedIds.has(student.grid_student_id));
  const handleToggleAll = (checked: boolean) =>
    setSelectedIds(checked ? new Set(visibleGridStudents.map((student) => student.grid_student_id)) : new Set());

  const handleAssignGroup = (values: Map<string, CellValue>) => {
    const changes = [...selectedIds].flatMap((gridStudentId) =>
      [...values].filter(([, value]) => value !== '').map(([criteriaId, value]) => ({ gridStudentId, criteriaId, value })),
    );
    void applyChanges(changes);
    setIsAssignOpen(false);
    onNotice(`Đã gán điểm cho ${selectedIds.size} học sinh.`);
  };

  const sheetStudents = useMemo(
    () =>
      allMembers.flatMap((member) => {
        const student = member.user_id ? gridStudents.get(member.user_id) : undefined;
        return student ? [{ gridStudentId: student.grid_student_id, studentCode: member.student_code, fullName: member.full_name }] : [];
      }),
    [allMembers, gridStudents],
  );

  const handleImportApply = (changes: GradeSheetResult['changes']) => applyChanges(changes);

  const handleDefaults = async (value: Understanding) => {
    setGrid((current) => ({
      ...current,
      default_acquaintance_duration: value.acquaintance_duration,
      default_contact_frequency: value.contact_frequency,
      default_observation_depth: value.observation_depth,
    }));
    try {
      await saveGridDefaults(grid.grid_id, value);
    } catch {
      onError('Không lưu được mức thấu hiểu của lớp.');
    }
  };

  const updateUnderstanding = async (student: GridStudent, value: Understanding) => {
    setGrid((current) => ({
      ...current,
      students: current.students.map((item) => (item.grid_student_id === student.grid_student_id ? { ...item, ...value } : item)),
    }));
    try {
      await saveStudentUnderstanding(student.grid_student_id, value);
    } catch {
      onError('Không lưu được mức thấu hiểu của học sinh.');
    }
  };

  /** Nộp cả bảng; chưa đủ điều kiện thì nêu lý do và tên học sinh bị chặn */
  const handleSubmitGrid = async () => {
    setIsSubmitting(true);
    setBlockedReasons([]);
    onError(null);
    try {
      const result = await submitGrid(grid.grid_id);
      if (result.ok) {
        setGrid((current) => ({ ...current, status: 'submitted', submitted_at: new Date().toISOString() }));
        setIsConfirmOpen(false);
        onNotice('Đã nộp và khóa bảng điểm.');
        onSubmitted();
        return;
      }
      const names =
        'student_ids' in result
          ? result.student_ids.map((id) => gridStudents.get(id)?.full_name || 'Học sinh').join(', ')
          : '';
      const text = GRID_BLOCK_TEXT[result.reason] ?? 'Chưa nộp được bảng điểm';
      if (result.reason === 'empty_cells') {
        // Đóng hộp thoại để thấy các ô thiếu được tô đỏ trong bảng
        setIsConfirmOpen(false);
        setHighlightMissing(true);
        onError(`${text} (${result.empty_count} ô)${names ? `: ${names}` : ''}`);
        window.requestAnimationFrame(() =>
          document.querySelector('.grid-cell-select.is-missing')?.scrollIntoView({ block: 'center', inline: 'center' }),
        );
        return;
      }
      setBlockedReasons([`${text}${names ? `: ${names}` : ''}`]);
    } catch {
      setBlockedReasons(['Không nộp được bảng điểm. Thử lại sau.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = useCallback((member: ClassMember) => callbacksRef.current.onRemove(member), []);

  const handleDownloadTemplate = () => {
    void downloadGradeTemplate(
      allMembers.filter((member) => member.user_id && gridStudents.has(member.user_id)),
      criteria,
    ).catch(() => onError('Không tạo được tệp mẫu. Thử lại sau.'));
  };

  const openIndex = openId ? visibleGridStudents.findIndex((student) => student.grid_student_id === openId) : -1;
  const openStudent = openId ? (gridStudentsById.get(openId) ?? null) : null;
  const previousStudent = openIndex > 0 ? visibleGridStudents[openIndex - 1] : null;
  const nextStudent = openIndex >= 0 && openIndex < visibleGridStudents.length - 1 ? visibleGridStudents[openIndex + 1] : null;

  const defaults: Understanding = {
    acquaintance_duration: grid.default_acquaintance_duration,
    contact_frequency: grid.default_contact_frequency,
    observation_depth: grid.default_observation_depth,
  };

  return (
    <>
      <Card
        title="Mức thấu hiểu của cả lớp"
        action={
          isLocked ? (
            <Badge variant="success">Đã nộp</Badge>
          ) : (
            <Button type="button" leftIcon={<Send size={16} />} onClick={() => setIsConfirmOpen(true)}>
              Nộp bảng điểm
            </Button>
          )
        }
      >
        <UnderstandingFields value={defaults} emptyLabel="Chưa chọn" disabled={isLocked} onChange={(value) => void handleDefaults(value)} />
        <ProgressBar value={totalCells === 0 ? null : (filledCells / totalCells) * 100} label="Tiến độ chấm" />
        <p className="grid-progress-text">
          {gradedStudents}/{grid.students.length} học sinh đã chấm đủ · {filledCells}/{totalCells} ô
        </p>
      </Card>

      {!isLocked && (
      <div className="grid-fill-bar filter-controls">
        <SearchableSelect
          label="Điền cả cột"
          placeholder="Chọn tiêu chí"
          options={visibleCriteria.map((item) => ({ value: item.id, label: `${item.dimension_code} · ${item.name}` }))}
          value={fillCriteria}
          onChange={setFillCriteria}
        />
        <Select label="Giá trị" options={CELL_OPTIONS.filter((option) => option.value !== '')} value={fillValue} onChange={(value) => setFillValue(value as CellValue)} />
        <Button type="button" variant="outline" onClick={handleFillColumn}>
          Điền cho học sinh đang hiển thị
        </Button>
        <Button type="button" variant="outline" onClick={handleFillDown}>
          Điền xuống
        </Button>
        <Button type="button" variant="outline" disabled={selectedIds.size === 0} onClick={() => setIsAssignOpen(true)}>
          Gán điểm cho học sinh đã chọn{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </Button>
        <Button type="button" variant="outline" leftIcon={<FileSpreadsheet size={16} />} onClick={() => setIsImportOpen(true)}>
          Nhập điểm từ Excel
        </Button>
      </div>
      )}

      <Card noPadding title="Học sinh">
        <div className="app-table-scroll" onPaste={handlePaste}>
          <table className="app-table grid-table">
            <caption className="app-table-caption">Bảng điểm học sinh theo tiêu chí</caption>
            <thead>
              <tr>
                <th scope="col" className="grid-select-col">
                  {!isLocked && (
                    <Checkbox
                      aria-label="Chọn tất cả học sinh đang hiển thị"
                      checked={allVisibleSelected}
                      indeterminate={selectedIds.size > 0}
                      onChange={handleToggleAll}
                    />
                  )}
                </th>
                <th scope="col" className="grid-sticky">Học sinh</th>
                {visibleCriteria.map((item) => (
                  <th key={item.id} scope="col" className="align-center" title={item.name}>
                    <span className="grid-head-code">{item.dimension_code}</span>
                    <span className="grid-head-name">{item.name}</span>
                  </th>
                ))}
                <th scope="col" className="align-center">Thấu hiểu</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td className="app-table-empty" colSpan={visibleCriteria.length + 4}>Lớp chưa có học sinh</td>
                </tr>
              )}
              {members.map((member) => {
                const student = member.user_id ? gridStudents.get(member.user_id) : undefined;
                return (
                  <GradeRow
                    key={member.member_id}
                    member={member}
                    student={student}
                    scores={student ? (scores.get(student.grid_student_id) ?? NO_SCORES) : undefined}
                    criteria={visibleCriteria}
                    readOnly={isLocked}
                    selected={student ? selectedIds.has(student.grid_student_id) : false}
                    highlightMissing={highlightMissing}
                    onToggle={handleToggle}
                    onOpen={setOpenId}
                    onChangeCell={handleChangeCell}
                    onRemove={handleRemove}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <GradeImportModal
        open={isImportOpen}
        students={sheetStudents}
        criteria={criteria}
        onDownloadTemplate={handleDownloadTemplate}
        onApply={handleImportApply}
        onClose={() => setIsImportOpen(false)}
      />

      <Modal
        open={isConfirmOpen}
        title="Xác nhận và khóa bảng điểm"
        locked={isSubmitting}
        onClose={() => setIsConfirmOpen(false)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>
              Quay lại chỉnh sửa
            </Button>
            <Button type="button" onClick={() => void handleSubmitGrid()} isLoading={isSubmitting}>
              Khóa bảng điểm
            </Button>
          </>
        }
      >
        {blockedReasons.map((reason) => (
          <Alert key={reason} variant="danger">{reason}</Alert>
        ))}
        <ProgressBar value={totalCells === 0 ? null : (filledCells / totalCells) * 100} label="Tiến độ chấm" />
        <p className="grid-progress-text">
          {grid.students.length} học sinh · {filledCells}/{totalCells} ô
        </p>
        <Alert variant="warning">Sau khi khóa, không sửa được bảng điểm.</Alert>
      </Modal>

      <GroupAssignModal
        open={isAssignOpen}
        count={selectedIds.size}
        criteria={criteria}
        onApply={handleAssignGroup}
        onClose={() => setIsAssignOpen(false)}
      />

      {openStudent && (
        <GradeStudentModal
          student={openStudent}
          criteria={criteria}
          values={scores.get(openStudent.grid_student_id) ?? NO_SCORES}
          position={openIndex >= 0 ? { index: openIndex + 1, total: visibleGridStudents.length } : null}
          hasResult={members.some((member) => member.user_id === openStudent.student_id && member.has_result)}
          readOnly={isLocked}
          onChangeCell={(criteriaId, value) => handleChangeCell(openStudent.grid_student_id, criteriaId, value)}
          onChangeUnderstanding={(value) => void updateUnderstanding(openStudent, value)}
          onPrevious={previousStudent ? () => setOpenId(previousStudent.grid_student_id) : null}
          onNext={nextStudent ? () => setOpenId(nextStudent.grid_student_id) : null}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
};
