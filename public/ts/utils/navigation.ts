import { OptionalApp } from '/lib/types.ts';
import { capitalizeWord } from '/public/ts/utils/misc.ts';

export interface MenuItem {
  url: string;
  label: string;
}

// Shared by the header (to name the current page) and the sidebar/tab bar (to link to every app)
export function getMenuItems(enabledApps: OptionalApp[]): MenuItem[] {
  return enabledApps.map((app) => ({
    url: `/${app}`,
    label: capitalizeWord(app),
  }));
}
