import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, PlayCircle } from 'lucide-react';
import { Alert, Button, Card } from '../../../components/common';
import { DISCLAIMER_TEXT } from '../../assessment_result/assessmentResult.constants';
import { useAuth } from '../../auth/AuthContext';
import { isInviteLocked } from '../../profile/profile.logic';
import {
  DEFAULT_PACKAGE,
  PACKAGES,
  PARTS,
  RETAKE_INTERVAL_HOURS,
} from '../assessmentSession.constants';
import {
  createSession,
  getAnswers,
  getInProgressSession,
  getLatestCompletedSession,
  getPackageAssignments,
  loadSelfQuestionBank,
} from '../assessmentSession.service';
import type { AssessmentSession, BankQuestion, PackageSize } from '../assessmentSession.types';
import { selectQuestions } from '../selectQuestions';
import { computeProgress } from '../sessionProgress';
import { StartPanelSkeleton } from './StartPanelSkeleton';
import './AssessmentStartPanel.css';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export const AssessmentStartPanel: React.FC<{ showDisclaimer?: boolean; showTitle?: boolean }> = ({
  showDisclaimer = true,
  showTitle = true,
}) => {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id;

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [assignments, setAssignments] = useState<Record<PackageSize, Set<string>>>({ 35: new Set(), 50: new Set(), 75: new Set() });
  const [inProgress, setInProgress] = useState<AssessmentSession | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [retakeAt, setRetakeAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<PackageSize>(DEFAULT_PACKAGE);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      try {
        const [questionBank, a35, a50, a75, current, completed] = await Promise.all([
          loadSelfQuestionBank(),
          getPackageAssignments(35),
          getPackageAssignments(50),
          getPackageAssignments(75),
          getInProgressSession(userId),
          getLatestCompletedSession(userId),
        ]);
        if (!active) return;
        setBank(questionBank);
        setAssignments({ 35: a35, 50: a50, 75: a75 });
        setInProgress(current);
        setSelected(current?.packageSize ?? DEFAULT_PACKAGE);

        if (current) {
          const questions = selectQuestions(questionBank, current.packageSize, current.packageSize === 35 ? a35 : current.packageSize === 50 ? a50 : a75);
          const answers = await getAnswers(current.id);
          const progress = computeProgress(questions, answers);
          const packageName = PACKAGES.find((p) => p.size === current.packageSize)?.name ?? '';
          if (progress.currentPart) {
            const partName = PARTS.find((p) => p.number === progress.currentPart)?.name ?? '';
            const part = progress.parts.find((p) => p.part === progress.currentPart);
            setResumeText(
              `Bạn đang làm dở gói ${packageName}, đến câu ${progress.currentIndex + 1}/${part?.total ?? 0} của phần ${partName}.`,
            );
          } else {
            setResumeText(`Bạn đã trả lời hết câu hỏi của gói ${packageName}, còn bước hoàn thành.`);
          }
        } else if (completed?.completedAt) {
          const next = new Date(new Date(completed.completedAt).getTime() + RETAKE_INTERVAL_HOURS * 3_600_000);
          if (next > new Date()) setRetakeAt(next.toISOString());
        }
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const selections = useMemo(
    () => ({
      35: selectQuestions(bank, 35, assignments[35]),
      50: selectQuestions(bank, 50, assignments[50]),
      75: selectQuestions(bank, 75, assignments[75]),
    }),
    [bank, assignments],
  );

  const partCounts = PARTS.map((part) => ({
    ...part,
    count: selections[selected].filter((q) => q.part === part.number).length,
  }));

  const handleStart = async () => {
    if (!userId) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const created = await createSession(userId, selected);
      navigate(`/danh-gia-ca-nhan/${created.id}`);
    } catch {
      setStartError('Không bắt đầu được bài đánh giá, vui lòng thử lại');
      setIsStarting(false);
    }
  };

  return (
    <section className="start-panel" aria-labelledby="start-title">
      {showTitle && (
        <h2 id="start-title" className="section-title">
          Làm bài đánh giá
        </h2>
      )}

      {isLoading && <StartPanelSkeleton />}
      {!isLoading && loadError && <Alert variant="danger">Không tải được bài đánh giá</Alert>}

      {!isLoading && !loadError && (
        <div className="start-layout">
          {inProgress && resumeText && (
            <Card className="resume-card">
              <div className="resume-content">
                <span className="resume-icon" aria-hidden="true">
                  <PlayCircle size={32} />
                </span>
                <p className="resume-text">{resumeText}</p>
                <Button size="lg" onClick={() => navigate(`/danh-gia-ca-nhan/${inProgress.id}`)} rightIcon={<ArrowRight size={18} />}>
                  Tiếp tục
                </Button>
              </div>
            </Card>
          )}

          {!inProgress && retakeAt && (
            <Alert variant="warning" title="Chưa thể làm lại">
              Bạn có thể làm lại bài từ {formatDateTime(retakeAt)}.
            </Alert>
          )}

          {!inProgress && !retakeAt && (
            <>
              <div className="start-choice">
              <div className="package-grid" role="radiogroup" aria-label="Gói câu hỏi">
                {PACKAGES.map((pack) => {
                  const isSelected = selected === pack.size;
                  const count = selections[pack.size].length;
                  return (
                    <label key={pack.size} className={`package-card ${isSelected ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="package"
                        value={pack.size}
                        checked={isSelected}
                        onChange={() => setSelected(pack.size)}
                        className="package-input"
                      />
                      <span className="package-name">{pack.name}</span>
                      <span className="package-count">{count} câu</span>
                      <span className="package-minutes">
                        <Clock size={14} aria-hidden="true" />
                        {pack.minutes}
                      </span>
                      {pack.note && <span className="package-note">{pack.note}</span>}
                      <span className="package-check" aria-hidden="true" />
                    </label>
                  );
                })}
              </div>

              <Card title="Số câu theo phần" className="parts-card">
                <div className="table-responsive parts-table-wrap">
                  <table className="parts-table">
                    <thead>
                      <tr>
                        <th scope="col">Phần</th>
                        <th scope="col" className="parts-count-col">
                          Số câu
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {partCounts.map((part) => (
                        <tr key={part.number}>
                          <td>
                            <span className="parts-number">{part.number}</span>
                            {part.name}
                          </td>
                          <td className="parts-count-col">{part.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              </div>

              {showDisclaimer && <Alert variant="info">{DISCLAIMER_TEXT}</Alert>}
              {startError && <Alert variant="danger">{startError}</Alert>}
              {isInviteLocked(profile) && (
                <Alert variant="warning">
                  Bạn dưới 16 tuổi: cần người giám hộ xác nhận trước khi mời người khác đánh giá.
                </Alert>
              )}

              <div className="start-actions">
                <Button size="lg" isLoading={isStarting} onClick={handleStart} rightIcon={<ArrowRight size={18} />}>
                  Bắt đầu làm bài
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
