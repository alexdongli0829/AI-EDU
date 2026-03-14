'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en, { Translations } from './en';
import zh from './zh';

export type Lang = 'en' | 'zh';

const translations: Record<Lang, Translations> = { en, zh };

interface I18nContext {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const I18nCtx = createContext<I18nContext>({
  lang: 'en',
  setLang: () => {},
  t: en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('edulens-lang') as Lang | null;
    if (saved && translations[saved]) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('edulens-lang', l);
  };

  return (
    <I18nCtx.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n() {
  return useContext(I18nCtx);
}

export { type Translations };
