import { useEffect, useState } from "react";

const STORAGE_KEY = "appSettings";
const EVENT_NAME = "settingschange";

export const SORT_OPTIONS = [
  { value: "area", label: "Area" },
  { value: "category", label: "Category" },
  { value: "alpha", label: "Alphabetical" },
  { value: "date", label: "Date added" },
  { value: "priority", label: "Priority" },
  { value: "custom", label: "Custom order" },
];

export interface Settings {
  themeMode: "system" | "light" | "dark";
  accentColor: string;
  defaultSort: string;
  defaultAreaId: number | string | null;
  compactMode: boolean;
  animationsEnabled: boolean;
}

const DEFAULTS: Settings = {
  themeMode: "system",
  accentColor: "#2E7D5A",
  defaultSort: "area",
  defaultAreaId: null,
  compactMode: false,
  animationsEnabled: true,
};

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(partial: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<Settings>(EVENT_NAME, { detail: next }));
  return next;
}

// Reactive access — any component using this re-renders when settings
// change anywhere else in the app (e.g. Settings.jsx writes, List.jsx reads).
export function useSettings(): [Settings, (partial: Partial<Settings>) => Settings] {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    const handler = (event: Event) => setSettings((event as CustomEvent<Settings>).detail);
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);
  return [settings, saveSettings];
}
