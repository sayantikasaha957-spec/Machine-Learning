import { create } from 'zustand';
import { BackendHealth } from '../types';

export type TimeRange = '1h' | '6h' | '24h' | '48h';

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;

  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;

  showForecast: boolean;
  toggleShowForecast: () => void;

  activePatientId: number;
  setActivePatientId: (id: number) => void;

  backendHealth: BackendHealth | null;
  setBackendHealth: (health: BackendHealth | null) => void;
}

// Initial dark mode read from localStorage or system preference
const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('vitalsync_theme');
  if (stored) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const useAppStore = create<AppState>((set) => {
  const initialDark = getInitialDarkMode();
  if (typeof document !== 'undefined') {
    if (initialDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  return {
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    darkMode: initialDark,
    toggleDarkMode: () =>
      set((state) => {
        const next = !state.darkMode;
        if (typeof document !== 'undefined') {
          if (next) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('vitalsync_theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('vitalsync_theme', 'light');
          }
        }
        return { darkMode: next };
      }),
    setDarkMode: (dark) => {
      if (typeof document !== 'undefined') {
        if (dark) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('vitalsync_theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('vitalsync_theme', 'light');
        }
      }
      set({ darkMode: dark });
    },

    timeRange: '24h',
    setTimeRange: (range) => set({ timeRange: range }),

    showForecast: true,
    toggleShowForecast: () => set((state) => ({ showForecast: !state.showForecast })),

    activePatientId: 1,
    setActivePatientId: (id) => set({ activePatientId: id }),

    backendHealth: null,
    setBackendHealth: (health) => set({ backendHealth: health }),
  };
});
