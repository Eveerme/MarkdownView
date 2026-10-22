import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  normalizeSettings,
  readSettings,
  writeSettings,
} from "#src/lib/settings.ts";
import type { AppSettings } from "#src/lib/settings.ts";

interface SettingsStore {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsStore | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(readSettings);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = normalizeSettings({ ...current, ...patch });

      writeSettings(next);

      return next;
    });
  }, []);

  const store = useMemo(() => ({ settings, update }), [settings, update]);

  return (
    <SettingsContext.Provider value={store}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsStore => {
  const store = useContext(SettingsContext);

  if (store === null) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }

  return store;
};
