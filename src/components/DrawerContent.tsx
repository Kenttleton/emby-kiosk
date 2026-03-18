import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { searchItems } from '../services/embyApi';
import { EmbyItem, EmbySession } from '../types/emby';
import { SearchResultRow } from './SearchResultRow';

export function DrawerContent({
  username, serverName, serverVersion, connected, sessions, server, authToken, currentUser,
  controlsLocked, onToggleLock, onLogout, onSwitchServer, onClose, onPlay,
}: {
  username?: string;
  serverName?: string;
  serverVersion?: string;
  connected: boolean;
  sessions: EmbySession[];
  server: any;
  authToken: string | null;
  currentUser: any;
  controlsLocked: boolean;
  onToggleLock: () => void;
  onLogout: () => void;
  onSwitchServer: () => void;
  onClose: () => void;
  onPlay: (item: EmbyItem, sessionId: string, startPositionTicks?: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmbyItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [targetDeviceId, setTargetDeviceId] = useState<string | null>(null);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Exclude our own kiosk device and any session that explicitly declares no playable media types
  const playableSessions = sessions.filter((s) => {
    if (s.Client === 'EmbyKiosk') return false;
    const types = s.Capabilities?.PlayableMediaTypes;
    if (!types) return true;
    return types.some((t) => t === 'Audio' || t === 'Video');
  });

  const duplicateClientDevice = new Set(
    playableSessions
      .map((s) => `${s.Client}|${s.DeviceName}`)
      .filter((key, _, arr) => arr.indexOf(key) !== arr.lastIndexOf(key))
  );

  // Track identity by DeviceId (stable across polls); resolve current session Id at send time
  const activeDeviceId = targetDeviceId ?? playableSessions[0]?.DeviceId ?? null;
  const activeSession = playableSessions.find((s) => s.DeviceId === activeDeviceId);
  const activeSessionId = activeSession?.Id ?? null;

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      if (!server || !authToken || !currentUser) return;
      setSearchLoading(true);
      try {
        const res = await searchItems(server.address, authToken, currentUser.Id, searchQuery);
        setSearchResults(res.Items);
      } catch { }
      finally { setSearchLoading(false); }
    }, 500);
  }, [searchQuery]);

  return (
    <View style={[styles.drawerInner, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.drawerHeader}>
        <View style={styles.drawerUserBlock}>
          <View style={styles.drawerAvatar}>
            <Ionicons name="person" size={22} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.drawerUsername} numberOfLines={1}>{username ?? 'User'}</Text>
            <View style={styles.drawerServerRow}>
              <View style={[styles.onlineDot, { backgroundColor: connected ? Colors.green : Colors.yellow }]} />
              <Text style={styles.drawerServerName} numberOfLines={1}>{serverName}</Text>
            </View>
          </View>
        </View>
        <Pressable style={styles.drawerCloseBtn} onPress={onClose}>
          <Ionicons name="close" size={22} color={Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.drawerDivider} />

      {/* Body */}
      <ScrollView style={styles.drawerBody} keyboardShouldPersistTaps="handled">
        <View style={styles.sendPanel}>
          <Text style={styles.sendPanelLabel}>SEND TO DEVICE</Text>

          {playableSessions.length > 1 ? (
            <View style={styles.deviceSelector}>
              <Pressable style={styles.deviceRow} onPress={() => setDevicePickerOpen((v) => !v)}>
                <Ionicons name="tv-outline" size={16} color={Colors.textMuted} />
                <View style={styles.deviceRowMeta}>
                  <Text style={styles.deviceRowLabel}>Target device</Text>
                  <Text style={styles.deviceRowName} numberOfLines={1}>
                    {activeSession
                      ? `${activeSession.Client} · ${activeSession.DeviceName}${duplicateClientDevice.has(`${activeSession.Client}|${activeSession.DeviceName}`) ? ` · ${activeSession.DeviceId.slice(-8)}` : ''}`
                      : 'Select device'}
                  </Text>
                </View>
                <Ionicons name={devicePickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
              </Pressable>
              {devicePickerOpen && (
                <View style={styles.deviceList}>
                  {playableSessions.map((s) => {
                    const selected = s.DeviceId === activeDeviceId;
                    return (
                      <Pressable
                        key={s.DeviceId}
                        style={styles.deviceListItem}
                        onPress={() => { setTargetDeviceId(s.DeviceId); setDevicePickerOpen(false); }}
                      >
                        <Ionicons name={s.NowPlayingItem ? 'play-circle-outline' : 'tv-outline'} size={16} color={selected ? Colors.accent : Colors.textMuted} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.deviceListName, selected && styles.deviceListNameActive]} numberOfLines={1}>{s.Client}</Text>
                          <Text style={styles.deviceListClient} numberOfLines={1}>
                            {s.DeviceName}{duplicateClientDevice.has(`${s.Client}|${s.DeviceName}`) ? ` · ${s.DeviceId.slice(-8)}` : ''}
                          </Text>
                        </View>
                        {selected && <Ionicons name="checkmark" size={16} color={Colors.accent} style={{ marginLeft: 'auto' }} />}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : playableSessions.length === 1 ? (
            <View style={styles.singleDevice}>
              <Ionicons name="tv-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.singleDeviceName}>{sessions[0].DeviceName}</Text>
            </View>
          ) : null}

          <View style={styles.panelDivider} />

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Movies, shows, episodes…"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchLoading && <ActivityIndicator size="small" color={Colors.accent} />}
            {searchQuery.length > 0 && !searchLoading && (
              <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {searchResults.length > 0 && (
          <FlatList
            data={searchResults}
            keyExtractor={(i) => i.Id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <SearchResultRow
                item={item}
                serverAddress={server?.address ?? ''}
                onPlay={() => onPlay(item, activeSessionId ?? '', 0)}
                onResume={
                  (item.UserData?.PlaybackPositionTicks ?? 0) > 0
                    ? () => onPlay(item, activeSessionId ?? '', item.UserData!.PlaybackPositionTicks)
                    : undefined
                }
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
          />
        )}

        {searchQuery.length > 0 && !searchLoading && searchResults.length === 0 && (
          <Text style={styles.noResults}>No results for "{searchQuery}"</Text>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.drawerFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.drawerDivider} />
        {serverVersion && <Text style={styles.footerMeta}>{serverName} · v{serverVersion}</Text>}
        <Pressable style={styles.footerRow} onPress={onToggleLock}>
          <Ionicons
            name={controlsLocked ? 'lock-closed' : 'lock-open-outline'}
            size={18}
            color={controlsLocked ? Colors.yellow : Colors.textSecondary}
          />
          <Text style={[styles.footerRowText, controlsLocked && { color: Colors.yellow }]}>
            {controlsLocked ? 'Unlock controls' : 'Lock controls'}
          </Text>
        </Pressable>
        <Pressable style={styles.footerRow} onPress={onSwitchServer}>
          <Ionicons name="swap-horizontal-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.footerRowText}>Switch server</Text>
        </Pressable>
        <Pressable style={styles.footerRow} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.red} />
          <Text style={[styles.footerRowText, { color: Colors.red }]}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  drawerInner: { flex: 1 },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  drawerUserBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  drawerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  drawerUsername: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  drawerServerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  drawerServerName: { color: Colors.textMuted, fontSize: 12 },
  drawerCloseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  drawerDivider: { height: 1, backgroundColor: Colors.border },
  drawerBody: { flex: 1 },

  sendPanel: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.lg,
    margin: Spacing.md, overflow: 'hidden',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md,
  },
  sendPanelLabel: { ...Typography.label, marginBottom: Spacing.sm },
  singleDevice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  singleDeviceName: { color: Colors.textSecondary, fontSize: 14 },
  panelDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  deviceSelector: { marginBottom: Spacing.xs },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10 },
  deviceRowMeta: { flex: 1 },
  deviceRowLabel: { color: Colors.textMuted, fontSize: 11, marginBottom: 1 },
  deviceRowName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  deviceList: {
    marginBottom: Spacing.xs, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  deviceListItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  deviceListName: { color: Colors.textSecondary, fontSize: 14 },
  deviceListNameActive: { color: Colors.accent, fontWeight: '600' },
  deviceListClient: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },

  searchBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15 },

  divider: { height: 1, backgroundColor: Colors.border },
  noResults: { ...Typography.caption, textAlign: 'center', padding: Spacing.sm },

  drawerFooter: { paddingHorizontal: Spacing.md },
  footerMeta: { color: Colors.textMuted, fontSize: 11, paddingVertical: Spacing.sm },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 2 },
  footerRowText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '500' },
});
