import { describe, expect, it } from 'vitest';
import { photoDimensions, ownedAvatarPath } from '@/lib/profilePhoto';

describe('profile photo processing', () => {
  it('reduces large images preserving aspect ratio', () => {
    expect(photoDimensions(4000, 2000)).toEqual({ width: 768, height: 384 });
  });
  it('does not enlarge small photos', () => {
    expect(photoDimensions(120, 240)).toEqual({ width: 120, height: 240 });
  });
  it('only cleans up the current user’s avatar folder', () => {
    expect(ownedAvatarPath('https://example.org/storage/v1/object/public/avatars/me/avatar.webp', 'me')).toBe('me/avatar.webp');
    expect(ownedAvatarPath('https://example.org/storage/v1/object/public/avatars/other/avatar.webp', 'me')).toBeNull();
    expect(ownedAvatarPath('https://example.org/photo.jpg', 'me')).toBeNull();
  });
});