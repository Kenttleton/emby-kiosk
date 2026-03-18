import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmbyServer, EmbyUser } from '../types/emby';

interface ServerCreds {
  token: string;
  user: EmbyUser;
}

interface Store {
  // Persisted
  server: EmbyServer | null;
  authToken: string | null;
  currentUser: EmbyUser | null;
  savedServers: EmbyServer[];
  serverCredentials: Record<string, ServerCreds>; // keyed by server.id

  // Runtime
  hydrated: boolean;
  controlsLocked: boolean;

  // Actions
  setServer: (server: EmbyServer) => void;
  setAuth: (token: string, user: EmbyUser) => void;
  clearAuth: () => void;
  addSavedServer: (server: EmbyServer) => void;
  removeSavedServer: (id: string) => void;
  switchToServer: (server: EmbyServer) => ServerCreds | null;
  clearSession: () => void;
  setControlsLocked: (locked: boolean) => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'emby_kiosk_state';

export const useStore = create<Store>((set, get) => ({
  server: null,
  authToken: null,
  currentUser: null,
  savedServers: [],
  serverCredentials: {},
  hydrated: false,
  controlsLocked: false,

  setServer: (server) => {
    set({ server });
    persist(get());
  },

  setAuth: (authToken, currentUser) => {
    const server = get().server;
    const updated = { ...get().serverCredentials };
    if (server) updated[server.id] = { token: authToken, user: currentUser };
    set({ authToken, currentUser, serverCredentials: updated });
    persist(get());
  },

  clearAuth: () => {
    const server = get().server;
    const updated = { ...get().serverCredentials };
    if (server) delete updated[server.id];
    set({ authToken: null, currentUser: null, serverCredentials: updated });
    persist(get());
  },

  // Clears the active session without touching stored credentials.
  clearSession: () => {
    set({ server: null, authToken: null, currentUser: null });
    persist(get());
  },

  // Sets the active server and loads stored creds if available. Returns creds or null.
  switchToServer: (server) => {
    const creds = get().serverCredentials[server.id] ?? null;
    set({
      server,
      authToken: creds?.token ?? null,
      currentUser: creds?.user ?? null,
    });
    persist(get());
    return creds;
  },

  setControlsLocked: (locked) => {
    set({ controlsLocked: locked });
    persist(get());
  },

  addSavedServer: (server) => {
    const existing = get().savedServers;
    const updated = existing.some((s) => s.id === server.id)
      ? existing.map((s) => (s.id === server.id ? server : s))
      : [...existing, server];
    set({ savedServers: updated });
    persist(get());
  },

  removeSavedServer: (id) => {
    set({ savedServers: get().savedServers.filter((s) => s.id !== id) });
    persist(get());
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        set({
          server: saved.server ?? null,
          authToken: saved.authToken ?? null,
          currentUser: saved.currentUser ?? null,
          savedServers: saved.savedServers ?? [],
          serverCredentials: saved.serverCredentials ?? {},
          controlsLocked: saved.controlsLocked ?? false,
        });
      }
    } catch (e) {
      console.warn('Failed to hydrate store:', e);
    } finally {
      set({ hydrated: true });
    }
  },
}));

function persist(state: Store) {
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      server: state.server,
      authToken: state.authToken,
      currentUser: state.currentUser,
      savedServers: state.savedServers,
      serverCredentials: state.serverCredentials,
      controlsLocked: state.controlsLocked,
    })
  ).catch(() => {});
}
