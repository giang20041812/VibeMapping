import React, { useState } from 'react';
import { FileText, HelpCircle } from 'lucide-react';
import { Button, Textarea } from '../../../components/common';
import { POST_TYPE_LABEL } from '../community.constants';
import type { PostType } from '../community.types';

interface Props {
  busy: boolean;
  onSubmit: (body: string, type: PostType) => Promise<boolean>;
}

const TYPES: { value: PostType; icon: React.ReactNode }[] = [
  { value: 'post', icon: <FileText size={16} aria-hidden="true" /> },
  { value: 'question', icon: <HelpCircle size={16} aria-hidden="true" /> },
];

/** Đăng bài viết (FR09.01.04) hoặc đặt câu hỏi (FR09.01.05) */
export const PostComposer: React.FC<Props> = ({ busy, onSubmit }) => {
  const [type, setType] = useState<PostType>('post');
  const [body, setBody] = useState('');

  return (
    <form
      className="cm-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(body, type).then((ok) => ok && setBody(''));
      }}
    >
      <div className="cm-type-switch" role="radiogroup" aria-label="Loại bài">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            className={`cm-type-option${type === t.value ? ' is-active' : ''}`}
            onClick={() => setType(t.value)}
          >
            {t.icon} {POST_TYPE_LABEL[t.value]}
          </button>
        ))}
      </div>
      <Textarea
        label={type === 'question' ? 'Câu hỏi của bạn' : 'Nội dung bài viết'}
        rows={3}
        maxLength={3000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="cm-form-actions">
        <Button type="submit" isLoading={busy} disabled={!body.trim()}>{type === 'question' ? 'Đặt câu hỏi' : 'Đăng bài'}</Button>
      </div>
    </form>
  );
};
