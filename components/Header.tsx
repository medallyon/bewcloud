import { OptionalApp, User } from '/lib/types.ts';
import { getMenuItems } from '/public/ts/utils/navigation.ts';

interface Data {
  route: string;
  user?: User | null;
  enabledApps: OptionalApp[];
}

export default function Header({ route, user, enabledApps }: Data) {
  const defaultClass = 'text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg font-medium';

  const iconWidthAndHeightInPixels = 20;

  const menuItems = getMenuItems(enabledApps);

  if (user && !route.startsWith('/file-share')) {
    const activeMenu = menuItems.find((menu) => route.startsWith(menu.url));

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

    return (
      <nav class='chrome pt-[env(safe-area-inset-top)]'>
        <div class='flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8'>
          <a href='/' class='shrink-0 md:hidden'>
            <img
              class='h-10 w-10 drop-shadow-md'
              src='/public/images/logomark.svg'
              alt='a stylized blue cloud'
            />
          </a>

          <h1 class='flex-1 truncate text-xl font-bold tracking-tight text-white sm:text-2xl'>{pageLabel}</h1>

          <details class='relative shrink-0' id='account-menu'>
            <summary class={`${defaultClass} flex min-h-11 min-w-11 list-none items-center justify-center`}>
              <img
                src='/public/images/settings.svg'
                alt='A cog wheel'
                title='Account'
                width={iconWidthAndHeightInPixels}
                height={iconWidthAndHeightInPixels}
                class='white'
              />
            </summary>
            <div class='absolute right-0 z-40 mt-2 w-64 origin-top-right rounded-xl border border-slate-600 bg-slate-700 shadow-lg'>
              <div class='py-1'>
                <span class='block truncate px-4 py-2 text-xs text-slate-300'>{user.email}</span>
                <a
                  href='/settings'
                  class={`flex min-h-11 items-center px-4 text-sm font-normal text-white hover:bg-slate-600 ${
                    route.startsWith('/settings') ? 'bg-slate-600' : ''
                  }`}
                >
                  Settings
                </a>
                <a
                  href='/logout'
                  id='logout-link'
                  class='flex min-h-11 items-center px-4 text-sm font-normal text-white hover:bg-slate-600'
                >
                  Logout
                </a>
              </div>
            </div>
          </details>
        </div>
      </nav>
    );
  }

  return (
    <header class='px-4 pt-8 pb-2 max-w-3xl mx-auto flex flex-col items-center justify-center'>
      <a href='/'>
        <img
          class='mt-6 mb-2 drop-shadow-md'
          src='/public/images/logo-white.svg'
          width='250'
          height='50'
          alt='the bewCloud logo: a stylized logo'
        />
      </a>
    </header>
  );
}
