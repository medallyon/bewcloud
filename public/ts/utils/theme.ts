// Grouped by how each theme paints its chrome and page, which is also how the settings picker lays them out
export const THEME_GROUPS = [
  {
    label: 'Gradient',
    themeIds: ['tide', 'aurora', 'citron', 'paper'],
  },
  {
    label: 'Flat',
    themeIds: ['bewcloud', 'nord', 'dracula', 'catppuccin-latte', 'daylight', 'ember'],
  },
] as const;

export type ThemeId = (typeof THEME_GROUPS)[number]['themeIds'][number];

// Derived from the groups so a new theme only has to be added in one place to be both valid and offered
export const THEME_IDS: readonly ThemeId[] = THEME_GROUPS.flatMap((group) => group.themeIds);

export const DEFAULT_THEME_ID: ThemeId = 'bewcloud';

export const THEME_LABELS = new Map<ThemeId, string>([
  ['bewcloud', 'bewCloud (dark)'],
  ['tide', 'Tide (dark)'],
  ['aurora', 'Aurora (dark)'],
  ['citron', 'Graphite & Citron (dark)'],
  ['paper', 'Paper (light)'],
  ['nord', 'Nord (dark)'],
  ['dracula', 'Dracula (dark)'],
  ['catppuccin-latte', 'Catppuccin Latte (light)'],
  ['daylight', 'Daylight (light)'],
  ['ember', 'Ember (dark)'],
]);

// Drives the browser/PWA chrome via <meta name="theme-color">, so each value matches the top of that theme's chrome (--color-slate-950, or the first stop of its chrome gradient)
export const THEME_COLORS = new Map<ThemeId, string>([
  ['bewcloud', '#020618'],
  ['tide', '#0f4a52'],
  ['aurora', '#241a3d'],
  ['citron', '#1b1b1e'],
  ['paper', '#f2ece0'],
  ['nord', '#242933'],
  ['dracula', '#191a21'],
  ['catppuccin-latte', '#dce0e8'],
  ['daylight', '#e8dcc3'],
  ['ember', '#1c1613'],
]);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}
