import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../src/theme';
import { useStore } from '../src/store';
import {
  remotePlaystate,
  reportCapabilities,
  setAudioStreamIndex,
  setSubtitleStreamIndex,
  setVolume,
} from '../src/services/embyApi';
import { useEmbySocket } from '../src/hooks/useEmbySocket';
import { useStableSessions } from '../src/hooks/useStableSessions';
import { InfoModal } from '../src/components/InfoModal';
import { LockModal } from '../src/components/LockModal';
import { KioskHeader } from '../src/components/KioskHeader';
import { IdleScreen } from '../src/components/IdleScreen';
import { SessionCard } from '../src/components/SessionCard';
import { DrawerContent } from '../src/components/DrawerContent';

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAWER_WIDTH_FRAC = 0.82;

// ─── KioskScreen ──────────────────────────────────────────────────────────────

export default function KioskScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const DRAWER_WIDTH = Math.min(screenWidth * DRAWER_WIDTH_FRAC, 400);

  const {
    server, authToken, currentUser, serverCredentials, connectAccount,
    clearAuth, clearSession, controlsLocked, setControlsLocked, setSessions,
  } = useStore();

  const activeCredential = server ? serverCredentials[server.id]?.active : null;

  const { sessions, connected } = useEmbySocket(server?.address ?? null, authToken);

  useEffect(() => { setSessions(sessions); }, [sessions]);

  useEffect(() => {
    if (server && authToken) reportCapabilities(server.address, authToken).catch(() => {});
  }, [server?.address, authToken]);
  const activeSessions = useStableSessions(sessions.filter((s) => s.NowPlayingItem));
  const duplicateClientDevice = new Set(
    activeSessions
      .map((s) => `${s.Client}|${s.DeviceName}`)
      .filter((key, _, arr) => arr.indexOf(key) !== arr.lastIndexOf(key))
  );
  const CARD_GAP = Spacing.md * 2;
  const cardWidth = screenWidth - (insets.left + insets.right) - Spacing.md * 2;
  const snapInterval = cardWidth + CARD_GAP;
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);
  const [errorVariant, setErrorVariant]   = useState<'error' | 'warning' | 'info'>('error');
  const [errorTitle, setErrorTitle]       = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);
  const [confirmLabel, setConfirmLabel]   = useState<string>('Confirm');
  const [onConfirmCb, setOnConfirmCb]     = useState<(() => void) | undefined>(undefined);
  const showError = (title: string, msg?: string, variant: 'error' | 'warning' | 'info' = 'error') => {
    setErrorVariant(variant); setErrorTitle(title); setErrorMessage(msg ?? 'Something went wrong.');
    setOnConfirmCb(undefined);
  };
  const showConfirm = (
    title: string,
    msg: string,
    label: string,
    onConfirm: () => void,
    variant: 'error' | 'warning' | 'info' = 'warning',
  ) => {
    setErrorVariant(variant); setErrorTitle(title); setErrorMessage(msg);
    setConfirmLabel(label); setOnConfirmCb(() => onConfirm);
  };
  const dismissModal = () => { setErrorMessage(null); setOnConfirmCb(undefined); };
  const sessionScrollRef = useRef<ScrollView>(null);

  const activeSessionIndex = Math.max(0,
    activeSessions.findIndex((s) => s.DeviceId === activeDeviceId)
  );

  // When sessions list changes, restore scroll position to the same device
  useEffect(() => {
    if (activeSessions.length === 0) return;
    const idx = activeSessions.findIndex((s) => s.DeviceId === activeDeviceId);
    const target = idx >= 0 ? idx : 0;
    if (idx < 0) setActiveDeviceId(activeSessions[0].DeviceId);
    sessionScrollRef.current?.scrollTo({ x: target * snapInterval, animated: false });
  }, [activeSessions.map((s) => s.DeviceId).join(',')]);

  // ── Drawer ──────────────────────────────────────────────────────────────────
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.spring(drawerAnim, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  };
  const closeDrawer = () => {
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start(() =>
      setDrawerOpen(false)
    );
  };
  const drawerX = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [DRAWER_WIDTH, 0] });

  // ── Lock ─────────────────────────────────────────────────────────────────────
  const [lockModalVisible, setLockModalVisible] = useState(false);

  const handleToggleLock = () => {
    if (controlsLocked) {
      setLockModalVisible(true);
    } else {
      setControlsLocked(true);
    }
  };

  // ── Session commands ─────────────────────────────────────────────────────────
  async function sendCommand(sessionId: string, command: 'PlayPause' | 'Stop') {
    if (!server || !authToken) return;
    try { await remotePlaystate(server.address, authToken, sessionId, command); } catch { }
  }
  async function seekTo(sessionId: string, fraction: number, runtimeTicks: number) {
    if (!server || !authToken || !runtimeTicks) return;
    try { await remotePlaystate(server.address, authToken, sessionId, 'Seek', Math.round(fraction * runtimeTicks)); } catch { }
  }
  async function sendVolume(sessionId: string, vol: number) {
    if (!server || !authToken) return;
    try { await setVolume(server.address, authToken, sessionId, vol); } catch { }
  }
  async function switchAudio(sessionId: string, index: number) {
    if (!server || !authToken) return;
    try { await setAudioStreamIndex(server.address, authToken, sessionId, index); }
    catch (e: any) { showError('Error', e?.message); }
  }
  async function switchSubtitle(sessionId: string, index: number) {
    if (!server || !authToken) return;
    try { await setSubtitleStreamIndex(server.address, authToken, sessionId, index); }
    catch (e: any) { showError('Error', e?.message); }
  }

  const handleLogout = () => {
    showConfirm(
      'Sign out',
      'Sign out of this server?',
      'Sign out',
      () => { clearAuth(); router.replace('/login'); },
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      <LockModal
        visible={lockModalVisible}
        serverAddress={server?.address ?? ''}
        username={currentUser?.Name}
        loginMethod={activeCredential?.loginMethod ?? 'local'}
        connectEmail={connectAccount?.email}
        onSuccess={() => { setLockModalVisible(false); setControlsLocked(false); }}
        onCancel={() => setLockModalVisible(false)}
      />

      <InfoModal
        variant={errorVariant}
        title={errorTitle}
        message={errorMessage}
        onDismiss={dismissModal}
        onConfirm={onConfirmCb}
        confirmLabel={confirmLabel}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + Spacing.xl,
            paddingLeft: insets.left + Spacing.md,
            paddingRight: insets.right + Spacing.md,
          },
        ]}
      >
        <KioskHeader
          serverName={server?.name}
          streamCount={activeSessions.length}
          connected={connected}
          controlsLocked={controlsLocked}
          onToggleLock={handleToggleLock}
          onOpenMenu={openDrawer}
        />

        {activeSessions.length === 0 ? (
          <IdleScreen serverName={server?.name} connected={connected} onSearch={() => router.push('/search')} />
        ) : (
          <>
            <ScrollView
              ref={sessionScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={snapInterval}
              snapToAlignment="start"
              scrollEnabled={pagerScrollEnabled}
              style={{ width: cardWidth }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
                const session = activeSessions[idx];
                if (session) setActiveDeviceId(session.DeviceId);
              }}
            >
              {activeSessions.map((session, i) => (
                <View key={session.DeviceId} style={{ width: cardWidth, marginRight: i < activeSessions.length - 1 ? CARD_GAP : 0 }}>
                  <SessionCard
                    session={session}
                    serverAddress={server?.address ?? ''}
                    controlsLocked={controlsLocked}
                    onCommand={(cmd) => sendCommand(session.Id, cmd)}
                    onSeek={(f) => seekTo(session.Id, f, session.NowPlayingItem?.RunTimeTicks ?? 0)}
                    onVolume={(v) => sendVolume(session.Id, v)}
                    onAudio={(i) => switchAudio(session.Id, i)}
                    onSubtitle={(i) => switchSubtitle(session.Id, i)}
                    onScrubStart={() => setPagerScrollEnabled(false)}
                    onScrubEnd={() => setPagerScrollEnabled(true)}
                    onStall={() => showError('Playback issue', `${session.DeviceName} appears to have stalled. You may need to resume playback on the device.`, 'warning')}
                    showDeviceId={duplicateClientDevice.has(`${session.Client}|${session.DeviceName}`)}
                  />
                </View>
              ))}
            </ScrollView>

            {activeSessions.length > 1 && (
              <View style={styles.pageDots}>
                {activeSessions.map((_, i) => (
                  <View key={i} style={[styles.pageDot, i === activeSessionIndex && styles.pageDotActive]} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {drawerOpen && (
        <Pressable style={[StyleSheet.absoluteFill, styles.drawerBackdrop]} onPress={closeDrawer} />
      )}

      {drawerOpen && (
        <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH, right: 0, transform: [{ translateX: drawerX }] }]}>
          <DrawerContent
            username={currentUser?.Name}
            serverName={server?.name}
            serverVersion={server?.version}
            connected={connected}
            sessions={sessions}
            controlsLocked={controlsLocked}
            onToggleLock={handleToggleLock}
            onLogout={handleLogout}
            onSettings={() => { closeDrawer(); router.push('/settings'); }}
            onSearch={() => { closeDrawer(); router.push('/search'); }}
            onSwitchServer={() => { clearSession(); closeDrawer(); router.replace('/'); }}
            onClose={closeDrawer}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: {},
  drawerBackdrop: { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  drawer: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: Colors.bgCard,
    borderLeftWidth: 1, borderLeftColor: Colors.border,
    zIndex: 20,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 20,
  },
  pageDots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingVertical: Spacing.sm,
  },
  pageDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
  pageDotActive: {
    width: 18, backgroundColor: Colors.accent,
  },
});
