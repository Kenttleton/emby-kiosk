import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../theme';

export function KioskHeader({
  serverName, streamCount, connected, controlsLocked, onToggleLock, onOpenMenu,
}: {
  serverName?: string;
  streamCount: number;
  connected: boolean;
  controlsLocked: boolean;
  onToggleLock: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <View style={styles.kioskHeader}>
      <View style={styles.headerLeft}>
        <View style={[styles.onlineDot, { backgroundColor: connected ? Colors.green : Colors.yellow }]} />
        <Text style={styles.headerServerName} numberOfLines={1}>{serverName}</Text>
        {streamCount > 0 && (
          <Text style={styles.headerStreamCount}>{streamCount} {streamCount === 1 ? 'stream' : 'streams'}</Text>
        )}
      </View>
      <View style={styles.headerRight}>
        <Pressable style={styles.headerIconBtn} onPress={onToggleLock}>
          <Ionicons
            name={controlsLocked ? 'lock-closed' : 'lock-open-outline'}
            size={18}
            color={controlsLocked ? Colors.yellow : Colors.textMuted}
          />
        </Pressable>
        <Pressable style={styles.headerIconBtn} onPress={onOpenMenu}>
          <Ionicons name="menu" size={22} color={Colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  kioskHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, marginBottom: Spacing.xs,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerServerName: { color: Colors.textMuted, fontSize: 13 },
  headerStreamCount: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
});
