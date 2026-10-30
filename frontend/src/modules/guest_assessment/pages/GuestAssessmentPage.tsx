import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Modal, ProgressBar } from '../../../components/common';
import { isAnswered } from '../../assessment_session/assessmentScores';
import type { AnswerMap } from '../../assessment_session/assessmentSession.types';
import { QuestionCard } from '../../assessment_session/components/QuestionCard';
import { GROUP_LABEL } from '../../invitation_link/invitation.constants';
import type { InviteGroup } from '../../invitation_link/invitation.constants';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { GuestIntroSkeleton } from '../components/GuestIntroSkeleton';
import {
  DEPTH_OPTIONS,
  DURATION_OPTIONS,
  FREQUENCY_OPTIONS,
  MIN_SECONDS_PER_QUESTION,
  RELATIONSHIPS,
  UNAVAILABLE_TEXT,
  UNIFORM_MIN_CRITERIA,
  resumeKey,
} from '../guest.constants';
import {
  GuestError,
  getGuestQuestions,
  getGuestSession,
  getInvitation,
  saveGuestAnswer,
  startSubmission,
  submitGuest,
} from '../guest.service';
import type { GuestQuestion } from '../guest.service';
import './GuestAssessmentPage.css';

type Stage =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'intro'; group: InviteGroup; subjectName: string | null }
  | { kind: 'questions' }
  | { kind: 'thanks' };

interface IntroErrors {
  relationship?: string;
  duration?: string;
  frequency?: string;
  depth?: string;
  nickname?: string;
}

const readResume = (token: string): string | null => {
  try {
    return window.localStorage.getItem(resumeKey(token));
  } catch {
    return null;
  }
};
const writeResume = (token: string, value: string | null) => {
  try {
    if (value) window.localStorage.setItem(resumeKey(token), value);
    else window.localStorage.removeItem(resumeKey(token));
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua, vẫn làm bài được trong phiên này */
  }
};

const formatClock = (date: Date) => date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export const GuestAssessmentPage: React.FC = () => {
  const { token } = useParams();

  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [resume, setResume] = useState<string | null>(null);
  const [group, setGroup] = useState<InviteGroup | null>(null);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GuestQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>(new Map());
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState(false);

  const [nickname, setNickname] = useState('');
  const [relationship, setRelationship] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [depth, setDepth] = useState<number | null>(null);
  const [introErrors, setIntroErrors] = useState<IntroErrors>({});
  const [introFailure, setIntroFailure] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [qualityIssues, setQualityIssues] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailure, setSubmitFailure] = useState<string | null>(null);

  const current = questions[index];
  const answeredCount = useMemo(() => questions.filter((q) => isAnswered(answers, q.id)).length, [questions, answers]);

  /** Vào màn câu hỏi, dừng ở câu chưa trả lời đầu tiên */
  const enterQuestions = useCallback((list: GuestQuestion[], answerMap: AnswerMap) => {
    const firstOpen = list.findIndex((q) => !isAnswered(answerMap, q.id));
    setQuestions(list);
    setAnswers(answerMap);
    setIndex(firstOpen >= 0 ? firstOpen : Math.max(list.length - 1, 0));
    setStage({ kind: 'questions' });
  }, []);

  // ---- Mở đường dẫn: tiếp tục bài đang làm dở hoặc kiểm tra đường dẫn
  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const saved = readResume(token);
        if (saved) {
          const state = await getGuestSession(saved);
          if (!active) return;
          if (state.status === 'draft') {
            if (state.linkState && state.linkState !== 'valid') {
              setStage({ kind: 'unavailable', reason: state.linkState });
              return;
            }
            const list = await getGuestQuestions(saved);
            if (!active) return;
            if (list.length === 0) {
              setStage({ kind: 'unavailable', reason: 'error' });
              return;
            }
            setResume(saved);
            setSubjectName(state.subjectDisplayName);
            setStartedAt(state.startedAt);
            enterQuestions(list, new Map(state.answers));
            return;
          }
          if (state.status !== 'not_found') {
            setStage({ kind: 'thanks' });
            return;
          }
          writeResume(token, null);
        }

        const invitation = await getInvitation(token);
        if (!active) return;
        if (invitation.state !== 'valid' || !invitation.raterGroup) {
          setStage({ kind: 'unavailable', reason: invitation.state });
          return;
        }
        setGroup(invitation.raterGroup);
        setSubjectName(invitation.subjectDisplayName);
        setStage({ kind: 'intro', group: invitation.raterGroup, subjectName: invitation.subjectDisplayName });
      } catch {
        if (active) setStage({ kind: 'unavailable', reason: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [token, enterQuestions]);

  // ---- Khai báo thông tin ban đầu
  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !group) return;
    const errors: IntroErrors = {};
    if (nickname.trim().length > 40) errors.nickname = 'Biệt danh tối đa 40 ký tự';
    if (!relationship) errors.relationship = 'Chọn một mục';
    if (duration === null) errors.duration = 'Chọn một mục';
    if (frequency === null) errors.frequency = 'Chọn một mục';
    if (depth === null) errors.depth = 'Chọn một mục';
    setIntroErrors(errors);
    if (Object.keys(errors).length > 0 || !relationship || duration === null || frequency === null || depth === null) return;

    setIsStarting(true);
    setIntroFailure(null);
    try {
      const resumeToken = await startSubmission(token, {
        nickname: nickname.trim(),
        relationship,
        duration,
        frequency,
        depth,
      });
      writeResume(token, resumeToken);
      const [state, list] = await Promise.all([getGuestSession(resumeToken), getGuestQuestions(resumeToken)]);
      if (list.length === 0) throw new GuestError('unknown');
      setResume(resumeToken);
      setStartedAt(state.startedAt);
      enterQuestions(list, new Map(state.answers));
    } catch (error) {
      if (error instanceof GuestError && error.code === 'duplicate') setStage({ kind: 'unavailable', reason: 'duplicate' });
      else if (error instanceof GuestError && error.code === 'full') setStage({ kind: 'unavailable', reason: 'full' });
      else if (error instanceof GuestError && error.code === 'unavailable') setStage({ kind: 'unavailable', reason: 'expired' });
      else if (error instanceof GuestError && error.code === 'own') setStage({ kind: 'unavailable', reason: 'own_link' });
      else setIntroFailure('Không bắt đầu được bài đánh giá, vui lòng thử lại');
    } finally {
      setIsStarting(false);
    }
  };

  // ---- Trả lời câu hỏi
  const handleSelect = useCallback(
    async (score: number) => {
      if (!resume || !current) return;
      setSaveError(false);
      setBlockMessage(null);
      const value = { score, insufficient: false };
      setAnswers((prev) => new Map(prev).set(current.id, value));
      try {
        await saveGuestAnswer(resume, current.id, value);
        setLastSavedAt(new Date());
      } catch {
        setSaveError(true);
      }
    },
    [resume, current],
  );

  const handleInsufficient = async (checked: boolean) => {
    if (!resume || !current) return;
    setSaveError(false);
    setBlockMessage(null);
    if (!checked) {
      // Bỏ chọn: câu quay về chưa trả lời, bài nháp được ghi lại khi chọn mức điểm
      setAnswers((prev) => {
        const next = new Map(prev);
        next.delete(current.id);
        return next;
      });
      return;
    }
    const value = { score: null, insufficient: true };
    setAnswers((prev) => new Map(prev).set(current.id, value));
    try {
      await saveGuestAnswer(resume, current.id, value);
      setLastSavedAt(new Date());
    } catch {
      setSaveError(true);
    }
  };

  const goTo = (next: number, dir: 'forward' | 'back') => {
    setDirection(dir);
    setIndex(next);
  };

  const reviewQuestions = () => {
    const open = questions.findIndex((q) => !isAnswered(answers, q.id) || missingIds.includes(q.id));
    setBlockMessage(null);
    setMissingIds([]);
    goTo(Math.max(open, 0), 'back');
  };

  // ---- Nộp bài
  const doSubmit = async () => {
    if (!resume || !token) return;
    setIsSubmitting(true);
    setSubmitFailure(null);
    try {
      const result = await submitGuest(resume);
      if (!result.ok) {
        setQualityIssues([]);
        setMissingIds(result.missingQuestionIds);
        setBlockMessage(`Chưa thể nộp bài. Bạn còn ${Math.max(result.missingQuestionIds.length, 1)} câu chưa trả lời`);
        return;
      }
      setQualityIssues([]);
      setStage({ kind: 'thanks' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
      if (message.includes('invitation_unavailable')) setStage({ kind: 'unavailable', reason: 'expired' });
      else if (message.includes('own_invitation')) setStage({ kind: 'unavailable', reason: 'own_link' });
      else setSubmitFailure('Không nộp được bài, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkQuality = (): string[] => {
    const issues: string[] = [];
    const scores = questions.map((q) => answers.get(q.id)?.score).filter((s): s is number => typeof s === 'number');
    if (scores.length >= UNIFORM_MIN_CRITERIA && new Set(scores).size === 1) {
      issues.push('Bạn đã chấm cùng một mức điểm cho tất cả tiêu chí.');
    }
    if (startedAt) {
      const seconds = (Date.now() - new Date(startedAt).getTime()) / 1000;
      if (seconds < questions.length * MIN_SECONDS_PER_QUESTION) issues.push('Bạn hoàn thành bài khá nhanh.');
    }
    return issues;
  };

  const handleSubmit = () => {
    const open = questions.filter((q) => !isAnswered(answers, q.id));
    if (open.length > 0) {
      setBlockMessage(`Chưa thể nộp bài. Bạn còn ${open.length} câu chưa trả lời`);
      return;
    }
    const issues = checkQuality();
    if (issues.length > 0) {
      setQualityIssues(issues);
      return;
    }
    void doSubmit();
  };

  const handleNext = useCallback(() => {
    if (!current || !isAnswered(answers, current.id)) return;
    if (index < questions.length - 1) goTo(index + 1, 'forward');
    else handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, answers, index, questions, startedAt]);

  // ---- Phím tắt: 1–5 chọn mức, Enter sang câu kế
  useEffect(() => {
    if (stage.kind !== 'questions' || qualityIssues.length > 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') return;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (event.key >= '1' && event.key <= '5' && !answers.get(current?.id ?? '')?.insufficient) {
        void handleSelect(Number(event.key));
      } else if (event.key === 'Enter' && target.tagName !== 'BUTTON') {
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, qualityIssues, answers, current, handleSelect, handleNext]);

  // ---- Hiển thị
  if (stage.kind === 'loading') {
    return <GuestIntroSkeleton />;
  }

  if (stage.kind === 'unavailable') {
    return (
      <Card className="guest-card guest-card-center">
        <div className="guest-state guest-state-warning">
          <AlertTriangle size={40} aria-hidden="true" />
          <p className="guest-state-text">{UNAVAILABLE_TEXT[stage.reason] ?? UNAVAILABLE_TEXT.error}</p>
        </div>
      </Card>
    );
  }

  if (stage.kind === 'thanks') {
    return (
      <Card className="guest-card guest-card-center">
        <div className="guest-state guest-state-success">
          <CheckCircle2 size={56} className="guest-thanks-icon" aria-hidden="true" />
          <h1 className="guest-thanks-title">Cảm ơn bạn!</h1>
          <p className="guest-state-text">Bài đánh giá của bạn đã được ghi nhận.</p>
        </div>
      </Card>
    );
  }

  if (stage.kind === 'intro') {
    return (
      <Card className="guest-card">
        <form className="guest-intro" onSubmit={handleStart} noValidate>
          <div className="guest-intro-head">
            <h1 className="guest-title">Đánh giá {stage.subjectName ?? 'bạn của bạn'}</h1>
            <Badge variant="info">{GROUP_LABEL[stage.group]}</Badge>
          </div>

          <Input
            label="Biệt danh"
            name="rater_nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            error={introErrors.nickname}
            maxLength={40}
            autoComplete="off"
          />
          <ChoiceGroup
            label="Mối quan hệ"
            name="relationship"
            options={RELATIONSHIPS[stage.group].map((value) => ({ label: value, value }))}
            value={relationship}
            onChange={setRelationship}
            error={introErrors.relationship}
          />
          <ChoiceGroup
            label="Thời gian quen biết"
            name="acquaintance_duration"
            options={DURATION_OPTIONS}
            value={duration}
            onChange={setDuration}
            error={introErrors.duration}
          />
          <ChoiceGroup
            label="Tần suất tiếp xúc"
            name="contact_frequency"
            options={FREQUENCY_OPTIONS}
            value={frequency}
            onChange={setFrequency}
            error={introErrors.frequency}
          />
          <ChoiceGroup
            label="Mức độ hiểu"
            name="observation_depth"
            options={DEPTH_OPTIONS}
            value={depth}
            onChange={setDepth}
            error={introErrors.depth}
          />

          {introFailure && <Alert variant="danger">{introFailure}</Alert>}
          <Button type="submit" size="lg" block isLoading={isStarting} rightIcon={<ArrowRight size={18} />}>
            Bắt đầu
          </Button>
        </form>
      </Card>
    );
  }

  const isLast = index === questions.length - 1;
  const answeredNow = current ? isAnswered(answers, current.id) : false;

  return (
    <div className="guest-run">
      <div className="guest-run-top">
        <span className="guest-run-subject">Đánh giá {subjectName ?? ''}</span>
        {lastSavedAt && <span className="guest-run-saved">Đã tự động lưu nháp lúc {formatClock(lastSavedAt)}</span>}
      </div>

      {saveError && <Alert variant="danger">Không lưu được. Kiểm tra kết nối mạng rồi thử lại.</Alert>}
      {blockMessage && (
        <Alert variant="warning">
          {blockMessage}
          <div className="guest-block-action">
            <Button size="sm" variant="outline" onClick={reviewQuestions}>
              Xem lại câu hỏi
            </Button>
          </div>
        </Alert>
      )}
      {submitFailure && <Alert variant="danger">{submitFailure}</Alert>}

      {current && (
        <Card className="guest-card">
          <div className="guest-run-body">
            <div className="guest-progress">
              <span className="guest-progress-text">
                Câu {index + 1}/{questions.length}
              </span>
              <ProgressBar tone="accent" value={(answeredCount / questions.length) * 100} label="Tiến độ" />
            </div>

            <QuestionCard
              question={current}
              value={answers.get(current.id)}
              direction={direction}
              onSelect={handleSelect}
              onToggleInsufficient={handleInsufficient}
            />

            <div className="guest-nav">
              <Button
                variant="outline"
                size="lg"
                onClick={() => goTo(index - 1, 'back')}
                disabled={index === 0}
                leftIcon={<ArrowLeft size={18} />}
              >
                Quay lại
              </Button>
              <Button
                size="lg"
                onClick={handleNext}
                disabled={!answeredNow}
                isLoading={isSubmitting}
                rightIcon={isLast ? <Check size={18} /> : <ArrowRight size={18} />}
              >
                {isLast ? 'Nộp bài' : 'Tiếp theo'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Modal
        open={qualityIssues.length > 0}
        title="Kiểm tra lại bài làm"
        onClose={() => setQualityIssues([])}
        locked={isSubmitting}
        actions={
          <>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setQualityIssues([]);
                goTo(0, 'back');
              }}
            >
              Kiểm tra lại
            </Button>
            <Button isLoading={isSubmitting} onClick={doSubmit}>
              Vẫn nộp
            </Button>
          </>
        }
      >
        <ul className="guest-quality-list">
          {qualityIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};
