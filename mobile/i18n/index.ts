import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import en from './locales/en';
import pt from './locales/pt';

export const SUPPORTED_LOCALES = ['en', 'pt'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const i18n = new I18n({ en, pt });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

const device = getLocales()[0]?.languageCode ?? 'en';
i18n.locale = (SUPPORTED_LOCALES as readonly string[]).includes(device) ? device : 'en';

export const t = (scope: string, options?: Record<string, unknown>): string =>
  i18n.t(scope, options);

export function setLocale(locale: Locale) {
  i18n.locale = locale;
}

export function getLocale(): string {
  return i18n.locale;
}
