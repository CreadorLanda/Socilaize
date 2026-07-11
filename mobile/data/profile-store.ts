/**
 * Cross-screen profile store backed by the auth store and the users API.
 *
 * The profile screen reads from useCurrentUser() for reactive updates;
 * writes go through patchMe() to the server.
 */

import { useState } from 'react';

import { patchMe, type UserPatch } from './api/users';
import { useCurrentUser } from './auth-store';

export function useProfile() {
  const user = useCurrentUser();
  return {
    name: user?.display_name ?? '',
    username: user?.username ?? '',
    bio: user?.bio ?? '',
    avatarUri: user?.avatar_uri ?? '',
    link: `socialize.app/@${user?.username ?? ''}`,
  };
}

export async function updateProfile(patch: {
  name?: string;
  username?: string;
  bio?: string;
  location?: string;
  avatarUri?: string | null;
}) {
  const body: UserPatch = {};
  if (patch.name !== undefined) body.display_name = patch.name;
  if (patch.username !== undefined) body.username = patch.username;
  if (patch.bio !== undefined) body.bio = patch.bio;
  if (patch.avatarUri !== undefined && patch.avatarUri !== null) body.avatar_uri = patch.avatarUri;
  if (Object.keys(body).length === 0) return;
  await patchMe(body);
}
