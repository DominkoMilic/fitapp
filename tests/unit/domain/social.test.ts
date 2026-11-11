import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BLOCKED_WORDS,
  commentAllowed,
  FLAGGED_WORDS,
  isFlagged,
  REGIONAL_BLOCKED_WORDS,
  RESERVED_HANDLES,
  groupFriendships,
  initials,
  avatarColorFor,
  avatarHex,
  normaliseHandle,
  primaryAction,
  socialErrorCode,
  suggestSocialName,
  handleFor,
  validateSocialName,
  textAllowed,
  validateBio,
  validateHandle,
  type FriendRow,
} from '@/domain/social';

const MIGRATIONS = join(__dirname, '../../../supabase/migrations');

function seededList(begin: string, end: string, migration = '_social_friends.sql'): string[] {
  const file = readdirSync(MIGRATIONS).find((f) => f.endsWith(migration));
  const sql = readFileSync(join(MIGRATIONS, file!), 'utf8');
  const block = sql.slice(sql.indexOf(begin), sql.indexOf(end));
  return [...block.matchAll(/\('([^']+)'(?:, '(?:flag|block)')?\)/g)].map((m) => m[1]!);
}

describe('word filter', () => {
  it('matches the lists the database enforces', () => {
    expect(seededList('-- BEGIN BLOCKED WORDS', '-- END BLOCKED WORDS')).toEqual(BLOCKED_WORDS);
    expect(seededList('-- BEGIN RESERVED HANDLES', '-- END RESERVED HANDLES')).toEqual(
      RESERVED_HANDLES,
    );
    const moderation = '_social_comment_moderation.sql';
    const flagged = readFileSync(
      join(
        MIGRATIONS,
        readdirSync(MIGRATIONS).find((f) => f.endsWith(moderation))!,
      ),
      'utf8',
    );
    const englishFlagged = /where word in \(([^)]+)\)/.exec(flagged)![1]!.match(/'([^']+)'/g)!;
    expect([
      ...englishFlagged.map((w) => w.slice(1, -1)),
      ...seededList('-- BEGIN FLAGGED WORDS', '-- END FLAGGED WORDS', moderation).filter(
        (w) => !englishFlagged.includes(`'${w}'`),
      ),
    ]).toEqual(FLAGGED_WORDS);
    expect(
      seededList('-- BEGIN REGIONAL BLOCKED WORDS', '-- END REGIONAL BLOCKED WORDS', moderation),
    ).toEqual(REGIONAL_BLOCKED_WORDS);
  });

  it('accepts swearing in comments but flags it; slurs are always refused', () => {
    expect(commentAllowed('Jebote, kakav trening')).toBe(true);
    expect(isFlagged('Jebote, kakav trening')).toBe(true);
    expect(isFlagged('ma p1čka')).toBe(true);
    expect(isFlagged('Odličan trening!')).toBe(false);
    expect(commentAllowed('peder')).toBe(false);
    expect(commentAllowed('you whore')).toBe(false);
    expect(textAllowed('Kreten')).toBe(false);
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

  it.each([
    ['Dominko', null],
    ['DoMInKo_99', null],
    ['Do Minko', 'characters'],
    ['Marić', 'characters'],
    ['Jo', 'too_short'],
    ['A'.repeat(21), 'too_long'],
    ['ADMIN', 'reserved'],
    ['Shit', 'not_allowed'],
  ])('validateSocialName(%p) → %p', (n, err) => {
    expect(validateSocialName(n)).toBe(err);
  });

  it('derives the handle from the username, so names are unique regardless of case', () => {
    expect(handleFor('Dominko')).toBe('dominko');
    expect(handleFor('DoMInKo')).toBe(handleFor('dominko'));
  });

  it('suggests a username from the profile name', () => {
    expect(suggestSocialName('Ana Marić')).toBe('AnaMaric');
    expect(suggestSocialName('Đuro  Đaković')).toBe('DuroDakovic');
    expect(suggestSocialName('Jo')).toBe('');
    expect(suggestSocialName('Admin')).toBe('');
    expect(suggestSocialName('A very long name indeed here').length).toBeLessThanOrEqual(20);
  });

  it('validates bios', () => {
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

  it('assigns the same colour as the database (first 32 bits of the id)', () => {
    expect(avatarColorFor('00000003-0000-0000-0000-000000000000')).toBe('rose');
    expect(avatarColorFor('00000008-0000-0000-0000-000000000000')).toBe('mint');
    expect(avatarColorFor('ffffffff-0000-0000-0000-000000000000')).toBe('slate');
  });
});
