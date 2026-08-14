// Grouped by how each theme paints its chrome and page, which is also how the settings picker lays them out
export const THEME_GROUPS = [
  {
    label: 'Gradient',
    themeIds: ['tide', 'aurora', 'citron', 'paper'],
  },
  {
    label: 'Flat',
    themeIds: ['bewcloud', 'dracula', 'catppuccin-latte', 'ember'],
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
  ['dracula', 'Dracula (dark)'],
  ['catppuccin-latte', 'Catppuccin Latte (light)'],
  ['ember', 'Ember (dark)'],
]);

// Drives the browser/PWA chrome via <meta name="theme-color">, so each value matches the top of that theme's chrome (--color-slate-950, or the first stop of its chrome gradient)
export const THEME_COLORS = new Map<ThemeId, string>([
  ['bewcloud', '#020618'],
  ['tide', '#0f4a52'],
  ['aurora', '#241a3d'],
  ['citron', '#1b1b1e'],
  ['paper', '#f2ece0'],
  ['dracula', '#191a21'],
  ['catppuccin-latte', '#dce0e8'],
  ['ember', '#1c1613'],
]);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export interface ThemeOverrideField {
  key: string;
  label: string;
  // The variable the input seeds itself from, and — unless the field feeds a gradient — the one it writes to
  cssVariable: string;
  gradient?: 'chrome' | 'page';
}

// The palette an OSS user can repaint by hand, on top of whichever theme is picked. Kept small on purpose: these are the values that change the look, not the whole ramp.
export const THEME_OVERRIDE_FIELDS: ThemeOverrideField[] = [
  {
    key: 'chrome-gradient-start',
    label: 'Sidebar & header gradient 1',
    cssVariable: '--color-slate-950',
    gradient: 'chrome',
  },
  {
    key: 'chrome-gradient-end',
    label: 'Sidebar & header gradient 2',
    cssVariable: '--color-slate-950',
    gradient: 'chrome',
  },
  { key: 'page-gradient-start', label: 'Page gradient 1', cssVariable: '--color-slate-800', gradient: 'page' },
  { key: 'page-gradient-end', label: 'Page gradient 2', cssVariable: '--color-slate-800', gradient: 'page' },
  { key: 'accent', label: 'Links & buttons', cssVariable: '--color-accent' },
  { key: 'accent-hover', label: 'Links & buttons (hover)', cssVariable: '--color-accent-hover' },
  { key: 'on-color', label: 'Text on buttons', cssVariable: '--color-on-color' },
  { key: 'chrome', label: 'Sidebar & header background', cssVariable: '--color-slate-950' },
  { key: 'card', label: 'Cards', cssVariable: '--color-slate-900' },
  { key: 'page', label: 'Page background', cssVariable: '--color-slate-800' },
  { key: 'row', label: 'Rows & inputs', cssVariable: '--color-slate-700' },
  { key: 'text', label: 'Main text', cssVariable: '--color-white' },
];

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

// Overrides come from a user-editable JSON field, so only known keys holding a plain hex colour are kept
export function parseThemeOverrides(value: unknown): Record<string, string> {
  const parsed = typeof value === 'string' ? safeJsonParse(value) : value;

  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  const overrides: Record<string, string> = {};

  for (const field of THEME_OVERRIDE_FIELDS) {
    const fieldValue = (parsed as Record<string, unknown>)[field.key];

    if (isHexColor(fieldValue)) {
      overrides[field.key] = fieldValue.toLowerCase();
    }
  }

  return overrides;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Both stops have to be set for a gradient to mean anything, so a half-filled pair simply isn't painted
export function buildThemeGradient(start?: string, end?: string, angle = '160deg') {
  if (!isHexColor(start) || !isHexColor(end)) {
    return '';
  }

  return `linear-gradient(${angle}, ${start} 0%, ${end} 100%)`;
}

// Rendered into the style attribute of <html>, so a custom palette applies before the first paint, exactly like the theme itself
export function themeOverridesToCssText(overrides: Record<string, string>) {
  const declarations = THEME_OVERRIDE_FIELDS.filter((field) => !field.gradient && overrides[field.key]).map((field) =>
    `${field.cssVariable}: ${overrides[field.key]}`
  );

  const chromeGradient = buildThemeGradient(overrides['chrome-gradient-start'], overrides['chrome-gradient-end']);
  const pageGradient = buildThemeGradient(overrides['page-gradient-start'], overrides['page-gradient-end'], '180deg');

  if (chromeGradient) {
    declarations.push(`--theme-chrome-gradient: ${chromeGradient}`);
  }

  if (pageGradient) {
    declarations.push(`--theme-page-gradient: ${pageGradient}`);
  }

  return declarations.join('; ');
}
