import type { FormulaDef, GroupDef, SymbolDef } from '../types';
import type { LatexContext } from '../latex';
import { PERSONAL_FORMULAS, RATER_360_FORMULAS } from './assessment';
import { CAREER_FORMULAS } from './career';
import { DECISION_FORMULAS, PROFILE_ROADMAP_FORMULAS, SCHOOL_MAJOR_FORMULAS } from './decision_school_profile';
import { ALIAS_SYMBOLS, GROUPS, INPUT_SYMBOLS, PARAM_SYMBOLS } from './symbols';

export { GROUPS };

/** Toàn bộ công thức, theo thứ tự hiển thị trong từng nhóm */
export const FORMULAS: FormulaDef[] = [
  ...PERSONAL_FORMULAS,
  ...RATER_360_FORMULAS,
  ...CAREER_FORMULAS,
  ...DECISION_FORMULAS,
  ...SCHOOL_MAJOR_FORMULAS,
  ...PROFILE_ROADMAP_FORMULAS,
];

/** Ký hiệu kết quả của từng công thức */
export const OUTPUT_SYMBOLS: SymbolDef[] = FORMULAS.map((f) => ({
  code: f.output.symbol,
  latex: f.output.latex,
  name: f.output.name,
  kind: 'formula' as const,
  ref: f.code,
  unit: f.output.unit,
  min: f.output.min,
  max: f.output.max,
}));

export const SYMBOLS: SymbolDef[] = [...INPUT_SYMBOLS, ...PARAM_SYMBOLS, ...ALIAS_SYMBOLS, ...OUTPUT_SYMBOLS];

export const SYMBOLS_BY_CODE: Readonly<Record<string, SymbolDef>> = Object.fromEntries(SYMBOLS.map((s) => [s.code, s]));
export const FORMULAS_BY_CODE: Readonly<Record<string, FormulaDef>> = Object.fromEntries(FORMULAS.map((f) => [f.code, f]));

export function catalogLatexContext(): LatexContext {
  return {
    symbols: SYMBOLS_BY_CODE,
    outputs: Object.fromEntries(FORMULAS.map((f) => [f.code, f.output.symbol])),
  };
}

export type { GroupDef };
