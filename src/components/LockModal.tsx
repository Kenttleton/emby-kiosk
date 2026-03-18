import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme';
import { authenticateByName } from '../services/embyApi';

export function LockModal({
  visible,
  serverAddress,
  onSuccess,
  onCancel,
}: {
  visible: boolean;
  serverAddress: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setUsername(''); setPassword(''); setError(null); setLoading(false); };

  const handleCancel = () => { reset(); onCancel(); };

  const handleUnlock = async () => {
    if (!username.trim()) { setError('Enter your username.'); return; }
    setLoading(true);
    setError(null);
    try {
      await authenticateByName(serverAddress, username.trim(), password);
      reset();
      onSuccess();
    } catch {
      setError('Invalid credentials. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={lockStyles.backdrop}>
        <View style={lockStyles.sheet}>
          <View style={lockStyles.header}>
            <Ionicons name="lock-closed" size={22} color={Colors.yellow} />
            <Text style={lockStyles.title}>Unlock Controls</Text>
          </View>
          <Text style={lockStyles.subtitle}>Enter your Emby credentials to unlock.</Text>

          <TextInput
            style={lockStyles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[lockStyles.input, { marginTop: Spacing.sm }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleUnlock}
          />

          {error && (
            <View style={lockStyles.errorRow}>
              <Ionicons name="warning-outline" size={14} color={Colors.red} />
              <Text style={lockStyles.errorText}>{error}</Text>
            </View>
          )}

          <View style={lockStyles.actions}>
            <Pressable style={lockStyles.cancelBtn} onPress={handleCancel}>
              <Text style={lockStyles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[lockStyles.unlockBtn, loading && { opacity: 0.6 }]} onPress={handleUnlock} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={lockStyles.unlockText}>Unlock</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const lockStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    width: '100%', maxWidth: 360,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginBottom: Spacing.md },
  input: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15,
    borderWidth: 1, borderColor: Colors.border,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  errorText: { color: Colors.red, fontSize: 13, flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: Radius.md,
    alignItems: 'center', backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  unlockBtn: {
    flex: 1, paddingVertical: 13, borderRadius: Radius.md,
    alignItems: 'center', backgroundColor: Colors.accent,
  },
  unlockText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
