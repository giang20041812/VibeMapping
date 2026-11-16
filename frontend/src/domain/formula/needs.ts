import type { Cond, Expr } from './types';

export interface SetNeed {
  /** Khóa trường của mỗi dòng: mã ký hiệu (sym) hoặc mã công thức (ref) */
  fields: { key: string; kind: 'sym' | 'ref' }[];
}

/** Những giá trị cần có để tính một công thức */
export interface FormulaNeeds {
  /** Ký hiệu dữ liệu đầu vào dùng ngoài các phép tổng */
  vars: string[];
  /** Tham số vận hành */
  params: string[];
  /** Kết quả các công thức khác dùng ngoài các phép tổng */
  refs: string[];
  /** Tập dòng cho các phép tổng; khóa là tên tập */
  sets: Record<string, SetNeed>;
}

/**
 * Trong phép tổng trên một tập (không phải tập viết thẳng), ký hiệu và công thức ở điều kiện và thân là
 * trường của từng dòng; ngoài phép tổng và trong các ô của tập viết thẳng thì là giá trị đơn.
 */
export function collectNeeds(expr: Expr): FormulaNeeds {
  const vars = new Set<string>();
  const params = new Set<string>();
  const refs = new Set<string>();
  const sets: Record<string, SetNeed> = {};

  const addField = (set: string, key: string, kind: 'sym' | 'ref') => {
    const need = (sets[set] ??= { fields: [] });
    if (!need.fields.some((field) => field.key === key && field.kind === kind)) need.fields.push({ key, kind });
  };

  const visitCond = (cond: Cond, row: string | null): void => {
    if (cond.c === 'cmp') {
      visit(cond.l, row);
      visit(cond.r, row);
    } else if (cond.c === 'notnull') {
      visit(cond.e, row);
    } else {
      cond.items.forEach((item) => visitCond(item, row));
    }
  };

  const visit = (node: Expr, row: string | null): void => {
    switch (node.t) {
      case 'sym':
        if (row) addField(row, node.id, 'sym');
        else vars.add(node.id);
        return;
      case 'param':
        params.add(node.code);
        return;
      case 'ref':
        if (row) addField(row, node.formula, 'ref');
        else refs.add(node.formula);
        return;
      case 'bin':
        visit(node.l, row);
        visit(node.r, row);
        return;
      case 'div':
        visit(node.n, row);
        visit(node.d, row);
        if (node.ifZero) visit(node.ifZero, row);
        return;
      case 'fn':
        node.args.forEach((arg) => visit(arg, row));
        return;
      case 'agg': {
        if (node.rows) {
          // Tập viết thẳng: ô của dòng lấy giá trị ở ngoài, thân và điều kiện dùng khóa của dòng nên không cần nhập
          node.rows.forEach((cells) => Object.values(cells).forEach((cell) => visit(cell, row)));
          return;
        }
        sets[node.over] ??= { fields: [] };
        if (node.where) visitCond(node.where, node.over);
        if (node.body) visit(node.body, node.over);
        return;
      }
      case 'cases':
        node.branches.forEach((branch) => {
          visitCond(branch.when, row);
          visit(branch.then, row);
        });
        visit(node.otherwise, row);
        return;
      default:
    }
  };

  visit(expr, null);
  return { vars: [...vars], params: [...params], refs: [...refs], sets };
}
