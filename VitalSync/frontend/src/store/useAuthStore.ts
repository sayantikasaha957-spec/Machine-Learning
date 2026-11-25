import { create } from 'zustand';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('vitalsync_token'),
  isAuthenticated: !!localStorage.getItem('vitalsync_token'),
  isLoading: true,
  role: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await api.login({ email, password });
      set({
        token: res.access_token,
        isAuthenticated: true,
        role: res.role,
        user: {
          id: res.user_id,
          email: res.email,
          full_name: res.full_name,
          role: res.role,
          is_active: true,
          created_at: new Date().toISOString(),
        },
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } finally {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        role: null,
        isLoading: false,
      });
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('vitalsync_token');
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false, role: null });
      return;
    }

    try {
      const user = await api.getMe();
      set({
        user,
        token,
        isAuthenticated: true,
        role: user.role,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem('vitalsync_token');
      localStorage.removeItem('vitalsync_user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        role: null,
        isLoading: false,
      });
    }
  },

  setUser: (user) => set({ user, role: user?.role || null, isAuthenticated: !!user }),
}));

// Listen for unauthorized events dispatched by api client
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().setUser(null);
  });
}
