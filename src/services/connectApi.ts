import { ConnectAccount, EmbyServer } from '../types/emby';
import { DEVICE_ID } from './embyApi';
import { logger } from './logger';

// ─── Config ───────────────────────────────────────────────────────────────────

const CONNECT_BASE  = 'https://connect.emby.media';
const X_APPLICATION = 'EmbyKiosk/1.0';

function connectHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Application': X_APPLICATION,
  };
  if (token) h['X-Connect-UserToken'] = token;
  return h;
}

async function connectRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`${CONNECT_BASE}${path}`, {
    ...options,
    headers: { ...connectHeaders(token), ...(options.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error(`[ConnectAPI] ${options.method ?? 'GET'} ${path} → ${res.status}`, text);
    throw new Error(`Emby Connect HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Connect login ────────────────────────────────────────────────────────────

interface ConnectAuthResponse {
  AccessToken: string;
  User: {
    Id:    string;
    Name:  string;
    Email: string;
  };
}

export async function connectLogin(
  email: string,
  password: string,
): Promise<ConnectAccount> {
  const data = await connectRequest<ConnectAuthResponse>(
    '/service/user/authenticate',
    { method: 'POST', body: JSON.stringify({ nameOrEmail: email, rawpw: password }) },
  );
  return {
    userId:      data.User.Id,
    accessToken: data.AccessToken,
    displayName: data.User.Name,
    email:       data.User.Email,
  };
}

// ─── Server list ──────────────────────────────────────────────────────────────

interface ConnectServerEntry {
  SystemId:     string;
  Name:         string;
  Url:          string;
  LocalAddress?: string;
  AccessKey:    string;
}

/**
 * Returns the list of Emby servers associated with the Connect account,
 * shaped as EmbyServer objects ready to be saved. The AccessKey and
 * ConnectUserId are embedded so the login screen can do the exchange later.
 */
export async function getConnectServers(
  userId: string,
  token:  string,
): Promise<(EmbyServer & { connectAccessKey: string; connectUserId: string })[]> {
  const entries = await connectRequest<ConnectServerEntry[]>(
    `/service/servers?userId=${userId}`,
    {},
    token,
  );
  return entries.map((e) => ({
    id:               e.SystemId,
    name:             e.Name,
    address:          e.Url,
    localAddress:     e.LocalAddress,
    discovered:       false,
    connectServerId:  e.SystemId,
    connectAccessKey: e.AccessKey,
    connectUserId:    userId,
  }));
}

// ─── Token exchange ───────────────────────────────────────────────────────────

interface ExchangeResponse {
  LocalUserId:  string;
  AccessToken:  string;
}

/**
 * Trade an Emby Connect AccessKey for a local server token.
 * Called on every reconnect — local tokens are not cached long-term.
 */
export async function exchangeToken(
  serverAddress:  string,
  connectUserId:  string,
  accessKey:      string,
): Promise<{ localUserId: string; accessToken: string }> {
  const url = `${serverAddress}/emby/Connect/Exchange?format=json&ConnectUserId=${connectUserId}`;
  const res = await fetch(url, {
    headers: {
      'X-Emby-Token':         accessKey,
      'X-Application':        X_APPLICATION,
      'X-Emby-Device-Id':     DEVICE_ID,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange HTTP ${res.status}: ${text}`);
  }
  const data: ExchangeResponse = await res.json();
  return { localUserId: data.LocalUserId, accessToken: data.AccessToken };
}
