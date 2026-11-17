import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, MessagesSquare, UserSearch } from 'lucide-react';
import { Alert, PageHero, Tabs, type TabItem } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { CommunityGroups } from '../components/CommunityGroups';
import { ConnectionRequests } from '../components/ConnectionRequests';
import { CreateCommunityDialog } from '../components/CreateCommunityDialog';
import { EventFormDialog } from '../components/EventFormDialog';
import { EventList } from '../components/EventList';
import { MentorDirectory } from '../components/MentorDirectory';
import { MentorProfileForm } from '../components/MentorProfileForm';
import { communityErrorText } from '../community.constants';
import {
  createCommunity,
  createEvent,
  joinCommunity,
  listCareerFields,
  listCommunities,
  listConnections,
  listEvents,
  listMentors,
  registerEvent,
  respondConnection,
  saveMentorProfile,
} from '../community.service';
import type { CareerEvent, CareerFieldOption, Community, ConnectionRequest, EventDraft, Mentor, MentorProfileInput } from '../community.types';
import '../Community.css';

type Tab = 'nhom' | 'su-kien' | 'nguoi-huong-dan';
const TAB_VALUES: Tab[] = ['nhom', 'su-kien', 'nguoi-huong-dan'];

/** M09: cộng đồng hướng nghiệp gồm nhóm thảo luận, sự kiện và người hướng dẫn */
export const CommunityPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && TAB_VALUES.includes(tabParam) ? tabParam : 'nhom';
  const role = profile?.role;
  const canCreateEvent = role === 'school_admin' || role === 'system_admin';
  const isMentor = role === 'mentor';

  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [events, setEvents] = useState<CareerEvent[] | null>(null);
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [connections, setConnections] = useState<ConnectionRequest[]>([]);
  const [fields, setFields] = useState<CareerFieldOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const loadCommunities = useCallback(() => listCommunities().then(setCommunities), []);
  const loadEvents = useCallback(() => listEvents().then(setEvents), []);
  const loadMentors = useCallback(() => Promise.all([listMentors().then(setMentors), listConnections().then(setConnections)]), []);

  useEffect(() => {
    const fail = () => setMessage({ tone: 'danger', text: 'Không tải được cộng đồng.' });
    if (tab === 'nhom' && communities === null) loadCommunities().catch(() => { setCommunities([]); fail(); });
    if (tab === 'su-kien' && events === null) loadEvents().catch(() => { setEvents([]); fail(); });
    if (tab === 'nguoi-huong-dan' && mentors === null) {
      loadMentors().catch(() => { setMentors([]); fail(); });
      listCareerFields().then(setFields).catch(() => undefined);
    }
  }, [tab, communities, events, mentors, loadCommunities, loadEvents, loadMentors]);

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'nhom') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
    setMessage(null);
  };

  const run = async (fn: () => Promise<unknown>, ok: string | null, fail: string): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ tone: 'success', text: ok });
      return true;
    } catch (caught) {
      setMessage({ tone: 'danger', text: communityErrorText(caught, fail) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const join = (community: Community) =>
    void run(async () => {
      await joinCommunity(community.id);
      navigate(`/cong-dong/nhom/${community.id}`);
    }, null, 'Không tham gia được nhóm.');

  const createGroup = (name: string, description: string) =>
    run(async () => {
      const id = await createCommunity(name, description);
      navigate(`/cong-dong/nhom/${id}`);
    }, null, 'Không tạo được nhóm.');

  const toggleEvent = (event: CareerEvent) =>
    void run(async () => {
      await registerEvent(event.id, !event.registered);
      await loadEvents();
    }, event.registered ? 'Đã hủy đăng ký.' : 'Đã đăng ký sự kiện.', 'Không đăng ký được.');

  const submitEvent = (draft: EventDraft) =>
    run(async () => {
      await createEvent(draft);
      await loadEvents();
    }, 'Đã tạo sự kiện.', 'Không tạo được sự kiện.');

  const saveProfile = async (input: MentorProfileInput) => {
    await run(async () => {
      await saveMentorProfile(input);
      await loadMentors();
    }, 'Đã lưu hồ sơ người hướng dẫn.', 'Không lưu được hồ sơ.');
  };

  const respond = (row: ConnectionRequest, accept: boolean) =>
    void run(async () => {
      await respondConnection(row.id, accept);
      await loadMentors();
    }, accept ? 'Đã chấp nhận yêu cầu kết nối.' : 'Đã từ chối yêu cầu kết nối.', 'Không xử lý được yêu cầu.');

  const pendingIncoming = connections.filter((c) => c.incoming && c.status === 'pending').length;
  const tabs: TabItem[] = [
    { value: 'nhom', label: 'Nhóm thảo luận', icon: <MessagesSquare /> },
    { value: 'su-kien', label: 'Sự kiện', icon: <CalendarDays /> },
    { value: 'nguoi-huong-dan', label: 'Người hướng dẫn', icon: <UserSearch />, alert: pendingIncoming > 0 },
  ];
  const mine = mentors?.find((m) => m.is_me) ?? null;

  return (
    <div className="module-page cm-page">
      <PageHero title="Cộng đồng hướng nghiệp" icon={<MessagesSquare />} tone="magenta" />
      {message && <Alert variant={message.tone}>{message.text}</Alert>}
      <Tabs items={tabs} value={tab} onChange={setTab} label="Cộng đồng" />

      {tab === 'nhom' && <CommunityGroups rows={communities} busy={busy} onJoin={join} onCreate={() => setCreatingGroup(true)} />}

      {tab === 'su-kien' && (
        <EventList events={events} busy={busy} canCreate={canCreateEvent} onToggle={toggleEvent} onCreate={() => setCreatingEvent(true)} />
      )}

      {tab === 'nguoi-huong-dan' && (
        <div className="cm-section">
          {isMentor && <MentorProfileForm mine={mine} fields={fields} busy={busy} onSave={saveProfile} />}
          <ConnectionRequests rows={connections} busy={busy} onRespond={respond} />
          <MentorDirectory mentors={mentors} fields={fields} />
        </div>
      )}

      <CreateCommunityDialog open={creatingGroup} busy={busy} onClose={() => setCreatingGroup(false)} onSubmit={createGroup} />
      {canCreateEvent && <EventFormDialog open={creatingEvent} busy={busy} onClose={() => setCreatingEvent(false)} onSubmit={submitEvent} />}
    </div>
  );
};
