/**
 * Cây biểu thức của một công thức. Lưu nguyên dạng này trong formula_versions.expression (jsonb).
 *
 * Quy ước tra giá trị khi tính:
 *  - sym, param: khóa là mã ký hiệu (symbol_code); param cũng dùng mã ký hiệu, nguồn là tham số vận hành.
 *  - ref: khóa là mã công thức (formula_code).
 *  - Trong thân của agg, các trường của dòng đang xét ghi đè giá trị cùng khóa ở ngoài.
 */

export type Value = number | string | null;

export type Expr =
  | { t: 'num'; v: number }
  | { t: 'text'; v: string }
  | { t: 'na' }
  | { t: 'sym'; id: string }
  | { t: 'param'; code: string }
  /** show: mã ký hiệu hiển thị thay cho ký hiệu kết quả của công thức (khi cùng công thức dùng ở nhiều vai) */
  | { t: 'ref'; formula: string; show?: string }
  | { t: 'bin'; op: '+' | '-' | '*'; l: Expr; r: Expr }
  /** Phân số; ifZero là kết quả khi mẫu bằng 0 (bắt buộc nếu mẫu có thể bằng 0) */
  | { t: 'div'; n: Expr; d: Expr; ifZero?: Expr }
  | { t: 'fn'; name: FnName; args: Expr[] }
  | {
      t: 'agg';
      kind: AggKind;
      /** Chỉ số hiển thị dưới Σ, ví dụ i, j, k */
      index: string;
      /** Tên tập dữ liệu đưa vào khi tính (sets); bỏ qua khi có rows */
      over: string;
      /** Tập dòng viết thẳng trong công thức: mỗi dòng gán biểu thức cho các khóa dùng trong where và body */
      rows?: Record<string, Expr>[];
      /** Mô tả tập, hiển thị dưới Σ: "tiêu chí có dữ liệu" */
      label: string;
      where?: Cond;
      body?: Expr;
    }
  | { t: 'cases'; branches: { when: Cond; then: Expr }[]; otherwise: Expr };

export type FnName = 'min' | 'max' | 'floor' | 'abs' | 'round' | 'clamp';
export type AggKind = 'sum' | 'avg' | 'count' | 'min' | 'max';

export type Cond =
  | { c: 'cmp'; op: '>=' | '>' | '<=' | '<' | '=' | '!='; l: Expr; r: Expr }
  | { c: 'notnull'; e: Expr }
  | { c: 'and'; items: Cond[] }
  | { c: 'or'; items: Cond[] };

export type SymbolKind = 'input' | 'param' | 'formula';

export interface SymbolDef {
  code: string;
  latex: string;
  name: string;
  kind: SymbolKind;
  /** param: mã tham số vận hành; formula: mã công thức tạo ra ký hiệu */
  ref?: string;
  unit?: string;
  min?: number;
  max?: number;
}

export type VerificationLevel = 'approved' | 'demo' | 'pending_ba' | 'blocked';

export interface TestCaseInputs {
  /** Giá trị ký hiệu đầu vào và tham số, khóa là symbol_code */
  vars?: Record<string, Value>;
  /** Kết quả đã có của các công thức khác, khóa là formula_code */
  refs?: Record<string, Value>;
  /** Các tập dữ liệu cho nút agg, khóa là tên tập; mỗi dòng là một bản đồ khóa → giá trị */
  sets?: Record<string, Record<string, Value>[]>;
}

export interface TestCase {
  name: string;
  inputs: TestCaseInputs;
  expected: Value;
  tolerance?: number;
  /** Hàm trong assessmentRules.ts dùng đối chiếu, và đối số đưa vào hàm đó */
  engineFn?: string;
  engineArgs?: unknown;
}

export interface FormulaDef {
  code: string;
  name: string;
  group: string;
  output: { symbol: string; latex: string; name: string; unit?: string; min?: number; max?: number };
  expression: Expr;
  verification: VerificationLevel;
  /** Chỉ để truy vết nội bộ, không hiển thị trên giao diện */
  specRef?: string;
  tests: TestCase[];
}

export interface GroupDef {
  code: string;
  name: string;
}

export interface EvalContext {
  vars?: Record<string, Value>;
  refs?: Record<string, Value>;
  sets?: Record<string, Record<string, Value>[]>;
  /**
   * Biểu thức của các công thức khác, để tự tính đệ quy khi refs chưa có giá trị.
   * Có vòng lặp sẽ báo lỗi.
   */
  formulas?: Record<string, Expr>;
}

export interface TraceStep {
  /** Công thức con ở dạng LaTeX */
  latex: string;
  value: Value;
}
