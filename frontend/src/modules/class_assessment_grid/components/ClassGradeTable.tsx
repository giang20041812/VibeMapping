import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, Modal, ProgressBar, Select } from '../../../components/common';
import { PACKAGES } from '../../assessment_session/assessmentSession.constants';
import type { PackageSize } from '../../assessment_session/assessmentSession.types';
import { GRID_BLOCK_TEXT } from '../../class_management/class_management.constants';
import type { ClassMember } from '../../class_management/class_management.types';
import {
  saveCells,
  saveGridDefaults,
  saveStudentUnderstanding,
  setGridPackage,
  submitGrid,
  submitGridStudent,
  type CellChange,
  type Understanding,
} from '../class_assessment_grid.service';
import type { CellValue, GridData, GridStudent, StudentBlockReason } from '../class_assessment_grid.types';
import { downloadGradeTemplate } from '../grade_template';
import {
  answerOptions,
  cellToDb,
  parseCellText,
  parsePastedText,
  toScoreMap,
  type GradeSheetResult,
  type GridChange,
  type ScoreMap,
} from '../grid.logic';
import { addPending, isNetworkFailure, loadPending, removePending, clearPending } from '../grid_offline';
import { GradeImportModal } from './GradeImportModal';
import { CELL_TEXT, GradeRow } from './GradeRow';
import { GradeStudentModal } from './GradeStudentModal';
import { UnderstandingFields } from './UnderstandingFields';
import './ClassGradeTable.css';

const NO_SCORES = new Map<string, CellValue>();
const PALETTE_HEIGHT = 300;
const PALETTE_WIDTH = 260;
const EDGE_SCROLL_ZONE = 48;
/** Phím tắt nhập nhanh: số 1–5, X/N/K là "Không đủ cơ sở", Delete xóa ô */
const KEY_VALUES: Record<string, CellValue> = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', x: 'na', n: 'na', k: 'na', Delete: '', Backspace: '' };
const PALETTE_VALUES: CellValue[] = ['5', '4', '3', '2', '1', 'na'];

interface ActiveCell {
  row: number;
  col: number;
}

interface PalettePosition {
  left: number;
  top?: number;
  bottom?: number;
}

interface FillDrag {
  source: ActiveCell;
  value: CellValue;
  targets: ActiveCell[];
  marked: HTMLElement[];
}

const toPayload = (changes: GridChange[]): CellChange[] =>
  changes.map((change) => ({ gridStudentId: change.gridStudentId, questionId: change.questionId, value: cellToDb(change.value) }));
const PACKAGE_OPTIONS = PACKAGES.map((item) => ({ value: String(item.size), label: `${item.name} (${item.size} câu)` }));

interface ClassGradeTableProps {
  /** Học sinh của lớp (đã lọc theo từ khóa), mỗi người một dòng */
  members: ClassMember[];
  /** Toàn bộ học sinh của lớp, để khớp dòng trong tệp Excel */
  allMembers: ClassMember[];
  /** Bảng điểm vừa tải; cha gắn `key` theo lần tải để tải lại là làm mới */
  initialGrid: GridData;
  /** Ô tìm học sinh, đặt ở góc trên trái của bảng */
  search: React.ReactNode;
  onRemove: (member: ClassMember) => void;
  /** Gọi sau khi nộp tất cả xong; cha tải lại lớp */
  onSubmitted: () => void;
  /** Gọi sau khi đổi gói câu hỏi; cha tải lại bảng */
  onPackageChanged: () => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

export const ClassGradeTable: React.FC<ClassGradeTableProps> = ({
  members,
  allMembers,
  initialGrid,
  search,
  onRemove,
  onSubmitted,
  onPackageChanged,
  onError,
  onNotice,
}) => {
  const [grid, setGrid] = useState(initialGrid);
  /** Điểm theo từng học sinh; chỉ học sinh vừa sửa mới có bảng điểm mới nên các dòng khác không vẽ lại */
  const [scores, setScores] = useState<ScoreMap>(() => toScoreMap(initialGrid));
  /** Đang xác nhận nộp: 'all' là nộp tất cả, còn lại là mã dòng của học sinh */
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Lý do chưa nộp được, hiện trong hộp thoại xác nhận */
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  /** Học sinh đang mở hộp thoại chấm điểm riêng */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Ô đang chọn (dòng × cột) và bảng chọn đáp án nổi bên dưới ô đó */
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [palette, setPalette] = useState<PalettePosition | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<FillDrag | null>(null);
  /** Học sinh có ô còn trống được tô đỏ sau khi nộp bị chặn vì thiếu điểm */
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  /** Gói đang chờ xác nhận đổi (bảng đã có đáp án) */
  const [pendingPackage, setPendingPackage] = useState<PackageSize | null>(null);
  const [isChangingPackage, setIsChangingPackage] = useState(false);
  /** Học sinh đang được nộp */
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Hàm xử lý của dòng giữ nguyên danh tính qua các lần vẽ; đọc dữ liệu mới nhất qua ref
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const callbacksRef = useRef({ onRemove, onSubmitted, onError, onNotice });
  callbacksRef.current = { onRemove, onSubmitted, onError, onNotice };
  const isLocked = grid.status === 'submitted';
  /** Học sinh đã nộp: dòng khóa, mọi thay đổi điểm của em đó bị bỏ qua */
  const submittedIds = useMemo(
    () => new Set(grid.students.filter((student) => student.submitted_at).map((student) => student.grid_student_id)),
    [grid],
  );
  const submittedIdsRef = useRef(submittedIds);
  submittedIdsRef.current = submittedIds;
  const pendingCount = grid.students.length - submittedIds.size;
  const questions = grid.questions;
  /** Đáp án của từng câu hỏi */
  const answers = useMemo(() => new Map(questions.map((item) => [item.question_id, answerOptions(item)])), [questions]);

  const gridStudents = useMemo(() => new Map(grid.students.map((student) => [student.student_id, student])), [grid]);
  const gridStudentsById = useMemo(() => new Map(grid.students.map((student) => [student.grid_student_id, student])), [grid]);

  /** Học sinh của từng dòng theo đúng thứ tự dòng; học sinh chưa tham gia không có bảng điểm */
  const rowStudents = useMemo(
    () => members.map((member) => (member.user_id ? gridStudents.get(member.user_id) : undefined)),
    [members, gridStudents],
  );
  const visibleGridStudents = useMemo(() => rowStudents.flatMap((student) => (student ? [student] : [])), [rowStudents]);

  let totalCells = 0;
  let filledCells = 0;
  let gradedStudents = 0;
  for (const student of grid.students) {
    const own = scores.get(student.grid_student_id);
    totalCells += questions.length;
    let filledOfStudent = 0;
    if (own) for (const item of questions) if (own.get(item.question_id)) filledOfStudent += 1;
    filledCells += filledOfStudent;
    if (questions.length > 0 && filledOfStudent === questions.length) gradedStudents += 1;
  }

  const applyChanges = useCallback(async (allChanges: GridChange[]) => {
    const changes = allChanges.filter((change) => !submittedIdsRef.current.has(change.gridStudentId));
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
      if (change.value === '') own.delete(change.questionId);
      else own.set(change.questionId, change.value);
    }
    setScores(next);
    try {
      await saveCells(toPayload(changes));
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
    const stored = loadPending(gridId);
    if (stored.length === 0 || gridRef.current.status === 'submitted') return;
    // Điểm lưu tạm của em đã nộp không còn ghi được
    removePending(gridId, stored.filter((item) => submittedIdsRef.current.has(item.gridStudentId)));
    const pending = stored.filter((item) => !submittedIdsRef.current.has(item.gridStudentId));
    if (pending.length === 0) return;
    try {
      await saveCells(toPayload(pending));
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
          if (item.value === '') own.delete(item.questionId);
          else own.set(item.questionId, item.value);
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
    (gridStudentId: string, questionId: string, value: CellValue) => void applyChanges([{ gridStudentId, questionId, value }]),
    [applyChanges],
  );

  /** Đổi gói: đồng bộ đáp án lưu tạm trước, rồi thay danh sách câu hỏi; cha tải lại bảng */
  const changePackage = async (size: PackageSize) => {
    setIsChangingPackage(true);
    onError(null);
    try {
      await flushPending();
      await setGridPackage(grid.grid_id, size);
      clearPending(grid.grid_id);
      setPendingPackage(null);
      onPackageChanged();
    } catch {
      onError('Không đổi được gói câu hỏi. Thử lại sau.');
    } finally {
      setIsChangingPackage(false);
    }
  };

  const handleSelectPackage = (value: string) => {
    const size = Number(value) as PackageSize;
    if (!value || size === grid.package_size) return;
    if (filledCells > 0) setPendingPackage(size);
    else void changePackage(size);
  };

  /** Ô (dòng × cột) → học sinh và câu hỏi tương ứng; trống khi dòng chưa có bảng điểm */
  const cellTarget = (cell: ActiveCell) => {
    const student = rowStudents[cell.row];
    const item = questions[cell.col];
    return student && item ? { student, item } : null;
  };

  /** Dòng gần nhất theo hướng `step` (từ vị trí `from`) có bảng điểm; không có thì giữ nguyên */
  const nearestRow = (from: number, step: 1 | -1) => {
    for (let row = from + step; row >= 0 && row < rowStudents.length; row += step) if (rowStudents[row]) return row;
    return from;
  };

  const moveActive = (rowStep: number, columnStep: number) =>
    setActive((current) => {
      if (!current) return current;
      const row = rowStep === 0 ? current.row : nearestRow(current.row, rowStep > 0 ? 1 : -1);
      const col = Math.min(Math.max(current.col + columnStep, 0), questions.length - 1);
      return { row, col };
    });

  const setActiveValue = (value: CellValue, advance: boolean) => {
    const target = active && cellTarget(active);
    if (!target || target.student.submitted_at || isLocked) return;
    void applyChanges([{ gridStudentId: target.student.grid_student_id, questionId: target.item.question_id, value }]);
    if (advance) moveActive(1, 0);
  };

  const closeSelection = () => {
    setActive(null);
    setIsPaletteOpen(false);
  };

  /** Bấm một ô: chọn ô và mở bảng đáp án ngay bên dưới */
  const handleSheetClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('td[data-ri]');
    if (!cell) return;
    setActive({ row: Number(cell.dataset.ri), col: Number(cell.dataset.ci) });
    setIsPaletteOpen(!isLocked && !cell.classList.contains('is-locked'));
  };

  /** Gõ trong ô tìm kiếm ở góc bảng không được coi là nhập điểm */
  const isTyping = (event: React.SyntheticEvent) => (event.target as HTMLElement).tagName === 'INPUT';

  const handleSheetKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTyping(event) || !active || event.ctrlKey || event.metaKey || event.altKey) return;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, 1], Enter: [1, 0] };
    const step = arrows[event.key];
    if (step) {
      event.preventDefault();
      moveActive(event.shiftKey ? -step[0] : step[0], event.shiftKey ? -step[1] : step[1]);
    } else if (event.key === 'Escape') {
      closeSelection();
    } else if (event.key.toLowerCase() in KEY_VALUES || event.key in KEY_VALUES) {
      event.preventDefault();
      setActiveValue(KEY_VALUES[event.key] ?? KEY_VALUES[event.key.toLowerCase()], true);
    }
  };

  /** Chép giá trị ô đang chọn để dán sang ô khác hoặc sang Excel */
  const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const target = active && cellTarget(active);
    if (!target || isTyping(event)) return;
    const value = scoresRef.current.get(target.student.grid_student_id)?.get(target.item.question_id) ?? '';
    event.clipboardData.setData('text/plain', value === 'na' ? 'na' : value);
    event.preventDefault();
  };

  const clearFillMarks = () => {
    dragRef.current?.marked.forEach((cell) => cell.classList.remove('is-fill-target'));
    if (dragRef.current) dragRef.current.marked = [];
  };

  /** Kéo núm ở góc ô: sao chép giá trị ô nguồn ra các ô kéo qua, theo hàng dọc hoặc ngang */
  const handleSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest('[data-handle]') || !active || isLocked) return;
    const target = cellTarget(active);
    if (!target) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const value = scoresRef.current.get(target.student.grid_student_id)?.get(target.item.question_id) ?? '';
    dragRef.current = { source: active, value, targets: [], marked: [] };
    setIsPaletteOpen(false);
    event.currentTarget.classList.add('is-filling');
  };

  const handleSheetPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const sheet = event.currentTarget;
    const bounds = sheet.getBoundingClientRect();
    if (event.clientY > bounds.bottom - EDGE_SCROLL_ZONE) sheet.scrollTop += 16;
    else if (event.clientY < bounds.top + EDGE_SCROLL_ZONE) sheet.scrollTop -= 16;
    if (event.clientX > bounds.right - EDGE_SCROLL_ZONE) sheet.scrollLeft += 16;
    else if (event.clientX < bounds.left + EDGE_SCROLL_ZONE) sheet.scrollLeft -= 16;

    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('td[data-ri]');
    if (!cell) return;
    const row = Number(cell.dataset.ri);
    const col = Number(cell.dataset.ci);
    const { source } = drag;
    const vertical = Math.abs(row - source.row) >= Math.abs(col - source.col);
    const targets: ActiveCell[] = [];
    if (vertical) {
      const step = row >= source.row ? 1 : -1;
      for (let current = source.row + step; step > 0 ? current <= row : current >= row; current += step) targets.push({ row: current, col: source.col });
    } else {
      const step = col >= source.col ? 1 : -1;
      for (let current = source.col + step; step > 0 ? current <= col : current >= col; current += step) targets.push({ row: source.row, col: current });
    }
    clearFillMarks();
    drag.targets = targets.filter((item) => {
      const found = cellTarget(item);
      return found && !found.student.submitted_at;
    });
    drag.marked = drag.targets.flatMap((item) => {
      const found = sheet.querySelector<HTMLElement>(`td[data-ri="${item.row}"][data-ci="${item.col}"]`);
      return found ? [found] : [];
    });
    drag.marked.forEach((found) => found.classList.add('is-fill-target'));
  };

  const endFill = (event: React.PointerEvent<HTMLDivElement>, apply: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    clearFillMarks();
    dragRef.current = null;
    event.currentTarget.classList.remove('is-filling');
    if (!apply) return;
    const changes = drag.targets.flatMap((item) => {
      const found = cellTarget(item);
      return found ? [{ gridStudentId: found.student.grid_student_id, questionId: found.item.question_id, value: drag.value }] : [];
    });
    void applyChanges(changes);
  };

  /** Dán từ bảng tính: bắt đầu từ ô đang chọn, đi sang phải theo câu hỏi và xuống dưới theo học sinh */
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (isLocked || !active || isTyping(event)) return;
    const matrix = parsePastedText(event.clipboardData.getData('text'));
    if (matrix.length === 0) return;
    event.preventDefault();

    const changes: GridChange[] = [];
    let invalid = 0;
    matrix.forEach((line, rowOffset) =>
      line.forEach((text, columnOffset) => {
        const found = cellTarget({ row: active.row + rowOffset, col: active.col + columnOffset });
        if (!found) return;
        const { student, item } = found;
        if (student.submitted_at) return;
        const parsed = parseCellText(text);
        if (parsed === null) invalid += 1;
        else if (parsed !== '') changes.push({ gridStudentId: student.grid_student_id, questionId: item.question_id, value: parsed });
      }),
    );
    void applyChanges(changes);
    onNotice(`Đã dán ${changes.length} ô${invalid > 0 ? `, bỏ qua ${invalid} ô sai giá trị` : ''}.`);
  };

  // Lọc lại danh sách đổi vị trí các dòng: bỏ chọn để khỏi trỏ nhầm học sinh
  useEffect(() => {
    setActive(null);
    setIsPaletteOpen(false);
  }, [members]);

  const findActiveCell = () =>
    active ? sheetRef.current?.querySelector<HTMLElement>(`td[data-ri="${active.row}"][data-ci="${active.col}"]`) ?? null : null;

  /** Đặt bảng đáp án ngay dưới ô đang chọn (lật lên trên khi sát đáy màn hình), đi theo khi cuộn */
  const placePalette = useCallback(() => {
    const cell = findActiveCell();
    if (!cell) return setPalette(null);
    const rect = cell.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - PALETTE_WIDTH - 8));
    const flip = rect.bottom + PALETTE_HEIGHT > window.innerHeight && rect.top > PALETTE_HEIGHT;
    setPalette(flip ? { left, bottom: window.innerHeight - rect.top + 4 } : { left, top: rect.bottom + 4 });
  }, [active]);

  // Ô đang chọn luôn nằm trong vùng nhìn thấy khi di chuyển bằng bàn phím
  useEffect(() => {
    findActiveCell()?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (!isPaletteOpen) return;
    placePalette();
    const sheet = sheetRef.current;
    sheet?.addEventListener('scroll', placePalette, { passive: true });
    window.addEventListener('scroll', placePalette, { passive: true });
    window.addEventListener('resize', placePalette);
    return () => {
      sheet?.removeEventListener('scroll', placePalette);
      window.removeEventListener('scroll', placePalette);
      window.removeEventListener('resize', placePalette);
    };
  }, [active, isPaletteOpen, placePalette]);

  // Bấm ra ngoài bảng thì bỏ chọn ô
  useEffect(() => {
    if (!active) return;
    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sheetRef.current?.contains(target) || paletteRef.current?.contains(target)) return;
      closeSelection();
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [active]);

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

  const blockText = (reason: StudentBlockReason, emptyCount?: number) =>
    `${GRID_BLOCK_TEXT[reason] ?? 'Chưa nộp được'}${reason === 'empty_cells' && emptyCount ? ` (${emptyCount} ô)` : ''}`;

  /** Tô đỏ ô trống của các em bị chặn vì thiếu điểm và cuộn tới ô đầu tiên */
  const showMissing = (gridStudentIds: string[]) => {
    setHighlightIds(new Set(gridStudentIds));
    window.requestAnimationFrame(() =>
      document.querySelector('.grid-cell.is-missing')?.scrollIntoView({ block: 'center', inline: 'center' }),
    );
  };

  /** Nộp một học sinh; nộp xong dòng của em đó khóa, chưa đủ điều kiện thì nêu lý do */
  const handleSubmitStudent = async (student: GridStudent) => {
    const name = student.full_name || 'Học sinh';
    setConfirmTarget(null);
    setSubmittingId(student.grid_student_id);
    onError(null);
    try {
      await flushPending();
      const result = await submitGridStudent(student.grid_student_id);
      if (result.ok) {
        setGrid((current) => ({
          ...current,
          students: current.students.map((item) =>
            item.grid_student_id === student.grid_student_id ? { ...item, submitted_at: new Date().toISOString() } : item,
          ),
        }));
        setHighlightIds((current) => new Set([...current].filter((id) => id !== student.grid_student_id)));
        onNotice(`Đã nộp điểm của ${name}.`);
        return;
      }
      if (result.reason === 'empty_cells') showMissing([student.grid_student_id]);
      onError(`${name}: ${blockText(result.reason, result.empty_count)}`);
    } catch {
      onError('Không nộp được điểm. Thử lại sau.');
    } finally {
      setSubmittingId(null);
    }
  };

  /** Nộp tất cả em đủ điều kiện; các em còn lại được nêu tên kèm lý do */
  const handleSubmitAll = async () => {
    setIsSubmitting(true);
    setBlockedReasons([]);
    onError(null);
    try {
      await flushPending();
      const result = await submitGrid(grid.grid_id);
      if (!result.ok) {
        setBlockedReasons([GRID_BLOCK_TEXT[result.reason] ?? 'Chưa nộp được']);
        return;
      }
      setConfirmTarget(null);
      const skipped = result.skipped.map(
        (item) => `${gridStudents.get(item.student_id)?.full_name || 'Học sinh'}: ${blockText(item.reason, item.empty_count)}`,
      );
      onNotice(`Đã nộp ${result.submitted_count} học sinh.`);
      if (skipped.length > 0) onError(`Chưa nộp ${skipped.length} học sinh. ${skipped.join('; ')}`);
      if (result.submitted_count > 0) {
        onSubmitted();
        return;
      }
      showMissing(
        result.skipped
          .filter((item) => item.reason === 'empty_cells')
          .flatMap((item) => gridStudents.get(item.student_id)?.grid_student_id ?? []),
      );
    } catch {
      setBlockedReasons(['Không nộp được. Thử lại sau.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestSubmit = useCallback((gridStudentId: string) => {
    setBlockedReasons([]);
    setConfirmTarget(gridStudentId);
  }, []);

  const handleRemove = useCallback((member: ClassMember) => callbacksRef.current.onRemove(member), []);

  const handleDownloadTemplate = () => {
    void downloadGradeTemplate(
      allMembers.filter((member) => member.user_id && gridStudents.has(member.user_id)),
      questions,
    ).catch(() => onError('Không tạo được tệp mẫu. Thử lại sau.'));
  };

  const confirmStudent = confirmTarget && confirmTarget !== 'all' ? (gridStudentsById.get(confirmTarget) ?? null) : null;

  const openIndex = openId ? visibleGridStudents.findIndex((student) => student.grid_student_id === openId) : -1;
  const openStudent = openId ? (gridStudentsById.get(openId) ?? null) : null;
  const previousStudent = openIndex > 0 ? visibleGridStudents[openIndex - 1] : null;
  const nextStudent = openIndex >= 0 && openIndex < visibleGridStudents.length - 1 ? visibleGridStudents[openIndex + 1] : null;

  const defaults: Understanding = {
    acquaintance_duration: grid.default_acquaintance_duration,
    contact_frequency: grid.default_contact_frequency,
    observation_depth: grid.default_observation_depth,
  };

  const packageModal = (
    <Modal
      open={pendingPackage !== null}
      title="Đổi gói câu hỏi"
      locked={isChangingPackage}
      onClose={() => setPendingPackage(null)}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => setPendingPackage(null)} disabled={isChangingPackage}>
            Hủy bỏ
          </Button>
          <Button type="button" onClick={() => pendingPackage && void changePackage(pendingPackage)} isLoading={isChangingPackage}>
            Đổi gói
          </Button>
        </>
      }
    >
      <Alert variant="warning">Đáp án của câu không có trong gói mới sẽ bị xóa.</Alert>
    </Modal>
  );

  const packageSelect = (
    <Select
      className="grid-package-select"
      label="Gói câu hỏi"
      options={PACKAGE_OPTIONS}
      emptyLabel="Chọn gói"
      value={grid.package_size ? String(grid.package_size) : ''}
      disabled={isLocked || isChangingPackage || submittedIds.size > 0}
      onChange={handleSelectPackage}
    />
  );

  const hasQuestions = questions.length > 0;

  return (
    <>
      <Card
        noPadding
        className="grid-card"
        title="Bảng chấm điểm"
        action={
          isLocked || (grid.students.length > 0 && pendingCount === 0) ? (
            <Badge variant="success">Đã nộp</Badge>
          ) : (
            <div className="class-header-actions">
              <Button type="button" variant="outline" leftIcon={<FileSpreadsheet size={16} />} disabled={!hasQuestions} onClick={() => setIsImportOpen(true)}>
                Nhập điểm từ Excel
              </Button>
              <Button
                type="button"
                leftIcon={<Send size={16} />}
                disabled={!hasQuestions || submittingId !== null}
                onClick={() => {
                  setBlockedReasons([]);
                  setConfirmTarget('all');
                }}
              >
                Nộp tất cả
              </Button>
            </div>
          )
        }
      >
        <div className="grid-settings">
          {packageSelect}
          <UnderstandingFields value={defaults} emptyLabel="Chưa chọn" disabled={isLocked} onChange={(value) => void handleDefaults(value)} />
        </div>
        <div className="grid-progress">
          <ProgressBar value={totalCells === 0 ? null : (filledCells / totalCells) * 100} label="Tiến độ chấm" />
          <p className="grid-progress-text">
            {gradedStudents}/{grid.students.length} học sinh đã chấm đủ · {submittedIds.size}/{grid.students.length} đã nộp ·{' '}
            {filledCells}/{totalCells} ô
          </p>
        </div>

        <div
          ref={sheetRef}
          className="grid-sheet"
          tabIndex={-1}
          onClick={handleSheetClick}
          onKeyDown={handleSheetKeyDown}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={(event) => endFill(event, true)}
          onPointerCancel={(event) => endFill(event, false)}
        >
          <table className="grid-table">
            <caption className="app-table-caption">Đáp án của học sinh theo câu hỏi</caption>
            <thead>
              <tr>
                <th scope="col" className="grid-sticky grid-corner">
                  {search}
                </th>
                {questions.map((item) => (
                  <th key={item.question_id} scope="col" className="grid-question-col">
                    <span className="grid-head-name">{item.content}</span>
                  </th>
                ))}
                <th scope="col" className="grid-extra-col">Thấu hiểu</th>
                <th scope="col" className="grid-extra-col" />
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td className="grid-empty" colSpan={questions.length + 3}>Không có học sinh</td>
                </tr>
              )}
              {members.map((member, rowIndex) => {
                const student = rowStudents[rowIndex];
                return (
                  <GradeRow
                    key={member.member_id}
                    member={member}
                    rowIndex={rowIndex}
                    student={student}
                    scores={student ? (scores.get(student.grid_student_id) ?? NO_SCORES) : undefined}
                    questions={questions}
                    answers={answers}
                    readOnly={isLocked || Boolean(student?.submitted_at)}
                    activeColumn={active?.row === rowIndex ? active.col : -1}
                    highlightMissing={student ? highlightIds.has(student.grid_student_id) : false}
                    submitting={student ? submittingId === student.grid_student_id : false}
                    onSubmit={handleRequestSubmit}
                    onOpen={setOpenId}
                    onRemove={handleRemove}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Gắn thẳng vào body: khung kính mờ của trang làm lệch vị trí cố định nếu để bên trong */}
      {isPaletteOpen &&
        palette &&
        active &&
        cellTarget(active) &&
        createPortal(
          <div
            ref={paletteRef}
            className="grid-palette"
            role="listbox"
            aria-label="Chọn đáp án"
            style={{ left: palette.left, top: palette.top, bottom: palette.bottom }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {PALETTE_VALUES.map((value) => {
              const target = cellTarget(active)!;
              const label = answers.get(target.item.question_id)?.find((option) => option.value === value)?.label ?? '';
              const current = scores.get(target.student.grid_student_id)?.get(target.item.question_id) === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={current}
                  className={`grid-palette-option${current ? ' is-current' : ''}`}
                  onClick={() => setActiveValue(value, true)}
                >
                  <span className={`grid-palette-chip is-${value}`}>{CELL_TEXT[value]}</span>
                  <span className="grid-palette-label">{label}</span>
                </button>
              );
            })}
            <button type="button" className="grid-palette-option" onClick={() => setActiveValue('', false)}>
              <span className="grid-palette-chip is-empty" />
              <span className="grid-palette-label">Xóa đáp án</span>
            </button>
          </div>,
          document.body,
        )}

      <GradeImportModal
        open={isImportOpen}
        students={sheetStudents}
        questions={questions}
        onDownloadTemplate={handleDownloadTemplate}
        onApply={handleImportApply}
        onClose={() => setIsImportOpen(false)}
      />

      <Modal
        open={confirmTarget !== null}
        title={confirmStudent ? `Nộp điểm của ${confirmStudent.full_name || 'học sinh'}` : 'Nộp tất cả'}
        locked={isSubmitting}
        onClose={() => setConfirmTarget(null)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirmTarget(null)} disabled={isSubmitting}>
              Quay lại chỉnh sửa
            </Button>
            <Button
              type="button"
              onClick={() => void (confirmStudent ? handleSubmitStudent(confirmStudent) : handleSubmitAll())}
              isLoading={isSubmitting}
            >
              Nộp
            </Button>
          </>
        }
      >
        {blockedReasons.map((reason) => (
          <Alert key={reason} variant="danger">{reason}</Alert>
        ))}
        {!confirmStudent && (
          <p className="grid-progress-text">
            {pendingCount} học sinh chưa nộp · {gradedStudents}/{grid.students.length} học sinh đã chấm đủ
          </p>
        )}
        <Alert variant="warning">Sau khi nộp, không sửa được điểm của học sinh đã nộp.</Alert>
      </Modal>

      {openStudent && (
        <GradeStudentModal
          student={openStudent}
          questions={questions}
          answers={answers}
          values={scores.get(openStudent.grid_student_id) ?? NO_SCORES}
          position={openIndex >= 0 ? { index: openIndex + 1, total: visibleGridStudents.length } : null}
          hasResult={members.some((member) => member.user_id === openStudent.student_id && member.has_result)}
          readOnly={isLocked || Boolean(openStudent.submitted_at)}
          onChangeCell={(questionId, value) => handleChangeCell(openStudent.grid_student_id, questionId, value)}
          onChangeUnderstanding={(value) => void updateUnderstanding(openStudent, value)}
          onPrevious={previousStudent ? () => setOpenId(previousStudent.grid_student_id) : null}
          onNext={nextStudent ? () => setOpenId(nextStudent.grid_student_id) : null}
          onClose={() => setOpenId(null)}
        />
      )}

      {packageModal}
    </>
  );
};
