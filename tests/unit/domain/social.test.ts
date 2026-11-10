import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BLOCKED_WORDS,
  RESERVED_HANDLES,
  groupFriendships,
  initials,
  avatarHex,
  normaliseHandle,
  primaryAction,
  socialErrorCode,
  suggestHandle,
  textAllowed,
  validateBio,
  validateDisplayName,
  validateHandle,
  type FriendRow,
} from '@/domain/social';

const MIGRATIONS = join(__dirname, '../../../supabase/migrations');

function seededList(begin: string, end: string): string[] {
  const file = readdirSync(MIGRATIONS).find((f) => f.endsWith('_social_friends.sql'));
  const sql = readFileSync(join(MIGRATIONS, file!), 'utf8');
  const block = sql.slice(sql.indexOf(begin), sql.indexOf(end));
  return [...block.matchAll(/\('([^']+)'\)/g)].map((m) => m[1]!);
}

describe('word filter', () => {
  it('matches the lists the database enforces', () => {
    expect(seededList('-- BEGIN BLOCKED WORDS', '-- END BLOCKED WORDS')).toEqual(BLOCKED_WORDS);
    expect(seededList('-- BEGIN RESERVED HANDLES', '-- END RESERVED HANDLES')).toEqual(
      RESERVED_HANDLES,
    );
  });

  it.each([
    ['Shit happens', false],
    ['sh1t', false],
    ['FUCKface', false],
    ['nazi_99', false],
    ['$lut', false],
    ['fag', false],
    ['Scunthorpe United', true],
    ['Cocktail lover', true],
    ['Dickson', true],
    ['assassin', true],
    ['Ana Marić', true],
    ['', true],
  ])('textAllowed(%p) is %p', (text, ok) => {
    expect(textAllowed(text)).toBe(ok);
  });
});

describe('handles', () => {
  it('normalises', () => {
    expect(normaliseHandle('  @Ana.M ')).toBe('ana.m');
  });

  it.each([
    ['ab', 'too_short'],
    ['a'.repeat(21), 'too_long'],
    ['ana m', 'characters'],
    ['ana-m', 'characters'],
    ['Support', 'reserved'],
    ['b1tch_x', 'not_allowed'],
    ['ana.m_99', null],
    ['@Ana', null],
  ])('validateHandle(%p) → %p', (h, err) => {
    expect(validateHandle(h)).toBe(err);
  });

  it('suggests a handle from the display name', () => {
    expect(suggestHandle('Ana Marić')).toBe('ana.maric');
    expect(suggestHandle('Đuro  Đaković')).toBe('duro.dakovic');
    expect(suggestHandle('Jo')).toBe('');
    expect(suggestHandle('Admin')).toBe('');
    expect(suggestHandle('A very long name indeed here').length).toBeLessThanOrEqual(20);
  });

  it('validates names and bios', () => {
    expect(validateDisplayName('  ')).toBe('required');
    expect(validateDisplayName('x'.repeat(41))).toBe('too_long');
    expect(validateDisplayName('Shit')).toBe('not_allowed');
    expect(validateDisplayName('Ana')).toBeNull();
    expect(validateBio('x'.repeat(141))).toBe('too_long');
    expect(validateBio('Running and futsal')).toBeNull();
  });
});

describe('relationships', () => {
  it('has one main action per state', () => {
    expect(primaryAction('none')).toBe('add');
    expect(primaryAction('outgoing')).toBe('cancel');
    expect(primaryAction('incoming')).toBe('accept');
    expect(primaryAction('blocked')).toBe('unblock');
    expect(primaryAction('friends')).toBe('none');
  });

  it('groups the friends list', () => {
    const row = (handle: string, relationship: FriendRow['relationship']): FriendRow => ({
      user_id: handle,
      handle,
      display_name: handle,
      avatar_color: 'mint',
      relationship,
      since: '2026-11-17T10:00:00Z',
    });
    const g = groupFriendships([row('a', 'friends'), row('b', 'incoming'), row('c', 'outgoing')]);
    expect(g.incoming.map((r) => r.handle)).toEqual(['b']);
    expect(g.friends.map((r) => r.handle)).toEqual(['a']);
    expect(g.outgoing.map((r) => r.handle)).toEqual(['c']);
  });

  it('maps database errors', () => {
    expect(socialErrorCode({ message: 'rate_limited' })).toBe('rate_limited');
    expect(socialErrorCode({ message: 'requests_closed' })).toBe('requests_closed');
    expect(socialErrorCode({ code: '23505', message: 'duplicate key' })).toBe('handle_taken');
    expect(socialErrorCode({ message: 'TypeError: Network request failed' })).toBe('network');
    expect(socialErrorCode({ message: 'weird' })).toBe('unknown');
    expect(socialErrorCode(null)).toBe('unknown');
  });
});

describe('avatars', () => {
  it('makes initials', () => {
    expect(initials('Ana Marić')).toBe('AM');
    expect(initials('bob')).toBe('B');
    expect(initials('Ana de la Cruz')).toBe('AC');
    expect(initials(' ')).toBe('?');
  });

  it('falls back to slate for unknown colours', () => {
    expect(avatarHex('mint')).toBe('#34D399');
    expect(avatarHex('nope')).toBe('#94A3B8');
  });
});
