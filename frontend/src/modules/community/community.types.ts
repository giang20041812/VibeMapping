export type PostType = 'post' | 'question';

export interface CommunityComment {
  id: string;
  body: string;
  author: string;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  body: string;
  post_type: PostType;
  created_at: string;
  author: string;
  is_mine: boolean;
  comments: CommunityComment[];
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  is_owner: boolean;
  joined: boolean;
  restricted_until: string | null;
  member_count: number;
  topics: string[];
  posts: CommunityPost[];
}

export interface CareerEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  audience: string | null;
  organizer: string;
  starts_at: string;
  seat_limit: number | null;
  registration_deadline: string | null;
  registered: boolean;
  registrations: number;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export interface Mentor {
  user_id: string;
  name: string;
  headline: string;
  bio: string | null;
  expertise_topics: string[];
  field_ids: string[];
  field_names: string[];
  years_experience: number | null;
  verified: boolean;
  is_me: boolean;
  connection_status: ConnectionStatus | null;
}

export interface MentorProfileInput {
  headline: string;
  bio: string;
  expertiseTopics: string[];
  fieldIds: string[];
  yearsExperience: number | null;
}

export interface ConnectionRequest {
  id: string;
  status: ConnectionStatus;
  message: string | null;
  created_at: string;
  incoming: boolean;
  other_name: string;
}

export interface EventDraft {
  title: string;
  description: string;
  location: string;
  audience: string;
  startsAt: string;
  seatLimit: string;
  deadline: string;
}

export interface CareerFieldOption {
  id: string;
  field_name: string;
}
