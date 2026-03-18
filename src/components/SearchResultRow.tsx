import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme';
import { getPosterUrl } from '../services/embyApi';
import { EmbyItem } from '../types/emby';
import { formatDurationTicks, itemTypeLabel } from '../utils';

export function SearchResultRow({ item, serverAddress, onPlay, onResume }: {
  item: EmbyItem;
  serverAddress: string;
  onPlay: () => void;
  onResume?: () => void;
}) {
  const posterUrl = item.ImageTags?.Primary
    ? getPosterUrl(serverAddress, item.Id, item.ImageTags.Primary, 'Primary', 88)
    : null;
  return (
    <View style={styles.searchResult}>
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.searchPoster} />
      ) : (
        <View style={[styles.searchPoster, styles.searchPosterPlaceholder]}>
          <Ionicons name="film-outline" size={18} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.searchInfo}>
        <Text style={styles.searchTitle} numberOfLines={1}>{item.Name}</Text>
        <Text style={styles.searchMeta}>
          {itemTypeLabel(item.Type, item)}
          {item.ProductionYear ? ` · ${item.ProductionYear}` : ''}
          {item.RunTimeTicks ? ` · ${formatDurationTicks(item.RunTimeTicks)}` : ''}
        </Text>
      </View>
      <View style={styles.searchActions}>
        {onResume && (
          <Pressable style={styles.resumeRowBtn} onPress={onResume}>
            <Ionicons name="play-forward" size={14} color={Colors.accent} />
          </Pressable>
        )}
        <Pressable style={styles.playRowBtn} onPress={onPlay}>
          <Ionicons name="play" size={14} color="#000" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchResult: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  searchPoster: { width: 44, height: 64, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated },
  searchPosterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  searchInfo: { flex: 1 },
  searchTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500', marginBottom: 2 },
  searchMeta: { color: Colors.textSecondary, fontSize: 12 },
  searchActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  resumeRowBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.accent },
  playRowBtn: { backgroundColor: Colors.accent, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
