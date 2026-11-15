import type { Cond, Expr, FormulaDef, SymbolDef, Value } from './types';

export interface LatexContext {
  /** Ký hiệu theo mã */
  symbols: Readonly<Record<string, SymbolDef>>;
  /** Mã công thức → mã ký hiệu kết quả của công thức đó */
  outputs: Readonly<Record<string, string>>;
  /**
   * Có thì thay số: ký hiệu, tham số, công thức (ngoài thân agg) được in bằng giá trị trả về.
   * Trả undefined để vẫn in ký hiệu.
   */
  resolve?: (kind: 'sym' | 'param' | 'ref', key: string) => Value | undefined;
}

const PREC_ADD = 1;
const PREC_AGG = 1.5;
const PREC_MUL = 2;
const PREC_ATOM = 3;

const TEXT_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  _: '\\_',
  '%': '\\%',
  '^': '\\^{}',
  '~': '\\~{}',
};

export function escapeLatexText(text: string): string {
  return text.replace(/[\\{}$&#_%^~]/g, (ch) => TEXT_ESCAPES[ch] ?? ch);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '\\infty';
  const rounded = Number(value.toFixed(6));
  const text = String(rounded);
  return text.includes('.') ? text.replace('.', '{,}') : text;
}

function symbolLatex(ctx: LatexContext, code: string): string {
  return ctx.symbols[code]?.latex ?? `\\text{${escapeLatexText(code)}}`;
}

function precedence(expr: Expr): number {
  switch (expr.t) {
    case 'bin':
      return expr.op === '*' ? PREC_MUL : PREC_ADD;
    case 'agg':
      return expr.kind === 'count' ? PREC_ATOM : PREC_AGG;
    case 'cases':
      return PREC_ADD;
    default:
      return PREC_ATOM;
  }
}

function wrap(text: string, child: Expr, required: number): string {
  return precedence(child) < required ? `\\left(${text}\\right)` : text;
}

function isNumber(expr: Expr): boolean {
  return expr.t === 'num';
}

const CMP_LATEX = { '>=': '\\geq', '>': '>', '<=': '\\leq', '<': '<', '=': '=', '!=': '\\neq' } as const;

function condLatex(cond: Cond, ctx: LatexContext): string {
  if (cond.c === 'cmp') return `${render(cond.l, ctx)} ${CMP_LATEX[cond.op]} ${render(cond.r, ctx)}`;
  if (cond.c === 'notnull') return `${render(cond.e, ctx)} \\text{ có giá trị}`;
  const joiner = cond.c === 'and' ? ' \\text{ và } ' : ' \\text{ hoặc } ';
  return cond.items
    .map((item) => (item.c === 'and' || item.c === 'or' ? `\\left(${condLatex(item, ctx)}\\right)` : condLatex(item, ctx)))
    .join(joiner);
}

function render(expr: Expr, ctx: LatexContext): string {
  switch (expr.t) {
    case 'num':
      return formatNumber(expr.v);
    case 'text':
      return `\\text{${escapeLatexText(expr.v)}}`;
    case 'na':
      return '\\text{không xác định}';
    case 'sym':
    case 'param': {
      const key = expr.t === 'sym' ? expr.id : expr.code;
      const value = ctx.resolve?.(expr.t, key);
      return typeof value === 'number' ? formatNumber(value) : symbolLatex(ctx, key);
    }
    case 'ref': {
      const value = ctx.resolve?.('ref', expr.formula);
      if (typeof value === 'number') return formatNumber(value);
      const output = expr.show ?? ctx.outputs[expr.formula];
      return output ? symbolLatex(ctx, output) : `\\text{${escapeLatexText(expr.formula)}}`;
    }
    case 'bin': {
      const left = render(expr.l, ctx);
      const right = render(expr.r, ctx);
      if (expr.op === '*') {
        const joiner = isNumber(expr.l) || isNumber(expr.r) ? ' \\times ' : ' \\cdot ';
        return `${wrap(left, expr.l, PREC_MUL)}${joiner}${wrap(right, expr.r, PREC_MUL)}`;
      }
      if (expr.op === '+') return `${left} + ${right}`;
      return `${left} - ${precedence(expr.r) <= PREC_ADD ? `\\left(${right}\\right)` : right}`;
    }
    case 'div':
      return `\\frac{${render(expr.n, ctx)}}{${render(expr.d, ctx)}}`;
    case 'fn': {
      const args = expr.args.map((arg) => render(arg, ctx));
      switch (expr.name) {
        case 'floor':
          return `\\left\\lfloor ${args[0]} \\right\\rfloor`;
        case 'abs':
          return `\\left| ${args[0]} \\right|`;
        case 'min':
        case 'max':
          return `\\${expr.name}\\left(${args.join(',\\ ')}\\right)`;
        case 'round':
          return `\\mathrm{round}\\left(${args.join(',\\ ')}\\right)`;
        case 'clamp':
          return `\\mathrm{clamp}\\left(${args.join(',\\ ')}\\right)`;
      }
      return '';
    }
    case 'agg': {
      // Trong thân agg không thay số: giá trị thay đổi theo từng dòng của tập
      const inner: LatexContext = { ...ctx, resolve: undefined };
      const subscript = `${expr.index} \\in \\text{${escapeLatexText(expr.label)}}`;
      if (expr.kind === 'count') return `n_{\\text{${escapeLatexText(expr.label)}}}`;
      const body = expr.body ? render(expr.body, inner) : '';
      const bodyText = expr.body && precedence(expr.body) <= PREC_ADD ? `\\left(${body}\\right)` : body;
      if (expr.kind === 'sum') return `\\sum_{${subscript}} ${bodyText}`;
      if (expr.kind === 'avg') return `\\mathrm{TB}_{${subscript}}\\left(${body}\\right)`;
      return `\\${expr.kind}_{${subscript}} ${bodyText}`;
    }
    case 'cases': {
      const rows = expr.branches.map((b) => `${render(b.then, ctx)} & \\text{nếu } ${condLatex(b.when, ctx)}`);
      rows.push(`${render(expr.otherwise, ctx)} & \\text{còn lại}`);
      return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
    }
  }
}

export function expressionToLatex(expr: Expr, ctx: LatexContext): string {
  return render(expr, ctx);
}

/** "TH% = (TH − 3) / 9 × 100" ở dạng LaTeX, có vế trái là ký hiệu kết quả */
export function formulaToLatex(def: Pick<FormulaDef, 'output' | 'expression'>, ctx: LatexContext): string {
  return `${def.output.latex} = ${render(def.expression, ctx)}`;
}

export interface FallbackNote {
  denominator: string;
  fallback: string;
}

/** Các nhánh "mẫu số bằng 0 thì ..." của công thức, để hiển thị thành ghi chú dưới công thức */
export function collectFallbacks(expr: Expr, ctx: LatexContext): FallbackNote[] {
  const notes: FallbackNote[] = [];
  const visit = (node: Expr): void => {
    switch (node.t) {
      case 'div':
        visit(node.n);
        visit(node.d);
        if (node.ifZero) notes.push({ denominator: render(node.d, ctx), fallback: render(node.ifZero, ctx) });
        return;
      case 'bin':
        visit(node.l);
        visit(node.r);
        return;
      case 'fn':
        node.args.forEach(visit);
        return;
      case 'agg':
        if (node.body) visit(node.body);
        return;
      case 'cases':
        node.branches.forEach((b) => visit(b.then));
        visit(node.otherwise);
        return;
      default:
    }
  };
  visit(expr);
  return notes;
}
