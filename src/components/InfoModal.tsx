import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../theme';

export type InfoModalVariant = 'error' | 'warning' | 'info';

const VARIANT_CONFIG: Record<InfoModalVariant, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; defaultTitle: string }> = {
  error:   { icon: 'warning-outline',            color: Colors.red,    defaultTitle: 'Error' },
  warning: { icon: 'alert-circle-outline',       color: Colors.yellow, defaultTitle: 'Warning' },
  info:    { icon: 'information-circle-outline', color: Colors.accent, defaultTitle: 'Info' },
};

interface Props {
  variant?: InfoModalVariant;
  title?: string;
  message: string | null;
  onDismiss: () => void;
}

export function InfoModal({ variant = 'info', title, message, onDismiss }: Props) {
  const { icon, color, defaultTitle } = VARIANT_CONFIG[variant];

  return (
    <Modal visible={!!message} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={[styles.sheet, { borderTopColor: color }]}>
          <Ionicons name={icon} size={28} color={color} />
          <Text style={styles.title}>{title ?? defaultTitle}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={[styles.btn, { backgroundColor: color }]} onPress={onDismiss}>
            <Text style={styles.btnText}>Dismiss</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 3,
  },
  title: {
    ...Typography.title,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  btn: {
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  btnText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
});
