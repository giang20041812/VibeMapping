import { useCallback, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { Textarea } from '../Textarea/Textarea';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export interface AskTextOptions {
  title: string;
  label: string;
  confirmLabel?: string;
  /** Số ký tự tối thiểu để nút xác nhận bật */
  minLength?: number;
}

/** Hộp thoại xác nhận thay cho window.confirm: `if (!(await confirm({...}))) return;` rồi đặt `dialog` trong JSX */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    [],
  );
  const finish = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };
  const dialog = (
    <Modal
      open={state !== null}
      title={state?.title ?? ''}
      onClose={() => finish(false)}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => finish(false)}>Hủy</Button>
          <Button type="button" variant={state?.danger ? 'danger' : 'primary'} onClick={() => finish(true)}>
            {state?.confirmLabel ?? 'Đồng ý'}
          </Button>
        </>
      }
    >
      {state?.message && <p>{state.message}</p>}
    </Modal>
  );
  return { confirm, dialog };
}

/** Hộp thoại nhập chữ thay cho window.prompt: trả về chuỗi đã nhập, hoặc null khi hủy */
export function useAskText() {
  const [state, setState] = useState<(AskTextOptions & { resolve: (value: string | null) => void }) | null>(null);
  const [text, setText] = useState('');
  const ask = useCallback(
    (options: AskTextOptions) =>
      new Promise<string | null>((resolve) => {
        setText('');
        setState({ ...options, resolve });
      }),
    [],
  );
  const finish = (value: string | null) => {
    state?.resolve(value);
    setState(null);
  };
  const dialog = (
    <Modal
      open={state !== null}
      title={state?.title ?? ''}
      onClose={() => finish(null)}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => finish(null)}>Hủy</Button>
          <Button type="button" disabled={text.trim().length < (state?.minLength ?? 0)} onClick={() => finish(text.trim())}>
            {state?.confirmLabel ?? 'Gửi'}
          </Button>
        </>
      }
    >
      <Textarea label={state?.label ?? ''} value={text} onChange={(event) => setText(event.target.value)} />
    </Modal>
  );
  return { ask, dialog };
}
