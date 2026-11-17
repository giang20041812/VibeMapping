import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Eye, Search } from 'lucide-react';
import { Alert, Badge, Breadcrumb, Button, Card, Input, Spinner } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { formulaToLatex } from '../../../domain/formula';
import { useAdminFilter } from '../../admin/useAdminFilter';
import { FormulaMath } from '../components/FormulaMath';
import { VERIFICATION_LABEL, VERIFICATION_OPTIONS, VERIFICATION_VARIANT, buildLatexContext, matchesFormulaFilter } from '../formula.logic';
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  buildEdges,
  edgePath,
  layoutGraph,
  relatedCodes,
  visibleCodes,
  type GraphEdge,
  type GraphNode,
} from '../formula.graph';
import type { FormulaFilter, FormulaRecord } from '../formula.types';
import { useFormulaLibrary } from '../useFormulaLibrary';
import '../../admin/pages/AdminPages.css';
import './FormulaLibrary.css';

const EMPTY_FILTER: FormulaFilter = { keyword: '', groupId: '', verification: '' };
const unit = (value: number) => `calc(${value} * var(--px))`;

interface TreeProps {
  code: string;
  formulas: Map<string, FormulaRecord>;
  dependencies: Map<string, string[]>;
  onOpen: (formula: FormulaRecord) => void;
}

/** Bản điện thoại: mỗi công thức gập mở ra các công thức nó dùng, chỉ dựng phần đã mở */
const TreeItem: React.FC<TreeProps> = ({ code, formulas, dependencies, onOpen }) => {
  const [open, setOpen] = useState(false);
  const formula = formulas.get(code);
  const children = dependencies.get(code) ?? [];
  if (!formula) return null;
  return (
    <li className="formula-tree-item">
      <div className="formula-tree-row">
        {children.length > 0 ? (
          <button
            type="button"
            className="formula-tree-toggle"
            aria-expanded={open}
            aria-label={open ? `Thu gọn ${formula.formula_name}` : `Mở ${formula.formula_name}`}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="formula-tree-toggle is-leaf" aria-hidden="true" />
        )}
        <button type="button" className="formula-tree-name" onClick={() => onOpen(formula)}>
          {formula.formula_name}
        </button>
        <Badge size="sm" variant={VERIFICATION_VARIANT[formula.verification_level]}>
          {VERIFICATION_LABEL[formula.verification_level]}
        </Badge>
      </div>
      {open && children.length > 0 && (
        <ul className="formula-tree-children">
          {children.map((child) => (
            <TreeItem key={child} code={child} formulas={formulas} dependencies={dependencies} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
};

export const FormulaGraphPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { library, isLoading, error } = useFormulaLibrary();
  const { draft, applied, patch, apply, reset } = useAdminFilter(EMPTY_FILTER);
  const [selected, setSelected] = useState<string | null>(searchParams.get('chon'));

  const formulas = library?.formulas ?? [];
  const edges = useMemo(() => buildEdges(formulas), [formulas]);
  const byCode = useMemo(() => new Map(formulas.map((formula) => [formula.formula_code, formula])), [formulas]);

  const layout = useMemo(() => {
    const visible = visibleCodes(formulas, edges, (formula) => matchesFormulaFilter(formula, applied));
    return layoutGraph(formulas, edges, visible);
  }, [formulas, edges, applied]);

  const nodeByCode = useMemo(() => new Map(layout.nodes.map((node) => [node.code, node])), [layout]);

  useEffect(() => {
    if (selected && !nodeByCode.has(selected)) setSelected(null);
  }, [selected, nodeByCode]);

  const related = useMemo(() => (selected ? relatedCodes(selected, layout.edges) : null), [selected, layout.edges]);

  const isNodeActive = (code: string) => Boolean(selected && (code === selected || related?.ancestors.has(code) || related?.descendants.has(code)));

  const isEdgeActive = (edge: GraphEdge) => {
    if (!selected || !related) return false;
    const inAncestors = (code: string) => code === selected || related.ancestors.has(code);
    const inDescendants = (code: string) => code === selected || related.descendants.has(code);
    return (inAncestors(edge.from) && inAncestors(edge.to)) || (inDescendants(edge.from) && inDescendants(edge.to));
  };

  const orderedEdges = useMemo(() => {
    const active = layout.edges.filter(isEdgeActive);
    return [...layout.edges.filter((edge) => !active.includes(edge)), ...active];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.edges, selected, related]);

  const dependencies = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of layout.edges) map.set(edge.to, [...(map.get(edge.to) ?? []), edge.from]);
    return map;
  }, [layout.edges]);

  /** Công thức cuối chuỗi (không công thức nào trong sơ đồ dùng nó) là gốc của cây */
  const treeRoots = useMemo(() => {
    const used = new Set(layout.edges.map((edge) => edge.from));
    return layout.nodes.filter((node) => !used.has(node.code)).map((node) => node.code);
  }, [layout]);

  const groupOptions = useMemo(() => (library?.groups ?? []).map((group) => ({ value: group.id, label: group.group_name })), [library]);

  const selectedFormula = selected ? byCode.get(selected) ?? null : null;
  const selectedLatex = useMemo(() => {
    if (!selectedFormula?.expression || !library) return '';
    const context = buildLatexContext(library);
    const output = context.symbols[selectedFormula.output_symbol];
    return formulaToLatex(
      { output: { symbol: selectedFormula.output_symbol, latex: output?.latex ?? selectedFormula.output_symbol, name: selectedFormula.formula_name }, expression: selectedFormula.expression },
      context,
    );
  }, [selectedFormula, library]);

  const openDetail = (formula: FormulaRecord) => navigate(`/quan-tri/cong-thuc/${formula.id}`);

  const renderNode = (node: GraphNode) => {
    const active = isNodeActive(node.code);
    const classes = [
      'formula-node',
      `is-${node.verification}`,
      node.code === selected ? 'is-selected' : '',
      selected && !active ? 'is-dimmed' : '',
      active && node.code !== selected ? 'is-related' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={node.code}
        type="button"
        className={classes}
        style={{ left: unit(node.x), top: unit(node.y), width: unit(GRAPH_NODE_WIDTH), height: unit(GRAPH_NODE_HEIGHT) }}
        aria-pressed={node.code === selected}
        onClick={() => setSelected((current) => (current === node.code ? null : node.code))}
      >
        <span className="formula-node-name">{node.name}</span>
        <span className="formula-node-group">{node.groupName}</span>
      </button>
    );
  };

  return (
    <>
      <Breadcrumb items={[{ label: 'Công thức', to: '/quan-tri/cong-thuc' }, { label: 'Sơ đồ liên kết' }]} />
      <div className="admin-page-header">
        <h1 className="page-title">Sơ đồ liên kết</h1>
        <div className="admin-badge-list">
          {Object.entries(VERIFICATION_LABEL).map(([value, label]) => (
            <Badge key={value} variant={VERIFICATION_VARIANT[value]}>
              {label}
            </Badge>
          ))}
        </div>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={layout.nodes.length}>
        <div className="filter-item-search">
          <Input
            label="Tìm kiếm"
            placeholder="Tên công thức"
            leftIcon={<Search size={16} />}
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </div>
        <SearchableSelect label="Nhóm" placeholder="Tất cả" options={groupOptions} value={draft.groupId} onChange={(value) => patch({ groupId: value })} />
        <SearchableSelect
          label="Trạng thái"
          placeholder="Tất cả"
          options={VERIFICATION_OPTIONS}
          value={draft.verification}
          onChange={(value) => patch({ verification: value })}
        />
      </FilterBar>

      {isLoading ? (
        <div className="formula-loading">
          <Spinner />
        </div>
      ) : layout.nodes.length === 0 ? (
        <Card>
          <p className="formula-empty">Không có công thức phù hợp</p>
        </Card>
      ) : (
        <div className="admin-stack">
          <div className="formula-graph-view">
            <Card noPadding>
              <div className="formula-graph-scroll">
                <div className="formula-graph" style={{ width: unit(layout.width), height: unit(layout.height) }}>
                  <svg className="formula-graph-edges" viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" height="100%" aria-hidden="true">
                    {orderedEdges.map((edge) => {
                      const from = nodeByCode.get(edge.from);
                      const to = nodeByCode.get(edge.to);
                      if (!from || !to) return null;
                      const active = isEdgeActive(edge);
                      return (
                        <path
                          key={`${edge.from}>${edge.to}`}
                          d={edgePath(from, to)}
                          className={`formula-edge${active ? ' is-active' : selected ? ' is-dimmed' : ''}`}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </svg>
                  {layout.nodes.map(renderNode)}
                </div>
              </div>
            </Card>
          </div>

          <div className="formula-tree-view">
            <Card noPadding>
              <ul className="formula-tree-children is-root">
                {treeRoots.map((code) => (
                  <TreeItem key={code} code={code} formulas={byCode} dependencies={dependencies} onOpen={openDetail} />
                ))}
              </ul>
            </Card>
          </div>

          {selectedFormula && (
            <Card
              title={selectedFormula.formula_name}
              action={
                <Button type="button" size="sm" variant="outline" leftIcon={<Eye size={14} />} onClick={() => openDetail(selectedFormula)}>
                  Xem chi tiết
                </Button>
              }
            >
              <div className="admin-badge-list">
                <Badge variant={VERIFICATION_VARIANT[selectedFormula.verification_level]}>{VERIFICATION_LABEL[selectedFormula.verification_level]}</Badge>
                <Badge>{selectedFormula.group_name}</Badge>
              </div>
              {selectedLatex && (
                <div className="formula-display">
                  <FormulaMath latex={selectedLatex} block />
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
};
