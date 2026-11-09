/**
 * Recipe measure parsing and scaling (spec 12.4). Pure.
 * Never invents quantities: anything not clearly parseable is kept verbatim and not scaled.
 */
export type ParseStatus = 'parsed' | 'unparsed' | 'to_taste';

export interface ParsedMeasure {
  quantityMin: number | null;
  quantityMax: number | null;
  unit: string | null;
  /** Remaining text after the number/unit, e.g. "chopped". */
  note: string | null;
  status: ParseStatus;
  raw: string;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
};

const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gr: 'g',
  gram: 'g',
  grams: 'g',
  gm: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  millilitres: 'ml',
  milliliters: 'ml',
  l: 'l',
  litre: 'l',
  liter: 'l',
  litres: 'l',
  liters: 'l',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  'tsp.': 'tsp',
  tbsp: 'tbsp',
  tbs: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  'tbsp.': 'tbsp',
  tblsp: 'tbsp',
  cup: 'cup',
  cups: 'cup',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  pinch: 'pinch',
  pinches: 'pinch',
  clove: 'clove',
  cloves: 'clove',
  can: 'can',
  cans: 'can',
  tin: 'can',
  tins: 'can',
  slice: 'slice',
  slices: 'slice',
  piece: 'piece',
  pieces: 'piece',
  bunch: 'bunch',
  bunches: 'bunch',
  knob: 'knob',
  knobs: 'knob',
  sprig: 'sprig',
  sprigs: 'sprig',
};

/** Phrases that mean "not a measurable amount" (spec 12.4). */
const TO_TASTE =
  /^(to taste|garnish|a dash|dash|a drizzle|drizzle|a handful|handful|a pinch|pinch|sprinkl\w*|spinkl\w*|dusting|topping|a knob|knob|as required|as needed|some|a splash|splash|chopped|sliced|grated|boiled|diced|minced|(for|to) \w+( \w+)?)$/i;

/** Count-like units are rounded to quarters and marked approximate when scaled. */
export const COUNT_UNITS = new Set([
  null,
  'clove',
  'can',
  'slice',
  'piece',
  'pinch',
  'bunch',
  'knob',
  'sprig',
]);

function parseNumber(token: string): number | null {
  const t = token.replace(',', '.');
  if (UNICODE_FRACTIONS[t] !== undefined) return UNICODE_FRACTIONS[t]!;
  const mixedUnicode = /^(\d+)([½¼¾⅓⅔⅛])$/.exec(t);
  if (mixedUnicode) return Number(mixedUnicode[1]) + UNICODE_FRACTIONS[mixedUnicode[2]!]!;
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  if (/^\d+(\.\d+)?$/.test(t) || /^\.\d+$/.test(t)) return Number(t);
  return null;
}

export function parseMeasure(input: string | null | undefined): ParsedMeasure {
  const raw = (input ?? '').trim();
  const fail = (status: ParseStatus): ParsedMeasure => ({
    quantityMin: null,
    quantityMax: null,
    unit: null,
    note: raw || null,
    status,
    raw,
  });
  if (!raw) return fail('to_taste');
  if (TO_TASTE.test(raw)) return fail('to_taste');

  // Separate a number glued to a unit ("175g", "2tbsp") and around range dashes.
  const tokens = raw
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/\s*[-–]\s*/g, ' - ')
    .split(/\s+/);

  let i = 0;
  let min: number | null = null;
  let max: number | null = null;

  const first = tokens[i] ? parseNumber(tokens[i]!) : null;
  if (first === null) return fail('unparsed');
  min = first;
  i++;
  // Mixed number: "1 1/2"
  if (tokens[i] && /^\d+\/\d+$/.test(tokens[i]!)) {
    const f = parseNumber(tokens[i]!);
    if (f !== null && f < 1) {
      min += f;
      i++;
    }
  }
  // Range: "2 - 3"
  if (tokens[i] === '-' && tokens[i + 1]) {
    const second = parseNumber(tokens[i + 1]!);
    if (second !== null && second >= min) {
      max = second;
      i += 2;
    }
  }
  if (max === null) max = min;

  let unit: string | null = null;
  const unitToken = tokens[i]?.toLowerCase().replace(/[,]$/, '');
  if (unitToken && UNIT_ALIASES[unitToken]) {
    unit = UNIT_ALIASES[unitToken]!;
    i++;
  }
  const note = tokens.slice(i).join(' ').trim() || null;
  return { quantityMin: min, quantityMax: max, unit, note, status: 'parsed', raw };
}

const FRACTION_GLYPHS: [number, string][] = [
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
];

/** Formats a quantity for display: quarters as glyphs ("¾", "1½"), otherwise up to 2 decimals. */
export function formatQuantity(v: number): string {
  const whole = Math.floor(v + 1e-9);
  const frac = v - whole;
  const glyph = FRACTION_GLYPHS.find(([f]) => Math.abs(frac - f) < 1e-6)?.[1];
  if (glyph) return `${whole || ''}${glyph}`;
  if (Math.abs(frac) < 1e-6) return String(whole);
  return String(Math.round(v * 100) / 100);
}

export interface ScaledMeasure {
  text: string;
  quantityMin: number | null;
  quantityMax: number | null;
  unit: string | null;
  approx: boolean;
  scaled: boolean;
}

const pluralUnit = (u: string) => (u === 'pinch' || u === 'bunch' ? `${u}es` : `${u}s`);

function roundFor(unit: string | null, v: number): number {
  if (unit === 'g' || unit === 'ml') return v > 50 ? Math.round(v / 5) * 5 : Math.round(v);
  if (COUNT_UNITS.has(unit)) return Math.round(v * 4) / 4;
  return Math.round(v * 100) / 100;
}

/**
 * Scales a parsed measure by `factor` (target servings / base servings). Unparsed and "to taste"
 * measures are returned unchanged. Volumes are never converted to grams (density unknown).
 */
export function scaleMeasure(m: ParsedMeasure, factor: number): ScaledMeasure {
  if (m.status !== 'parsed' || m.quantityMin === null || m.quantityMax === null || !(factor > 0)) {
    return {
      text: m.raw,
      quantityMin: m.quantityMin,
      quantityMax: m.quantityMax,
      unit: m.unit,
      approx: false,
      scaled: false,
    };
  }
  const lo = roundFor(m.unit, m.quantityMin * factor);
  const hi = roundFor(m.unit, m.quantityMax * factor);
  // A scaled count (eggs, cloves, cans) is approximate when it isn't whole or rounding changed it:
  // ¾ egg is approx., doubling 2–3 cloves to 4–6 is exact.
  const exact = (v: number, r: number) => Math.abs(v - r) < 1e-9 && Number.isInteger(r);
  const approx =
    factor !== 1 &&
    COUNT_UNITS.has(m.unit) &&
    !(exact(m.quantityMin * factor, lo) && exact(m.quantityMax * factor, hi));
  const amount = lo === hi ? formatQuantity(lo) : `${formatQuantity(lo)}–${formatQuantity(hi)}`;
  const unit = m.unit && COUNT_UNITS.has(m.unit) && hi > 1 ? pluralUnit(m.unit) : m.unit;
  const text = [amount, unit, m.note].filter(Boolean).join(' ') + (approx ? ' (approx.)' : '');
  return { text, quantityMin: lo, quantityMax: hi, unit: m.unit, approx, scaled: factor !== 1 };
}
