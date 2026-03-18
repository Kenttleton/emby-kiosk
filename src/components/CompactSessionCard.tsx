import React from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme';
import { EmbySession } from '../types/emby';
import { normalizeMediaItem } from '../normalizeMedia';
import { progressPercent } from '../utils';

export function CompactSessionCard({
  session, serverAddress, controlsLocked, onCommand,
}: {
  session: EmbySession;
  serverAddress: string;
  controlsLocked: boolean;
  onCommand: (cmd: 'PlayPause' | 'Stop') => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const { NowPlayingItem: item, PlayState: ps } = session;
  if (!item || !ps) return null;

  const COMPACT_W = Math.min(screenWidth * 0.72, 300);
  const isPlaying = !ps.IsPaused;
  const progress = progressPercent(ps.PositionTicks ?? 0, item.RunTimeTicks ?? 0);
  const media = normalizeMediaItem(item, serverAddress, Math.round(COMPACT_W));

  return (
    <View style={[styles.compactCard, { width: COMPACT_W }]}>
      {media.backdropUrl ? (
        <Image source={{ uri: media.backdropUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}>
          <Ionicons name="film-outline" size={28} color={Colors.textMuted} />
        </View>
      )}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', backgroundColor: 'rgba(18,18,18,0.93)' }} />
        <View style={{ position: 'absolute', bottom: '45%', left: 0, right: 0, height: '30%', backgroundColor: 'rgba(18,18,18,0.55)' }} />
        <View style={{ position: 'absolute', bottom: '68%', left: 0, right: 0, height: '22%', backgroundColor: 'rgba(18,18,18,0.20)' }} />
      </View>
      <View style={[styles.compactStateBadge, { backgroundColor: isPlaying ? Colors.accent : Colors.yellow }]}>
        <Ionicons name={isPlaying ? 'play' : 'pause'} size={8} color="#000" />
      </View>
      {!controlsLocked && (
        <Pressable style={styles.compactPlayBtn} onPress={() => onCommand('PlayPause')}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color="#000" />
        </Pressable>
      )}
      <View style={styles.compactMeta}>
        {media.subtitle && <Text style={styles.compactSubtitle} numberOfLines={1}>{media.subtitle}</Text>}
        <Text style={styles.compactTitle} numberOfLines={1}>{media.title}</Text>
        <View style={styles.compactWatcher}>
          <Ionicons name="person-circle-outline" size={10} color={Colors.accent} />
          <Text style={styles.compactWatcherName} numberOfLines={1}>{session.UserName}</Text>
          <Text style={styles.compactDot}>·</Text>
          <Ionicons name="tv-outline" size={10} color={Colors.textMuted} />
          <Text style={styles.compactDevice} numberOfLines={1}>{session.DeviceName}</Text>
        </View>
        <View style={styles.miniProgressTrack}>
          <View style={[styles.miniProgressFill, { width: `${progress}%` as any }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  compactCard: { height: 140, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.bgElevated },
  compactStateBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm,
  },
  compactPlayBtn: {
    position: 'absolute', top: 8, right: 38,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  compactMeta: { position: 'absolute', left: Spacing.sm, right: Spacing.sm, bottom: Spacing.sm },
  compactSubtitle: { color: Colors.textMuted, fontSize: 11, marginBottom: 1 },
  compactTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  compactWatcher: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  compactWatcherName: { color: Colors.textSecondary, fontSize: 11, maxWidth: 80 },
  compactDot: { color: Colors.textMuted, fontSize: 11 },
  compactDevice: { color: Colors.textMuted, fontSize: 11, flex: 1 },
  miniProgressTrack: { height: 2, backgroundColor: Colors.bgOverlay, borderRadius: 1, overflow: 'hidden' },
  miniProgressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.accent, borderRadius: 1 },
});
