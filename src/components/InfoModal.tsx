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
  /** When provided, renders a two-button confirmation layout. */
  onConfirm?: () => void;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the dismiss/cancel button. Defaults to "Dismiss" (no onConfirm) or "Cancel" (with onConfirm). */
  dismissLabel?: string;
}

export function InfoModal({
  variant = 'info',
  title,
  message,
  onDismiss,
  onConfirm,
  confirmLabel = 'Confirm',
  dismissLabel,
}: Props) {
  const { icon, color, defaultTitle } = VARIANT_CONFIG[variant];
  const resolvedDismissLabel = dismissLabel ?? (onConfirm ? 'Cancel' : 'Dismiss');

  return (
    <Modal visible={!!message} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={[styles.sheet, { borderTopColor: color }]}>
          <Ionicons name={icon} size={28} color={color} />
          <Text style={styles.title}>{title ?? defaultTitle}</Text>
          <Text style={styles.message}>{message}</Text>

          {onConfirm ? (
            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onDismiss}>
                <Text style={styles.btnSecondaryText}>{resolvedDismissLabel}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary, { backgroundColor: color }]} onPress={onConfirm}>
                <Text style={styles.btnText}>{confirmLabel}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={[styles.btn, styles.btnFull, { backgroundColor: color }]} onPress={onDismiss}>
              <Text style={styles.btnText}>{resolvedDismissLabel}</Text>
            </Pressable>
          )}
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
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    width: '100%',
  },
  btn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: {
    alignSelf: 'stretch',
    width: '100%',
  },
  btnPrimary: {
    flex: 1,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  btnSecondaryText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
});
