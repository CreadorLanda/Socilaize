/**
 * Colour filters, as matrices.
 *
 * One list, used in three places: the live viewfinder, the thumbnail strip,
 * and the bake that writes the file. They have to be the same numbers or the
 * filter you picked is not the filter you get — which is the whole reason the
 * old "filters" button was left doing nothing rather than tinting the preview
 * with something that would vanish on save.
 *
 * A Skia colour matrix is 4×5, row-major, applied to RGBA. Each row is
 * (r, g, b, a, offset) — how much of each input channel, plus a constant. The
 * offset is in 0–1 space, so 0.1 is a tenth of full brightness.
 *
 *     R' = m0·R  + m1·G  + m2·B  + m3·A  + m4
 *     G' = m5·R  + m6·G  + m7·B  + m8·A  + m9
 *     B' = m10·R + m11·G + m12·B + m13·A + m14
 *     A' = m15·R + m16·G + m17·B + m18·A + m19
 *
 * Alpha is left alone everywhere: a filter that changes transparency is not a
 * filter, it is a bug that looks like one.
 */

export type FilterId =
  | 'none'
  | 'mono'
  | 'noir'
  | 'sepia'
  | 'warm'
  | 'cool'
  | 'fade'
  | 'vivid'
  | 'dusk';

export type PhotoFilter = {
  id: FilterId;
  /** i18n key under `filters.`, so the names translate. */
  nameKey: string;
  /** 4×5 row-major, RGBA. `null` for the identity — see NONE. */
  matrix: number[] | null;
};

/**
 * Luma weights, Rec. 709.
 *
 * Not a third each: the eye reads green as far brighter than blue, so an even
 * split makes a grey that is too dark where the picture was green and too
 * light where it was blue.
 */
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

const IDENTITY = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** Straight desaturation. */
const MONO = [
  LR, LG, LB, 0, 0,
  LR, LG, LB, 0, 0,
  LR, LG, LB, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * Desaturated and pushed to the ends — the blacks close up and the whites
 * open. The 1.35 gain with a -0.14 lift is the contrast; without the lift the
 * whole frame would just get brighter.
 */
const NOIR = [
  LR * 1.35, LG * 1.35, LB * 1.35, 0, -0.14,
  LR * 1.35, LG * 1.35, LB * 1.35, 0, -0.14,
  LR * 1.35, LG * 1.35, LB * 1.35, 0, -0.14,
  0, 0, 0, 1, 0,
];

/** Grey first, then tinted — that is what makes it sepia and not "yellowish". */
const SEPIA = [
  LR * 1.07, LG * 1.07, LB * 1.07, 0, 0.02,
  LR * 0.94, LG * 0.94, LB * 0.94, 0, 0.01,
  LR * 0.72, LG * 0.72, LB * 0.72, 0, 0,
  0, 0, 0, 1, 0,
];

/** Sunlight: red up, blue down, green held so skin does not go orange. */
const WARM = [
  1.12, 0.02, 0, 0, 0.02,
  0.01, 1.03, 0, 0, 0,
  0, 0.01, 0.88, 0, 0,
  0, 0, 0, 1, 0,
];

/** The other way, and slightly lifted, which is how shade actually looks. */
const COOL = [
  0.9, 0, 0.03, 0, 0,
  0, 0.98, 0.03, 0, 0.01,
  0.02, 0.02, 1.14, 0, 0.02,
  0, 0, 0, 1, 0,
];

/**
 * Washed: everything pulled towards mid-grey and lifted. The 0.82 gain with a
 * 0.1 offset is what crushes the blacks up, which is the look — not less
 * saturation, less range.
 */
const FADE = [
  0.82, 0.06, 0.04, 0, 0.1,
  0.04, 0.82, 0.06, 0, 0.1,
  0.05, 0.06, 0.82, 0, 0.11,
  0, 0, 0, 1, 0,
];

/**
 * Saturation lifted by pulling each channel away from the luma it would have
 * as grey: out = grey + s·(in − grey), folded into one matrix at s = 1.35.
 */
const S = 1.35;
const VIVID = [
  LR * (1 - S) + S, LG * (1 - S), LB * (1 - S), 0, 0,
  LR * (1 - S), LG * (1 - S) + S, LB * (1 - S), 0, 0,
  LR * (1 - S), LG * (1 - S), LB * (1 - S) + S, 0, 0,
  0, 0, 0, 1, 0,
];

/** Cold shadows, warm highlights — the split-tone that reads as evening. */
const DUSK = [
  1.06, 0.03, 0.06, 0, -0.02,
  0.02, 0.96, 0.06, 0, -0.01,
  0.04, 0.05, 1.1, 0, 0.03,
  0, 0, 0, 1, 0,
];

/**
 * `none` carries a null matrix rather than the identity.
 *
 * Deliberate: it lets every consumer skip the colour-filter path entirely
 * instead of multiplying every pixel by 1, which on a live viewfinder is a
 * per-frame cost for no visible result.
 */
export const FILTERS: PhotoFilter[] = [
  { id: 'none', nameKey: 'none', matrix: null },
  { id: 'vivid', nameKey: 'vivid', matrix: VIVID },
  { id: 'warm', nameKey: 'warm', matrix: WARM },
  { id: 'cool', nameKey: 'cool', matrix: COOL },
  { id: 'fade', nameKey: 'fade', matrix: FADE },
  { id: 'dusk', nameKey: 'dusk', matrix: DUSK },
  { id: 'mono', nameKey: 'mono', matrix: MONO },
  { id: 'noir', nameKey: 'noir', matrix: NOIR },
  { id: 'sepia', nameKey: 'sepia', matrix: SEPIA },
];

export function filterById(id: FilterId): PhotoFilter {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

/** The identity, for anything that needs a matrix even when nothing is picked. */
export const IDENTITY_MATRIX = IDENTITY;
