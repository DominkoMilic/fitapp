import {
  imagePath,
  isMealDbImageUrl,
  recipeImageUri,
  MAX_IMAGE_BYTES,
  mirrorImages,
  type MirrorPorts,
} from '@/integrations/recipes/image-mirror';

const MEAL = 'https://www.themealdb.com/images/media/meals/1529444830.jpg';
const SUPA = 'https://abc.supabase.co';

function ports(over: Partial<MirrorPorts> = {}) {
  const uploads: string[] = [];
  const remembered: string[] = [];
  const fetched: string[] = [];
  const p: MirrorPorts = {
    known: async () => new Set(['111']),
    fetchImage: async (url) => {
      fetched.push(url);
      return { bytes: new Uint8Array(10), type: 'image/jpeg' };
    },
    upload: async (path) => void uploads.push(path),
    remember: async (id) => void remembered.push(id),
    ...over,
  };
  return { p, uploads, remembered, fetched };
}

describe('recipe photos are served by PACE, not TheMealDB (audit: privacy)', () => {
  it('only TheMealDB image paths are fetched by the server', () => {
    expect(isMealDbImageUrl(MEAL)).toBe(true);
    for (const bad of [
      'http://www.themealdb.com/images/media/meals/a.jpg',
      'https://evil.com/images/media/meals/a.jpg',
      'https://www.themealdb.com/api/json/v1/1/search.php',
      'https://www.themealdb.com/images/media/meals/../../etc.jpg',
      'https://www.themealdb.com/images/media/meals/a.jpg?redirect=http://169.254.169.254',
      'https://user@www.themealdb.com/images/media/meals/a.jpg',
      null,
    ])
      expect(isMealDbImageUrl(bad)).toBe(false);
  });
  it('the app only builds URLs for its own bucket', () => {
    expect(recipeImageUri('storage:recipe-images/themealdb/1.jpg', SUPA)).toBe(
      `${SUPA}/storage/v1/object/public/recipe-images/themealdb/1.jpg`,
    );
    expect(recipeImageUri(MEAL, SUPA)).toBeNull();
    expect(recipeImageUri('storage:recipe-images/../routes/x.json', SUPA)).toBeNull();
    expect(recipeImageUri('storage:routes/x/1.json', SUPA)).toBeNull();
    expect(recipeImageUri(null, SUPA)).toBeNull();
  });
  it('copies new images once, reuses known ones, never fails the request', async () => {
    const fetched: string[] = [];
    const { p, uploads, remembered } = ports({
      fetchImage: async (url) => {
        fetched.push(url);
        if (url.includes('bad')) throw new Error('timeout');
        return { bytes: new Uint8Array(10), type: 'image/jpeg' };
      },
    });
    const out = await mirrorImages(
      [
        { externalId: '111', imageUrl: MEAL },
        { externalId: '222', imageUrl: MEAL },
        { externalId: '333', imageUrl: 'https://www.themealdb.com/images/media/meals/bad.jpg' },
        { externalId: '444', imageUrl: 'https://evil.com/x.jpg' },
        { externalId: '../x', imageUrl: MEAL },
      ],
      p,
    );
    expect(out.get('111')).toBe('storage:recipe-images/themealdb/111.jpg');
    expect(out.get('222')).toBe('storage:recipe-images/themealdb/222.jpg');
    expect(out.get('333')).toBeNull();
    expect(out.get('444')).toBeNull();
    expect(out.has('../x')).toBe(false);
    expect(fetched).toHaveLength(2);
    expect(uploads).toEqual(['themealdb/222.jpg']);
    expect(remembered).toEqual(['222']);
  });
  it('rejects oversized or non-image responses', async () => {
    const big = ports({
      known: async () => new Set(),
      fetchImage: async () => ({ bytes: new Uint8Array(MAX_IMAGE_BYTES + 1), type: 'image/jpeg' }),
    });
    expect((await mirrorImages([{ externalId: '1', imageUrl: MEAL }], big.p)).get('1')).toBeNull();
    const html = ports({
      known: async () => new Set(),
      fetchImage: async () => ({ bytes: new Uint8Array(5), type: 'text/html' }),
    });
    expect((await mirrorImages([{ externalId: '1', imageUrl: MEAL }], html.p)).get('1')).toBeNull();
    expect(html.uploads).toEqual([]);
  });
  it('paths are derived from validated ids only', () => {
    expect(imagePath('52772')).toBe('themealdb/52772.jpg');
    expect(() => imagePath('1/../2')).toThrow();
  });
});
