import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../theme';

function formatClock(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function IdleScreen({ serverName, connected }: { serverName?: string; connected: boolean }) {
  const { height: screenHeight } = useWindowDimensions();
  const [clock, setClock] = useState(formatClock());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => setClock(formatClock()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={[styles.idleScreen, { minHeight: screenHeight * 0.80 }]}>
      <View style={styles.idleCenter}>
        <Ionicons name="tv-outline" size={80} color={Colors.accent} />
        <Text style={styles.idleClock}>{clock}</Text>
        <Text style={styles.idleTitle}>Nothing Playing</Text>
        <Text style={styles.idleSubtitle}>
          {serverName ? `Waiting for streams on ${serverName}` : 'Waiting for streams…'}
        </Text>
      </View>
      <View style={styles.idleFooter}>
        <Animated.View style={[styles.onlineDot, { backgroundColor: connected ? Colors.green : Colors.yellow, opacity: pulseAnim }]} />
        <Text style={styles.idleFooterText}>{connected ? 'Connected' : 'Reconnecting…'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  idleScreen: { alignItems: 'center', paddingVertical: Spacing.xxl },
  idleCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  idleClock: { fontSize: 60, fontWeight: '200' as any, color: Colors.textPrimary, letterSpacing: -2, marginTop: Spacing.sm },
  idleTitle: { ...Typography.title, marginTop: Spacing.xs },
  idleSubtitle: { ...Typography.caption, textAlign: 'center' },
  idleFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.lg },
  idleFooterText: { color: Colors.textMuted, fontSize: 13 },
});
