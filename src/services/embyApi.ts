import {
  AuthResult,
  EmbyItem,
  EmbySession,
  EmbyUser,
  ItemsResult,
  PlayRequest,
  PlaystateCommand,
} from '../types/emby';

// ─── Device identity (stable per install) ─────────────────────────────────

export const DEVICE_ID = 'EmbyKiosk-' + Math.random().toString(36).slice(2, 10);
const CLIENT_NAME = 'EmbyKiosk';
const DEVICE_NAME = 'EmbyKiosk App';
const APP_VERSION = '1.0.0';

function authHeader(token?: string | null): Record<string, string> {
  const parts = [
    `Client="${CLIENT_NAME}"`,
    `Device="${DEVICE_NAME}"`,
    `DeviceId="${DEVICE_ID}"`,
    `Version="${APP_VERSION}"`,
  ];
  if (token) parts.unshift(`UserId=""`); // token-based: UserId can be empty
  const authorization = `Emby ${parts.join(', ')}`;
  const headers: Record<string, string> = {
    Authorization: authorization,
    'Content-Type': 'application/json',
  };
  if (token) headers['X-Emby-Token'] = token;
  return headers;
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const url = `${baseUrl}/emby${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeader(token),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  // Some endpoints return empty body on success (204)
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ─── Discovery ─────────────────────────────────────────────────────────────

/**
 * Probe a candidate address to confirm it's an Emby server.
 * Returns server name + id if successful, throws if not.
 */
export async function probeServer(
  address: string
): Promise<{ id: string; name: string; version: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  let res: Response;
  try {
    res = await fetch(`${address}/emby/System/Info/Public`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error('Connection timed out.');
    }
    throw new Error('Could not reach server. Check the address and that Emby is running.');
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) throw new Error('Not an Emby server');
  const data = await res.json();
  return {
    id: data.Id ?? data.ServerId ?? 'unknown',
    name: data.ServerName ?? 'Emby Server',
    version: data.Version ?? '',
  };
}

/**
 * Scan a subnet for Emby servers by probing common ports on /24 range.
 * localIp should be like "192.168.1.100"
 */
export async function scanSubnet(
  localIp: string,
  onFound: (address: string, name: string, id: string) => void
): Promise<void> {
  const parts = localIp.split('.');
  if (parts.length !== 4) return;
  const subnet = parts.slice(0, 3).join('.');
  const ports = [8096, 8920]; // default Emby HTTP / HTTPS ports

  const probes: Promise<void>[] = [];
  for (let i = 1; i <= 254; i++) {
    for (const port of ports) {
      const address = `http://${subnet}.${i}:${port}`;
      probes.push(
        probeServer(address)
          .then(({ id, name }) => onFound(address, name, id))
          .catch(() => {})
      );
    }
  }
  await Promise.allSettled(probes);
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function authenticateByName(
  baseUrl: string,
  username: string,
  password: string
): Promise<AuthResult> {
  return request<AuthResult>(
    baseUrl,
    '/Users/AuthenticateByName',
    {
      method: 'POST',
      body: JSON.stringify({ Username: username, Pw: password }),
    }
  );
}

export async function getPublicUsers(baseUrl: string): Promise<EmbyUser[]> {
  return request<EmbyUser[]>(baseUrl, '/Users/Public');
}

export async function logout(baseUrl: string, token: string): Promise<void> {
  return request<void>(baseUrl, '/Sessions/Logout', { method: 'POST' }, token);
}

// ─── Sessions ──────────────────────────────────────────────────────────────

export async function getSessions(
  baseUrl: string,
  token: string,
  userId?: string
): Promise<EmbySession[]> {
  const qs = userId ? `?userId=${userId}` : '';
  return request<EmbySession[]>(baseUrl, `/Sessions${qs}`, {}, token);
}

// ─── Image URLs ────────────────────────────────────────────────────────────

export function getPosterUrl(
  baseUrl: string,
  itemId: string,
  imageTag: string,
  type: 'Primary' | 'Backdrop' | 'Thumb' = 'Primary',
  width = 300
): string {
  return `${baseUrl}/emby/Items/${itemId}/Images/${type}?tag=${imageTag}&maxWidth=${width}&quality=90`;
}

export function getUserImageUrl(
  baseUrl: string,
  userId: string,
  tag: string
): string {
  return `${baseUrl}/emby/Users/${userId}/Images/Primary?tag=${tag}&maxWidth=100`;
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchItems(
  baseUrl: string,
  token: string,
  userId: string,
  query: string
): Promise<ItemsResult> {
  const params = new URLSearchParams({
    searchTerm: query,
    IncludeItemTypes: 'Movie,Series,Episode',
    Recursive: 'true',
    Fields: 'PrimaryImageAspectRatio,BasicSyncInfo,Overview,UserData',
    Limit: '30',
    userId,
  });
  return request<ItemsResult>(baseUrl, `/Items?${params}`, {}, token);
}

// ─── Remote Control ────────────────────────────────────────────────────────

/** Send a play command to a specific session */
export async function remotePlay(
  baseUrl: string,
  token: string,
  sessionId: string,
  playRequest: PlayRequest
): Promise<void> {
  return request<void>(
    baseUrl,
    `/Sessions/${sessionId}/Playing`,
    {
      method: 'POST',
      body: JSON.stringify(playRequest),
    },
    token
  );
}

/** Send a playstate command (pause/unpause/stop/seek) to a session */
export async function remotePlaystate(
  baseUrl: string,
  token: string,
  sessionId: string,
  command: PlaystateCommand,
  seekPositionTicks?: number
): Promise<void> {
  const qs = seekPositionTicks !== undefined
    ? `?SeekPositionTicks=${seekPositionTicks}`
    : '';
  return request<void>(
    baseUrl,
    `/Sessions/${sessionId}/Playing/${command}${qs}`,
    { method: 'POST' },
    token
  );
}

/** Send a general system command to a session */
export async function remoteCommand(
  baseUrl: string,
  token: string,
  sessionId: string,
  command: string
): Promise<void> {
  return request<void>(
    baseUrl,
    `/Sessions/${sessionId}/Command/${command}`,
    { method: 'POST' },
    token
  );
}

/** Set volume (0–100) on a session */
export async function setVolume(
  baseUrl: string,
  token: string,
  sessionId: string,
  volume: number
): Promise<void> {
  return request<void>(
    baseUrl,
    `/Sessions/${sessionId}/Command`,
    {
      method: 'POST',
      body: JSON.stringify({ Name: 'SetVolume', Arguments: { Volume: String(Math.round(volume)) } }),
    },
    token
  );
}

/** Switch audio track on the active media source */
export async function setAudioStreamIndex(
  baseUrl: string,
  token: string,
  sessionId: string,
  index: number
): Promise<void> {
  return request<void>(
    baseUrl,
    `/Sessions/${sessionId}/Command`,
    {
      method: 'POST',
      body: JSON.stringify({ Name: 'SetAudioStreamIndex', Arguments: { Index: String(index) } }),
    },
    token
  );
}

/** Switch subtitle track on the active media source (-1 to disable) */
export async function setSubtitleStreamIndex(
  baseUrl: string,
  token: string,
  sessionId: string,
  index: number
): Promise<void> {
  return request<void>(
    baseUrl,
    `/Sessions/${sessionId}/Command`,
    {
      method: 'POST',
      body: JSON.stringify({ Name: 'SetSubtitleStreamIndex', Arguments: { Index: String(index) } }),
    },
    token
  );
}

export async function reportCapabilities(baseUrl: string, token: string): Promise<void> {
  return request<void>(
    baseUrl,
    '/Sessions/Capabilities/Full',
    {
      method: 'POST',
      body: JSON.stringify({
        PlayableMediaTypes: [],
        SupportedCommands: [],
        SupportsMediaControl: false,
        SupportsRemoteControl: false,
        SupportsContentUploading: false,
        SupportsSync: false,
      }),
    },
    token
  );
}

export async function getItem(
  baseUrl: string,
  token: string,
  itemId: string
): Promise<EmbyItem> {
  return request<EmbyItem>(baseUrl, `/Items/${itemId}?Fields=Overview`, {}, token);
}

export async function setPlaybackRate(
  baseUrl: string,
  token: string,
  sessionId: string,
  rate: number
): Promise<void> {
  return request<void>(
    baseUrl,
    `/Sessions/${sessionId}/Command`,
    {
      method: 'POST',
      body: JSON.stringify({ Name: 'SetPlaybackRate', Arguments: { PlaybackRate: String(rate) } }),
    },
    token
  );
}
