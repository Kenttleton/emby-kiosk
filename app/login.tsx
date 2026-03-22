import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import { useStore } from '../src/store';
import { authenticateByName } from '../src/services/embyApi';
import { exchangeToken } from '../src/services/connectApi';
import { InfoModal } from '../src/components/InfoModal';
import { KnownUser } from '../src/types/emby';
import { logger } from '../src/services/logger';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();

  const {
    server,
    setAuth,
    connectAccount,
    serverCredentials,
  } = useStore();

  const record     = server ? (serverCredentials[server.id] ?? null) : null;
  const knownUsers = record?.knownUsers ?? [];

  // Connect state for this server
  const connectLinkedTo = record?.connectUserId   ?? null;
  const connectAccessKey = record?.connectAccessKey ?? null;
  const connectAvailable =
    !!connectAccount &&
    !!connectAccessKey &&
    (connectLinkedTo === null || connectLinkedTo === connectAccount.userId);
  const connectMismatch =
    !!connectAccount &&
    !!connectLinkedTo &&
    connectLinkedTo !== connectAccount.userId;

  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [loadingUser, setLoadingUser] = useState<string | null>(null);
  const [modalTitle,  setModalTitle]  = useState<string | undefined>(undefined);
  const [modalMsg,    setModalMsg]    = useState<string | null>(null);

  if (!server) {
    return (
      <View style={styles.centered}>
        <Text style={Typography.body}>No server selected.</Text>
        <Pressable onPress={() => router.replace('/')}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Try a known user's stored token ───────────────────────────────────────
  const tryKnownUser = async (user: KnownUser) => {
    if (!server) return;
    setLoadingUser(user.userId);
    logger.info('[Auth] Trying stored token for:', user.username);
    try {
      const res = await globalThis.fetch(`${server.address}/emby/System/Info`, {
        headers: { 'X-Emby-Token': user.token },
      });
      if (res.ok) {
        logger.info('[Auth] Stored token valid — signed in as:', user.username);
        setAuth(user.token, { Id: user.userId, Name: user.username, ServerId: server.id, HasPassword: true }, user.loginMethod);
        router.replace('/kiosk');
        return;
      }
      logger.warn('[Auth] Stored token expired for:', user.username);
      setUsername(user.username);
      setModalTitle('Session expired');
      setModalMsg(`Your session for "${user.username}" has expired. Please enter your password again.`);
    } catch (e) {
      logger.warn('[Auth] Stored token check failed for:', user.username, e);
      setUsername(user.username);
    } finally {
      setLoadingUser(null);
    }
  };

  // ── Emby Connect exchange ─────────────────────────────────────────────────
  const tryConnect = async () => {
    if (!connectAccount || !connectAccessKey) return;
    setLoading(true);
    logger.info('[Auth] Attempting Emby Connect exchange for:', connectAccount.displayName);
    try {
      const { localUserId, accessToken } = await exchangeToken(
        server.address,
        connectAccount.userId,
        connectAccessKey,
      );
      const user = {
        Id:          localUserId,
        Name:        connectAccount.displayName,
        ServerId:    server.id,
        HasPassword: false,
      };
      logger.info('[Auth] Connect exchange successful — signed in as:', connectAccount.displayName);
      setAuth(accessToken, user, 'connect');
      router.replace('/kiosk');
    } catch (e: any) {
      logger.error('[Auth] Connect exchange failed:', e);
      setModalTitle('Connect sign-in failed');
      setModalMsg(e?.message ?? 'Could not authenticate with Emby Connect.');
    } finally {
      setLoading(false);
    }
  };

  // ── Local username/password login ─────────────────────────────────────────
  const handleLocalLogin = async () => {
    if (!username.trim()) { setModalTitle('Username required'); setModalMsg('Please enter a username.'); return; }
    setLoading(true);
    logger.info('[Auth] Local login attempt for:', username.trim());
    try {
      const result = await authenticateByName(server.address, username.trim(), password);
      logger.info('[Auth] Local login successful for:', result.User.Name);
      setAuth(result.AccessToken, result.User, 'local');
      router.replace('/kiosk');
    } catch (e: any) {
      logger.error('[Auth] Local login failed for:', username.trim(), e);
      setModalTitle('Login failed');
      setModalMsg(e?.message ?? 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <InfoModal
        variant="error"
        title={modalTitle}
        message={modalMsg}
        onDismiss={() => setModalMsg(null)}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={[styles.container, { paddingTop: insets.top }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Server header */}
          <View style={styles.serverRow}>
            <Text style={styles.serverName} numberOfLines={1}>{server.name}</Text>
            <Pressable onPress={() => router.replace('/')}>
              <Text style={styles.switchServer}>Switch server</Text>
            </Pressable>
          </View>

          {/* Connect mismatch notice */}
          {connectMismatch && (
            <View style={styles.noticeCard}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.yellow} />
              <Text style={styles.noticeText}>
                This server was previously linked to a different Emby Connect account.
              </Text>
            </View>
          )}

          {/* Known users — quick sign-in row */}
          {knownUsers.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>SIGN IN AS</Text>
              <View style={styles.knownUsersRow}>
                {knownUsers.map((u) => (
                  <Pressable
                    key={u.userId}
                    style={styles.knownUserChip}
                    onPress={() => tryKnownUser(u)}
                    disabled={loadingUser !== null}
                  >
                    {loadingUser === u.userId
                      ? <ActivityIndicator size="small" color={Colors.accent} />
                      : <Ionicons
                          name={u.loginMethod === 'connect' ? 'cloud-outline' : 'person-outline'}
                          size={14}
                          color={Colors.accent}
                        />
                    }
                    <Text style={styles.knownUserName} numberOfLines={1}>{u.username}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Emby Connect button */}
          {(connectAvailable || connectMismatch) && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>EMBY CONNECT</Text>
              <Pressable
                style={[styles.connectBtn, loading && styles.btnDisabled]}
                onPress={tryConnect}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={Colors.accent} size="small" />
                  : <Ionicons name="cloud-outline" size={18} color={Colors.accent} />
                }
                <Text style={styles.connectBtnText}>
                  Continue as {connectAccount?.displayName}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Local credentials */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>LOCAL ACCOUNT</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { marginTop: Spacing.sm }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={handleLocalLogin}
            />
            <Pressable
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleLocalLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.loginBtnText}>Sign In</Text>
              }
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.md, paddingBottom: Spacing.xl },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  serverRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.lg,
  },
  serverName:   { color: Colors.accent, fontSize: 18, fontWeight: '700', flex: 1 },
  switchServer: { color: Colors.textMuted, fontSize: 13, marginLeft: Spacing.sm },

  noticeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderLeftWidth: 3, borderLeftColor: Colors.yellow,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  noticeText: { ...Typography.caption, color: Colors.yellow, flex: 1 },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  sectionLabel: { ...Typography.label, marginBottom: Spacing.sm },

  knownUsersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  knownUserChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
    minWidth: 80,
  },
  knownUserName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500', flexShrink: 1 },

  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, borderWidth: 1.5, borderColor: Colors.accent,
    borderRadius: Radius.md, paddingVertical: 12,
  },
  connectBtnText: { color: Colors.accent, fontWeight: '600', fontSize: 15 },

  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15,
    borderWidth: 1, borderColor: Colors.border,
  },
  loginBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md,
  },
  btnDisabled:   { opacity: 0.6 },
  loginBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  link:          { color: Colors.accent, marginTop: 8, fontSize: 15 },
});
