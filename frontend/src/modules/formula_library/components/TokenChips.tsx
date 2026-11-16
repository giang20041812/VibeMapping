import React from 'react';
import { Sigma, GitBranch } from 'lucide-react';
import type { Expr, SymbolDef } from '../../../domain/formula';
import { AGG_LABEL, CMP_LABEL, FN_LABEL, LOGIC_LABEL, NOTNULL_LABEL, OP_LABEL, condToTokens, exprToTokens, isSimpleIfZero, type Token } from '../formula.tokens';

const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 });

/** Số theo cách viết tiếng Việt: 5.000.000 và 0,25 */
export function formatViNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** Tên hiển thị của ký hiệu và công thức */
export interface TokenNames {
  symbols: Readonly<Record<string, SymbolDef>>;
  formulas: Readonly<Record<string, string>>;
}

export type ChipTone = 'input' | 'param' | 'formula' | 'text' | 'empty' | 'number';

export function leafInfo(expr: Expr, names: TokenNames): { label: string; tone: ChipTone } {
  switch (expr.t) {
    case 'num':
      return { label: formatViNumber(expr.v), tone: 'number' };
    case 'text':
      return { label: expr.v || '…', tone: 'text' };
    case 'na':
      return { label: 'Không có', tone: 'empty' };
    case 'sym':
      return { label: names.symbols[expr.id]?.name ?? expr.id, tone: 'input' };
    case 'param':
      return { label: names.symbols[expr.code]?.name ?? expr.code, tone: 'param' };
    case 'ref':
      return { label: names.formulas[expr.formula] ?? expr.formula, tone: 'formula' };
    default:
      return { label: '', tone: 'empty' };
  }
}

export interface TokenListProps {
  tokens: readonly Token[];
  names: TokenNames;
  /** Thẻ bị lỗi, tô đỏ */
  errorAt?: number;
  /** Bấm vào thẻ công thức khác */
  onRefClick?: (code: string) => void;
}

/** Nội dung bên trong thẻ khối: tổng/trung bình trên tập, phân số có giá trị riêng khi mẫu bằng 0, điều kiện lồng */
export const BlockContent: React.FC<{ expr: Expr; names: TokenNames }> = ({ expr, names }) => {
  if (expr.t === 'agg') {
    return (
      <>
        <Sigma size={14} aria-hidden="true" className="fx-block-icon" />
        <span className="fx-block-word">{AGG_LABEL[expr.kind]}</span>
        {expr.body && expr.kind !== 'count' && <TokenList tokens={exprToTokens(expr.body)} names={names} />}
        <span className="fx-block-word">{expr.kind === 'count' ? expr.label : `trên ${expr.label}`}</span>
      </>
    );
  }
  if (expr.t === 'div' && !isSimpleIfZero(expr.ifZero)) {
    return (
      <>
        <TokenList tokens={exprToTokens(expr.n)} names={names} />
        <span className="fx-op">÷</span>
        <TokenList tokens={exprToTokens(expr.d)} names={names} />
      </>
    );
  }
  if (expr.t === 'cases') {
    return (
      <>
        <GitBranch size={14} aria-hidden="true" className="fx-block-icon" />
        {expr.branches.map((branch, index) => (
          <React.Fragment key={index}>
            <span className="fx-block-word">{index === 0 ? 'Nếu' : '; nếu'}</span>
            <TokenList tokens={condToTokens(branch.when)} names={names} />
            <span className="fx-block-word">thì</span>
            <TokenList tokens={exprToTokens(branch.then)} names={names} />
          </React.Fragment>
        ))}
        <span className="fx-block-word">; còn lại</span>
        <TokenList tokens={exprToTokens(expr.otherwise)} names={names} />
      </>
    );
  }
  return <span className="fx-block-word">Biểu thức</span>;
};

/** Một thẻ, dùng chung cho chế độ xem và chế độ sửa */
export const TokenChip: React.FC<{ token: Token; names: TokenNames; isError?: boolean; onRefClick?: (code: string) => void }> = ({
  token,
  names,
  isError = false,
  onRefClick,
}) => {
  const error = isError ? ' is-error' : '';
  switch (token.k) {
    case 'val': {
      const { label, tone } = leafInfo(token.expr, names);
      if (tone === 'number') return <span className={`fx-num${error}`}>{label}</span>;
      const ref = token.expr.t === 'ref' ? token.expr.formula : null;
      if (ref && onRefClick) {
        return (
          <button
            type="button"
            className={`fx-chip fx-chip-${tone} fx-chip-link${error}`}
            onClick={(event) => {
              event.stopPropagation();
              onRefClick(ref);
            }}
          >
            {label}
          </button>
        );
      }
      return <span className={`fx-chip fx-chip-${tone}${error}`}>{tone === 'text' ? `“${label}”` : label}</span>;
    }
    case 'op':
      return <span className={`fx-op${error}`}>{OP_LABEL[token.op]}</span>;
    case 'open':
      return <span className={`fx-paren${error}`}>(</span>;
    case 'close':
      return <span className={`fx-paren${error}`}>)</span>;
    case 'comma':
      return <span className={`fx-paren${error}`}>;</span>;
    case 'fn':
      return <span className={`fx-fn${error}`}>{`${FN_LABEL[token.name]}(`}</span>;
    case 'cmp':
      return <span className={`fx-op fx-op-cmp${error}`}>{CMP_LABEL[token.op]}</span>;
    case 'logic':
      return <span className={`fx-logic${error}`}>{LOGIC_LABEL[token.op]}</span>;
    case 'notnull':
      return <span className={`fx-logic${error}`}>{NOTNULL_LABEL}</span>;
    case 'block':
      return (
        <span className={`fx-block${error}`}>
          <BlockContent expr={token.expr} names={names} />
        </span>
      );
  }
};

/** Chuỗi thẻ chỉ để xem */
export const TokenList: React.FC<TokenListProps> = ({ tokens, names, errorAt, onRefClick }) => (
  <span className="fx-tokens">
    {tokens.map((token, index) => (
      <TokenChip key={token.id} token={token} names={names} isError={index === errorAt} onRefClick={onRefClick} />
    ))}
  </span>
);
