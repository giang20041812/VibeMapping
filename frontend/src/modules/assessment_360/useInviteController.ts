import { useCallback, useEffect, useState } from 'react';
import type { GroupSelection } from '../invitation_link/components/GroupPicker';
import { GROUP_LABEL, INVITE_GROUPS, MAX_EXPECTED_PER_GROUP } from '../invitation_link/invitation.constants';
import type { InviteGroup } from '../invitation_link/invitation.constants';
import { answerConsent, createLinks, disableInvites, getInviteState, revokeAndRecreate } from '../invitation_link/invitation.service';
import type { InviteLink, InviteState } from '../invitation_link/invitation.service';

export type GroupSelections = Record<InviteGroup, GroupSelection>;

export const emptySelections = (): GroupSelections => ({
  parent: { checked: false, count: '1' },
  friend: { checked: false, count: '1' },
  teacher: { checked: false, count: '1' },
  mentor: { checked: false, count: '1' },
});

/** Mọi thứ phần "mời đánh giá" cần để hiển thị và thao tác; tách khỏi giao diện để xem thử bằng dữ liệu mẫu */
export interface InviteController {
  state: InviteState | null;
  isLoading: boolean;
  hasError: boolean;
  busy: boolean;
  locked: boolean;
  actionError: string | null;
  notice: string | null;
  selections: GroupSelections;
  pickerError: string | null;
  revokeTarget: InviteLink | null;
  confirmOff: boolean;
  consentOpen: boolean;
  setSelection: (group: InviteGroup, value: GroupSelection) => void;
  setRevokeTarget: (link: InviteLink | null) => void;
  setConfirmOff: (open: boolean) => void;
  setConsentOpen: (open: boolean) => void;
  /** Người dùng gạt công tắc: bật thì hỏi đồng ý, tắt thì xác nhận (nếu đang có đường dẫn) rồi thu hồi */
  requestToggle: () => void;
  answerConsent: (agree: boolean) => void;
  createLinks: () => void;
  revoke: () => void;
  recreate: (link: InviteLink) => void;
  turnOff: () => void;
}

export function useInviteController(userId: string | undefined, locked: boolean): InviteController {
  const [state, setState] = useState<InviteState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selections, setSelections] = useState(emptySelections);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteLink | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setState(await getInviteState(userId));
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (action: () => Promise<void>, failure: string, success?: string) => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      await reload();
      if (success) setNotice(success);
    } catch {
      setActionError(failure);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = () => {
    setConfirmOff(false);
    void run(() => disableInvites(userId as string, state?.resultId ?? null), 'Không tắt được việc mời, vui lòng thử lại');
  };

  return {
    state,
    isLoading,
    hasError,
    busy,
    locked,
    actionError,
    notice,
    selections,
    pickerError,
    revokeTarget,
    confirmOff,
    consentOpen,
    setSelection: (group, value) => setSelections((prev) => ({ ...prev, [group]: value })),
    setRevokeTarget,
    setConfirmOff,
    setConsentOpen,
    requestToggle: () => {
      if (!state) return;
      if (state.consent !== 'granted') setConsentOpen(true);
      else if (state.links.length > 0) setConfirmOff(true);
      else turnOff();
    },
    answerConsent: (agree) => {
      setConsentOpen(false);
      void run(() => answerConsent(userId as string, state?.resultId ?? null, agree), 'Không ghi nhận được lựa chọn, vui lòng thử lại');
    },
    createLinks: () => {
      if (!state || !userId) return;
      const chosen = INVITE_GROUPS.filter((g) => selections[g.key].checked && !state.links.some((l) => l.group === g.key));
      const parsed = chosen.map((g) => ({ group: g.key, count: Number(selections[g.key].count) }));
      if (parsed.some((p) => !Number.isInteger(p.count) || p.count < 1 || p.count > MAX_EXPECTED_PER_GROUP)) {
        setPickerError(`Số người dự kiến từ 1 đến ${MAX_EXPECTED_PER_GROUP}.`);
        return;
      }
      setPickerError(null);
      void run(
        async () => {
          await createLinks(userId, parsed, state.expiryDays);
          setSelections(emptySelections());
        },
        'Không tạo được đường dẫn mời, vui lòng thử lại',
      );
    },
    revoke: () => {
      const link = revokeTarget;
      if (!link || !state || !userId) return;
      setRevokeTarget(null);
      void run(
        () => revokeAndRecreate(userId, link, state.expiryDays),
        'Không thu hồi được đường dẫn, vui lòng thử lại',
        `Đã thu hồi đường dẫn cũ. Đường dẫn mới cho nhóm ${GROUP_LABEL[link.group]} đã được tạo.`,
      );
    },
    recreate: (link) => {
      if (!state || !userId) return;
      void run(() => revokeAndRecreate(userId, link, state.expiryDays), 'Không tạo được đường dẫn mới, vui lòng thử lại');
    },
    turnOff,
  };
}
