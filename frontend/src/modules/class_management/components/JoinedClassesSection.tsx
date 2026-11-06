import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Alert, Button, Card, DataTable, Input, Modal } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { JOIN_ERROR_TEXT } from '../class_management.constants';
import { findMyMemberId, joinClassByCode, leaveClass, listJoinedClasses } from '../class_management.service';
import type { JoinedClass } from '../class_management.types';
import '../ClassManagement.css';

export interface JoinedClassesSectionProps {
  userId: string;
  /** Mã lớp điền sẵn (từ đường dẫn hoặc mã QR của lớp) */
  initialClassCode?: string;
  /** Báo cho hộp thoại chứa phần này biết đang có hộp thoại con mở, để Esc chỉ đóng hộp thoại con */
  onDialogOpenChange?: (open: boolean) => void;
}

/** Tham gia lớp bằng mã lớp và danh sách lớp đã tham gia của học sinh, sinh viên */
export const JoinedClassesSection: React.FC<JoinedClassesSectionProps> = ({ userId, initialClassCode = '', onDialogOpenChange }) => {
  const [classes, setClasses] = useState<JoinedClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [classCode, setClassCode] = useState(initialClassCode);
  const [studentCode, setStudentCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<JoinedClass | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
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

  useEffect(() => {
    onDialogOpenChange?.(leaveTarget !== null);
  }, [leaveTarget, onDialogOpenChange]);

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

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setIsLeaving(true);
    setError(null);
    setNotice(null);
    try {
      const memberId = await findMyMemberId(leaveTarget.id, userId);
      if (memberId) await leaveClass(memberId);
      setLeaveTarget(null);
      setReloadKey((value) => value + 1);
    } catch {
      setLeaveTarget(null);
      setError('Không rời được lớp. Thử lại sau.');
    } finally {
      setIsLeaving(false);
    }
  };

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
          <Button type="button" size="sm" variant="outline" leftIcon={<LogOut size={14} />} onClick={() => setLeaveTarget(row)}>
            Rời lớp
          </Button>
        ),
      },
    ],
    [],
  );

  const closeLeave = useCallback(() => setLeaveTarget(null), []);

  return (
    <section className="class-stack" aria-labelledby="class-joined-title">
      <h3 id="class-joined-title" className="section-title">
        Lớp học
      </h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      <Alert variant="info">Giáo viên của lớp sẽ đánh giá hướng nghiệp của bạn. Tham gia lớp được coi là đồng ý.</Alert>
      <form className="class-join-form" onSubmit={handleJoin}>
        <Input label="Mã lớp" value={classCode} onChange={(event) => setClassCode(event.target.value)} required />
        <Input label="Mã học sinh" value={studentCode} onChange={(event) => setStudentCode(event.target.value)} />
        <Button type="submit" isLoading={isJoining} disabled={!classCode.trim()}>
          Tham gia
        </Button>
      </form>
      <Card noPadding>
        <DataTable columns={columns} rows={classes} rowKey={(row) => row.id} isLoading={isLoading} emptyText="Chưa tham gia lớp nào" caption="Lớp đã tham gia" />
      </Card>

      <Modal
        open={leaveTarget !== null}
        title={`Rời lớp ${leaveTarget?.class_name ?? ''}?`}
        onClose={closeLeave}
        locked={isLeaving}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={closeLeave} disabled={isLeaving}>
              Hủy
            </Button>
            <Button type="button" variant="danger" onClick={() => void handleLeave()} isLoading={isLeaving}>
              Rời lớp
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </section>
  );
};
