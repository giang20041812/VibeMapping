import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { Alert, Button, Card, ProgressBar } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { pathAfterTest } from '../../profile/profile.logic';
import { INSUFFICIENT_WARNING_RATIO, PARTS } from '../assessmentSession.constants';
import {
  completeSession,
  deleteAnswer,
  getAnswers,
  getCoreValues,
  getEvidence,
  getPackageAssignments,
  getSession,
  getSessionCoreValues,
  loadSelfQuestionBank,
  saveAnswer,
  saveEvidence,
  saveSessionCoreValues,
  touchSession,
} from '../assessmentSession.service';
import type {
  AnswerMap,
  AssessmentSession,
  BankQuestion,
  CoreValue,
  EvidenceValues,
  PartNumber,
} from '../assessmentSession.types';
import { insufficientRatio, isAnswered } from '../assessmentScores';
import { CoreValuesStep } from '../components/CoreValuesStep';
import { EvidenceStep } from '../components/EvidenceStep';
import { HollandReport, PersonalityReport } from '../components/PartReports';
import { PartStepper } from '../components/PartStepper';
import { QuestionCard } from '../components/QuestionCard';
import { RunSkeleton } from '../components/RunSkeleton';
import { computeProgress, questionsOfPart } from '../sessionProgress';
import { selectQuestions } from '../selectQuestions';
import './AssessmentRunPage.css';

type Stage =
  | { kind: 'questions'; part: PartNumber; index: number }
  | { kind: 'report'; part: 1 | 3 }
  | { kind: 'values' }
  | { kind: 'evidence' };

/** Dừng ngắn để người dùng thấy mức vừa chọn trước khi chuyển câu */
const ADVANCE_DELAY_MS = 220;
/** Trả lời xong câu cuối của phần: chờ người dùng bấm Hoàn thành phần, quá thời gian này thì tự sang bước sau.
    Khớp thời lượng hiệu ứng đếm ngược .run-finish.is-counting trong AssessmentRunPage.css */
const PART_FINISH_DELAY_MS = 3000;

const EMPTY_EVIDENCE: EvidenceValues = { gradePointAverage: '', certificates: '', achievements: '' };

export const AssessmentRunPage: React.FC = () => {
  const { sessionId } = useParams();
  const { session: authSession, profile, isGuest } = useAuth();
  const navigate = useNavigate();
  /* Đọc qua ref để vòng tải dữ liệu không chạy lại mỗi khi hồ sơ được nạp xong */
  const afterTestPath = useRef('/danh-gia-ca-nhan');
  afterTestPath.current = pathAfterTest(isGuest, profile);

  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>(new Map());
  const [coreValues, setCoreValues] = useState<CoreValue[]>([]);
  const [selectedValueIds, setSelectedValueIds] = useState<string[]>([]);
  const [valuesSaved, setValuesSaved] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceValues>(EMPTY_EVIDENCE);
  const [stage, setStage] = useState<Stage | null>(null);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [isSavingValues, setIsSavingValues] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  /** Lượt đếm ngược tự hoàn thành phần đang chạy; đổi số để hiệu ứng chạy lại từ đầu */
  const [finishCountdown, setFinishCountdown] = useState<number | null>(null);

  const advanceTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const progress = useMemo(() => computeProgress(questions, answers), [questions, answers]);
  const partDone = useCallback(
    (part: PartNumber) => progress.parts[part - 1].done && (part !== 2 || valuesSaved),
    [progress, valuesSaved],
  );
  const unlockedPart = useMemo(() => {
    for (const { number } of PARTS) if (!partDone(number)) return number;
    return 5;
  }, [partDone]);

  /** Vị trí vào một phần: câu chưa trả lời đầu tiên, hoặc bước kế tiếp nếu phần đã xong câu hỏi */
  const stageForPart = useCallback(
    (part: number, answerMap: AnswerMap, valuesDone: boolean): Stage => {
      if (part > 4) return { kind: 'evidence' };
      const list = questionsOfPart(questions, part as PartNumber);
      const firstOpen = list.findIndex((q) => !isAnswered(answerMap, q.id));
      if (firstOpen >= 0) return { kind: 'questions', part: part as PartNumber, index: firstOpen };
      if (part === 2 && !valuesDone) return { kind: 'values' };
      return { kind: 'questions', part: part as PartNumber, index: 0 };
    },
    [questions],
  );

  // ---- Tải dữ liệu
  useEffect(() => {
    if (!sessionId || !authSession) return;
    let active = true;
    (async () => {
      try {
        const current = await getSession(sessionId);
        if (!current) throw new Error('not_found');
        if (current.status === 'completed') {
          navigate(afterTestPath.current, { replace: true });
          return;
        }
        const [bank, assigned, answerMap, values, selected, savedEvidence] = await Promise.all([
          loadSelfQuestionBank(),
          getPackageAssignments(current.packageSize),
          getAnswers(sessionId),
          getCoreValues(),
          getSessionCoreValues(sessionId),
          getEvidence(sessionId),
        ]);
        if (!active) return;
        const picked = selectQuestions(bank, current.packageSize, assigned);
        const progressNow = computeProgress(picked, answerMap);
        const valuesDone = selected.length >= 3;

        setSession(current);
        setQuestions(picked);
        setAnswers(answerMap);
        setCoreValues(values);
        setSelectedValueIds(selected);
        setValuesSaved(valuesDone);
        setEvidence(savedEvidence);

        // Phần đầu tiên chưa xong; nếu xong cả bốn phần thì sang bước minh chứng
        let startPart = 5;
        for (const { number } of PARTS) {
          if (!(progressNow.parts[number - 1].done && (number !== 2 || valuesDone))) {
            startPart = number;
            break;
          }
        }
        const list = startPart <= 4 ? picked.filter((q) => q.part === startPart) : [];
        const firstOpen = list.findIndex((q) => !isAnswered(answerMap, q.id));
        if (startPart > 4) setStage({ kind: 'evidence' });
        else if (firstOpen >= 0) setStage({ kind: 'questions', part: startPart as PartNumber, index: firstOpen });
        else setStage({ kind: 'values' });
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId, authSession, navigate]);

  const currentQuestion =
    stage?.kind === 'questions' ? questionsOfPart(questions, stage.part)[stage.index] : undefined;

  const cancelAdvance = () => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setFinishCountdown(null);
  };

  const go = (next: Stage, dir: 'forward' | 'back' = 'forward') => {
    cancelAdvance();
    setDirection(dir);
    setLockedMessage(null);
    setStage(next);
    if (session) {
      const part: PartNumber =
        next.kind === 'questions' ? next.part : next.kind === 'report' ? next.part : next.kind === 'values' ? 2 : 4;
      void touchSession(session.id, part);
    }
  };

  // ---- Trả lời câu hỏi
  const handleSelect = useCallback(
    async (score: number) => {
      if (!session || !currentQuestion) return;
      setSaveError(false);
      setAnswers((prev) => new Map(prev).set(currentQuestion.id, { score, insufficient: false }));

      // Chọn xong tự sang câu kế; câu cuối của phần đếm ngược rồi tự hoàn thành nếu người dùng chưa bấm
      if (stage?.kind === 'questions') {
        const list = questionsOfPart(questions, stage.part);
        const { part, index } = stage;
        const isLast = index === list.length - 1;
        if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
        advanceTimer.current = window.setTimeout(
          () => {
            advanceTimer.current = null;
            if (isLast) afterPart(part);
            else go({ kind: 'questions', part, index: index + 1 });
          },
          isLast ? PART_FINISH_DELAY_MS : ADVANCE_DELAY_MS,
        );
        if (isLast) setFinishCountdown((count) => (count ?? 0) + 1);
      }

      try {
        await saveAnswer(session.id, currentQuestion, { score, insufficient: false });
      } catch {
        setSaveError(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, currentQuestion, stage, questions],
  );

  const handleInsufficient = async (checked: boolean) => {
    if (!session || !currentQuestion) return;
    setSaveError(false);
    cancelAdvance();
    if (checked) {
      setAnswers((prev) => new Map(prev).set(currentQuestion.id, { score: null, insufficient: true }));
      try {
        await saveAnswer(session.id, currentQuestion, { score: null, insufficient: true });
      } catch {
        setSaveError(true);
      }
    } else {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.delete(currentQuestion.id);
        return next;
      });
      try {
        await deleteAnswer(session.id, currentQuestion.id);
      } catch {
        setSaveError(true);
      }
    }
  };

  // ---- Điều hướng giữa các câu
  const afterPart = (part: PartNumber) => {
    if (part === 1) go({ kind: 'report', part: 1 });
    else if (part === 2) go({ kind: 'values' });
    else if (part === 3) go({ kind: 'report', part: 3 });
    else go({ kind: 'evidence' });
  };

  const handleNext = useCallback(() => {
    if (stage?.kind !== 'questions' || !currentQuestion || !isAnswered(answers, currentQuestion.id)) return;
    const list = questionsOfPart(questions, stage.part);
    if (stage.index < list.length - 1) go({ kind: 'questions', part: stage.part, index: stage.index + 1 });
    else afterPart(stage.part);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentQuestion, answers, questions, session]);

  const handleBack = () => {
    if (stage?.kind !== 'questions') return;
    if (stage.index > 0) {
      go({ kind: 'questions', part: stage.part, index: stage.index - 1 }, 'back');
    } else if (stage.part > 1) {
      const previous = (stage.part - 1) as PartNumber;
      const list = questionsOfPart(questions, previous);
      go({ kind: 'questions', part: previous, index: Math.max(list.length - 1, 0) }, 'back');
    }
  };

  const handleStepperSelect = (part: PartNumber) => {
    if (part > unlockedPart) {
      setLockedMessage(`Hãy hoàn thành phần ${unlockedPart} trước khi mở phần ${part}.`);
      return;
    }
    go(part === unlockedPart ? stageForPart(part, answers, valuesSaved) : { kind: 'questions', part, index: 0 });
  };

  const continueFromPart = (part: PartNumber) => go(stageForPart(part + 1, answers, valuesSaved));

  // ---- Phím tắt: 1–5 chọn mức, Enter sang câu kế
  useEffect(() => {
    if (stage?.kind !== 'questions') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') return;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (event.key >= '1' && event.key <= '5' && !answers.get(currentQuestion?.id ?? '')?.insufficient) {
        void handleSelect(Number(event.key));
      } else if (event.key === 'Enter' && target.tagName !== 'BUTTON') {
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, answers, currentQuestion, handleSelect, handleNext]);

  // ---- Giá trị cốt lõi và hoàn thành
  const handleSaveValues = async () => {
    if (!session) return;
    setIsSavingValues(true);
    try {
      await saveSessionCoreValues(session.id, selectedValueIds);
      setValuesSaved(true);
      go(stageForPart(3, answers, true));
    } catch {
      setSaveError(true);
    } finally {
      setIsSavingValues(false);
    }
  };

  const handleFinish = async () => {
    if (!session) return;
    setIsFinishing(true);
    setFinishError(null);
    try {
      await saveEvidence(session.id, evidence);
      await completeSession(session.id, false);
      navigate(afterTestPath.current, { replace: true, state: { justCompleted: true } });
    } catch {
      setFinishError('Không hoàn thành được bài đánh giá, vui lòng thử lại');
      setIsFinishing(false);
    }
  };

  const insufficientTooHigh = insufficientRatio(questions, answers) > INSUFFICIENT_WARNING_RATIO;

  if (isLoading) return <RunSkeleton />;
  if (loadError || !session || !stage) {
    return (
      <div className="run-layout">
        <Alert variant="danger">Không tải được bài đánh giá</Alert>
      </div>
    );
  }

  const currentPart: PartNumber | null =
    stage.kind === 'questions' ? stage.part : stage.kind === 'report' ? stage.part : stage.kind === 'values' ? 2 : null;
  const partQuestions = stage.kind === 'questions' ? questionsOfPart(questions, stage.part) : [];
  const partIndexLabel = stage.kind === 'questions' ? stage.index + 1 : 0;
  const partPercent = partQuestions.length ? ((stage.kind === 'questions' ? stage.index : 0) / partQuestions.length) * 100 : 0;
  const answeredNow = currentQuestion ? isAnswered(answers, currentQuestion.id) : false;
  const isLastInPart = stage.kind === 'questions' && stage.index === partQuestions.length - 1;
  const canGoBack = stage.kind === 'questions' && (stage.index > 0 || stage.part > 1);

  return (
    <div className="run-layout">
      <div className="run-top">
        <Button
          variant="ghost"
          size="sm"
          className="run-exit"
          leftIcon={<Save size={16} />}
          onClick={() => navigate('/', { state: { draftSaved: true } })}
        >
          Lưu tạm và thoát
        </Button>
        <PartStepper currentPart={currentPart} unlockedPart={unlockedPart} onSelect={handleStepperSelect} />
      </div>

      {lockedMessage && <Alert variant="warning">{lockedMessage}</Alert>}
      {saveError && <Alert variant="danger">Không lưu được. Kiểm tra kết nối mạng rồi thử lại.</Alert>}
      {stage.kind === 'questions' && stage.part === 4 && insufficientTooHigh && (
        <Alert variant="warning" title="Thiếu dữ liệu đánh giá">
          Bạn đã chọn Không đủ cơ sở ở hơn 40% tiêu chí.
        </Alert>
      )}

      {stage.kind === 'questions' && currentQuestion && (
        <Card className={`run-card run-part-${stage.part}`}>
          <div className="run-progress">
            <span className="run-progress-text">
              Phần {stage.part}/4 – <span className="run-progress-count">Câu {partIndexLabel}/{partQuestions.length}</span>
            </span>
            <ProgressBar tone="accent" value={partPercent + 100 / Math.max(partQuestions.length, 1)} label="Tiến độ phần" />
          </div>

          <QuestionCard
            question={currentQuestion}
            value={answers.get(currentQuestion.id)}
            direction={direction}
            onSelect={handleSelect}
            onToggleInsufficient={handleInsufficient}
          />

          <div className="run-nav">
            <Button variant="outline" size="lg" onClick={handleBack} disabled={!canGoBack} leftIcon={<ArrowLeft size={18} />}>
              Quay lại
            </Button>
            <Button
              key={finishCountdown ?? 'idle'}
              size="lg"
              className={isLastInPart && answeredNow ? `run-finish ${finishCountdown ? 'is-counting' : ''}` : ''}
              onClick={handleNext}
              disabled={!answeredNow}
              rightIcon={isLastInPart ? <Check size={18} /> : <ArrowRight size={18} />}
            >
              {isLastInPart ? 'Hoàn thành phần' : 'Tiếp theo'}
            </Button>
          </div>
        </Card>
      )}

      {stage.kind === 'report' && stage.part === 1 && (
        <PersonalityReport questions={questions} answers={answers} onContinue={() => continueFromPart(1)} />
      )}
      {stage.kind === 'report' && stage.part === 3 && (
        <HollandReport questions={questions} answers={answers} onContinue={() => continueFromPart(3)} />
      )}
      {stage.kind === 'values' && (
        <CoreValuesStep
          values={coreValues}
          selectedIds={selectedValueIds}
          isSaving={isSavingValues}
          onChange={setSelectedValueIds}
          onSave={handleSaveValues}
        />
      )}
      {stage.kind === 'evidence' && (
        <EvidenceStep
          values={evidence}
          isSaving={isFinishing}
          showInsufficientWarning={insufficientTooHigh}
          error={finishError}
          onChange={setEvidence}
          onFinish={handleFinish}
        />
      )}
    </div>
  );
};
