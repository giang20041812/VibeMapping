import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, Button, Modal, Select } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { AggKind, Expr, FnName, LatexContext } from '../../../domain/formula';
import { normalizeSearchText } from '../../../lib/searchText';
import { AGG_KIND_OPTIONS, type EditorEnv } from '../editor.logic';
import {
  CMP_LABEL,
  FN_LABEL,
  LOGIC_LABEL,
  NOTNULL_LABEL,
  condToTokens,
  exprToTokens,
  lineToExpr,
  newBranch,
  parseTypedNumber,
  tok,
  tokensToCond,
  tokensToExpr,
  type BranchTokens,
  type CmpOp,
  type LineError,
  type ParseContext,
  type Token,
  type TokenBody,
} from '../formula.tokens';
import { ExprEditor } from './ExprEditor';
import { TokenChip, formatViNumber, type ChipTone, type TokenNames } from './TokenChips';
import './FormulaLine.css';

/** Mọi thứ trình soạn cần: tên hiển thị, ký hiệu để đọc chuỗi thẻ, danh sách được chọn, các tập dữ liệu */
export interface EditorKit {
  names: TokenNames;
  ctx: ParseContext;
  env: EditorEnv;
  latex: LatexContext;
  /** Các tập dữ liệu đang có trong thư viện, để chọn khi thêm phép tổng */
  sets: { over: string; label: string }[];
}

type Mode = 'expr' | 'cond';

interface Suggestion {
  key: string;
  section: string;
  label: string;
  tone: ChipTone | 'plain';
  pick: () => void;
}

const DIV_TOKEN: TokenBody = { k: 'op', op: '/', ifZero: { t: 'na' }, auto: true };

const ARITH_CHARS: Record<string, TokenBody> = {
  '+': { k: 'op', op: '+' },
  '-': { k: 'op', op: '-' },
  '−': { k: 'op', op: '-' },
  '*': { k: 'op', op: '*' },
  '×': { k: 'op', op: '*' },
  '/': DIV_TOKEN,
  ':': DIV_TOKEN,
  '÷': DIV_TOKEN,
  '(': { k: 'open' },
  ')': { k: 'close' },
  ';': { k: 'comma' },
};

const CMP_CHARS: Record<string, CmpOp> = { '>': '>', '<': '<', '=': '=', '≥': '>=', '≤': '<=', '≠': '!=', '!': '!=' };

const CMP_ORDER: CmpOp[] = ['>=', '>', '<=', '<', '=', '!='];

/** Sau thẻ này cần một giá trị (nên dấu trừ là dấu âm của số) */
function expectsOperand(prev: Token | undefined): boolean {
  return !prev || prev.k === 'op' || prev.k === 'open' || prev.k === 'fn' || prev.k === 'comma' || prev.k === 'cmp' || prev.k === 'logic';
}

/** Vị trí thẻ đóng ngoặc ứng với thẻ mở ở vị trí index */
function matchingClose(tokens: readonly Token[], index: number): number {
  let depth = 0;
  for (let i = index; i < tokens.length; i += 1) {
    const k = tokens[i].k;
    if (k === 'open' || k === 'fn') depth += 1;
    else if (k === 'close') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const IF_ZERO_OPTIONS = [
  { value: 'na', label: 'Không có giá trị' },
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: 'none', label: 'Không xét' },
];

function ifZeroValue(token: Token): string {
  if (token.k !== 'op' || !token.ifZero) return 'none';
  if (token.ifZero.t === 'na') return 'na';
  return token.ifZero.t === 'num' ? String(token.ifZero.v) : 'none';
}

function ifZeroExpr(value: string): Expr | undefined {
  if (value === 'none') return undefined;
  if (value === 'na') return { t: 'na' };
  return { t: 'num', v: Number(value) };
}

export interface TokenEditorProps {
  tokens: Token[];
  onChange: (tokens: Token[]) => void;
  kit: EditorKit;
  mode?: Mode;
  /** Thẻ bị lỗi, tô đỏ */
  errorAt?: number;
  label: string;
  autoFocus?: boolean;
  /** Chọn "Theo điều kiện" khi ô còn trống thì chuyển cả dòng sang dạng nhiều nhánh */
  onConvertToCases?: () => void;
}

type DialogState = { index: number | null; expr: Expr | null; kind: BlockKind };

/** Ô soạn công thức dạng chuỗi thẻ: gõ số và dấu phép tính, gõ chữ để tìm ký hiệu, công thức, hàm */
export const TokenEditor: React.FC<TokenEditorProps> = ({ tokens, onChange, kit, mode = 'expr', errorAt, label, autoFocus = false, onConvertToCases }) => {
  const [caretState, setCaret] = useState(tokens.length);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Thêm, xóa thẻ hay dời con trỏ có thể làm ô nhập đổi chỗ và mất focus: giữ focus qua lần dựng kế tiếp */
  const keepFocus = useRef(false);

  const caret = Math.min(caretState, tokens.length);
  const selectedToken = selected !== null ? tokens[selected] : undefined;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useLayoutEffect(() => {
    if (!keepFocus.current) return;
    keepFocus.current = false;
    inputRef.current?.focus();
  });

  const moveCaret = (value: number) => {
    keepFocus.current = true;
    setCaret(value);
    setSelected(null);
  };

  const replaceRange = (start: number, removeCount: number, bodies: TokenBody[], caretAfter: number, keep = true) => {
    const next = [...tokens.slice(0, start), ...bodies.map(tok), ...tokens.slice(start + removeCount)];
    keepFocus.current = keep;
    onChange(next);
    setCaret(caretAfter);
    setText('');
    setSelected(null);
    setHighlight(0);
  };

  const insert = (bodies: TokenBody[], caretOffset = bodies.length, keep = true) => replaceRange(caret, 0, bodies, caret + caretOffset, keep);

  const removeAt = (index: number) => {
    const token = tokens[index];
    if (!token) return;
    const close = token.k === 'fn' || token.k === 'open' ? matchingClose(tokens, index) : -1;
    const next = tokens.filter((_, i) => i !== index && i !== close);
    keepFocus.current = true;
    onChange(next);
    setCaret(index);
    setSelected(null);
  };

  const openDialog = (state: DialogState) => {
    setDialog(state);
    setBrowse(false);
    setText('');
  };

  const handleText = (value: string) => {
    if (value === '') {
      setText('');
      return;
    }
    const last = value.slice(-1);
    const prefix = value.slice(0, -1);
    const prefixNumber = prefix === '' ? null : parseTypedNumber(prefix);
    const prev = tokens[caret - 1];

    // Dấu trừ đứng đầu một giá trị là dấu âm; dấu phẩy, dấu chấm sau số là phần thập phân
    if ((last === '-' || last === '−') && prefix === '' && expectsOperand(prev)) {
      setText('-');
      return;
    }
    if ((last === ',' || last === '.') && (prefixNumber !== null || prefix === '-')) {
      setText(value);
      return;
    }

    const cmp = mode === 'cond' ? CMP_CHARS[last] : undefined;
    const body: TokenBody | undefined = cmp ? { k: 'cmp', op: cmp } : ARITH_CHARS[last] ?? (last === ',' && prefix === '' ? { k: 'comma' } : undefined);
    if (body && (prefix === '' || prefixNumber !== null)) {
      const number: TokenBody[] = prefixNumber !== null ? [{ k: 'val', expr: { t: 'num', v: prefixNumber } }] : [];
      // ">" rồi "=" thành "≥"
      if (body.k === 'cmp' && body.op === '=' && number.length === 0 && prev?.k === 'cmp') {
        const merged: CmpOp = prev.op === '>' ? '>=' : prev.op === '<' ? '<=' : prev.op;
        replaceRange(caret - 1, 1, [{ k: 'cmp', op: merged }], caret);
        return;
      }
      insert([...number, body]);
      return;
    }
    setText(value);
    setBrowse(false);
    setHighlight(0);
  };

  const commitNumber = (keep = true): boolean => {
    const value = parseTypedNumber(text);
    if (value === null) return false;
    insert([{ k: 'val', expr: { t: 'num', v: value } }], 1, keep);
    return true;
  };

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!focused || (!text && !browse)) return [];
    const query = normalizeSearchText(text);
    const matches = (...labels: string[]) => !query || labels.some((item) => normalizeSearchText(item).includes(query));
    const list: Suggestion[] = [];
    const typed = parseTypedNumber(text);
    if (typed !== null) {
      list.push({ key: 'num', section: 'Số', label: formatViNumber(typed), tone: 'plain', pick: () => insert([{ k: 'val', expr: { t: 'num', v: typed } }]) });
    }
    for (const symbol of kit.env.inputSymbols) {
      if (matches(symbol.name, symbol.code)) {
        list.push({ key: `s:${symbol.code}`, section: 'Dữ liệu đầu vào', label: symbol.name, tone: 'input', pick: () => insert([{ k: 'val', expr: { t: 'sym', id: symbol.code } }]) });
      }
    }
    for (const symbol of kit.env.paramSymbols) {
      if (matches(symbol.name, symbol.code)) {
        list.push({ key: `p:${symbol.code}`, section: 'Tham số', label: symbol.name, tone: 'param', pick: () => insert([{ k: 'val', expr: { t: 'param', code: symbol.code } }]) });
      }
    }
    for (const formula of kit.env.formulas) {
      if (matches(formula.name, formula.code)) {
        list.push({ key: `f:${formula.code}`, section: 'Công thức', label: formula.name, tone: 'formula', pick: () => insert([{ k: 'val', expr: { t: 'ref', formula: formula.code } }]) });
      }
    }
    for (const name of Object.keys(FN_LABEL) as FnName[]) {
      if (matches(FN_LABEL[name])) {
        list.push({ key: `fn:${name}`, section: 'Hàm', label: `${FN_LABEL[name]}( … )`, tone: 'plain', pick: () => insert([{ k: 'fn', name }, { k: 'close' }], 1) });
      }
    }
    if (mode === 'cond') {
      for (const op of CMP_ORDER) {
        list.push({ key: `cmp:${op}`, section: 'So sánh', label: CMP_LABEL[op], tone: 'plain', pick: () => insert([{ k: 'cmp', op }]) });
      }
      if (matches(NOTNULL_LABEL)) list.push({ key: 'notnull', section: 'So sánh', label: NOTNULL_LABEL, tone: 'plain', pick: () => insert([{ k: 'notnull' }]) });
      for (const op of ['and', 'or'] as const) {
        if (matches(LOGIC_LABEL[op])) list.push({ key: `logic:${op}`, section: 'So sánh', label: LOGIC_LABEL[op], tone: 'plain', pick: () => insert([{ k: 'logic', op }]) });
      }
    }
    if (mode === 'expr' && matches('Theo điều kiện', 'nếu')) {
      list.push({
        key: 'cases',
        section: 'Khác',
        label: 'Theo điều kiện',
        tone: 'plain',
        pick: () => (onConvertToCases && tokens.length === 0 ? onConvertToCases() : openDialog({ index: null, expr: null, kind: 'cases' })),
      });
    }
    if (mode === 'expr' && kit.sets.length > 0 && matches('Tổng', 'Trung bình', 'Đếm')) {
      list.push({ key: 'agg', section: 'Khác', label: 'Tổng, trung bình, đếm trên tập', tone: 'plain', pick: () => openDialog({ index: null, expr: null, kind: 'agg' }) });
    }
    if (matches('Không có giá trị')) {
      list.push({ key: 'na', section: 'Khác', label: 'Không có giá trị', tone: 'empty', pick: () => insert([{ k: 'val', expr: { t: 'na' } }]) });
    }
    if (text.trim() && typed === null) {
      const value = text.trim();
      list.push({ key: 'text', section: 'Khác', label: `Chữ “${value}”`, tone: 'text', pick: () => insert([{ k: 'val', expr: { t: 'text', v: value } }]) });
    }
    return list;
    // insert và openDialog đọc tokens/caret mới nhất qua closure của lần dựng này
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, text, browse, kit, mode, tokens, caret, onConvertToCases]);

  const activeIndex = Math.min(highlight, Math.max(suggestions.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, suggestions.length]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const open = suggestions.length > 0;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) setBrowse(true);
        else setHighlight((activeIndex + 1) % suggestions.length);
        return;
      case 'ArrowUp':
        if (!open) return;
        event.preventDefault();
        setHighlight((activeIndex - 1 + suggestions.length) % suggestions.length);
        return;
      case 'Enter':
        event.preventDefault();
        if (open) suggestions[activeIndex]?.pick();
        else commitNumber();
        return;
      case 'Escape':
        if (open || text) {
          event.preventDefault();
          event.stopPropagation();
          setBrowse(false);
          setText('');
        }
        return;
      case 'Backspace':
        if (text) return;
        event.preventDefault();
        if (caret > 0) removeAt(caret - 1);
        return;
      case 'Delete':
        if (text) return;
        event.preventDefault();
        if (caret < tokens.length) removeAt(caret);
        return;
      case 'ArrowLeft':
        if (text) return;
        event.preventDefault();
        moveCaret(Math.max(0, caret - 1));
        return;
      case 'ArrowRight':
        if (text) return;
        event.preventDefault();
        moveCaret(Math.min(tokens.length, caret + 1));
        return;
      case 'Home':
        if (text) return;
        event.preventDefault();
        moveCaret(0);
        return;
      case 'End':
        if (text) return;
        event.preventDefault();
        moveCaret(tokens.length);
        return;
      default:
    }
  };

  const clickToken = (index: number) => {
    keepFocus.current = true;
    setCaret(index + 1);
    setSelected(index);
    setText('');
    setBrowse(false);
    const token = tokens[index];
    if (token.k === 'block') {
      keepFocus.current = false;
      openDialog({ index, expr: token.expr, kind: blockKindOf(token.expr) });
    } else {
      inputRef.current?.focus();
    }
  };

  const input = (
    <input
      key="input"
      ref={inputRef}
      className={`fx-input${caret === tokens.length ? ' is-end' : ''}`}
      value={text}
      size={Math.max(1, text.length + 1)}
      aria-label={label}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      onChange={(event) => handleText(event.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        setFocused(true);
        if (tokens.length === 0) setBrowse(true);
      }}
      onBlur={() => {
        // Ô nhập đổi chỗ khi thêm thẻ: sẽ được focus lại ngay, không tính là rời ô
        if (keepFocus.current) return;
        commitNumber(false);
        setFocused(false);
        setBrowse(false);
        setText('');
      }}
    />
  );

  const renderToken = (token: Token, index: number) => (
    <span
      key={token.id}
      className={`fx-token-hit${selected === index ? ' is-selected' : ''}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => clickToken(index)}
    >
      <TokenChip token={token} names={kit.names} isError={index === errorAt} />
    </span>
  );

  let lastSection = '';
  return (
    <div className="fx-editor">
      <div
        className={`fx-bar is-editing${focused ? ' is-focused' : ''}${errorAt !== undefined ? ' has-error' : ''}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            moveCaret(tokens.length);
            inputRef.current?.focus();
          }
        }}
      >
        {/* Các thẻ và ô nhập là con trực tiếp, có khóa: thêm thẻ trước con trỏ không dựng lại ô nhập */}
        {tokens.slice(0, caret).map(renderToken)}
        {input}
        {tokens.slice(caret).map((token, offset) => renderToken(token, caret + offset))}
        <button
          type="button"
          className="fx-add"
          aria-label="Thêm vào công thức"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            moveCaret(tokens.length);
            setBrowse(true);
            inputRef.current?.focus();
          }}
        >
          <Plus size={16} />
        </button>
        {suggestions.length > 0 && (
          <div className="fx-menu" role="listbox" ref={listRef} onMouseDown={(event) => event.preventDefault()}>
            {suggestions.map((item, index) => {
              const header = item.section !== lastSection ? item.section : null;
              lastSection = item.section;
              return (
                <React.Fragment key={item.key}>
                  {header && <div className="fx-menu-section">{header}</div>}
                  <div
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`fx-menu-item${index === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => item.pick()}
                  >
                    {item.tone === 'plain' ? <span>{item.label}</span> : <span className={`fx-chip fx-chip-${item.tone}`}>{item.label}</span>}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {selectedToken && selected !== null && (
        <div className="fx-token-tools">
          {selectedToken.k === 'op' && selectedToken.op === '/' && (
            <div className="fx-token-tool-field">
              <Select
                label="Khi mẫu số bằng 0"
                options={IF_ZERO_OPTIONS.some((option) => option.value === ifZeroValue(selectedToken)) ? IF_ZERO_OPTIONS : [...IF_ZERO_OPTIONS, { value: ifZeroValue(selectedToken), label: ifZeroValue(selectedToken) }]}
                value={ifZeroValue(selectedToken)}
                onChange={(value) => {
                  const ifZero = ifZeroExpr(value);
                  onChange(tokens.map((token, i) => (i === selected ? { id: token.id, k: 'op', op: '/', ...(ifZero ? { ifZero } : {}) } : token)));
                }}
              />
            </div>
          )}
          {selectedToken.k === 'block' && (
            <Button type="button" size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => openDialog({ index: selected, expr: selectedToken.expr, kind: blockKindOf(selectedToken.expr) })}>
              Sửa
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => removeAt(selected)}>
            Xóa
          </Button>
        </div>
      )}

      {dialog && (
        <BlockDialog
          kit={kit}
          kind={dialog.kind}
          initial={dialog.expr}
          onCancel={() => setDialog(null)}
          onSave={(expr) => {
            if (dialog.index === null) insert([{ k: 'block', expr }]);
            else onChange(tokens.map((token, i) => (i === dialog.index ? { id: token.id, k: 'block', expr } : token)));
            setDialog(null);
          }}
        />
      )}
    </div>
  );
};

/* ---------- Thẻ khối: tổng trên tập, điều kiện lồng, phân số có giá trị riêng khi mẫu bằng 0 ---------- */

type BlockKind = 'agg' | 'cases' | 'div' | 'other';

function blockKindOf(expr: Expr): BlockKind {
  if (expr.t === 'agg' || expr.t === 'cases' || expr.t === 'div') return expr.t;
  return 'other';
}

const BLOCK_TITLE: Record<BlockKind, string> = {
  agg: 'Tổng, trung bình, đếm trên tập',
  cases: 'Theo điều kiện',
  div: 'Phân số',
  other: 'Biểu thức',
};

interface BlockDialogProps {
  kit: EditorKit;
  kind: BlockKind;
  initial: Expr | null;
  onCancel: () => void;
  onSave: (expr: Expr) => void;
}

const BlockDialog: React.FC<BlockDialogProps> = ({ kit, kind, initial, onCancel, onSave }) => {
  const [error, setError] = useState<string | null>(null);
  const [lineError, setLineError] = useState<LineError | null>(null);

  // Tổng trên tập
  const agg = initial?.t === 'agg' ? initial : null;
  const firstSet = kit.sets[0];
  const [aggKind, setAggKind] = useState<AggKind>(agg?.kind ?? 'sum');
  const [over, setOver] = useState(agg?.over ?? firstSet?.over ?? '');
  const [setLabel, setSetLabel] = useState(agg?.label ?? firstSet?.label ?? '');
  const [body, setBody] = useState<Token[]>(() => (agg?.body ? exprToTokens(agg.body) : []));
  const [where, setWhere] = useState<Token[]>(() => (agg?.where ? condToTokens(agg.where) : []));

  // Điều kiện
  const casesInit = initial?.t === 'cases' ? initial : null;
  const [cases, setCases] = useState<{ branches: BranchTokens[]; otherwise: Token[] }>(() =>
    casesInit
      ? {
          branches: casesInit.branches.map((branch) => ({ ...newBranch(), when: condToTokens(branch.when), then: exprToTokens(branch.then) })),
          otherwise: exprToTokens(casesInit.otherwise),
        }
      : { branches: [newBranch()], otherwise: [] },
  );

  // Phân số
  const divInit = initial?.t === 'div' ? initial : null;
  const [numerator, setNumerator] = useState<Token[]>(() => (divInit ? exprToTokens(divInit.n) : []));
  const [denominator, setDenominator] = useState<Token[]>(() => (divInit ? exprToTokens(divInit.d) : []));
  const [ifZero, setIfZero] = useState<Token[]>(() => (divInit?.ifZero ? exprToTokens(divInit.ifZero) : []));

  // Biểu thức khác: dùng trình soạn dạng cây
  const [other, setOther] = useState<Expr>(initial ?? { t: 'num', v: 0 });

  const setOptions = useMemo(() => {
    const options = kit.sets.map((item) => ({ value: item.over, label: item.label }));
    return over && !options.some((option) => option.value === over) ? [{ value: over, label: setLabel || over }, ...options] : options;
  }, [kit.sets, over, setLabel]);

  const save = () => {
    setError(null);
    setLineError(null);
    if (kind === 'agg') {
      if (!agg?.rows && !over) return setError('Chọn tập dữ liệu');
      let bodyExpr: Expr | undefined;
      if (aggKind !== 'count') {
        const parsed = tokensToExpr(body, kit.ctx);
        if (!parsed.ok) return setError(`Giá trị: ${parsed.message}`);
        bodyExpr = parsed.value;
      }
      let whereCond;
      if (where.length > 0) {
        const parsed = tokensToCond(where, kit.ctx);
        if (!parsed.ok) return setError(`Chỉ tính khi: ${parsed.message}`);
        whereCond = parsed.value;
      }
      return onSave({
        t: 'agg',
        kind: aggKind,
        index: agg?.index ?? 'i',
        over: agg?.rows ? agg.over : over,
        ...(agg?.rows ? { rows: agg.rows } : {}),
        label: setLabel,
        ...(whereCond ? { where: whereCond } : {}),
        ...(bodyExpr ? { body: bodyExpr } : {}),
      });
    }
    if (kind === 'cases') {
      const result = lineToExpr({ kind: 'cases', ...cases }, kit.ctx);
      if (!result.ok) {
        setLineError(result.error);
        return setError(result.error.message);
      }
      return onSave(result.expr);
    }
    if (kind === 'div') {
      const n = tokensToExpr(numerator, kit.ctx);
      if (!n.ok) return setError(`Tử số: ${n.message}`);
      const d = tokensToExpr(denominator, kit.ctx);
      if (!d.ok) return setError(`Mẫu số: ${d.message}`);
      if (ifZero.length === 0) return onSave({ t: 'div', n: n.value, d: d.value });
      const z = tokensToExpr(ifZero, kit.ctx);
      if (!z.ok) return setError(`Khi mẫu số bằng 0: ${z.message}`);
      return onSave({ t: 'div', n: n.value, d: d.value, ifZero: z.value });
    }
    return onSave(other);
  };

  return (
    <Modal
      open
      wide
      title={BLOCK_TITLE[kind]}
      onClose={onCancel}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="button" onClick={save}>
            Xong
          </Button>
        </>
      }
    >
      <div className="fx-dialog">
        {error && <Alert variant="danger">{error}</Alert>}

        {kind === 'agg' && (
          <>
            <div className="fx-dialog-grid">
              <Select label="Phép tính" options={AGG_KIND_OPTIONS} value={aggKind} onChange={(value) => setAggKind(value as AggKind)} />
              {!agg?.rows && (
                <SearchableSelect
                  label="Trên tập"
                  placeholder="Chọn tập"
                  options={setOptions}
                  value={over}
                  onChange={(value) => {
                    setOver(value);
                    setSetLabel(kit.sets.find((item) => item.over === value)?.label ?? value);
                  }}
                />
              )}
            </div>
            {aggKind !== 'count' && <DialogField label="Giá trị">{<TokenEditor tokens={body} onChange={setBody} kit={kit} label="Giá trị" autoFocus />}</DialogField>}
            <DialogField label="Chỉ tính khi">{<TokenEditor tokens={where} onChange={setWhere} kit={kit} mode="cond" label="Chỉ tính khi" />}</DialogField>
          </>
        )}

        {kind === 'cases' && <CasesFields value={cases} onChange={setCases} kit={kit} error={lineError} />}

        {kind === 'div' && (
          <>
            <DialogField label="Tử số">{<TokenEditor tokens={numerator} onChange={setNumerator} kit={kit} label="Tử số" autoFocus />}</DialogField>
            <DialogField label="Mẫu số">{<TokenEditor tokens={denominator} onChange={setDenominator} kit={kit} label="Mẫu số" />}</DialogField>
            <DialogField label="Khi mẫu số bằng 0">{<TokenEditor tokens={ifZero} onChange={setIfZero} kit={kit} label="Khi mẫu số bằng 0" />}</DialogField>
          </>
        )}

        {kind === 'other' && <ExprEditor env={kit.env} latex={kit.latex} value={other} onChange={setOther} />}
      </div>
    </Modal>
  );
};

const DialogField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="fx-dialog-field">
    <span className="fx-dialog-label">{label}</span>
    {children}
  </div>
);

/* ---------- Các nhánh "nếu … thì …" ---------- */

export interface CasesValue {
  branches: BranchTokens[];
  otherwise: Token[];
}

export interface CasesFieldsProps {
  value: CasesValue;
  onChange: (value: CasesValue) => void;
  kit: EditorKit;
  error?: LineError | null;
  /** Xóa nhánh cuối cùng: không có thì giữ tối thiểu một nhánh */
  onRemoveAll?: () => void;
}

export const CasesFields: React.FC<CasesFieldsProps> = ({ value, onChange, kit, error, onRemoveAll }) => {
  const errorAt = (part: 'when' | 'then', branch: number) =>
    error && error.where.part === part && 'branch' in error.where && error.where.branch === branch ? error.at : undefined;

  const patchBranch = (index: number, patch: Partial<BranchTokens>) =>
    onChange({ ...value, branches: value.branches.map((branch, i) => (i === index ? { ...branch, ...patch } : branch)) });

  const removeBranch = (index: number) => {
    if (value.branches.length === 1) {
      onRemoveAll?.();
      return;
    }
    onChange({ ...value, branches: value.branches.filter((_, i) => i !== index) });
  };

  return (
    <div className="fx-cases is-editing">
      {value.branches.map((branch, index) => (
        <div className="fx-case" key={branch.id}>
          <span className="fx-case-key">Nếu</span>
          <div className="fx-case-cond">
            <TokenEditor tokens={branch.when} onChange={(when) => patchBranch(index, { when })} kit={kit} mode="cond" errorAt={errorAt('when', index)} label={`Điều kiện ${index + 1}`} />
          </div>
          <span className="fx-case-key">thì</span>
          <div className="fx-case-value">
            <TokenEditor tokens={branch.then} onChange={(then) => patchBranch(index, { then })} kit={kit} errorAt={errorAt('then', index)} label={`Kết quả ${index + 1}`} />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="fx-case-remove"
            aria-label={`Bỏ điều kiện ${index + 1}`}
            disabled={value.branches.length === 1 && !onRemoveAll}
            onClick={() => removeBranch(index)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
      <div className="fx-case fx-case-else">
        <span className="fx-case-key">Còn lại</span>
        <div className="fx-case-value">
          <TokenEditor
            tokens={value.otherwise}
            onChange={(otherwise) => onChange({ ...value, otherwise })}
            kit={kit}
            errorAt={error?.where.part === 'otherwise' ? error.at : undefined}
            label="Kết quả còn lại"
          />
        </div>
      </div>
      <div>
        <Button type="button" size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => onChange({ ...value, branches: [...value.branches, newBranch()] })}>
          Thêm điều kiện
        </Button>
      </div>
    </div>
  );
};
