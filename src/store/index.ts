import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ConnectAccount,
  EmbyServer,
  EmbySession,
  EmbyUser,
  KnownUser,
  ServerLoginRecord,
} from '../types/emby';
import { UpdateInfo } from '../services/updateCheck';
import { logger } from '../services/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Store {
  // Persisted
  server:             EmbyServer | null;
  authToken:          string | null;
  currentUser:        EmbyUser | null;
  savedServers:       EmbyServer[];
  serverCredentials:  Record<string, ServerLoginRecord>;
  connectAccount:     ConnectAccount | null;

  // Runtime
  hydrated:       boolean;
  controlsLocked: boolean;
  sessions:       EmbySession[];
  updateInfo:     UpdateInfo | null;

  setUpdateInfo:          (info: UpdateInfo | null) => void;
  ignoredUpdateVersion:   string | null;
  setIgnoredUpdateVersion:(version: string | null) => void;

  // Actions
  setServer:          (server: EmbyServer) => void;
  setAuth:            (token: string, user: EmbyUser, method: 'connect' | 'local') => void;
  clearAuth:          () => void;
  addSavedServer:     (server: EmbyServer) => void;
  removeSavedServer:  (id: string) => void;
  switchToServer:     (server: EmbyServer) => ServerLoginRecord | null;
  clearSession:       () => void;
  setControlsLocked:  (locked: boolean) => void;
  setConnectAccount:  (account: ConnectAccount | null) => void;
  setSessions:        (sessions: EmbySession[]) => void;
  hydrate:            () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'emby_kiosk_state_v2';

function upsertKnownUser(record: ServerLoginRecord, user: KnownUser): ServerLoginRecord {
  const others = record.knownUsers.filter((u) => u.userId !== user.userId);
  return { ...record, knownUsers: [user, ...others] };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<Store>((set, get) => ({
  server:            null,
  authToken:         null,
  currentUser:       null,
  savedServers:      [],
  serverCredentials: {},
  connectAccount:    null,
  hydrated:             false,
  controlsLocked:       false,
  sessions:             [],
  updateInfo:           null,
  ignoredUpdateVersion: null,

  setServer: (server) => {
    set({ server });
    persist(get());
  },

  setAuth: (token, user, method) => {
    const server = get().server;
    if (!server) return;

    const knownUser: KnownUser = {
      userId:      user.Id,
      username:    user.Name,
      token,
      loginMethod: method,
      lastLoginAt: new Date().toISOString(),
    };

    const existing = get().serverCredentials[server.id] ?? {
      active:     null,
      knownUsers: [],
    };

    const updated = upsertKnownUser(existing, knownUser);
    updated.active = knownUser;

    set({
      authToken:   token,
      currentUser: user,
      serverCredentials: {
        ...get().serverCredentials,
        [server.id]: updated,
      },
    });
    persist(get());
  },

  clearAuth: () => {
    const server = get().server;
    if (!server) return;

    const existing = get().serverCredentials[server.id];
    if (existing) {
      set({
        authToken:   null,
        currentUser: null,
        serverCredentials: {
          ...get().serverCredentials,
          [server.id]: { ...existing, active: null },
        },
      });
    } else {
      set({ authToken: null, currentUser: null });
    }
    persist(get());
  },

  clearSession: () => {
    set({ server: null, authToken: null, currentUser: null });
    persist(get());
  },

  switchToServer: (server) => {
    const record = get().serverCredentials[server.id] ?? null;
    set({
      server,
      authToken:   record?.active?.token   ?? null,
      currentUser: record?.active ? {
        Id:              record.active.userId,
        Name:            record.active.username,
        ServerId:        server.id,
        HasPassword:     true,
        PrimaryImageTag: undefined,
      } : null,
    });
    persist(get());
    return record;
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

  setControlsLocked: (locked) => {
    set({ controlsLocked: locked });
    persist(get());
  },

  setConnectAccount: (account) => {
    set({ connectAccount: account });
    persist(get());
  },

  setSessions: (sessions) => {
    set({ sessions });
  },

  setUpdateInfo: (info) => {
    set({ updateInfo: info });
  },

  setIgnoredUpdateVersion: (version) => {
    set({ ignoredUpdateVersion: version });
    persist(get());
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        set({
          server:            saved.server            ?? null,
          authToken:         saved.authToken         ?? null,
          currentUser:       saved.currentUser       ?? null,
          savedServers:      saved.savedServers      ?? [],
          serverCredentials: saved.serverCredentials ?? {},
          connectAccount:        saved.connectAccount        ?? null,
          controlsLocked:        saved.controlsLocked        ?? false,
          ignoredUpdateVersion:  saved.ignoredUpdateVersion  ?? null,
        });
      }
    } catch (e) {
      logger.warn('Failed to hydrate store:', e);
    } finally {
      set({ hydrated: true });
    }
  },
}));

function persist(state: Store) {
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      server:            state.server,
      authToken:         state.authToken,
      currentUser:       state.currentUser,
      savedServers:      state.savedServers,
      serverCredentials: state.serverCredentials,
      connectAccount:       state.connectAccount,
      controlsLocked:       state.controlsLocked,
      ignoredUpdateVersion: state.ignoredUpdateVersion,
    })
  ).catch(() => {});
}
