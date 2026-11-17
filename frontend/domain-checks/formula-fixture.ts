/**
 * Sinh tệp SQL dùng cho kiểm thử trên Postgres: nạp danh mục công thức hiện hành (nhóm, ký hiệu, công thức,
 * phiên bản đầu) và các ca thử vào một bảng tạm để so bộ tính trong SQL với kết quả mong đợi.
 * Tệp nằm ở supabase/tests/formula_catalog_fixture.sql, sinh bằng: npm run gen:formula-fixture
 */
import { FORMULAS, GROUPS, SYMBOLS } from '../src/domain/formula/catalog';

const lit = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `$fx$${String(value)}$fx$`;
};
const json = (value: unknown): string => `$fx$${JSON.stringify(value)}$fx$::jsonb`;

export function buildFormulaFixtureSql(): string {
  const lines: string[] = [
    '-- Tệp sinh tự động từ danh mục công thức. Không sửa tay: chạy npm run gen:formula-fixture',
    '',
  ];
  GROUPS.forEach((group, index) => {
    lines.push(
      `INSERT INTO public.formula_groups (group_code, group_name, sort_order) VALUES (${lit(group.code)}, ${lit(group.name)}, ${index + 1});`,
    );
  });
  for (const s of SYMBOLS) {
    lines.push(
      `INSERT INTO public.formula_symbols (symbol_code, display_latex, symbol_name, source_kind, source_ref, unit, value_min, value_max) VALUES (${lit(s.code)}, ${lit(s.latex)}, ${lit(s.name)}, ${lit(s.kind)}, ${lit(s.ref)}, ${lit(s.unit)}, ${lit(s.min)}, ${lit(s.max)});`,
    );
  }
  FORMULAS.forEach((f, index) => {
    lines.push(
      `INSERT INTO public.formulas (formula_code, formula_name, group_id, output_symbol, output_unit, verification_level, spec_ref, sort_order) VALUES (${lit(f.code)}, ${lit(f.name)}, (SELECT id FROM public.formula_groups WHERE group_code = ${lit(f.group)}), ${lit(f.output.symbol)}, ${lit(f.output.unit)}, ${lit(f.verification)}, ${lit(f.specRef)}, ${index + 1});`,
    );
  });
  for (const f of FORMULAS) {
    lines.push(
      `INSERT INTO public.formula_versions (formula_id, expression, status, note) SELECT id, ${json(f.expression)}, 'active', 'Nạp từ danh mục công thức' FROM public.formulas WHERE formula_code = ${lit(f.code)};`,
    );
  }
  lines.push(
    '',
    'CREATE TEMP TABLE fx_case (code text, case_name text, vars jsonb, refs jsonb, sets jsonb, expected jsonb, tolerance numeric);',
  );
  for (const f of FORMULAS) {
    for (const t of f.tests) {
      lines.push(
        `INSERT INTO fx_case VALUES (${lit(f.code)}, ${lit(t.name)}, ${json(t.inputs.vars ?? {})}, ${json(t.inputs.refs ?? {})}, ${json(t.inputs.sets ?? {})}, ${json(t.expected)}, ${t.tolerance ?? 0.0001});`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}
