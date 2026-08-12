export const THEME_IDS = ['bewcloud', 'nord', 'dracula', 'catppuccin-latte', 'daylight', 'ember'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_ID: ThemeId = 'bewcloud';

export const THEME_LABELS = new Map<ThemeId, string>([
  ['bewcloud', 'bewCloud (dark)'],
  ['nord', 'Nord (dark)'],
  ['dracula', 'Dracula (dark)'],
  ['catppuccin-latte', 'Catppuccin Latte (light)'],
  ['daylight', 'Daylight (light)'],
  ['ember', 'Ember (dark)'],
]);

// Drives the browser/PWA chrome via <meta name="theme-color">, so each value matches that theme's darkest chrome surface (--color-slate-950)
export const THEME_COLORS = new Map<ThemeId, string>([
  ['bewcloud', '#020618'],
  ['nord', '#242933'],
  ['dracula', '#191a21'],
  ['catppuccin-latte', '#dce0e8'],
  ['daylight', '#e8dcc3'],
  ['ember', '#1c1613'],
]);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}
