import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button } from '../../../components/common';
import { formulaToLatex, type LatexContext, type SymbolDef } from '../../../domain/formula';
import { VERIFICATION_LABEL, VERIFICATION_VARIANT, symbolsInFormula } from '../formula.logic';
import { dependencyLevels } from '../formula.graph';
import type { FormulaLibrary, FormulaRecord } from '../formula.types';
import { FormulaMath } from './FormulaMath';

export interface FormulaExpansionProps {
  formula: FormulaRecord;
  library: FormulaLibrary;
  latexContext: LatexContext;
}

/** Khai triển công thức theo cấp: mỗi cấp viết ra các công thức mà cấp trước dùng, đến tận dữ liệu đầu vào */
export const FormulaExpansion: React.FC<FormulaExpansionProps> = ({ formula, library, latexContext }) => {
  const levels = useMemo(() => dependencyLevels(formula.formula_code, library.formulas), [formula, library]);
  const [shown, setShown] = useState(1);

  const chainInputs = useMemo(() => {
    const unique = new Map<string, SymbolDef>();
    for (const item of [formula, ...levels.flat()]) {
      for (const symbol of symbolsInFormula(item, library)) if (symbol.kind === 'input') unique.set(symbol.code, symbol);
    }
    return [...unique.values()];
  }, [formula, levels, library]);

  const latexOf = (item: FormulaRecord): string => {
    if (!item.expression) return '';
    const output = latexContext.symbols[item.output_symbol];
    return formulaToLatex(
      { output: { symbol: item.output_symbol, latex: output?.latex ?? item.output_symbol, name: item.formula_name }, expression: item.expression },
      latexContext,
    );
  };

  if (levels.length === 0) {
    return (
      <div className="formula-tab-body">
        <p className="formula-empty">Không dùng công thức khác</p>
        {chainInputs.length > 0 && <InputChips symbols={chainInputs} />}
      </div>
    );
  }

  const visibleLevels = Math.min(shown, levels.length);

  return (
    <div className="formula-tab-body">
      <div className="formula-expansion-bar">
        <span className="formula-expansion-count">{`Cấp ${visibleLevels}/${levels.length}`}</span>
        <div className="admin-row-actions">
          <Button type="button" size="sm" variant="outline" disabled={visibleLevels <= 1} onClick={() => setShown(1)}>
            Thu gọn
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={visibleLevels >= levels.length} onClick={() => setShown(visibleLevels + 1)}>
            Khai triển thêm
          </Button>
          <Button type="button" size="sm" disabled={visibleLevels >= levels.length} onClick={() => setShown(levels.length)}>
            Khai triển hết
          </Button>
        </div>
      </div>

      {levels.slice(0, visibleLevels).map((items, index) => (
        <section key={index} className="formula-expansion-level">
          <h3 className="admin-form-section-title">{`Cấp ${index + 1}`}</h3>
          {items.map((item) => (
            <div key={item.id} className="formula-expansion-item">
              <div className="formula-expansion-head">
                <Link className="formula-link" to={`/quan-tri/cong-thuc/${item.id}`}>
                  {item.formula_name}
                </Link>
                <Badge size="sm" variant={VERIFICATION_VARIANT[item.verification_level]}>
                  {VERIFICATION_LABEL[item.verification_level]}
                </Badge>
              </div>
              <div className="formula-display">
                <FormulaMath latex={latexOf(item)} block />
              </div>
            </div>
          ))}
        </section>
      ))}

      <section className="formula-expansion-level">
        <h3 className="admin-form-section-title">Dữ liệu đầu vào của cả chuỗi</h3>
        <InputChips symbols={chainInputs} />
      </section>
    </div>
  );
};

const InputChips: React.FC<{ symbols: SymbolDef[] }> = ({ symbols }) => (
  <ul className="formula-chip-list">
    {symbols.map((symbol) => (
      <li key={symbol.code} className="formula-chip">
        <FormulaMath latex={symbol.latex} />
        <span>{symbol.name}</span>
      </li>
    ))}
  </ul>
);
