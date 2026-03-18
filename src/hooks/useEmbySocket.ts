import { useEffect, useRef, useState } from 'react';
import { DEVICE_ID } from '../services/embyApi';
import { EmbySession } from '../types/emby';

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

/**
 * Connects to the Emby WebSocket endpoint and subscribes to live session updates.
 * Automatically reconnects on disconnect with exponential backoff.
 * Replaces HTTP polling entirely.
 */
export function useEmbySocket(
  serverAddress: string | null,
  token: string | null
): { sessions: EmbySession[]; connected: boolean; reconnect: () => void } {
  const [sessions, setSessions] = useState<EmbySession[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS);
  const unmountedRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const reconnect = () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    setConnected(false);
    reconnectDelayRef.current = RECONNECT_DELAY_MS;
    connectRef.current();
  };

  useEffect(() => {
    unmountedRef.current = false;

    if (!serverAddress || !token) return;

    function connect() {
      if (unmountedRef.current) return;
      connectRef.current = connect;

      // Build WebSocket URL from the HTTP server address
      // e.g. http://192.168.1.10:8096 → ws://192.168.1.10:8096
      const wsUrl = serverAddress!
        .replace(/^https:\/\//, 'wss://')
        .replace(/^http:\/\//, 'ws://');

      const url = `${wsUrl}/embywebsocket?api_key=${token}&deviceId=${DEVICE_ID}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return; }
        setConnected(true);
        reconnectDelayRef.current = RECONNECT_DELAY_MS;
        // Subscribe to session updates: 0ms initial delay, 1500ms interval
        ws.send(JSON.stringify({ MessageType: 'SessionsStart', Data: '0,1500' }));
      };

      ws.onmessage = (event) => {
        if (unmountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.MessageType === 'Sessions') {
            setSessions(msg.Data as EmbySession[]);
          } else if (msg.MessageType === 'ForceKeepAlive') {
            ws.send(JSON.stringify({ MessageType: 'KeepAlive' }));
          }
        } catch { }
      };

      ws.onerror = () => {
        // onclose fires after onerror; let onclose handle reconnect
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setConnected(false);
        // Exponential backoff
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [serverAddress, token]);

  return { sessions, connected, reconnect };
}
