import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { loadResultHistory, type ResultHistoryItem } from '../resultInsights.service';
import '../../career_explorer/pages/CareerPages.css';

const STATUS_LABEL: Record<string, string> = {
  self_assessment: 'Tự đánh giá',
  temporary: 'Tạm thời',
  final_360: 'Cuối cùng 360°',
};
const GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];
/** P22: chênh từ 0,5 điểm (thang 1–5) = 10 điểm % trở lên mới gọi là có tiến bộ */
const PROGRESS_POINTS = 10;

/** FR01.03.04, R18: các bản chụp bất biến, so sánh với bản trước theo ngưỡng P22 */
export const ResultHistoryPage: React.FC = () => {
  const { session } = useAuth();
  const [items, setItems] = useState<ResultHistoryItem[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    loadResultHistory(session.user.id).then(setItems).catch(() => setError('Không tải được lịch sử kết quả.'));
  }, [session?.user.id]);

  // Mỗi kết quả chỉ giữ bản chụp mới nhất để so sánh giữa các lần làm bài
  const latestPerResult = (items ?? []).filter((item, index, all) => all.findIndex((x) => x.resultId === item.resultId) === index);
  const selected = latestPerResult.filter((item) => picked.includes(item.id));
  const toggle = (id: string) => {
    setPicked((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  };

  return (
    <div className="module-page">
      <h1>Lịch sử kết quả</h1>
      {selected.length === 2 && (
        <Card title="So sánh hai bản">
          <ul className="module-list">
            {GROUPS.map((group) => {
              const left = selected[0].groupPercents[group];
              const right = selected[1].groupPercents[group];
              if (left === undefined && right === undefined) return null;
              const delta = left !== undefined && right !== undefined ? right - left : null;
              return (
                <li key={group}>
                  <span>{group}</span>
                  <span>{left === undefined ? '–' : `${Math.round(left)}%`}</span>
                  <span>{right === undefined ? '–' : `${Math.round(right)}%`}</span>
                  {delta !== null && Math.abs(delta) >= PROGRESS_POINTS && (
                    <Badge variant={delta > 0 ? 'success' : 'warning'}>{delta > 0 ? 'Tăng' : 'Giảm'} {Math.round(Math.abs(delta))} điểm</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!error && items === null && <Spinner />}
      {items && items.length === 0 && <p>Chưa có bản chụp kết quả nào.</p>}
      {latestPerResult.map((item, index) => {
        const previous = latestPerResult[index + 1];
        return (
          <Card key={item.id} title={`${new Date(item.createdAt).toLocaleString('vi-VN')} · ${STATUS_LABEL[item.statusLabel] ?? item.statusLabel}`}>
            <Button type="button" size="sm" variant={picked.includes(item.id) ? 'primary' : 'outline'} onClick={() => toggle(item.id)}>
              {picked.includes(item.id) ? 'Bỏ chọn' : 'Chọn để so sánh'}
            </Button>
            <ul className="module-list">
              {GROUPS.filter((g) => item.groupPercents[g] !== undefined).map((g) => {
                const now = item.groupPercents[g];
                const before = previous?.groupPercents[g];
                const delta = before === undefined ? null : now - before;
                return (
                  <li key={g}>
                    <span>{g}</span>
                    <strong>{Math.round(now)}%</strong>
                    {delta !== null && Math.abs(delta) >= PROGRESS_POINTS && (
                      <Badge variant={delta > 0 ? 'success' : 'warning'}>{delta > 0 ? 'Có tiến bộ' : 'Giảm'} {Math.round(Math.abs(delta))} điểm</Badge>
                    )}
                    {delta !== null && Math.abs(delta) < PROGRESS_POINTS && <span className="explain-note">Không đổi đáng kể</span>}
                  </li>
                );
              })}
            </ul>
            {item.versions && (
              <p className="explain-note">
                {item.versions.framework ?? '–'} · {item.versions.question_bank ?? '–'} · {item.versions.parameters ?? '–'} · {item.versions.career_matrix ?? '–'}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
};
