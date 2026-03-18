import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { InfoModal } from '../src/components/InfoModal';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import { logger } from '../src/services/logger';

// ─── Device info ──────────────────────────────────────────────────────────────

function getDeviceInfo(): { label: string; value: string }[] {
  const appVersion = Constants.expoConfig?.version ?? '—';
  const rows: { label: string; value: string }[] = [
    { label: 'App version',  value: appVersion },
    { label: 'Platform',     value: Platform.OS === 'android' ? 'Android' : 'iOS' },
  ];

  if (Platform.OS === 'android') {
    const c = Platform.constants as any;
    rows.push(
      { label: 'Device',        value: [c.Manufacturer, c.Model].filter(Boolean).join(' ') || '—' },
      { label: 'Android',       value: `${c.Release ?? '—'} (API ${Platform.Version})` },
      { label: 'Build',         value: __DEV__ ? 'Debug' : 'Release' },
    );
  } else {
    rows.push(
      { label: 'Device',  value: Constants.deviceName ?? '—' },
      { label: 'iOS',     value: String(Platform.Version) },
      { label: 'Build',   value: __DEV__ ? 'Debug' : 'Release' },
    );
  }

  return rows;
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [logs, setLogs]             = useState<string>('');
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  const deviceInfo = getDeviceInfo();

  const loadLogs = useCallback(async () => {
    const content = await logger.getLogs();
    setLogs(content);
    setLogsLoaded(true);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleShareLogs = async () => {
    try {
      await Share.share({ message: logs || '(empty)' });
    } catch {}
  };

  const handleClearLogs = () => {
    setConfirmMessage('Delete all log entries?');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <InfoModal
        variant="warning"
        title="Clear logs"
        message={confirmMessage}
        onDismiss={() => setConfirmMessage(null)}
        confirmLabel="Clear"
        onConfirm={async () => { setConfirmMessage(null); await logger.clearLogs(); setLogs(''); }}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        {/* App & Device info */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          {deviceInfo.map(({ label, value }, i) => (
            <View key={label} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Log viewer */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>LOGS</Text>
          <View style={styles.logActions}>
            <Pressable style={styles.logActionBtn} onPress={handleShareLogs}>
              <Ionicons name="share-outline" size={16} color={Colors.accent} />
              <Text style={styles.logActionText}>Share</Text>
            </Pressable>
            {!__DEV__ && (
              <Pressable style={styles.logActionBtn} onPress={handleClearLogs}>
                <Ionicons name="trash-outline" size={16} color={Colors.red} />
                <Text style={[styles.logActionText, { color: Colors.red }]}>Clear</Text>
              </Pressable>
            )}
            <Pressable style={styles.logActionBtn} onPress={loadLogs}>
              <Ionicons name="refresh-outline" size={16} color={Colors.textMuted} />
              <Text style={[styles.logActionText, { color: Colors.textMuted }]}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.logCard}>
          <ScrollView horizontal style={styles.logScroll} contentContainerStyle={styles.logScrollContent}>
            <Text style={styles.logText} selectable>
              {logsLoaded ? (logs || '(empty)') : 'Loading…'}
            </Text>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...Typography.title },

  sectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.xs, marginTop: Spacing.sm,
  },
  logActions: { flexDirection: 'row', gap: Spacing.sm },
  logActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logActionText: { fontSize: 13, fontWeight: '500', color: Colors.accent },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel: { ...Typography.caption, color: Colors.textMuted },
  infoValue: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: Spacing.sm },

  logCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 300,
    maxHeight: 500,
    overflow: 'hidden',
  },
  logScroll: { flex: 1 },
  logScrollContent: { padding: Spacing.md },
  logText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
