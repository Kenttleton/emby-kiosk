import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors, Radius } from '../theme';
import { MediaStream } from '../types/emby';

export function TrackChip({ stream, active, onPress, isOff }: {
  stream: MediaStream;
  active: boolean;
  onPress: () => void;
  isOff?: boolean;
}) {
  return (
    <Pressable
      style={[styles.trackChip, active && !isOff && styles.trackChipActive, isOff && active && styles.trackChipOff]}
      onPress={onPress}
    >
      <Text style={[styles.trackChipText, active && !isOff && styles.trackChipTextActive]} numberOfLines={1}>
        {stream.DisplayTitle ?? stream.Language ?? `Track ${stream.Index}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trackChip: {
    borderRadius: Radius.xl, paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 8, backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  trackChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  trackChipOff: { borderColor: Colors.red, backgroundColor: 'rgba(204,41,41,0.08)' },
  trackChipText: { color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
  trackChipTextActive: { color: Colors.accent, fontWeight: '600' },
});
