import React from 'react';
import { SCALE_VALUES } from '../assessmentSession.constants';
import type { AnswerValue, BankQuestion } from '../assessmentSession.types';
import './QuestionCard.css';

export interface QuestionCardProps {
  question: Pick<BankQuestion, 'id' | 'content' | 'answerOptions' | 'criteriaName'>;
  value: AnswerValue | undefined;
  direction: 'forward' | 'back';
  onSelect: (score: number) => void;
  onToggleInsufficient: (checked: boolean) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, value, direction, onSelect, onToggleInsufficient }) => {
  const insufficient = Boolean(value?.insufficient);
  const groupName = `question-${question.id}`;

  return (
    <section key={question.id} className={`question-card question-enter-${direction}`}>
      <span className="question-criteria">{question.criteriaName}</span>
      <h2 className="question-text">{question.content}</h2>

      <div className="question-options" role="radiogroup" aria-label="Mức độ" aria-disabled={insufficient}>
        {SCALE_VALUES.map((score) => {
          const selected = !insufficient && value?.score === score;
          return (
            <label key={score} className={`question-option ${selected ? 'is-selected' : ''} ${insufficient ? 'is-disabled' : ''}`}>
              <input
                type="radio"
                name={groupName}
                value={score}
                checked={selected}
                disabled={insufficient}
                onChange={() => onSelect(score)}
                className="question-option-input"
              />
              <span className="question-option-score" aria-hidden="true">
                {score}
              </span>
              <span className="question-option-label">{question.answerOptions[score - 1] ?? ''}</span>
            </label>
          );
        })}
      </div>

      <label className={`question-insufficient ${insufficient ? 'is-checked' : ''}`}>
        <input
          type="checkbox"
          checked={insufficient}
          onChange={(event) => onToggleInsufficient(event.target.checked)}
          className="question-insufficient-input"
        />
        <span className="question-insufficient-box" aria-hidden="true" />
        <span>Không đủ cơ sở để đánh giá</span>
      </label>
    </section>
  );
};
