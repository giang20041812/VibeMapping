import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Download } from 'lucide-react';
import { Button, Card, Modal, ProgressBar, Select, Textarea } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { GRID_BLOCK_TEXT } from '../../class_management/class_management.constants';
import type { ClassMember } from '../../class_management/class_management.types';
import {
  saveCells,
  saveGridDefaults,
  saveStudentUnderstanding,
  submitGridStudent,
  type CellChange,
  type Understanding,
} from '../class_assessment_grid.service';
import type { CellValue, GridData, GridStudent, ShortCriteria } from '../class_assessment_grid.types';
import { downloadGradeTemplate } from '../grade_template';
import { CELL_OPTIONS, cellToDb, parsePaste, toScoreMap, type ScoreMap } from '../grid.logic';
import { GradeRow } from './GradeRow';
import { GradeStudentModal } from './GradeStudentModal';
import { UnderstandingFields } from './UnderstandingFields';
import './ClassGradeTable.css';

const NO_SCORES = new Map<string, CellValue>();

interface ClassGradeTableProps {
  /** Học sinh của lớp (đã lọc theo từ khóa), mỗi người một dòng */
  members: ClassMember[];
  /** Bảng điểm vừa tải; cha gắn `key` theo lần tải để tải lại là làm mới */
  initialGrid: GridData;
  /** Toàn bộ tiêu chí của bộ rút gọn */
  criteria: ShortCriteria[];
  /** Chỉ hiện tiêu chí của nhóm này; rỗng là hiện hết */
  groupCode: string;
  onRemove: (member: ClassMember) => void;
  /** Gọi sau khi nộp xong một học sinh */
  onSubmitted: (studentId: string) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

export const ClassGradeTable: React.FC<ClassGradeTableProps> = ({
  members,
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
  /** Học sinh đã nộp nhưng sau đó sửa điểm, chưa nộp lại */
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [fillCriteria, setFillCriteria] = useState(criteria[0]?.id ?? '');
  const [fillValue, setFillValue] = useState<CellValue>('3');
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  /** Học sinh đang mở hộp thoại chấm điểm riêng */
  const [openId, setOpenId] = useState<string | null>(null);

  // Hàm xử lý của dòng giữ nguyên danh tính qua các lần vẽ; đọc dữ liệu mới nhất qua ref
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const callbacksRef = useRef({ onRemove, onSubmitted, onError, onNotice });
  callbacksRef.current = { onRemove, onSubmitted, onError, onNotice };

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
  for (const student of grid.students) {
    const own = scores.get(student.grid_student_id);
    totalCells += criteria.length;
    if (own) for (const item of criteria) if (own.get(item.id)) filledCells += 1;
  }

  const applyChanges = useCallback(async (changes: { gridStudentId: string; criteriaId: string; value: CellValue }[]) => {
    if (changes.length === 0) return;
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
    setDirtyIds((current) => {
      const updated = new Set(current);
      for (const id of touched.keys()) {
        const student = gridRef.current.students.find((item) => item.grid_student_id === id);
        if (student?.submitted_at) updated.add(id);
      }
      return updated.size === current.size ? current : updated;
    });
    try {
      const payload: CellChange[] = changes.map((change) => ({
        gridStudentId: change.gridStudentId,
        criteriaId: change.criteriaId,
        value: cellToDb(change.value),
      }));
      await saveCells(payload);
      callbacksRef.current.onNotice(null);
    } catch {
      setScores(previous);
      callbacksRef.current.onError('Không lưu được điểm. Thử lại sau.');
    }
  }, []);

  const handleChangeCell = useCallback(
    (gridStudentId: string, criteriaId: string, value: CellValue) => void applyChanges([{ gridStudentId, criteriaId, value }]),
    [applyChanges],
  );

  const handleFillColumn = () => {
    if (!fillCriteria) return;
    void applyChanges(visibleGridStudents.map((student) => ({ gridStudentId: student.grid_student_id, criteriaId: fillCriteria, value: fillValue })));
  };

  const handlePaste = () => {
    const result = parsePaste(pasteText, visibleGridStudents, visibleCriteria);
    void applyChanges(result.changes);
    setIsPasteOpen(false);
    setPasteText('');
    onNotice(result.invalid > 0 ? `Đã dán ${result.changes.length} ô, bỏ qua ${result.invalid} ô sai giá trị.` : `Đã dán ${result.changes.length} ô.`);
  };

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
    if (student.submitted_at) setDirtyIds((current) => new Set(current).add(student.grid_student_id));
    try {
      await saveStudentUnderstanding(student.grid_student_id, value);
    } catch {
      onError('Không lưu được mức thấu hiểu của học sinh.');
    }
  };

  /** Gửi điểm một học sinh; trả về thông báo lỗi nếu chưa gửi được, null nếu đã gửi */
  const submitStudent = useCallback(async (student: GridStudent): Promise<string | null> => {
    setSubmittingId(student.grid_student_id);
    callbacksRef.current.onError(null);
    callbacksRef.current.onNotice(null);
    const name = student.full_name || 'Học sinh';
    try {
      const result = await submitGridStudent(student.grid_student_id);
      if (result.ok) {
        setGrid((current) => ({
          ...current,
          students: current.students.map((item) =>
            item.grid_student_id === student.grid_student_id ? { ...item, submitted_at: new Date().toISOString() } : item,
          ),
        }));
        setDirtyIds((current) => {
          const next = new Set(current);
          next.delete(student.grid_student_id);
          return next;
        });
        callbacksRef.current.onSubmitted(student.student_id);
        callbacksRef.current.onNotice(`Đã gửi điểm của ${name}.`);
        return null;
      }
      if (result.reason === 'empty_cells') return `${name}: còn ${result.empty_count} tiêu chí chưa chấm.`;
      if (result.reason === 'short_set_not_configured') return 'Chưa có tiêu chí nào thuộc bộ câu hỏi rút gọn.';
      return `${name}: ${GRID_BLOCK_TEXT[result.reason] ?? 'chưa gửi được điểm.'}`;
    } catch {
      return 'Không gửi được điểm. Thử lại sau.';
    } finally {
      setSubmittingId(null);
    }
  }, []);

  const handleRowSubmit = useCallback(
    async (student: GridStudent) => {
      const message = await submitStudent(student);
      if (message) callbacksRef.current.onError(message);
    },
    [submitStudent],
  );

  const handleRemove = useCallback((member: ClassMember) => callbacksRef.current.onRemove(member), []);

  const handleDownloadTemplate = () => {
    void downloadGradeTemplate(
      members.filter((member) => member.user_id && gridStudents.has(member.user_id)),
      visibleCriteria,
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
      <Card title="Mức thấu hiểu của cả lớp">
        <UnderstandingFields value={defaults} emptyLabel="Chưa chọn" onChange={(value) => void handleDefaults(value)} />
        <ProgressBar value={totalCells === 0 ? null : (filledCells / totalCells) * 100} label="Tiến độ chấm" />
        <p className="grid-progress-text">
          {filledCells}/{totalCells} ô
        </p>
      </Card>

      <div className="grid-fill-bar">
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
        <Button type="button" variant="outline" leftIcon={<ClipboardPaste size={16} />} onClick={() => setIsPasteOpen(true)}>
          Dán từ Excel
        </Button>
        <Button type="button" variant="outline" leftIcon={<Download size={16} />} onClick={handleDownloadTemplate}>
          Tải tệp mẫu
        </Button>
      </div>

      <Card noPadding title="Học sinh">
        <div className="app-table-scroll">
          <table className="app-table grid-table">
            <caption className="app-table-caption">Bảng điểm học sinh theo tiêu chí</caption>
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
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td className="app-table-empty" colSpan={visibleCriteria.length + 3}>Lớp chưa có học sinh</td>
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
                    isDirty={student ? dirtyIds.has(student.grid_student_id) : false}
                    isSubmitting={student ? submittingId === student.grid_student_id : false}
                    isBusy={submittingId !== null}
                    onOpen={setOpenId}
                    onChangeCell={handleChangeCell}
                    onSubmit={handleRowSubmit}
                    onRemove={handleRemove}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

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
          label="Điểm theo thứ tự học sinh đã tham gia và tiêu chí đang hiển thị"
          rows={8}
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
        />
      </Modal>

      {openStudent && (
        <GradeStudentModal
          student={openStudent}
          criteria={criteria}
          values={scores.get(openStudent.grid_student_id) ?? NO_SCORES}
          position={openIndex >= 0 ? { index: openIndex + 1, total: visibleGridStudents.length } : null}
          hasResult={members.some((member) => member.user_id === openStudent.student_id && member.has_result)}
          isDirty={dirtyIds.has(openStudent.grid_student_id)}
          isSubmitting={submittingId === openStudent.grid_student_id}
          onChangeCell={(criteriaId, value) => handleChangeCell(openStudent.grid_student_id, criteriaId, value)}
          onChangeUnderstanding={(value) => void updateUnderstanding(openStudent, value)}
          onSubmit={() => submitStudent(openStudent)}
          onPrevious={previousStudent ? () => setOpenId(previousStudent.grid_student_id) : null}
          onNext={nextStudent ? () => setOpenId(nextStudent.grid_student_id) : null}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
};
