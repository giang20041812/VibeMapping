import { collectDependencies, type Expr } from '../../domain/formula';

/** Phần của công thức mà sơ đồ cần */
export interface GraphFormula {
  id: string;
  formula_code: string;
  formula_name: string;
  group_id: string;
  group_name: string;
  verification_level: string;
  sort_order: number;
  expression: Expr | null;
}

export interface GraphEdge {
  /** Mã công thức được dùng (bên trái) */
  from: string;
  /** Mã công thức đang dùng nó (bên phải) */
  to: string;
}

export interface GraphNode {
  code: string;
  id: string;
  name: string;
  groupName: string;
  verification: string;
  /** Tầng: 0 là công thức chỉ dùng dữ liệu đầu vào và tham số, càng cao càng gần kết quả cuối */
  depth: number;
  x: number;
  y: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

/** Kích thước tính theo đơn vị giao diện, nhân với --px khi vẽ */
export const GRAPH_NODE_WIDTH = 200;
export const GRAPH_NODE_HEIGHT = 56;
const COLUMN_GAP = 96;
const ROW_GAP = 14;
const PADDING = 16;

export function buildEdges(formulas: readonly GraphFormula[]): GraphEdge[] {
  const known = new Set(formulas.map((formula) => formula.formula_code));
  return formulas.flatMap((formula) =>
    formula.expression
      ? collectDependencies(formula.expression)
          .formulas.filter((code) => known.has(code) && code !== formula.formula_code)
          .map((code) => ({ from: code, to: formula.formula_code }))
      : [],
  );
}

/** Tầng của từng công thức: 0 nếu không dùng công thức nào, ngược lại là tầng cao nhất của công thức nó dùng cộng 1 */
export function computeDepths(codes: readonly string[], edges: readonly GraphEdge[]): Map<string, number> {
  const dependencies = new Map<string, string[]>();
  for (const edge of edges) dependencies.set(edge.to, [...(dependencies.get(edge.to) ?? []), edge.from]);
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (code: string): number => {
    const known = depths.get(code);
    if (known !== undefined) return known;
    // Cơ sở dữ liệu đã chặn vòng lặp; lớp phòng thủ để không treo giao diện nếu dữ liệu hỏng
    if (visiting.has(code)) return 0;
    visiting.add(code);
    const deps = dependencies.get(code) ?? [];
    const value = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(depthOf));
    visiting.delete(code);
    depths.set(code, value);
    return value;
  };
  for (const code of codes) depthOf(code);
  return depths;
}

function reach(start: string, next: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(next.get(start) ?? [])];
  while (stack.length > 0) {
    const code = stack.pop() as string;
    if (seen.has(code)) continue;
    seen.add(code);
    stack.push(...(next.get(code) ?? []));
  }
  return seen;
}

function adjacency(edges: readonly GraphEdge[], direction: 'up' | 'down'): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const [key, value] = direction === 'up' ? [edge.to, edge.from] : [edge.from, edge.to];
    map.set(key, [...(map.get(key) ?? []), value]);
  }
  return map;
}

/** Mọi công thức mà công thức này dùng (trực tiếp và gián tiếp) và mọi công thức dùng nó */
export function relatedCodes(code: string, edges: readonly GraphEdge[]): { ancestors: Set<string>; descendants: Set<string> } {
  return { ancestors: reach(code, adjacency(edges, 'up')), descendants: reach(code, adjacency(edges, 'down')) };
}

/**
 * Công thức hiển thị khi lọc: công thức khớp điều kiện cùng toàn bộ chuỗi phía trước và phía sau của nó,
 * để chuỗi liên kết không bị cắt giữa chừng.
 */
export function visibleCodes(
  formulas: readonly GraphFormula[],
  edges: readonly GraphEdge[],
  matches: (formula: GraphFormula) => boolean,
): Set<string> {
  const visible = new Set<string>();
  const up = adjacency(edges, 'up');
  const down = adjacency(edges, 'down');
  for (const formula of formulas) {
    if (!matches(formula)) continue;
    visible.add(formula.formula_code);
    for (const code of reach(formula.formula_code, up)) visible.add(code);
    for (const code of reach(formula.formula_code, down)) visible.add(code);
  }
  return visible;
}

/** Xếp các công thức hiển thị thành cột theo tầng, thứ tự trong cột giảm giao cắt dây nối */
export function layoutGraph(formulas: readonly GraphFormula[], edges: readonly GraphEdge[], visible: ReadonlySet<string>): GraphLayout {
  const shown = formulas.filter((formula) => visible.has(formula.formula_code));
  const shownEdges = edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  const depths = computeDepths(
    shown.map((formula) => formula.formula_code),
    shownEdges,
  );
  const maxDepth = Math.max(0, ...depths.values());

  const baseOrder = [...shown].sort((a, b) => a.sort_order - b.sort_order);
  const columns: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const formula of baseOrder) columns[depths.get(formula.formula_code) ?? 0].push(formula.formula_code);

  const up = adjacency(shownEdges, 'up');
  const down = adjacency(shownEdges, 'down');
  const row = new Map<string, number>();
  const assignRows = () => columns.forEach((column) => column.forEach((code, index) => row.set(code, index)));
  const reorder = (column: string[], neighbours: Map<string, string[]>) => {
    const score = (code: string): number => {
      const linked = (neighbours.get(code) ?? []).map((other) => row.get(other)).filter((value): value is number => value !== undefined);
      return linked.length === 0 ? (row.get(code) ?? 0) : linked.reduce((total, value) => total + value, 0) / linked.length;
    };
    const original = new Map(column.map((code, index) => [code, index]));
    column.sort((a, b) => score(a) - score(b) || (original.get(a) ?? 0) - (original.get(b) ?? 0));
  };

  assignRows();
  for (let depth = 1; depth < columns.length; depth += 1) {
    reorder(columns[depth], up);
    assignRows();
  }
  for (let depth = columns.length - 2; depth >= 0; depth -= 1) {
    reorder(columns[depth], down);
    assignRows();
  }

  const byCode = new Map(shown.map((formula) => [formula.formula_code, formula]));
  const nodes: GraphNode[] = [];
  columns.forEach((column, depth) =>
    column.forEach((code, index) => {
      const formula = byCode.get(code) as GraphFormula;
      nodes.push({
        code,
        id: formula.id,
        name: formula.formula_name,
        groupName: formula.group_name,
        verification: formula.verification_level,
        depth,
        x: PADDING + depth * (GRAPH_NODE_WIDTH + COLUMN_GAP),
        y: PADDING + index * (GRAPH_NODE_HEIGHT + ROW_GAP),
      });
    }),
  );

  const tallest = Math.max(0, ...columns.map((column) => column.length));
  return {
    nodes,
    edges: shownEdges,
    width: PADDING * 2 + columns.length * GRAPH_NODE_WIDTH + Math.max(0, columns.length - 1) * COLUMN_GAP,
    height: PADDING * 2 + tallest * GRAPH_NODE_HEIGHT + Math.max(0, tallest - 1) * ROW_GAP,
  };
}

/** Đường cong nối mép phải của công thức được dùng tới mép trái của công thức dùng nó */
export function edgePath(from: GraphNode, to: GraphNode): string {
  const x1 = from.x + GRAPH_NODE_WIDTH;
  const y1 = from.y + GRAPH_NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + GRAPH_NODE_HEIGHT / 2;
  const dx = Math.max(24, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/**
 * Các công thức mà công thức này dùng, chia theo cấp: cấp 1 là công thức nó dùng trực tiếp,
 * cấp 2 là công thức mà cấp 1 dùng... Mỗi công thức chỉ xuất hiện một lần, ở cấp gần nhất.
 */
export function dependencyLevels<T extends Pick<GraphFormula, 'formula_code' | 'expression'>>(code: string, formulas: readonly T[]): T[][] {
  const byCode = new Map(formulas.map((formula) => [formula.formula_code, formula]));
  const seen = new Set<string>([code]);
  const levels: T[][] = [];
  let frontier = [code];
  while (frontier.length > 0) {
    const next: T[] = [];
    for (const current of frontier) {
      const formula = byCode.get(current);
      if (!formula?.expression) continue;
      for (const dependency of collectDependencies(formula.expression).formulas) {
        const target = byCode.get(dependency);
        if (!target || seen.has(dependency)) continue;
        seen.add(dependency);
        next.push(target);
      }
    }
    if (next.length > 0) levels.push(next);
    frontier = next.map((formula) => formula.formula_code);
  }
  return levels;
}
