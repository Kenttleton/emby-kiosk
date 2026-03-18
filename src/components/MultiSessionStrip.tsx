import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Typography } from '../theme';
import { EmbySession } from '../types/emby';
import { CompactSessionCard } from './CompactSessionCard';

export function MultiSessionStrip({
  sessions, serverAddress, controlsLocked, onCommand,
}: {
  sessions: EmbySession[];
  serverAddress: string;
  controlsLocked: boolean;
  onCommand: (sessionId: string, cmd: 'PlayPause' | 'Stop') => void;
}) {
  return (
    <View style={styles.stripWrapper}>
      <View style={styles.stripHeader}>
        <Text style={styles.stripLabel}>ALSO PLAYING</Text>
        <Text style={styles.stripCount}>{sessions.length} more</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripScroll}>
        {sessions.map((session) => (
          <CompactSessionCard
            key={session.Id}
            session={session}
            serverAddress={serverAddress}
            controlsLocked={controlsLocked}
            onCommand={(cmd) => onCommand(session.Id, cmd)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stripWrapper: { marginBottom: Spacing.md },
  stripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  stripLabel: { ...Typography.label },
  stripCount: { color: Colors.textMuted, fontSize: 12 },
  stripScroll: { gap: Spacing.sm },
});
