import { generateFieldHtml, getFormDataField } from '/public/ts/utils/form.ts';
import { convertObjectToFormData, currencyMap, escapeHtml, html } from '/public/ts/utils/misc.ts';
import { getEnabledMultiFactorAuthMethodsFromUser } from '/public/ts/utils/multi-factor-auth.ts';
import { getTimeZones } from '/public/ts/utils/calendar.ts';
import { DEFAULT_THEME_ID, isThemeId, parseThemeOverrides, THEME_COLORS, THEME_GROUPS, THEME_LABELS, THEME_OVERRIDE_FIELDS } from '/public/ts/utils/theme.ts';
import Loading from "/public/components/Loading.js";
export const actionWords = new Map([['change-email', 'change email'], ['verify-change-email', 'change email'], ['change-password', 'change password'], ['change-dav-password', 'change WebDav password'], ['delete-account', 'delete account'], ['change-currency', 'change currency'], ['change-timezone', 'change timezone'], ['change-theme', 'change theme']]);
function formFields(action, formData, currency, timezoneId, theme, themeOverrides) {
  const fields = [{
    name: 'action',
    label: '',
    type: 'hidden',
    value: action,
    overrideValue: action,
    required: true,
    readOnly: true
  }];
  if (action === 'change-email') {
    fields.push({
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: getFormDataField(formData, 'email'),
      required: true
    });
  } else if (action === 'verify-change-email') {
    fields.push({
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: getFormDataField(formData, 'email'),
      required: true
    }, {
      name: 'verification-code',
      label: 'Verification Code',
      description: `The verification code to validate your new email.`,
      type: 'text',
      placeholder: '000000',
      required: true
    });
  } else if (action === 'change-password') {
    fields.push({
      name: 'current-password',
      label: 'Current Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true
    }, {
      name: 'new-password',
      label: 'New Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true
    });
  } else if (action === 'change-dav-password') {
    fields.push({
      name: 'new-dav-password',
      label: 'New WebDav Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true,
      description: 'Alternative password used for WebDav access and/or HTTP Basic Auth.'
    });
  } else if (action === 'delete-account') {
    fields.push({
      name: 'current-password',
      label: 'Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      description: 'You need to input your password in order to delete your account.',
      required: true
    });
  } else if (action === 'change-currency') {
    fields.push({
      name: 'currency',
      label: 'Currency',
      type: 'select',
      options: Array.from(currencyMap.keys()).map(currencySymbol => ({
        value: currencySymbol,
        label: `${currencySymbol} (${currencyMap.get(currencySymbol)})`
      })),
      value: getFormDataField(formData, 'currency') || currency,
      required: true
    });
  } else if (action === 'change-timezone') {
    const timezones = getTimeZones();
    fields.push({
      name: 'timezone',
      label: 'Timezone',
      type: 'select',
      options: timezones.map(timezone => ({
        value: timezone.id,
        label: timezone.label
      })),
      value: getFormDataField(formData, 'timezone') || timezoneId,
      required: true
    });
  } else if (action === 'change-theme') {
    fields.push({
      name: 'theme',
      label: '',
      type: 'hidden',
      value: getFormDataField(formData, 'theme') || theme || DEFAULT_THEME_ID,
      required: true
    }, {
      name: 'theme-overrides',
      label: '',
      type: 'hidden',
      overrideValue: JSON.stringify(themeOverrides || {})
    });
  }
  return fields;
}
function themePreviewTile(themeId, selectedTheme) {
  return html`
    <button
      type="button"
      data-theme="${themeId}"
      data-theme-color="${THEME_COLORS.get(themeId)}"
      aria-current="${themeId === selectedTheme ? 'true' : 'false'}"
      title="Preview the ${THEME_LABELS.get(themeId)} theme"
      class="flex aspect-5/4 w-full flex-col gap-2 rounded-xl border border-slate-600 bg-slate-800 p-2 text-left
        ring-accent aria-current:ring-2"
    >
      <span class="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-600">
        <span class="flex h-3 items-center justify-end px-1 theme-preview-chrome">
          <span class="h-1.5 w-1.5 rounded-full bg-accent"></span>
        </span>
        <span class="flex flex-1">
          <span class="w-1/4 theme-preview-chrome"></span>
          <span class="flex flex-1 flex-col gap-1 p-1 theme-preview-page">
            <span class="h-1.5 rounded bg-slate-700"></span>
            <span class="h-1.5 rounded bg-slate-700"></span>
            <span class="h-1.5 w-2/3 rounded bg-slate-700"></span>
          </span>
        </span>
      </span>
      <span class="truncate text-xs font-semibold text-white">${THEME_LABELS.get(themeId)}</span>
    </button>
  `;
}
function themeOverridePanel(themeOverrides) {
  const hasOverrides = Object.keys(themeOverrides).length > 0;
  return html`
    <details class="mb-8 px-4 max-w-3xl mx-auto lg:min-w-96" ${hasOverrides ? 'open' : ''}>
      <summary class="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-300">Custom colors</summary>
      <p class="mt-2 mb-4 text-sm text-slate-400">
        These are painted on top of the theme picked above, so they follow you from theme to theme until you reset them.
      </p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        ${THEME_OVERRIDE_FIELDS.map(field => html`
            <div>
              <label class="block text-sm text-slate-300" for="theme-override-${field.key}">${escapeHtml(field.label)}</label>
              <span class="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  id="theme-override-${field.key}"
                  data-override-key="${field.key}"
                  data-override-dirty="${themeOverrides[field.key] ? '1' : '0'}"
                  value="${themeOverrides[field.key] || '#000000'}"
                  class="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-600 bg-slate-700 p-1"
                />
                <input
                  type="text"
                  data-override-text="${field.key}"
                  value="${themeOverrides[field.key] || ''}"
                  placeholder="#000000"
                  maxlength="7"
                  spellcheck="false"
                  aria-label="${escapeHtml(field.label)} hex value"
                  class="input-field font-mono"
                />
              </span>
            </div>
          `).join('')}
      </div>
      <button class="button-secondary mt-4" type="button" id="reset-theme-overrides">Reset custom colors</button>
    </details>
  `;
}
export default function Settings({
  formData: formDataObject,
  error,
  notice,
  currency,
  timezoneId,
  theme,
  themeOverrides,
  isExpensesAppEnabled,
  isMultiFactorAuthEnabled,
  isCalendarAppEnabled,
  helpEmail,
  user
}) {
  const formData = convertObjectToFormData(formDataObject);
  const multiFactorAuthMethods = getEnabledMultiFactorAuthMethodsFromUser(user);
  const submittedTheme = getFormDataField(formData, 'theme');
  const selectedTheme = isThemeId(submittedTheme) ? submittedTheme : theme || DEFAULT_THEME_ID;
  const submittedThemeOverrides = getFormDataField(formData, 'theme-overrides');
  const selectedThemeOverrides = submittedThemeOverrides ? parseThemeOverrides(submittedThemeOverrides) : themeOverrides || {};
  const emailFormAction = notice?.title === 'Verify your email!' || getFormDataField(formData, 'action') === 'verify-change-email' && notice?.title !== 'Email updated!' ? 'verify-change-email' : 'change-email';
  return html`
    <section class="mx-auto max-w-7xl my-8">
      ${error ? html`
          <section class="notification-error">
            <h3>${escapeHtml(error.title)}</h3>
            <p>${escapeHtml(error.message)}</p>
          </section>
        ` : ''} ${notice ? html`
          <section class="notification-success">
            <h3>${escapeHtml(notice.title)}</h3>
            <p>${escapeHtml(notice.message)}</p>
          </section>
        ` : ''}

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your theme</h2>
      <p class="text-left mt-2 mb-6 px-4 max-w-3xl mx-auto lg:min-w-96">
        Picking a theme previews it across the whole page. Apply saves it everywhere you're signed in.
      </p>

      <form method="POST" class="mb-12" id="change-theme-form">
        ${formFields('change-theme', formData, currency, timezoneId, theme, selectedThemeOverrides).map(field => generateFieldHtml(field, formData)).join('')}
        ${THEME_GROUPS.map(group => html`
            <h3 class="mb-3 px-4 max-w-3xl mx-auto text-sm font-semibold uppercase tracking-wide text-slate-300
              lg:min-w-96">${group.label}</h3>
            <div class="grid grid-cols-2 gap-4 mb-8 px-4 max-w-3xl mx-auto sm:grid-cols-4 lg:min-w-96">
              ${group.themeIds.map(themeId => themePreviewTile(themeId, selectedTheme)).join('')}
            </div>
          `).join('')} ${themeOverridePanel(selectedThemeOverrides)}
        <section class="flex justify-end mt-8 mb-4 px-4 max-w-3xl mx-auto lg:min-w-96">
          <button class="button" type="submit">Apply</button>
        </section>
      </form>

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your email</h2>

      <form method="POST" class="mb-12">
        ${formFields(emailFormAction, formData).map(field => generateFieldHtml(field, formData)).join('')}
        <section class="flex justify-end ${emailFormAction === 'verify-change-email' ? 'gap-8' : 'gap-2'} mt-8 mb-4">
          ${emailFormAction === 'verify-change-email' ? html`
              <button class="button" type="submit">Verify email</button>
              <button class="button-secondary order-first" type="submit" name="request-new-code" value="1"
                formnovalidate>Request new code</button>
            ` : html`
              <button class="button-secondary" type="submit">Change email</button>
            `}
        </section>
      </form>

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your password</h2>

      <form method="POST" class="mb-12">
        ${formFields('change-password', formData).map(field => generateFieldHtml(field, formData)).join('')}
        <section class="flex justify-end mt-8 mb-4">
          <button class="button-secondary" type="submit">Change password</button>
        </section>
      </form>

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your WebDav password</h2>

      <form method="POST" class="mb-12">
        ${formFields('change-dav-password', formData).map(field => generateFieldHtml(field, formData)).join('')}
        <section class="flex justify-end mt-8 mb-4">
          <button class="button-secondary" type="submit">Change WebDav password</button>
        </section>
      </form>

      ${isExpensesAppEnabled ? html`
          <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your currency</h2>
          <p class="text-left mt-2 mb-6 px-4 max-w-3xl mx-auto lg:min-w-96">
            This is only used in the expenses app, visually. It changes nothing about the stored data or values.
          </p>

          <form method="POST" class="mb-12">
            ${formFields('change-currency', formData, currency, timezoneId).map(field => generateFieldHtml(field, formData)).join('')}
            <section class="flex justify-end mt-8 mb-4">
              <button class="button-secondary" type="submit">Change currency</button>
            </section>
          </form>
        ` : ''} ${isCalendarAppEnabled ? html`
          <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your timezone</h2>
          <p class="text-left mt-2 mb-6 px-4 max-w-3xl mx-auto lg:min-w-96">
            This is only used in the calendar app.
          </p>

          <form method="POST" class="mb-12">
            ${formFields('change-timezone', formData, currency, timezoneId).map(field => generateFieldHtml(field, formData)).join('')}
            <section class="flex justify-end mt-8 mb-4">
              <button class="button-secondary" type="submit">Change timezone</button>
            </section>
          </form>
        ` : ''} ${isMultiFactorAuthEnabled ? html`
          <section id="multi-factor-auth-settings">
            ${Loading()}
          </section>
        ` : ''}

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Delete your account</h2>
      <p class="text-left mt-2 mb-6 px-4 max-w-3xl mx-auto lg:min-w-96">
        Deleting your account is instant and deletes all your data. ${helpEmail !== '' ? html`
            If you need help, please <a href="${`mailto:${helpEmail}`}">reach out</a>.
          ` : ''}
      </p>

      <form method="POST" class="mb-12">
        ${formFields('delete-account', formData).map(field => generateFieldHtml(field, formData)).join('')}
        <section class="flex justify-end mt-8 mb-4">
          <button class="button-danger" type="submit">Delete account</button>
        </section>
      </form>
    </section>

    <script>
    const themeForm = document.getElementById('change-theme-form');
    const themeInput = themeForm?.querySelector('[name="theme"]');
    const themeOverridesInput = themeForm?.querySelector('[name="theme-overrides"]');
    const themeOverrideFields = ${JSON.stringify(THEME_OVERRIDE_FIELDS)};
    const hexColorPattern = /^#[0-9a-f]{6}$/i;

    // The probe inherits the theme variables from <html>, so it resolves whatever the page is currently painting
    const colorProbe = document.createElement('span');
    colorProbe.style.display = 'none';
    themeForm?.appendChild(colorProbe);

    function toHexColor(cssVariable) {
      // A computed colour keeps the space it was authored in, so the mix into sRGB is what turns Tailwind's oklch defaults into channels a colour input can take
      colorProbe.style.color = 'color-mix(in srgb, var(' + cssVariable + ') 100%, transparent)';

      const computedColor = getComputedStyle(colorProbe).color;
      const channels = (computedColor.match(/[0-9.]+/g) || []).slice(0, 3);

      if (channels.length < 3) {
        return '#000000';
      }

      // color(srgb ...) counts each channel from 0 to 1, rgb() from 0 to 255. A colour outside the sRGB gamut lands past either end, so it's clipped rather than rendered as a fourth hex digit.
      const scale = computedColor.startsWith('color(') ? 255 : 1;

      return '#' + channels.map((channel) =>
        Math.min(255, Math.max(0, Math.round(Number(channel) * scale))).toString(16).padStart(2, '0')
      ).join('');
    }

    function overrideColorInput(key) {
      return themeForm.querySelector('[data-override-key="' + key + '"]');
    }

    function overrideTextInput(key) {
      return themeForm.querySelector('[data-override-text="' + key + '"]');
    }

    // Untouched fields mirror whatever the theme on screen is painting, so they're a starting point instead of a black swatch
    function seedThemeOverrideInputs() {
      for (const field of themeOverrideFields) {
        const colorInput = overrideColorInput(field.key);

        if (colorInput.dataset.overrideDirty === '1') {
          continue;
        }

        const hexColor = toHexColor(field.cssVariable);

        colorInput.value = hexColor;
        overrideTextInput(field.key).value = '';
        overrideTextInput(field.key).placeholder = hexColor;
      }
    }

    function applyThemeOverrides() {
      const overrides = {};
      const style = document.documentElement.style;

      for (const field of themeOverrideFields) {
        const colorInput = overrideColorInput(field.key);

        if (colorInput.dataset.overrideDirty !== '1') {
          if (!field.gradient) {
            style.removeProperty(field.cssVariable);
          }

          continue;
        }

        overrides[field.key] = colorInput.value;

        if (!field.gradient) {
          style.setProperty(field.cssVariable, colorInput.value);
        }
      }

      for (const gradient of ['chrome', 'page']) {
        const start = overrides[gradient + '-gradient-start'];
        const end = overrides[gradient + '-gradient-end'];
        const angle = gradient === 'chrome' ? '160deg' : '180deg';

        if (start && end) {
          style.setProperty(
            '--theme-' + gradient + '-gradient',
            'linear-gradient(' + angle + ', ' + start + ' 0%, ' + end + ' 100%)',
          );
        } else {
          style.removeProperty('--theme-' + gradient + '-gradient');
        }
      }

      themeOverridesInput.value = JSON.stringify(overrides);
    }

    themeForm?.addEventListener('click', (event) => {
      const tile = event.target.closest('[data-theme]');

      // Every tile carries data-theme and so does <html>, so a click on the form's own padding would otherwise match the document
      if (!tile || !themeForm.contains(tile)) {
        return;
      }

      // Themes are plain CSS variable overrides, so previewing one is a single attribute write. Apply is what persists it.
      document.documentElement.dataset.theme = tile.dataset.theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tile.dataset.themeColor);
      themeInput.value = tile.dataset.theme;

      for (const otherTile of themeForm.querySelectorAll('[data-theme]')) {
        otherTile.setAttribute('aria-current', String(otherTile === tile));
      }

      seedThemeOverrideInputs();
    });

    themeForm?.addEventListener('input', (event) => {
      const key = event.target.dataset.overrideKey || event.target.dataset.overrideText;

      if (!key) {
        return;
      }

      const value = event.target.value.trim();

      // Typing a hex is a per-character event, so anything half-written is simply ignored until it's a colour
      if (!hexColorPattern.test(value)) {
        return;
      }

      const editedField = themeOverrideFields.find((field) => field.key === key);

      overrideColorInput(key).value = value;

      for (const field of themeOverrideFields) {
        // A single gradient stop paints nothing, so its partner is taken over at the same time
        if (field.key !== key && !(editedField.gradient && field.gradient === editedField.gradient)) {
          continue;
        }

        const colorInput = overrideColorInput(field.key);
        const textInput = overrideTextInput(field.key);

        colorInput.dataset.overrideDirty = '1';

        // Writing back into the field being typed in would fight the caret
        if (textInput !== event.target) {
          textInput.value = colorInput.value;
        }
      }

      applyThemeOverrides();
    });

    document.getElementById('reset-theme-overrides')?.addEventListener('click', () => {
      for (const field of themeOverrideFields) {
        overrideColorInput(field.key).dataset.overrideDirty = '0';
      }

      applyThemeOverrides();
      seedThemeOverrideInputs();
    });

    if (themeForm) {
      seedThemeOverrideInputs();
    }
    </script>

    <script type="module">
    import { h, render } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;

    import MultiFactorAuthSettings from '/public/components/auth/MultiFactorAuthSettings.js';

    const multiFactorAuthSettingsElement = document.getElementById('multi-factor-auth-settings');

    if (multiFactorAuthSettingsElement) {
      const multiFactorAuthSettingsApp = h(MultiFactorAuthSettings, {
        methods: ${JSON.stringify(multiFactorAuthMethods.map(method => ({
    type: method.type,
    id: method.id,
    name: method.name,
    enabled: method.enabled,
    backupCodesCount: method.metadata.totp?.hashed_backup_codes?.length
  })))},
      });

      render(multiFactorAuthSettingsApp, multiFactorAuthSettingsElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}