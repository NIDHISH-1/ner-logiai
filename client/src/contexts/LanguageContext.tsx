import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  type SupportedLanguage,
  localizeAlert as sharedLocalizeAlert,
  formatActionableDriverAlert as sharedFormatDriverAlert,
  FIELD_UI_LABELS,
} from "@shared/i18n";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
  localizeAlert: typeof sharedLocalizeAlert;
  formatActionableDriverAlert: typeof sharedFormatDriverAlert;
}

const STORAGE_KEY = "ner-logiai.lang";

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => (FIELD_UI_LABELS.en as any)[key] ?? key,
  localizeAlert: sharedLocalizeAlert,
  formatActionableDriverAlert: sharedFormatDriverAlert,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (saved === "en" || saved === "hi" || saved === "as") return saved;
    }
    return "en";
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = (key: string): string => {
    return (FIELD_UI_LABELS[language] as any)[key] ?? (FIELD_UI_LABELS.en as any)[key] ?? key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        localizeAlert: sharedLocalizeAlert,
        formatActionableDriverAlert: sharedFormatDriverAlert,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
