import { getMenuItems } from '/public/ts/utils/navigation.ts';
export default function Header({
  route,
  user,
  enabledApps
}) {
  const defaultClass = 'text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg font-medium';
  const iconWidthAndHeightInPixels = 20;
  const menuItems = getMenuItems(enabledApps);
  if (user && !route.startsWith('/file-share')) {
    const activeMenu = menuItems.find(menu => route.startsWith(menu.url));
    let pageLabel = activeMenu?.label || '404 - Page not found';
    if (route.startsWith('/news/feeds')) {
      pageLabel = 'News feeds';
    }
    if (route.startsWith('/settings')) {
      pageLabel = 'Settings';
    }
    if (route.startsWith('/expenses')) {
      pageLabel = 'Budgets & Expenses';
    }
    if (route.startsWith('/contacts')) {
      pageLabel = 'Contacts';
    }
    if (route.startsWith('/calendar')) {
      pageLabel = 'Calendar';
    }
    return h("nav", {
      class: "chrome pt-[env(safe-area-inset-top)]"
    }, h("div", {
      class: "flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8"
    }, h("a", {
      href: "/",
      class: "shrink-0 md:hidden"
    }, h("img", {
      class: "h-10 w-10 drop-shadow-md",
      src: "/public/images/logomark.svg",
      alt: "a stylized blue cloud"
    })), h("h1", {
      class: "flex-1 truncate text-xl font-bold tracking-tight text-white sm:text-2xl"
    }, pageLabel), h("a", {
      href: "/settings",
      class: `${defaultClass} flex min-h-11 min-w-11 shrink-0 items-center justify-center ${route.startsWith('/settings') ? 'bg-slate-700 text-white' : ''}`
    }, h("img", {
      src: "/public/images/settings.svg",
      alt: "A cog wheel",
      title: "Settings",
      width: iconWidthAndHeightInPixels,
      height: iconWidthAndHeightInPixels,
      class: "white"
    })), h("a", {
      href: "/logout",
      class: `${defaultClass} flex min-h-11 min-w-11 shrink-0 items-center justify-center md:hidden`
    }, h("img", {
      src: "/public/images/logout.svg",
      alt: "An arrow leaving a door",
      title: "Logout",
      width: iconWidthAndHeightInPixels,
      height: iconWidthAndHeightInPixels,
      class: "white"
    }))));
  }
  return h("header", {
    class: "px-4 pt-8 pb-2 max-w-3xl mx-auto flex flex-col items-center justify-center"
  }, h("a", {
    href: "/"
  }, h("img", {
    class: "mt-6 mb-2 drop-shadow-md",
    src: "/public/images/logo-white.svg",
    width: "250",
    height: "50",
    alt: "the bewCloud logo: a stylized logo"
  })));
}