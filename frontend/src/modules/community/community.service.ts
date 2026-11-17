import { callRpc, db } from '../../lib/rpc';
import type {
  CareerEvent,
  CareerFieldOption,
  Community,
  ConnectionRequest,
  EventDraft,
  Mentor,
  MentorProfileInput,
  PostType,
} from './community.types';

export async function listCommunities(): Promise<Community[]> {
  return (await callRpc<Community[]>('list_communities')) ?? [];
}

export function createCommunity(name: string, description: string) {
  return callRpc<string>('create_community', { p_name: name.trim(), p_description: description.trim() || null });
}

export function joinCommunity(communityId: string) {
  return callRpc<void>('join_community', { p_community_id: communityId });
}

export function leaveCommunity(communityId: string) {
  return callRpc<void>('leave_community', { p_community_id: communityId });
}

export function createPost(communityId: string, body: string, postType: PostType) {
  return callRpc<string>('create_community_post', { p_community_id: communityId, p_body: body, p_post_type: postType });
}

export function addComment(postId: string, body: string) {
  return callRpc<string>('add_community_comment', { p_post_id: postId, p_body: body });
}

export function reportPost(postId: string, reason: string) {
  return callRpc<void>('report_community_post', { p_post_id: postId, p_reason: reason });
}

export async function listEvents(): Promise<CareerEvent[]> {
  return (await callRpc<CareerEvent[]>('list_career_events')) ?? [];
}

export function getEvent(eventId: string) {
  return callRpc<CareerEvent>('get_career_event', { p_event_id: eventId });
}

export function registerEvent(eventId: string, register: boolean) {
  return callRpc<void>('register_career_event', { p_event_id: eventId, p_register: register });
}

export function createEvent(draft: EventDraft) {
  return callRpc<string>('create_career_event', {
    p_school_id: null,
    p_title: draft.title,
    p_description: draft.description,
    p_location: draft.location,
    p_starts_at: new Date(draft.startsAt).toISOString(),
    p_seat_limit: draft.seatLimit.trim() ? Number(draft.seatLimit) : null,
    p_registration_deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
    p_audience: draft.audience,
  });
}

export async function listMentors(): Promise<Mentor[]> {
  const rows = (await callRpc<Mentor[]>('list_verified_mentors')) ?? [];
  return rows.map((m) => ({ ...m, expertise_topics: m.expertise_topics ?? [], field_ids: m.field_ids ?? [], field_names: m.field_names ?? [] }));
}

export function saveMentorProfile(input: MentorProfileInput) {
  return callRpc<void>('save_mentor_profile', {
    p_headline: input.headline,
    p_bio: input.bio,
    p_expertise_topics: input.expertiseTopics,
    p_field_ids: input.fieldIds,
    p_years_experience: input.yearsExperience,
  });
}

export function requestConnection(mentorId: string, message: string) {
  return callRpc<void>('request_mentor_connection', { p_mentor_id: mentorId, p_message: message });
}

export async function listConnections(): Promise<ConnectionRequest[]> {
  return (await callRpc<ConnectionRequest[]>('list_my_connection_requests')) ?? [];
}

export function respondConnection(id: string, accept: boolean) {
  return callRpc<void>('respond_connection_request', { p_id: id, p_accept: accept });
}

/** Lĩnh vực cấp gốc để tìm người hướng dẫn theo lĩnh vực */
export async function listCareerFields(): Promise<CareerFieldOption[]> {
  const { data, error } = await db.from('career_fields').select('id, field_name').is('parent_field_id', null).order('field_name');
  if (error) throw error;
  return (data ?? []) as CareerFieldOption[];
}
