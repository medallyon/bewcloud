import { renderToString } from 'preact-render-to-string';

import denoConfig from '/deno.json' with { type: 'json' };
import { RequestHandlerParams } from '/lib/page.ts';
import { AppConfig } from '/lib/config.ts';
import { escapeHtml, html } from '/public/ts/utils/misc.ts';
import { DEFAULT_THEME_ID, isThemeId, THEME_COLORS } from '/public/ts/utils/theme.ts';

import Header from '/components/Header.tsx';

interface BasicLayoutOptions
  extends Pick<RequestHandlerParams, 'user' | 'session' | 'request' | 'match' | 'isRunningLocally'> {
  currentPath: string;
  titlePrefix: string;
  description?: string;
}

async function basicLayout(
  htmlContent: string,
  { currentPath, titlePrefix, description, user }: BasicLayoutOptions,
) {
  const config = await AppConfig.getConfig();

  const defaultTitle = config.visuals.title || 'bewCloud is a modern and simpler alternative to Nextcloud and ownCloud';
  const defaultDescription = config.visuals.description || `Have your files under your own control.`;
  const enabledApps = config.core.enabledApps;

  let title = defaultTitle;

  if (titlePrefix) {
    title = `${titlePrefix} - bewCloud`;
  }

  // Rendered server-side, so there's no flash of the default theme before a saved one applies
  const theme = isThemeId(user?.extra.theme) ? user.extra.theme : DEFAULT_THEME_ID;

  const headerReactNode = <Header route={currentPath} user={user} enabledApps={enabledApps} theme={theme} />;

  const headerHtml = renderToString(headerReactNode);

  return html`
    <!DOCTYPE html>
    <html lang="en" dir="ltr" class="h-full bg-slate-800" data-theme="${theme}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        <meta name="description" content="${escapeHtml(description || defaultDescription)}">
        <meta name="author" content="Bruno Bernardino">
        <!-- Overrides the manifest's static theme_color, so PWA chrome follows the chosen theme -->
        <meta name="theme-color" content="${THEME_COLORS.get(theme)}">
        <meta property="og:title" content="${escapeHtml(defaultTitle)}" />
        <link rel="icon" href="/public/images/favicon-dark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/public/images/favicon-dark.png" />
        <link rel="manifest" href="/public/manifest.json" />
        <link rel="stylesheet" href="/public/scss/style.scss" />
        <link rel="stylesheet" href="/public/css/tailwind.css" />
      </head>

      <script type="importmap">
      ${JSON.stringify(importMap)}
      </script>

      <body class="h-full">
        ${headerHtml} ${htmlContent}

        <!-- Preact renders into this element, never replaces it, so the live region survives every toast -->
        <div
          id="toast-host"
          aria-live="polite"
          class="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 pointer-events-none max-md:bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]"
        ></div>

        <script type="module">
          import { h, render, Fragment } from 'preact';

          // Imported files need some preact globals to work
          window.h = h;
          window.Fragment = Fragment;

          import ToastHost from '/public/components/ToastHost.js';

          render(h(ToastHost, {}), document.getElementById('toast-host'));
        </script>

        <script>
          // Tell the upload service worker to abort its queue before navigating away, instead of letting it keep running against a session that's about to be gone.
          document.getElementById('logout-link')?.addEventListener('click', () => {
            navigator.serviceWorker?.controller?.postMessage({ type: 'ABORT_UPLOADS' });
          });

          // The themes are plain CSS variable overrides, so switching one is a single attribute write. Saving it is a background concern.
          document.getElementById('theme-switch')?.addEventListener('click', async (event) => {
            const theme = event.target.closest('[data-theme-id]')?.dataset.themeId;

            if (!theme) {
              return;
            }

            document.documentElement.dataset.theme = theme;
            document.getElementById('theme-switch').open = false;

            try {
              const response = await fetch('/api/user/update-theme', {
                method: 'POST',
                body: JSON.stringify({ theme }),
              });

              if (!response.ok) {
                throw new Error('Failed to save theme. ' + response.statusText);
              }
            } catch (error) {
              console.error(error);
            }
          });
        </script>
      </body>
    </html>
  `;
}

const importMap = denoConfig.frontendImports.reduce(
  (importsObject: { imports: Record<string, string> }, importName: string) => {
    const url = new URL(denoConfig.imports[importName as keyof typeof denoConfig.imports]).toString();
    let fileName = url.replace('https://esm.sh/', '').split('?')[0].trim();
    if (!fileName.endsWith('.mjs')) {
      fileName = `${fileName}.mjs`;
    }
    // Replace characters in file names that aren't cross-OS-compatible (looking at Windows, non WSL, mostly)
    fileName = fileName.replaceAll('*', '_');
    importsObject.imports[importName] = `/public/js/${fileName}`;
    return importsObject;
  },
  { imports: {} },
);

export async function basicLayoutResponse(htmlContent: string, options: BasicLayoutOptions) {
  const headers: HeadersInit = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy':
      `default-src 'self'; child-src 'none'; worker-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'`,
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  };

  return new Response(await basicLayout(htmlContent, options), {
    headers,
  });
}
