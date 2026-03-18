import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

export const SKIP_ICON_SIZE = 40;
// The refresh icon's arc occupies ~70% of its bounding box height,
// so its visual center is ~15% above the geometric center.
export const SKIP_ICON_OFFSET = Math.round(SKIP_ICON_SIZE * 0.075);

export function SkipButton({ direction, onPress }: { direction: 'back' | 'forward'; onPress: () => void }) {
  return (
    <Pressable style={styles.skipBtn} onPress={onPress}>
      <View style={styles.skipIconWrapper}>
        <Ionicons
          name="refresh"
          size={SKIP_ICON_SIZE}
          color={Colors.textPrimary}
          style={{ transform: [{ scaleX: direction === 'back' ? -1 : 1 }, { translateY: -SKIP_ICON_OFFSET }] }}
        />
        <Text style={styles.skipLabel}>10</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skipBtn: { padding: 8 },
  skipIconWrapper: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipLabel: { position: 'absolute', color: Colors.textPrimary, fontSize: 11, fontWeight: '700' },
});
