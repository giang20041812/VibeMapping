import { isProvablyNonZero, type Cond, type Expr, type FnName, type SymbolDef } from '../../domain/formula';

/**
 * Công thức dạng chuỗi thẻ: mỗi số, ký hiệu, tham số, công thức khác là một thẻ, nối bằng dấu + − × ÷ và ngoặc.
 * Phần không viết được thành chuỗi (tổng/trung bình trên tập, điều kiện lồng bên trong) là một thẻ khối,
 * bấm vào mới sửa. Chuyển qua lại giữa cây biểu thức và chuỗi thẻ phải giữ nguyên cây.
 */

export type ArithOp = '+' | '-' | '*' | '/';
export type CmpOp = '>=' | '>' | '<=' | '<' | '=' | '!=';

export type TokenBody =
  /** Số, chữ, không có giá trị, dữ liệu đầu vào, tham số, công thức khác */
  | { k: 'val'; expr: Expr }
  /** ifZero: giá trị khi mẫu số bằng 0; auto: tự bỏ khi mẫu số chắc chắn khác 0 */
  | { k: 'op'; op: ArithOp; ifZero?: Expr; auto?: boolean }
  | { k: 'open' }
  | { k: 'close' }
  /** Tên hàm kèm dấu mở ngoặc */
  | { k: 'fn'; name: FnName }
  | { k: 'comma' }
  | { k: 'block'; expr: Expr }
  | { k: 'cmp'; op: CmpOp }
  | { k: 'logic'; op: 'and' | 'or' }
  | { k: 'notnull' };

export type Token = TokenBody & { id: string };

let nextId = 0;
export function newId(): string {
  nextId += 1;
  return `t${nextId}`;
}

export function tok(body: TokenBody): Token {
  return { ...body, id: newId() };
}

export const OP_LABEL: Record<ArithOp, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
export const CMP_LABEL: Record<CmpOp, string> = { '>=': '≥', '>': '>', '<=': '≤', '<': '<', '=': '=', '!=': '≠' };
export const LOGIC_LABEL = { and: 'và', or: 'hoặc' } as const;
export const NOTNULL_LABEL = 'có dữ liệu';

export const FN_LABEL: Record<FnName, string> = {
  min: 'Nhỏ nhất',
  max: 'Lớn nhất',
  floor: 'Làm tròn xuống',
  abs: 'Giá trị tuyệt đối',
  round: 'Làm tròn',
  clamp: 'Giới hạn',
};

export const AGG_LABEL = { sum: 'Tổng', avg: 'Trung bình', count: 'Đếm', min: 'Nhỏ nhất', max: 'Lớn nhất' } as const;

const LEAF = new Set<Expr['t']>(['num', 'text', 'na', 'sym', 'param', 'ref']);

/** Giá trị khi mẫu số bằng 0 chỉ chọn được trong danh sách ngắn; giá trị khác thì cả phân số là thẻ khối */
export function isSimpleIfZero(expr: Expr | undefined): boolean {
  return expr === undefined || expr.t === 'na' || expr.t === 'num';
}

function precedence(expr: Expr): number {
  if (expr.t === 'bin') return expr.op === '*' ? 2 : 1;
  if (expr.t === 'div') return isSimpleIfZero(expr.ifZero) ? 2 : 3;
  return 3;
}

/** Cây biểu thức → chuỗi thẻ */
export function exprToTokens(expr: Expr): Token[] {
  const out: Token[] = [];
  const emit = (node: Expr, parentPrec: number, isRight: boolean): void => {
    if (LEAF.has(node.t)) {
      out.push(tok({ k: 'val', expr: node }));
      return;
    }
    if (node.t === 'fn') {
      out.push(tok({ k: 'fn', name: node.name }));
      node.args.forEach((arg, index) => {
        if (index > 0) out.push(tok({ k: 'comma' }));
        emit(arg, 0, false);
      });
      out.push(tok({ k: 'close' }));
      return;
    }
    if ((node.t === 'bin' || node.t === 'div') && precedence(node) < 3) {
      const prec = precedence(node);
      // Vế phải cùng bậc cũng cần ngoặc, để đọc lại theo thứ tự trái sang phải vẫn ra đúng cây
      const wrap = prec < parentPrec || (isRight && prec === parentPrec);
      if (wrap) out.push(tok({ k: 'open' }));
      if (node.t === 'bin') {
        emit(node.l, prec, false);
        out.push(tok({ k: 'op', op: node.op }));
        emit(node.r, prec, true);
      } else {
        emit(node.n, prec, false);
        out.push(tok({ k: 'op', op: '/', ...(node.ifZero ? { ifZero: node.ifZero } : {}) }));
        emit(node.d, prec, true);
      }
      if (wrap) out.push(tok({ k: 'close' }));
      return;
    }
    out.push(tok({ k: 'block', expr: node }));
  };
  emit(expr, 0, false);
  return out;
}

/** Điều kiện → chuỗi thẻ */
export function condToTokens(cond: Cond): Token[] {
  const out: Token[] = [];
  const emit = (node: Cond, parent: 'and' | 'or' | null): void => {
    if (node.c === 'cmp') {
      out.push(...exprToTokens(node.l), tok({ k: 'cmp', op: node.op }), ...exprToTokens(node.r));
      return;
    }
    if (node.c === 'notnull') {
      out.push(...exprToTokens(node.e), tok({ k: 'notnull' }));
      return;
    }
    // "và" gắn chặt hơn "hoặc"; nhóm cùng loại lồng nhau hay nhóm một mục thì giữ ngoặc để đọc lại ra đúng cây
    const wrap = parent !== null && (parent === node.c || node.c === 'or' || node.items.length < 2);
    if (wrap) out.push(tok({ k: 'open' }));
    node.items.forEach((item, index) => {
      if (index > 0) out.push(tok({ k: 'logic', op: node.c }));
      emit(item, node.c);
    });
    if (wrap) out.push(tok({ k: 'close' }));
  };
  emit(cond, null);
  return out;
}

export interface ParseContext {
  symbols: Readonly<Record<string, SymbolDef>>;
}

export class TokenParseError extends Error {
  constructor(
    message: string,
    /** Vị trí thẻ gây lỗi, để tô đỏ */
    readonly at: number,
  ) {
    super(message);
  }
}

class Parser {
  pos = 0;
  constructor(
    readonly tokens: readonly Token[],
    readonly ctx: ParseContext,
  ) {}

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  fail(message: string, at = this.pos): never {
    throw new TokenParseError(message, Math.min(at, Math.max(this.tokens.length - 1, 0)));
  }

  expr(): Expr {
    let left = this.term();
    for (let t = this.peek(); t && t.k === 'op' && (t.op === '+' || t.op === '-'); t = this.peek()) {
      this.pos += 1;
      left = { t: 'bin', op: t.op, l: left, r: this.term() };
    }
    return left;
  }

  term(): Expr {
    let left = this.factor();
    for (let t = this.peek(); t && t.k === 'op' && (t.op === '*' || t.op === '/'); t = this.peek()) {
      this.pos += 1;
      const right = this.factor();
      if (t.op === '*') {
        left = { t: 'bin', op: '*', l: left, r: right };
      } else {
        const ifZero = t.auto && isProvablyNonZero(right, this.ctx.symbols) ? undefined : t.ifZero;
        left = ifZero ? { t: 'div', n: left, d: right, ifZero } : { t: 'div', n: left, d: right };
      }
    }
    return left;
  }

  factor(): Expr {
    const t = this.peek();
    if (!t) this.fail('Thiếu số hoặc ký hiệu ở cuối', this.tokens.length);
    if (t.k === 'val' || t.k === 'block') {
      this.pos += 1;
      return t.expr;
    }
    if (t.k === 'open') {
      this.pos += 1;
      const inner = this.expr();
      if (this.peek()?.k !== 'close') this.fail('Thiếu dấu đóng ngoặc');
      this.pos += 1;
      return inner;
    }
    if (t.k === 'fn') {
      this.pos += 1;
      const args: Expr[] = [this.expr()];
      while (this.peek()?.k === 'comma') {
        this.pos += 1;
        args.push(this.expr());
      }
      if (this.peek()?.k !== 'close') this.fail(`Thiếu dấu đóng ngoặc của ${FN_LABEL[t.name]}`);
      this.pos += 1;
      return { t: 'fn', name: t.name, args };
    }
    if (t.k === 'op') this.fail(`Thiếu số hoặc ký hiệu trước dấu ${OP_LABEL[t.op]}`);
    if (t.k === 'close') this.fail('Dấu đóng ngoặc thừa hoặc thiếu số trước nó');
    if (t.k === 'comma') this.fail('Dấu phẩy chỉ dùng giữa các giá trị của hàm');
    return this.fail('Phép so sánh chỉ dùng trong điều kiện');
  }

  cond(): Cond {
    const items = [this.andCond()];
    while (this.peek()?.k === 'logic' && (this.peek() as { op: string }).op === 'or') {
      this.pos += 1;
      items.push(this.andCond());
    }
    return items.length === 1 ? items[0] : { c: 'or', items };
  }

  andCond(): Cond {
    const items = [this.atomCond()];
    while (this.peek()?.k === 'logic' && (this.peek() as { op: string }).op === 'and') {
      this.pos += 1;
      items.push(this.atomCond());
    }
    return items.length === 1 ? items[0] : { c: 'and', items };
  }

  atomCond(): Cond {
    // Ngoặc có thể bao một điều kiện hoặc chỉ bao một phép tính: thử điều kiện trước, không được thì đọc như phép tính
    if (this.peek()?.k === 'open') {
      const saved = this.pos;
      try {
        this.pos += 1;
        const inner = this.cond();
        if (this.peek()?.k === 'close') {
          this.pos += 1;
          const next = this.peek();
          if (!next || next.k === 'logic' || next.k === 'close') return inner;
        }
      } catch {
        // đọc lại như phép tính
      }
      this.pos = saved;
    }
    const left = this.expr();
    const t = this.peek();
    if (t?.k === 'notnull') {
      this.pos += 1;
      return { c: 'notnull', e: left };
    }
    if (t?.k === 'cmp') {
      this.pos += 1;
      return { c: 'cmp', op: t.op, l: left, r: this.expr() };
    }
    return this.fail('Điều kiện cần một phép so sánh hoặc "có dữ liệu"', t ? this.pos : this.tokens.length);
  }
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string; at: number };

function run<T>(tokens: readonly Token[], ctx: ParseContext, read: (parser: Parser) => T, emptyMessage: string): ParseResult<T> {
  if (tokens.length === 0) return { ok: false, message: emptyMessage, at: 0 };
  const parser = new Parser(tokens, ctx);
  try {
    const value = read(parser);
    if (parser.pos < tokens.length) {
      const t = tokens[parser.pos];
      const message = t.k === 'close' ? 'Dấu đóng ngoặc thừa' : t.k === 'comma' ? 'Dấu phẩy chỉ dùng giữa các giá trị của hàm' : 'Thiếu dấu phép tính giữa hai giá trị';
      return { ok: false, message, at: parser.pos };
    }
    return { ok: true, value };
  } catch (error) {
    if (error instanceof TokenParseError) return { ok: false, message: error.message, at: error.at };
    throw error;
  }
}

export function tokensToExpr(tokens: readonly Token[], ctx: ParseContext): ParseResult<Expr> {
  return run(tokens, ctx, (parser) => parser.expr(), 'Chưa có nội dung');
}

export function tokensToCond(tokens: readonly Token[], ctx: ParseContext): ParseResult<Cond> {
  return run(tokens, ctx, (parser) => parser.cond(), 'Chưa có điều kiện');
}

/* ---------- Bố cục một dòng công thức: chuỗi thẻ, hoặc các nhánh "nếu … thì …" ---------- */

export interface BranchTokens {
  id: string;
  when: Token[];
  then: Token[];
}

export type LineTokens = { kind: 'flat'; tokens: Token[] } | { kind: 'cases'; branches: BranchTokens[]; otherwise: Token[] };

export function exprToLine(expr: Expr): LineTokens {
  if (expr.t === 'cases' && expr.branches.length > 0) {
    return {
      kind: 'cases',
      branches: expr.branches.map((branch) => ({ id: newId(), when: condToTokens(branch.when), then: exprToTokens(branch.then) })),
      otherwise: exprToTokens(expr.otherwise),
    };
  }
  return { kind: 'flat', tokens: exprToTokens(expr) };
}

/** Lỗi đọc chuỗi thẻ: chỉ rõ ô nào (nhánh nào, vế nào) và thẻ nào */
export interface LineError {
  message: string;
  /** flat; hoặc chỉ số nhánh và vế; otherwise */
  where: { part: 'flat' } | { part: 'when' | 'then'; branch: number } | { part: 'otherwise' };
  at: number;
}

export type LineResult = { ok: true; expr: Expr } | { ok: false; error: LineError };

export function lineToExpr(line: LineTokens, ctx: ParseContext): LineResult {
  if (line.kind === 'flat') {
    const parsed = tokensToExpr(line.tokens, ctx);
    return parsed.ok ? { ok: true, expr: parsed.value } : { ok: false, error: { message: parsed.message, where: { part: 'flat' }, at: parsed.at } };
  }
  const branches: { when: Cond; then: Expr }[] = [];
  for (const [index, branch] of line.branches.entries()) {
    const when = tokensToCond(branch.when, ctx);
    if (!when.ok) return { ok: false, error: { message: when.message, where: { part: 'when', branch: index }, at: when.at } };
    const then = tokensToExpr(branch.then, ctx);
    if (!then.ok) return { ok: false, error: { message: then.message, where: { part: 'then', branch: index }, at: then.at } };
    branches.push({ when: when.value, then: then.value });
  }
  const otherwise = tokensToExpr(line.otherwise, ctx);
  if (!otherwise.ok) return { ok: false, error: { message: otherwise.message, where: { part: 'otherwise' }, at: otherwise.at } };
  return { ok: true, expr: { t: 'cases', branches, otherwise: otherwise.value } };
}

export function newBranch(): BranchTokens {
  return { id: newId(), when: [], then: [] };
}

/* ---------- Đọc số người dùng gõ ---------- */

/** "0,5", "0.5", "-3" → số; không phải số thì null */
export function parseTypedNumber(text: string): number | null {
  const raw = text.trim();
  // Có dấu chấm ngăn hàng nghìn: 5.000.000 hay 1.250,5
  const grouped = /^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(raw);
  const trimmed = grouped ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
