import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme';

export const SNAP_VISIBLE = 5; // always show 5 slots; center slot = selected

export function SnapPicker({ visible, options, selectedIndex, itemHeight, onSelect, onDismiss, onActivity }: {
  visible: boolean;
  options: string[];
  selectedIndex: number;
  itemHeight: number;
  onSelect: (index: number) => void;
  onDismiss: () => void;
  onActivity?: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [centeredIdx, setCenteredIdx] = useState(selectedIndex);
  const padding = itemHeight * Math.floor(SNAP_VISIBLE / 2); // 2 slots above/below center

  useEffect(() => {
    if (visible) {
      setCenteredIdx(selectedIndex);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
      }, 50);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.snapPickerBackdrop} onPress={onDismiss}>
        <Pressable style={styles.snapPickerModal} onPress={() => {}}>
          <View style={[styles.snapPicker, { height: itemHeight * SNAP_VISIBLE }]}>
            {/* Fixed center highlight band */}
            <View pointerEvents="none" style={[styles.snapPickerCenterBand, { top: padding, height: itemHeight }]} />
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={itemHeight}
              decelerationRate="fast"
              contentContainerStyle={{ paddingTop: padding, paddingBottom: padding }}
              onScroll={(e) => {
                const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / itemHeight), options.length - 1));
                setCenteredIdx(idx);
                onActivity?.();
              }}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / itemHeight), options.length - 1));
                setCenteredIdx(idx);
                onSelect(idx);
              }}
            >
              {options.map((label, i) => (
                <Pressable
                  key={label}
                  style={[styles.snapPickerItem, { height: itemHeight }]}
                  onPress={() => {
                    scrollRef.current?.scrollTo({ y: i * itemHeight, animated: true });
                    setCenteredIdx(i);
                    onSelect(i);
                  }}
                >
                  <Text style={[styles.snapPickerText, i === centeredIdx && styles.snapPickerTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  snapPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapPickerModal: {
    minWidth: 200,
  },
  snapPicker: {
    backgroundColor: Colors.bgOverlay, borderRadius: Radius.md,
    overflow: 'hidden',
  },
  snapPickerCenterBand: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: Colors.accentDim,
    borderRadius: Radius.sm,
  },
  snapPickerItem: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.md },
  snapPickerText: { color: Colors.textMuted, fontSize: 15 },
  snapPickerTextActive: { color: Colors.accent, fontWeight: '600' },
});
