import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import { useStore } from '../src/store';
import { searchItems } from '../src/services/embyApi';
import { remotePlay } from '../src/services/embyApi';
import { EmbyItem, EmbySession } from '../src/types/emby';
import { SearchResultRow } from '../src/components/SearchResultRow';
import { useEmbySocket } from '../src/hooks/useEmbySocket';
import { InfoModal } from '../src/components/InfoModal';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { server, authToken, currentUser } = useStore();

  const { sessions } = useEmbySocket(server?.address ?? null, authToken);

  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<EmbyItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [targetDeviceId, setTargetDeviceId]   = useState<string | null>(null);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Exclude our own kiosk device and sessions with no playable media types
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

  const activeDeviceId  = targetDeviceId ?? playableSessions[0]?.DeviceId ?? null;
  const activeSession   = playableSessions.find((s) => s.DeviceId === activeDeviceId);
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

  const handlePlay = async (item: EmbyItem, startPositionTicks = 0) => {
    if (!server || !authToken || !activeSessionId) {
      setErrorMessage('No target device available. Make sure a compatible device is active.');
      return;
    }
    try {
      await remotePlay(server.address, authToken, activeSessionId, {
        ItemIds: [item.Id], PlayCommand: 'PlayNow', StartPositionTicks: startPositionTicks,
      });
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Playback failed.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top }]}>

        <InfoModal variant="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />

        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Search &amp; Play</Text>
        </View>

        {/* Device selector */}
        {playableSessions.length > 1 ? (
          <View style={[styles.deviceSelector, { marginHorizontal: Spacing.md }]}>
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
                      {selected && <Ionicons name="checkmark" size={16} color={Colors.accent} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : playableSessions.length === 1 ? (
          <View style={[styles.singleDevice, { marginHorizontal: Spacing.md }]}>
            <Ionicons name="tv-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.singleDeviceName}>{playableSessions[0].DeviceName}</Text>
          </View>
        ) : (
          <View style={[styles.noDeviceRow, { marginHorizontal: Spacing.md }]}>
            <Ionicons name="warning-outline" size={14} color={Colors.yellow} />
            <Text style={styles.noDeviceText}>No playable devices found. Open a media player to send content.</Text>
          </View>
        )}

        {/* Search bar */}
        <View style={[styles.searchBar, { marginHorizontal: Spacing.md }]}>
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
            autoFocus
          />
          {searchLoading && <ActivityIndicator size="small" color={Colors.accent} />}
          {searchQuery.length > 0 && !searchLoading && (
            <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Results */}
        <FlatList
          data={searchResults}
          keyExtractor={(i) => i.Id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <SearchResultRow
              item={item}
              serverAddress={server?.address ?? ''}
              onPlay={() => handlePlay(item, 0)}
              onResume={
                (item.UserData?.PlaybackPositionTicks ?? 0) > 0
                  ? () => handlePlay(item, item.UserData!.PlaybackPositionTicks)
                  : undefined
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={
            searchQuery.length > 0 && !searchLoading ? (
              <Text style={styles.noResults}>No results for "{searchQuery}"</Text>
            ) : null
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },

  deviceSelector: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.lg,
    marginBottom: Spacing.sm, overflow: 'hidden',
    paddingHorizontal: Spacing.md,
  },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 12 },
  deviceRowMeta: { flex: 1 },
  deviceRowLabel: { color: Colors.textMuted, fontSize: 11, marginBottom: 1 },
  deviceRowName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  deviceList: {
    marginBottom: Spacing.sm, backgroundColor: Colors.bgCard,
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

  singleDevice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginBottom: Spacing.sm },
  singleDeviceName: { color: Colors.textSecondary, fontSize: 14 },

  noDeviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginBottom: Spacing.sm },
  noDeviceText: { ...Typography.caption, flex: 1 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgElevated, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15 },

  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  divider: { height: 1, backgroundColor: Colors.border },
  noResults: { ...Typography.caption, textAlign: 'center', padding: Spacing.md },
});
