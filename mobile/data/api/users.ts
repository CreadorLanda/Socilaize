import { api } from './client';
import type { ApiUser } from './auth';

export type Availability = {
  username: string;
  available: boolean;
};

export type UserPatch = Partial<{
  username: string;
  display_name: string;
  bio: string;
  avatar_uri: string;
  username_public: boolean;
}>;

export const me = () => api.get<ApiUser>('/api/users/me');

export const patchMe = (patch: UserPatch) => api.patch<ApiUser>('/api/users/me', patch);

export const checkAvailability = (username: string) =>
  api.get<Availability>(`/api/users/availability?username=${encodeURIComponent(username)}`);

export const userByUsername = (username: string) =>
  api.get<ApiUser>(`/api/users/by-username/${encodeURIComponent(username)}`);
