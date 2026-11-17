import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, Select } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { expressionToLatex, type AggKind, type Cond, type Expr, type FnName, type LatexContext } from '../../../domain/formula';
import {
  AGG_KIND_OPTIONS,
  BIN_OPTIONS,
  CMP_OPTIONS,
  COND_KIND_OPTIONS,
  FN_ARITY,
  FN_OPTIONS,
  KIND_OPTIONS,
  changeNodeKind,
  defaultCond,
  fitFnArgs,
  type EditorEnv,
  type NodeKind,
} from '../editor.logic';
import { FormulaMath } from './FormulaMath';

interface Shared {
  env: EditorEnv;
  latex: LatexContext;
}

const zero: Expr = { t: 'num', v: 0 };
const replaceAt = <T,>(list: readonly T[], index: number, value: T): T[] => list.map((item, i) => (i === index ? value : item));
const removeAt = <T,>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index);

/** Ô nhập số giữ chữ đang gõ (như "0," hay "-") và chỉ báo lên khi đã là số hợp lệ */
const NumField: React.FC<{ value: number; onChange: (value: number) => void; label?: string }> = ({ value, onChange, label = 'Giá trị' }) => {
  const [textValue, setTextValue] = useState(String(value));
  useEffect(() => {
    if (Number(textValue.replace(',', '.')) !== value) setTextValue(String(value));
    // chỉ đồng bộ khi giá trị từ ngoài đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      label={label}
      inputMode="decimal"
      value={textValue}
      onChange={(event) => {
        setTextValue(event.target.value);
        const parsed = Number(event.target.value.replace(',', '.'));
        if (event.target.value.trim() !== '' && Number.isFinite(parsed)) onChange(parsed);
      }}
    />
  );
};

/** Danh sách lựa chọn, thêm mục hiện tại nếu nó không còn trong danh sách */
function withCurrent(options: { value: string; label: string }[], current: string) {
  return current && !options.some((option) => option.value === current) ? [{ value: current, label: current }, ...options] : options;
}

export interface ExprEditorProps extends Shared {
  value: Expr;
  onChange: (value: Expr) => void;
  onRemove?: () => void;
  caption?: string;
}

/** Một khối công thức: chọn loại rồi chỉnh các phần bên trong; khối con lồng nhau như cây */
export const ExprEditor: React.FC<ExprEditorProps> = ({ value, onChange, onRemove, caption, env, latex }) => {
  const shared: Shared = { env, latex };
  const preview = useMemo(() => (['bin', 'div', 'fn', 'agg', 'cases'].includes(value.t) ? expressionToLatex(value, latex) : ''), [value, latex]);

  const symbolOptions = useMemo(
    () => env.inputSymbols.map((symbol) => ({ value: symbol.code, label: symbol.unit ? `${symbol.name} (${symbol.unit})` : symbol.name })),
    [env.inputSymbols],
  );
  const paramOptions = useMemo(() => env.paramSymbols.map((symbol) => ({ value: symbol.code, label: symbol.name })), [env.paramSymbols]);
  const formulaOptions = useMemo(() => env.formulas.map((formula) => ({ value: formula.code, label: formula.name })), [env.formulas]);
  const nameOfKey = (key: string) => env.inputSymbols.find((symbol) => symbol.code === key)?.name ?? key;

  const body = (): React.ReactNode => {
    switch (value.t) {
      case 'num':
        return <NumField value={value.v} onChange={(v) => onChange({ t: 'num', v })} />;
      case 'text':
        return <Input label="Chữ" value={value.v} onChange={(event) => onChange({ t: 'text', v: event.target.value })} />;
      case 'na':
        return null;
      case 'sym':
        return <SearchableSelect label="Dữ liệu" options={withCurrent(symbolOptions, value.id)} value={value.id} onChange={(id) => onChange({ t: 'sym', id })} />;
      case 'param':
        return <SearchableSelect label="Tham số" options={withCurrent(paramOptions, value.code)} value={value.code} onChange={(code) => onChange({ t: 'param', code })} />;
      case 'ref':
        return <SearchableSelect label="Công thức" options={withCurrent(formulaOptions, value.formula)} value={value.formula} onChange={(formula) => onChange({ t: 'ref', formula })} />;
      case 'bin':
        return (
          <>
            <ExprEditor {...shared} caption="Vế trái" value={value.l} onChange={(l) => onChange({ ...value, l })} />
            <Select label="Phép tính" options={BIN_OPTIONS} value={value.op} onChange={(op) => onChange({ ...value, op: op as '+' | '-' | '*' })} />
            <ExprEditor {...shared} caption="Vế phải" value={value.r} onChange={(r) => onChange({ ...value, r })} />
          </>
        );
      case 'div': {
        const { ifZero, ...rest } = value;
        return (
          <>
            <ExprEditor {...shared} caption="Tử số" value={value.n} onChange={(n) => onChange({ ...value, n })} />
            <ExprEditor {...shared} caption="Mẫu số" value={value.d} onChange={(d) => onChange({ ...value, d })} />
            <Checkbox
              label="Có kết quả riêng khi mẫu số bằng 0"
              checked={ifZero !== undefined}
              onChange={(checked) => onChange(checked ? { ...value, ifZero: { t: 'na' } } : (rest as Expr))}
            />
            {ifZero && <ExprEditor {...shared} caption="Khi mẫu số bằng 0" value={ifZero} onChange={(next) => onChange({ ...value, ifZero: next })} />}
          </>
        );
      }
      case 'fn': {
        const [min, max] = FN_ARITY[value.name];
        return (
          <>
            <Select
              label="Hàm"
              options={FN_OPTIONS}
              value={value.name}
              onChange={(name) => onChange({ t: 'fn', name: name as FnName, args: fitFnArgs(name as FnName, value.args) })}
            />
            {value.args.map((arg, index) => (
              <ExprEditor
                key={index}
                {...shared}
                caption={`Đối số ${index + 1}`}
                value={arg}
                onChange={(next) => onChange({ ...value, args: replaceAt(value.args, index, next) })}
                onRemove={value.args.length > min ? () => onChange({ ...value, args: removeAt(value.args, index) }) : undefined}
              />
            ))}
            {value.args.length < max && (
              <Button type="button" size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => onChange({ ...value, args: [...value.args, zero] })}>
                Thêm đối số
              </Button>
            )}
          </>
        );
      }
      case 'agg': {
        const { where, rows, ...rest } = value;
        return (
          <>
            <div className="expr-row">
              <Select
                label="Phép tính"
                options={AGG_KIND_OPTIONS}
                value={value.kind}
                onChange={(kind) => {
                  const next = { ...value, kind: kind as AggKind };
                  if (kind === 'count') delete next.body;
                  else if (!next.body) next.body = zero;
                  onChange(next);
                }}
              />
              <Input label="Chỉ số" maxLength={3} value={value.index} onChange={(event) => onChange({ ...value, index: event.target.value })} />
              <Input label="Mô tả tập" value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} />
              {!rows && <Input label="Tên tập dữ liệu" value={value.over} onChange={(event) => onChange({ ...value, over: event.target.value })} />}
            </div>
            <Checkbox
              label="Chỉ tính các dòng thỏa điều kiện"
              checked={where !== undefined}
              onChange={(checked) => onChange(checked ? { ...value, where: defaultCond('notnull') } : ({ ...rest, ...(rows ? { rows } : {}) } as Expr))}
            />
            {where && <CondEditor {...shared} caption="Điều kiện" value={where} onChange={(next) => onChange({ ...value, where: next })} />}
            {value.kind !== 'count' && value.body && (
              <ExprEditor {...shared} caption="Giá trị của mỗi dòng" value={value.body} onChange={(next) => onChange({ ...value, body: next })} />
            )}
            {rows?.map((row, rowIndex) => (
              <div key={rowIndex} className="expr-node expr-rows">
                <div className="expr-node-head">
                  <span className="expr-caption">{`Dòng ${rowIndex + 1}`}</span>
                  {rows.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" aria-label="Xóa dòng" onClick={() => onChange({ ...value, rows: removeAt(rows, rowIndex) })}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
                {Object.entries(row).map(([key, cell]) => (
                  <ExprEditor
                    key={key}
                    {...shared}
                    caption={nameOfKey(key)}
                    value={cell}
                    onChange={(next) => onChange({ ...value, rows: replaceAt(rows, rowIndex, { ...row, [key]: next }) })}
                  />
                ))}
              </div>
            ))}
            {rows && (
              <Button type="button" size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => onChange({ ...value, rows: [...rows, rows[rows.length - 1]] })}>
                Thêm dòng
              </Button>
            )}
          </>
        );
      }
      case 'cases':
        return (
          <>
            {value.branches.map((branch, index) => (
              <div key={index} className="expr-node expr-branch">
                <div className="expr-node-head">
                  <span className="expr-caption">{`Trường hợp ${index + 1}`}</span>
                  {value.branches.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" aria-label="Xóa trường hợp" onClick={() => onChange({ ...value, branches: removeAt(value.branches, index) })}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
                <CondEditor
                  {...shared}
                  caption="Nếu"
                  value={branch.when}
                  onChange={(when) => onChange({ ...value, branches: replaceAt(value.branches, index, { ...branch, when }) })}
                />
                <ExprEditor
                  {...shared}
                  caption="Thì"
                  value={branch.then}
                  onChange={(then) => onChange({ ...value, branches: replaceAt(value.branches, index, { ...branch, then }) })}
                />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<Plus size={14} />}
              onClick={() => onChange({ ...value, branches: [...value.branches, { when: defaultCond('cmp'), then: zero }] })}
            >
              Thêm trường hợp
            </Button>
            <ExprEditor {...shared} caption="Còn lại" value={value.otherwise} onChange={(otherwise) => onChange({ ...value, otherwise })} />
          </>
        );
    }
  };

  return (
    <div className="expr-node">
      <div className="expr-node-head">
        {caption && <span className="expr-caption">{caption}</span>}
        <Select
          aria-label="Loại"
          options={KIND_OPTIONS}
          value={value.t}
          onChange={(kind) => onChange(changeNodeKind(value, kind as NodeKind, env))}
        />
        {onRemove && (
          <Button type="button" size="sm" variant="ghost" aria-label="Xóa" onClick={onRemove}>
            <Trash2 size={14} />
          </Button>
        )}
      </div>
      {preview && (
        <div className="expr-preview">
          <FormulaMath latex={preview} />
        </div>
      )}
      <div className="expr-node-body">{body()}</div>
    </div>
  );
};

export interface CondEditorProps extends Shared {
  value: Cond;
  onChange: (value: Cond) => void;
  caption?: string;
}

/** Điều kiện của phân nhánh hoặc của phép tổng */
export const CondEditor: React.FC<CondEditorProps> = ({ value, onChange, caption, env, latex }) => {
  const shared: Shared = { env, latex };
  const body = (): React.ReactNode => {
    switch (value.c) {
      case 'cmp':
        return (
          <>
            <ExprEditor {...shared} caption="Vế trái" value={value.l} onChange={(l) => onChange({ ...value, l })} />
            <Select label="So sánh" options={CMP_OPTIONS} value={value.op} onChange={(op) => onChange({ ...value, op: op as typeof value.op })} />
            <ExprEditor {...shared} caption="Vế phải" value={value.r} onChange={(r) => onChange({ ...value, r })} />
          </>
        );
      case 'notnull':
        return <ExprEditor {...shared} caption="Giá trị cần có" value={value.e} onChange={(e) => onChange({ ...value, e })} />;
      case 'and':
      case 'or':
        return (
          <>
            {value.items.map((item, index) => (
              <div key={index} className="expr-cond-item">
                <CondEditor {...shared} value={item} onChange={(next) => onChange({ ...value, items: replaceAt(value.items, index, next) })} />
                {value.items.length > 1 && (
                  <Button type="button" size="sm" variant="ghost" aria-label="Xóa điều kiện" onClick={() => onChange({ ...value, items: removeAt(value.items, index) })}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => onChange({ ...value, items: [...value.items, defaultCond('cmp')] })}>
              Thêm điều kiện
            </Button>
          </>
        );
    }
  };

  return (
    <div className="expr-node expr-cond">
      <div className="expr-node-head">
        {caption && <span className="expr-caption">{caption}</span>}
        <Select
          aria-label="Loại điều kiện"
          options={COND_KIND_OPTIONS}
          value={value.c}
          onChange={(kind) => onChange(kind === value.c ? value : defaultCond(kind as Cond['c']))}
        />
      </div>
      <div className="expr-node-body">{body()}</div>
    </div>
  );
};
