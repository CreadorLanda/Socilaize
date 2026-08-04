import { api } from './client';

export type MemberRole = 'admin' | 'member';
export type HistoryMode = 'full' | 'view-only';

export interface GroupMemberDTO {
  user_id: string;
  username?: string;
  display_name: string;
  avatar_uri?: string;
  role: MemberRole;
  joined_at: string;
}

export interface GroupDTO {
  id: string;
  title: string;
  description?: string;
  avatar_url?: string;
  created_by: string;
  created_at: string;
  history_enabled: boolean;
  history_mode: HistoryMode;
  history_limit: number;
  member_count: number;
  members?: GroupMemberDTO[];
}

export function listGroups() {
  return api.get<GroupDTO[]>('/api/groups');
}

export function getGroup(id: string) {
  return api.get<GroupDTO>(`/api/groups/${id}`);
}

export function createGroup(input: {
  title: string;
  description?: string;
  avatar_url?: string;
  member_ids?: string[];
}) {
  return api.post<GroupDTO>('/api/groups', input);
}

export function patchGroup(
  id: string,
  patch: {
    title?: string;
    description?: string;
    avatar_url?: string;
    history_enabled?: boolean;
    history_mode?: HistoryMode;
    history_limit?: number;
  },
) {
  return api.patch<GroupDTO>(`/api/groups/${id}`, patch);
}

export function addGroupMembers(id: string, userIds: string[]) {
  return api.post<GroupDTO>(`/api/groups/${id}/members`, { user_ids: userIds });
}

export function removeGroupMember(id: string, userId: string) {
  return api.del<GroupDTO>(`/api/groups/${id}/members/${userId}`);
}

export function setGroupMemberRole(id: string, userId: string, role: MemberRole) {
  return api.patch<GroupDTO>(`/api/groups/${id}/members/${userId}`, { role });
}

export function leaveGroup(id: string) {
  return api.post<void>(`/api/groups/${id}/leave`);
}

/**
 * A sender key sealed for one member.
 *
 * `user_id` is the recipient when publishing and the sender when fetching —
 * whichever end the caller is not.
 */
export type SenderKeyEntry = {
  user_id: string;
  ciphertext: string;
  epoch: number;
};

export function publishSenderKeys(
  id: string,
  epoch: number,
  entries: { user_id: string; ciphertext: string }[],
) {
  return api.post<void>(`/api/groups/${id}/sender-keys`, { epoch, entries });
}

export function fetchSenderKeys(id: string) {
  return api.get<{ epoch: number; keys: SenderKeyEntry[] }>(`/api/groups/${id}/sender-keys`);
}
