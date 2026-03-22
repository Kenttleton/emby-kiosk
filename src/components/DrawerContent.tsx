import React, { useState } from 'react';
import Constants from 'expo-constants';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { EmbySession } from '../types/emby';
import { downloadAndInstallApk } from '../services/updateCheck';
import { useStore } from '../store';

// ─── Action Card ──────────────────────────────────────────────────────────────

function ActionCard({
  icon, iconBg, iconColor, title, subtitle, onPress, danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.cardIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, danger && { color: Colors.red }]} numberOfLines={1}>{title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

// ─── DrawerContent ────────────────────────────────────────────────────────────

export function DrawerContent({
  username, serverName, serverVersion, connected,
  controlsLocked, onToggleLock, onSettings, onSearch, onLogout, onSwitchServer, onClose,
}: {
  username?: string;
  serverName?: string;
  serverVersion?: string;
  connected: boolean;
  sessions?: EmbySession[];
  controlsLocked: boolean;
  onToggleLock: () => void;
  onSettings: () => void;
  onSearch: () => void;
  onLogout: () => void;
  onSwitchServer: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const updateInfo              = useStore((s) => s.updateInfo);
  const ignoredUpdateVersion    = useStore((s) => s.ignoredUpdateVersion);
  const setIgnoredUpdateVersion = useStore((s) => s.setIgnoredUpdateVersion);
  const showBanner = updateInfo && updateInfo.version !== ignoredUpdateVersion;
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Major version bump = first segment changes (e.g. 0.x → 1.x); cannot be dismissed
  const isMajorUpdate = updateInfo
    ? (parseInt(updateInfo.version) ?? 0) > (parseInt(Constants.expoConfig?.version ?? '0') ?? 0)
    : false;

  const handleDismiss = () => {
    if (!updateInfo) return;
    setIgnoredUpdateVersion(updateInfo.version);
  };

  const handleUpdate = async () => {
    if (!updateInfo) return;
    if (Platform.OS === 'android' && updateInfo.apkUrl) {
      setDownloading(true);
      try {
        await downloadAndInstallApk(updateInfo.apkUrl, (p) => setDownloadProgress(p));
      } catch {
        // Installer not available (e.g. "Install unknown apps" not granted) — open release page
        Linking.openURL(updateInfo.releaseUrl);
      } finally {
        setDownloading(false);
        setDownloadProgress(0);
      }
    } else {
      Linking.openURL(updateInfo.releaseUrl);
    }
  };

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

      <View style={styles.divider} />

      {/* Action cards */}
      <ScrollView style={styles.drawerBody} contentContainerStyle={styles.cardList}>

        <ActionCard
          icon="search"
          iconBg={Colors.accentDim}
          iconColor={Colors.accent}
          title="Search &amp; Play"
          subtitle="Find and send media to a device"
          onPress={() => { onClose(); onSearch(); }}
        />

        <ActionCard
          icon={controlsLocked ? 'lock-closed' : 'lock-open-outline'}
          iconBg={controlsLocked ? Colors.yellowDim : Colors.bgElevated}
          iconColor={controlsLocked ? Colors.yellow : Colors.textSecondary}
          title={controlsLocked ? 'Controls locked' : 'Lock controls'}
          subtitle={controlsLocked ? 'Tap to unlock' : 'Prevent accidental taps'}
          onPress={onToggleLock}
        />

        <ActionCard
          icon="settings-outline"
          iconBg={Colors.bgElevated}
          iconColor={Colors.textSecondary}
          title="Settings"
          subtitle="App info, logs, and preferences"
          onPress={() => { onClose(); onSettings(); }}
        />

        <ActionCard
          icon="swap-horizontal-outline"
          iconBg={Colors.bgElevated}
          iconColor={Colors.textSecondary}
          title="Switch server"
          subtitle="Connect to a different server"
          onPress={() => { onClose(); onSwitchServer(); }}
        />

        <ActionCard
          icon="log-out-outline"
          iconBg={Colors.redDim}
          iconColor={Colors.red}
          title="Sign out"
          subtitle={serverName ? `Sign out of ${serverName}` : 'Sign out of this server'}
          onPress={onLogout}
          danger
        />

      </ScrollView>

      {/* Update banner + version footer — always gets bottom safe-area padding */}
      <View style={{ paddingBottom: insets.bottom }}>
        {showBanner && (
          <Pressable
            style={styles.updateBanner}
            onPress={handleUpdate}
            disabled={downloading}
          >
            <View style={[styles.updateIconWrap]}>
              {downloading
                ? <ActivityIndicator size="small" color={Colors.accent} />
                : <Ionicons name="arrow-up-circle" size={22} color={Colors.accent} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.updateTitle}>
                {downloading
                  ? `Downloading… ${Math.round(downloadProgress * 100)}%`
                  : `Update available · v${updateInfo.version}`}
              </Text>
              <Text style={styles.updateSubtitle} numberOfLines={1}>
                {Platform.OS === 'android' ? 'Tap to download and install' : 'Tap to open release page'}
              </Text>
            </View>
            {!downloading && !isMajorUpdate && (
              <Pressable onPress={handleDismiss} hitSlop={8}>
                <Ionicons name="close" size={16} color={Colors.textMuted} />
              </Pressable>
            )}
            {!downloading && isMajorUpdate && (
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            )}
          </Pressable>
        )}

        {serverVersion && (
          <View style={[styles.versionFooter, { paddingBottom: Spacing.md }]}>
            <Text style={styles.versionText}>{serverName} · v{serverVersion}</Text>
          </View>
        )}
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
  drawerUsername:  { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  drawerServerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  drawerServerName: { color: Colors.textMuted, fontSize: 12 },
  drawerCloseBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  divider: { height: 1, backgroundColor: Colors.border },

  drawerBody: { flex: 1 },
  cardList:   { padding: Spacing.md, gap: Spacing.sm },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle:    { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  cardSubtitle: { ...Typography.caption, marginTop: 2 },

  versionFooter: { alignItems: 'center', paddingTop: Spacing.sm, paddingHorizontal: Spacing.md },
  versionText:   { color: Colors.textMuted, fontSize: 11 },

  updateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.accentDim,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.accent,
  },
  updateIconWrap: { width: 32, alignItems: 'center', justifyContent: 'center' },
  updateTitle:    { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  updateSubtitle: { ...Typography.caption, marginTop: 2 },
});
