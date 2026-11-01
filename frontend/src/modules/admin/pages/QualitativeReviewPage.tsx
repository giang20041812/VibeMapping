import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Spinner } from '../../../components/common';
import { supplementalUnderstandingScore, type RaterGroup } from '../../../domain/assessmentRules';
import { callRpc } from '../../../lib/rpc';
import '../../career_explorer/pages/CareerPages.css';

interface QueueItem {
  submission_id: string;
  rater_group: RaterGroup;
  subject_name: string;
  reviewed: boolean;
}

interface OpenAnswer { aspect: string; text: string }
interface CaseFile {
  submission_id: string;
  rater_group: RaterGroup;
  understanding_score: number | null;
  supplemental_score: number | null;
  answers: OpenAnswer[];
}

const ASPECTS = ['interest', 'ability', 'value', 'blind_spot'] as const;

export const QualitativeReviewPage: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<CaseFile | null>(null);
  const [ea, setEa] = useState(['0', '0', '0', '0']);
  const [solo, setSolo] = useState(['1', '1', '1', '1']);
  const [carkhuff, setCarkhuff] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => callRpc<QueueItem[]>('list_qualitative_queue').then((rows) => setQueue(rows ?? []));

  useEffect(() => {
    reload().catch(() => setError('Không tải được hàng chờ chấm định tính.')).finally(() => setLoading(false));
  }, []);

  const open = async (id: string) => {
    setError(null);
    try {
      const file = await callRpc<CaseFile>('get_qualitative_case', { p_submission_id: id });
      setCurrent(file);
    } catch {
      setError('Không mở được bài. Thao tác này được ghi nhật ký.');
    }
  };

  const save = async () => {
    if (!current) return;
    const eaScores = ea.map((value) => Number(value));
    const soloScores = solo.map((value) => Number(value));
    const carkhuffScore = current.rater_group === 'friend' ? null : Number(carkhuff);
    try {
      supplementalUnderstandingScore(current.rater_group, {
        empathicAccuracy: eaScores,
        solo: soloScores,
        carkhuff: carkhuffScore,
      });
      await callRpc('record_qualitative_evaluation', {
        p_submission_id: current.submission_id,
        p_ea: eaScores,
        p_solo: soloScores,
        p_carkhuff: carkhuffScore,
      });
      setCurrent(null);
      await reload();
    } catch {
      setError('Điểm không hợp lệ hoặc bài chưa có đủ câu trả lời mở. Hệ thống không tự chấm từ nội dung văn bản.');
    }
  };

  return (
    <div className="module-page">
      <h1>Chấm thấu hiểu định tính</h1>
      <Alert variant="info" title="S_i tính từ điểm EA, SOLO và Carkhuff do người chấm nhập">
        Bài chưa chấm dùng giá trị mặc định ở tham số unreviewed_supplemental_default (100, đang chờ BA/PO chốt). Bài đã chấm 0 điểm là kết quả thật và cho trọng số 0. Bạn bè không nhập Carkhuff. Lưu điểm sẽ tính lại kết quả 360° của học sinh.
      </Alert>
      {loading && <Spinner />}
      {error && <Alert variant="danger">{error}</Alert>}
      <Card title="Bài đã chấp nhận">
        {queue.length === 0 && !loading ? <p>Chưa có bài lời mời nào được chấp nhận.</p> : (
          <ul className="module-list">
            {queue.map((item) => (
              <li key={item.submission_id}>
                <span>{item.subject_name || 'Học sinh'}</span>
                <span>{item.rater_group}</span>
                <span>{item.reviewed ? 'Đã chấm' : 'Chưa chấm'}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void open(item.submission_id)}>Mở</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {current && (
        <Card title={`Chấm nhóm ${current.rater_group}`}>
          {current.answers.length === 0 && <Alert variant="warning">Bài này chưa có câu trả lời mở nên chưa chấm được.</Alert>}
          <ul className="module-list">
            {current.answers.map((answer) => <li key={answer.aspect}><strong>{answer.aspect}</strong><span>{answer.text}</span></li>)}
          </ul>
          {ASPECTS.map((aspect, index) => (
            <div className="module-form" key={aspect}>
              <Input label={`EA ${aspect} (0–2)`} value={ea[index]} onChange={(event) => setEa((currentEa) => currentEa.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} />
              <Input label={`SOLO ${aspect} (1–5)`} value={solo[index]} onChange={(event) => setSolo((currentSolo) => currentSolo.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} />
            </div>
          ))}
          {current.rater_group !== 'friend' && (
            <Input label="Carkhuff (1–5)" value={carkhuff} onChange={(event) => setCarkhuff(event.target.value)} />
          )}
          <Button type="button" onClick={() => void save()}>Lưu điểm S_i</Button>
        </Card>
      )}
    </div>
  );
};
