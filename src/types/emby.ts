// ─── Emby Server Discovery ─────────────────────────────────────────────────

export interface EmbyServer {
  id: string;
  name: string;
  address: string; // e.g. "http://192.168.1.10:8096"
  localAddress?: string;
  version?: string;
  discovered?: boolean; // true = via SSDP, false = manually added
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface AuthResult {
  User: EmbyUser;
  AccessToken: string;
  ServerId: string;
}

export interface EmbyUser {
  Id: string;
  Name: string;
  ServerId: string;
  PrimaryImageTag?: string;
  HasPassword: boolean;
}

// ─── Sessions ──────────────────────────────────────────────────────────────

export interface SessionCapabilities {
  PlayableMediaTypes?: string[];   // e.g. ["Audio", "Video"]
  SupportsRemoteControl?: boolean;
  SupportedCommands?: string[];
}

export interface EmbySession {
  Id: string;
  UserId: string;
  UserName: string;
  Client: string;
  DeviceName: string;
  DeviceId: string;
  ApplicationVersion: string;
  IsActive: boolean;
  NowPlayingItem?: NowPlayingItem;
  PlayState?: PlayState;
  LastActivityDate: string;
  RemoteEndPoint?: string;
  Capabilities?: SessionCapabilities;
}

export interface MediaStream {
  Index: number;
  Type: 'Audio' | 'Subtitle' | 'Video' | 'EmbeddedImage';
  Language?: string;
  DisplayTitle?: string;
  Codec?: string;
  IsDefault: boolean;
  IsExternal: boolean;
  IsForced: boolean;
  // Video-specific
  Width?: number;
  Height?: number;
  VideoRange?: string;        // 'HDR', 'SDR'
  VideoRangeType?: string;    // 'HDR10', 'DV', 'HLG', etc.
  BitRate?: number;
  // Audio-specific
  Channels?: number;
}

export interface NowPlayingItem {
  Id: string;
  Name: string;
  Type: string; // "Movie", "Episode", "Audio", etc.
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;       // episode number
  ParentIndexNumber?: number; // season number
  RunTimeTicks: number;       // 10,000 ticks = 1ms
  OfficialRating?: string;
  Overview?: string;
  ImageTags?: { Primary?: string; Thumb?: string; Banner?: string };
  BackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  ParentThumbItemId?: string;
  ParentThumbImageTag?: string;
  SeriesId?: string;
  SeriesPrimaryImageTag?: string;
  AlbumId?: string;
  AlbumPrimaryImageTag?: string;
  Album?: string;
  AlbumArtist?: string;
  Artists?: string[];
  ChannelName?: string;
  EpisodeTitle?: string;
  CommunityRating?: number;
  ProductionYear?: number;
  Genres?: string[];
  Studios?: { Name: string; Id: string }[];
  MediaStreams?: MediaStream[];
}

export interface PlayState {
  PositionTicks: number; // current position, 10,000 ticks = 1ms
  CanSeek: boolean;
  IsPaused: boolean;
  IsMuted: boolean;
  VolumeLevel?: number;
  PlaybackRate?: number;
  MediaSourceId?: string;
  PlayMethod?: string; // "DirectPlay", "Transcode"
}

// ─── Search / Library Items ────────────────────────────────────────────────

export interface EmbyItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  RunTimeTicks?: number;
  ProductionYear?: number;
  OfficialRating?: string;
  CommunityRating?: number;
  ImageTags?: { Primary?: string };
  BackdropImageTags?: string[];
  Overview?: string;
  UserData?: {
    PlaybackPositionTicks: number;
    PlayedPercentage?: number;
    Played: boolean;
  };
}

export interface ItemsResult {
  Items: EmbyItem[];
  TotalRecordCount: number;
}

// ─── Remote Control ────────────────────────────────────────────────────────

export type PlaystateCommand =
  | 'Stop'
  | 'Pause'
  | 'Unpause'
  | 'NextTrack'
  | 'PreviousTrack'
  | 'Seek'
  | 'Rewind'
  | 'FastForward'
  | 'PlayPause';

export interface PlayRequest {
  ItemIds: string[];
  PlayCommand: 'PlayNow' | 'PlayNext' | 'PlayLast';
  StartPositionTicks?: number;
}

// ─── App State ─────────────────────────────────────────────────────────────

export interface AppState {
  server: EmbyServer | null;
  authToken: string | null;
  currentUser: EmbyUser | null;
}
