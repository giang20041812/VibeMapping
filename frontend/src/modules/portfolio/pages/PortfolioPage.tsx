import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Briefcase, ClipboardList, ScanSearch } from 'lucide-react';
import { Alert, PageHero, SkeletonRegion, Skeleton, Tabs, useConfirm, type TabItem } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { listSavedCareers, type SavedCareer } from '../../career_explorer/career.service';
import type { CareerLevelFramework } from '../../career_explorer/careerLevelFramework.types';
import { RoadmapAddDialog, type AddInitial, type AddInput } from '../../roadmap/components/RoadmapAddDialog';
import { GapPositionStep } from '../components/GapPositionStep';
import { GapResultView } from '../components/GapResultView';
import { SkillLevelDialog } from '../components/SkillLevelDialog';
import { SkillProfilePanel } from '../components/SkillProfilePanel';
import { DEFAULT_GAP_PARAMS, SECTION_TO_KIND } from '../portfolio.constants';
import {
  addRoadmapItem,
  addSkillItem,
  deleteSkillItem,
  getActiveRoadmap,
  importVerifiedSoftSkills,
  listCourseSuggestions,
  listGapHistory,
  listGapPositions,
  listSkillItems,
  loadFramework,
  loadGapParams,
  saveGapSnapshot,
  updateSkillLevel,
  type ActiveRoadmap,
} from '../portfolio.service';
import type { CourseSuggestion, GapHistoryEntry, GapParams, GapPosition, GapRow, SkillProfileInput, SkillProfileItem } from '../portfolio.types';
import { analyseSkillGap } from '../skillGap.logic';
import '../../roadmap/pages/RoadmapPage.css';
import '../Portfolio.css';

type Notice = { tone: 'success' | 'danger' | 'info'; text: string; link?: { to: string; label: string } };

const TABS: TabItem[] = [
  { value: 'ho-so', label: 'Hồ sơ', icon: <ClipboardList /> },
  { value: 'phan-tich', label: 'Phân tích khoảng cách', icon: <ScanSearch /> },
];

const errorText = (caught: unknown) => String((caught as { message?: string })?.message ?? '');

/** M08: hồ sơ năng lực của sinh viên và phân tích khoảng cách so với khung JD theo cấp */
export const PortfolioPage: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'phan-tich' ? 'phan-tich' : 'ho-so';

  const [items, setItems] = useState<SkillProfileItem[] | null>(null);
  const [saved, setSaved] = useState<SavedCareer[]>([]);
  const [positions, setPositions] = useState<GapPosition[] | null>(null);
  const [params, setParams] = useState<GapParams>(DEFAULT_GAP_PARAMS);
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [history, setHistory] = useState<GapHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [framework, setFramework] = useState<CareerLevelFramework | null>(null);
  const [analysedAt, setAnalysedAt] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [levelRow, setLevelRow] = useState<GapRow | null>(null);
  const [roadmap, setRoadmap] = useState<ActiveRoadmap | null>(null);
  const [adding, setAdding] = useState<AddInitial | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reloadItems = useCallback(async () => setItems(await listSkillItems()), []);

  useEffect(() => {
    reloadItems().catch(() => {
      setItems([]);
      setNotice({ tone: 'danger', text: 'Không tải được hồ sơ năng lực.' });
    });
    listSavedCareers().then(setSaved).catch(() => undefined);
    loadGapParams().then(setParams).catch(() => undefined);
    listCourseSuggestions().then(setSuggestions).catch(() => undefined);
    listGapHistory().then(setHistory).catch(() => undefined);
  }, [reloadItems]);

  useEffect(() => {
    if (tab !== 'phan-tich' || positions !== null) return;
    listGapPositions().then(setPositions).catch(() => {
      setPositions([]);
      setNotice({ tone: 'danger', text: 'Không tải được danh sách vị trí.' });
    });
  }, [tab, positions]);

  const position = positions?.find((p) => p.framework_id === framework?.id) ?? null;
  const result = useMemo(() => {
    if (!framework || !items || !analysedAt) return null;
    const name = position ? `${position.career_name} · ${position.level_name}` : framework.level_name;
    return { ...analyseSkillGap(framework, name, items, params), analysed_at: analysedAt };
  }, [framework, items, params, analysedAt, position]);

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'ho-so') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
    } catch {
      setNotice({ tone: 'danger', text: fail });
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (input: SkillProfileInput) => {
    if (!userId) return false;
    let ok = false;
    await run(async () => {
      await addSkillItem(userId, input);
      await reloadItems();
      ok = true;
    }, 'Không thêm được kỹ năng.');
    return ok;
  };

  const changeLevel = async (item: SkillProfileItem, level: number) => {
    if (item.self_level === level) return;
    if (item.verified_360 && !(await confirm({ title: 'Tự sửa mức sẽ gỡ nhãn Đã xác thực 360°. Tiếp tục?', confirmLabel: 'Tiếp tục' }))) return;
    await run(async () => {
      await updateSkillLevel(item.id, level);
      await reloadItems();
    }, 'Không lưu được mức tự chấm.');
  };

  const removeItem = async (item: SkillProfileItem) => {
    if (!(await confirm({ title: `Xóa "${item.title}" khỏi hồ sơ?`, confirmLabel: 'Xóa', danger: true }))) return;
    await run(async () => {
      await deleteSkillItem(item.id);
      await reloadItems();
    }, 'Không xóa được kỹ năng.');
  };

  const importSoftSkills = () =>
    run(async () => {
      try {
        const count = await importVerifiedSoftSkills();
        await reloadItems();
        setNotice({ tone: 'success', text: `Đã lấy ${count} kỹ năng từ kết quả Cuối cùng 360°.` });
      } catch (caught) {
        if (errorText(caught).includes('no_final_360')) {
          setNotice({ tone: 'info', text: 'Bạn chưa có kết quả Cuối cùng 360°.', link: { to: '/danh-gia-360', label: 'Mời đánh giá 360°' } });
          return;
        }
        throw caught;
      }
    }, 'Không lấy được kỹ năng.');

  const analyse = async () => {
    if (!selectedId || !userId || !items) return;
    setAnalysing(true);
    setNotice(null);
    try {
      const fw = framework?.id === selectedId ? framework : await loadFramework(selectedId);
      const freshItems = await listSkillItems();
      setItems(freshItems);
      setFramework(fw);
      const now = new Date().toISOString();
      setAnalysedAt(now);
      const picked = positions?.find((p) => p.framework_id === fw.id);
      const snapshot = analyseSkillGap(fw, picked ? `${picked.career_name} · ${picked.level_name}` : fw.level_name, freshItems, params);
      saveGapSnapshot(userId, snapshot).then(() => listGapHistory().then(setHistory)).catch(() => undefined);
    } catch {
      setNotice({ tone: 'danger', text: 'Không phân tích được. Thử lại sau.' });
    } finally {
      setAnalysing(false);
    }
  };

  const saveLevel = async (row: GapRow, level: number) => {
    if (!userId) return;
    await run(async () => {
      if (row.profile_item_id) {
        await updateSkillLevel(row.profile_item_id, level);
      } else {
        await addSkillItem(userId, {
          kind: SECTION_TO_KIND[row.section] ?? 'hard_skill',
          title: row.content,
          self_level: level,
          framework_item_id: row.item_id,
        });
      }
      await reloadItems();
      setLevelRow(null);
    }, 'Không lưu được kỹ năng.');
  };

  const openRoadmapDialog = async (title: string) => {
    setNotice(null);
    try {
      const active = roadmap ?? (await getActiveRoadmap());
      if (!active) {
        setNotice({ tone: 'info', text: 'Bạn chưa có lộ trình.', link: { to: '/lo-trinh', label: 'Tạo lộ trình' } });
        return;
      }
      setRoadmap(active);
      setAdding({ kind: 'activity', pillar: 'knowledge', due: '', title });
    } catch {
      setNotice({ tone: 'danger', text: 'Không mở được lộ trình.' });
    }
  };

  const addToRoadmap = async (input: AddInput) => {
    if (!roadmap) return;
    await run(async () => {
      await addRoadmapItem(roadmap.id, { title: input.title, pillar: input.pillar, due: input.due, checkpoint: input.checkpoint, passCriteria: input.passCriteria });
      setNotice({ tone: 'success', text: `Đã thêm vào lộ trình "${roadmap.title}".`, link: { to: '/lo-trinh', label: 'Xem lộ trình' } });
    }, 'Không thêm được vào lộ trình.');
  };

  return (
    <div className="module-page pf-page">
      <PageHero title="Hồ sơ năng lực" icon={<Briefcase />} tone="violet" />

      {notice && (
        <Alert variant={notice.tone}>
          {notice.text}
          {notice.link && <> <Link to={notice.link.to}>{notice.link.label}</Link></>}
        </Alert>
      )}

      <Tabs items={TABS} value={tab} onChange={setTab} label="Hồ sơ năng lực" />

      {items === null ? (
        <SkeletonRegion>
          <Skeleton shape="block" />
          <Skeleton shape="block" />
        </SkeletonRegion>
      ) : tab === 'ho-so' ? (
        <SkillProfilePanel items={items} busy={busy} onAdd={addItem} onLevel={(item, level) => void changeLevel(item, level)} onDelete={(item) => void removeItem(item)} onImport={() => void importSoftSkills()} />
      ) : analysing ? (
        <SkeletonRegion className="pf-analysing">
          <p className="pf-analysing-text">Đang phân tích hồ sơ của bạn...</p>
          <div className="pf-stats">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} shape="block" />)}</div>
          <Skeleton shape="block" />
        </SkeletonRegion>
      ) : result ? (
        <GapResultView
          result={result}
          suggestions={suggestions}
          busy={busy || analysing}
          onReanalyse={() => void analyse()}
          onChangePosition={() => setAnalysedAt(null)}
          onAddToProfile={setLevelRow}
          onEditLevel={setLevelRow}
          onAddToRoadmap={(title) => void openRoadmapDialog(title)}
        />
      ) : (
        <GapPositionStep
          positions={positions}
          saved={saved}
          items={items}
          params={params}
          history={history}
          selectedId={selectedId}
          analysing={analysing}
          onSelect={setSelectedId}
          onAnalyse={() => void analyse()}
          onOpenProfile={() => setTab('ho-so')}
        />
      )}

      <SkillLevelDialog row={levelRow} busy={busy} onClose={() => setLevelRow(null)} onSubmit={saveLevel} />
      <RoadmapAddDialog
        key={adding ? `add-${adding.title}` : 'closed'}
        initial={adding}
        busy={busy}
        onClose={() => setAdding(null)}
        onSubmit={addToRoadmap}
      />
      {confirmDialog}
    </div>
  );
};
