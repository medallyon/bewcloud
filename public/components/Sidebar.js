import { getMenuItems } from '/public/ts/utils/navigation.ts';
const iconWidthAndHeightInPixels = 20;
export default function Sidebar({
  route,
  enabledApps
}) {
  const menuItems = getMenuItems(enabledApps);
  const activeClass = 'bg-slate-700 text-white';
  const defaultClass = 'text-slate-300 hover:bg-slate-700 hover:text-white';
  return h(Fragment, null, h("aside", {
    class: "hidden md:flex md:w-16 lg:w-56 shrink-0 flex-col gap-1 border-r border-slate-700 bg-slate-950 p-2 pt-[env(safe-area-inset-top)]"
  }, menuItems.map(menu => h("a", {
    key: menu.url,
    href: menu.url,
    class: `flex min-h-11 items-center gap-3 rounded-lg px-3 font-normal ${route.startsWith(menu.url) ? activeClass : defaultClass}`,
    title: menu.label
  }, h("img", {
    src: `/public/images${menu.url}.svg`,
    alt: "",
    width: iconWidthAndHeightInPixels,
    height: iconWidthAndHeightInPixels,
    class: "white shrink-0"
  }), h("span", {
    class: "hidden lg:inline text-sm"
  }, menu.label)))), h("nav", {
    class: "md:hidden fixed inset-x-0 bottom-0 z-30 flex min-h-14 items-stretch gap-1 overflow-x-auto border-t border-slate-700 bg-slate-950 px-2 pb-[env(safe-area-inset-bottom)]"
  }, menuItems.map(menu => h("a", {
    key: menu.url,
    href: menu.url,
    class: `flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 font-normal ${route.startsWith(menu.url) ? activeClass : defaultClass}`
  }, h("img", {
    src: `/public/images${menu.url}.svg`,
    alt: "",
    width: iconWidthAndHeightInPixels,
    height: iconWidthAndHeightInPixels,
    class: "white"
  }), h("span", {
    class: "text-[0.625rem] leading-none"
  }, menu.label)))));
}