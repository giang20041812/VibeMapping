import { callRpc } from '../../lib/rpc';

export interface Friend {
  user_id: string;
  name: string;
  since: string;
  /** Lần gửi lời mời đánh giá gần nhất với đường dẫn nhóm Bạn bè đang mở */
  invite_sent_at: string | null;
}

export interface FriendRequest {
  id: string;
  name: string;
  created_at: string;
  status?: 'pending' | 'declined';
}

export interface FriendList {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  has_active_friend_link: boolean;
}

export type FriendRequestResult =
  | { ok: true; status: 'pending' | 'accepted'; name: string }
  | { ok: false; reason: 'code_invalid' | 'self' | 'already_friends' | 'pending' };

export type FriendInviteResult = { ok: true } | { ok: false; reason: 'not_friend' | 'no_active_link' | 'recently_sent' };

export const FRIEND_REQUEST_ERROR: Record<string, string> = {
  code_invalid: 'Mã không đúng.',
  self: 'Đây là mã của chính bạn.',
  already_friends: 'Hai bạn đã là bạn bè.',
  pending: 'Bạn đã gửi lời kết bạn, đang chờ người kia chấp nhận.',
};

export const FRIEND_INVITE_ERROR: Record<string, string> = {
  not_friend: 'Hai bạn chưa là bạn bè.',
  no_active_link: 'Bạn chưa có đường dẫn mời nhóm Bạn bè còn hạn. Tạo đường dẫn ở trang Đánh giá 360°.',
  recently_sent: 'Bạn đã gửi lời mời cho người này trong 24 giờ qua.',
};

export async function listFriends(): Promise<FriendList> {
  const data = await callRpc<FriendList>('list_my_friends');
  return {
    friends: data?.friends ?? [],
    incoming: data?.incoming ?? [],
    outgoing: data?.outgoing ?? [],
    has_active_friend_link: Boolean(data?.has_active_friend_link),
  };
}

export function getFriendCode(regenerate = false) {
  return callRpc<string>('get_my_friend_code', { p_regenerate: regenerate });
}

export function requestFriend(code: string) {
  return callRpc<FriendRequestResult>('request_friend_by_code', { p_code: code });
}

export function respondFriend(id: string, accept: boolean) {
  return callRpc<void>('respond_friend_request', { p_id: id, p_accept: accept });
}

export function removeFriend(userId: string) {
  return callRpc<void>('remove_friend', { p_user_id: userId });
}

export function sendFriendInvite(friendId: string) {
  return callRpc<FriendInviteResult>('send_friend_invite', { p_friend_id: friendId });
}
