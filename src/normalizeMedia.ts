import { getPosterUrl } from './services/embyApi';
import { NowPlayingItem } from './types/emby';

export interface MediaDisplayInfo {
  title: string;
  subtitle: string | null;   // series name / artist / channel
  detail: string | null;     // S·E badge / album / program episode title
  mediaTypeLabel: string;    // "Movie" | "TV Show" | "Music" | "Live TV" | ...
  backdropUrl: string | null;
  posterUrl: string | null;
  year: number | null;
  rating: string | null;
  communityRating: number | null;
  overview: string | null;
  genres: string[];
}

function resolveBackdrop(item: NowPlayingItem, serverAddress: string, width: number): string | null {
  // Tagged URLs (preferred — cache-busted)
  if (item.BackdropImageTags?.[0])
    return getPosterUrl(serverAddress, item.Id, item.BackdropImageTags[0], 'Backdrop', width);
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.[0])
    return getPosterUrl(serverAddress, item.ParentBackdropItemId, item.ParentBackdropImageTags[0], 'Backdrop', width);
  // Tag-less fallback — /Sessions omits BackdropImageTags but Emby still serves the image
  const backdropId = item.ParentBackdropItemId ?? item.Id;
  return `${serverAddress}/emby/Items/${backdropId}/Images/Backdrop?maxWidth=${Math.ceil(width)}&quality=90`;
}

function primaryUrl(serverAddress: string, item: NowPlayingItem, width = 300): string | null {
  if (!item.ImageTags?.Primary) return null;
  return getPosterUrl(serverAddress, item.Id, item.ImageTags.Primary, 'Primary', width);
}

export function normalizeMediaItem(
  item: NowPlayingItem,
  serverAddress: string,
  backdropWidth = 800,
  fallbackOverview?: string | null,
): MediaDisplayInfo {
  const genres = item.Genres ?? [];

  switch (item.Type) {
    case 'Movie':
      return {
        title: item.Name,
        subtitle: null,
        detail: null,
        mediaTypeLabel: 'Movie',
        backdropUrl: resolveBackdrop(item, serverAddress, backdropWidth),
        posterUrl: primaryUrl(serverAddress, item),
        year: item.ProductionYear ?? null,
        rating: item.OfficialRating ?? null,
        communityRating: item.CommunityRating ?? null,
        overview: item.Overview ?? null,
        genres,
      };

    case 'Episode': {
      const epDetail = item.ParentIndexNumber != null && item.IndexNumber != null
        ? `S${item.ParentIndexNumber} · E${item.IndexNumber}`
        : item.SeasonName ?? null;
      const posterUrl = item.SeriesId && item.SeriesPrimaryImageTag
        ? getPosterUrl(serverAddress, item.SeriesId, item.SeriesPrimaryImageTag, 'Primary', 300)
        : primaryUrl(serverAddress, item);
      return {
        title: item.Name,
        subtitle: item.SeriesName ?? null,
        detail: epDetail,
        mediaTypeLabel: 'TV Show',
        backdropUrl: resolveBackdrop(item, serverAddress, backdropWidth),
        posterUrl,
        year: null,
        rating: item.OfficialRating ?? null,
        communityRating: item.CommunityRating ?? null,
        overview: item.Overview ?? fallbackOverview ?? null,
        genres,
      };
    }

    case 'Audio': {
      const artist = item.Artists?.[0] ?? item.AlbumArtist ?? null;
      const posterUrl = item.AlbumId && item.AlbumPrimaryImageTag
        ? getPosterUrl(serverAddress, item.AlbumId, item.AlbumPrimaryImageTag, 'Primary', 300)
        : primaryUrl(serverAddress, item);
      return {
        title: item.Name,
        subtitle: artist,
        detail: item.Album ?? null,
        mediaTypeLabel: 'Music',
        backdropUrl: resolveBackdrop(item, serverAddress, backdropWidth),
        posterUrl,
        year: null,
        rating: null,
        communityRating: null,
        overview: item.Overview ?? null,
        genres,
      };
    }

    case 'MusicVideo': {
      const artist = item.Artists?.[0] ?? item.AlbumArtist ?? null;
      return {
        title: item.Name,
        subtitle: artist,
        detail: item.Album ?? null,
        mediaTypeLabel: 'Music Video',
        backdropUrl: resolveBackdrop(item, serverAddress, backdropWidth),
        posterUrl: primaryUrl(serverAddress, item),
        year: item.ProductionYear ?? null,
        rating: null,
        communityRating: null,
        overview: item.Overview ?? null,
        genres,
      };
    }

    case 'TvChannel':
    case 'Program':
      return {
        title: item.Name,
        subtitle: item.ChannelName ?? null,
        detail: item.EpisodeTitle ?? null,
        mediaTypeLabel: 'Live TV',
        backdropUrl: resolveBackdrop(item, serverAddress, backdropWidth),
        posterUrl: primaryUrl(serverAddress, item),
        year: null,
        rating: null,
        communityRating: null,
        overview: item.Overview ?? null,
        genres,
      };

    default:
      return {
        title: item.Name,
        subtitle: item.SeriesName ?? null,
        detail: item.ParentIndexNumber != null && item.IndexNumber != null
          ? `S${item.ParentIndexNumber} · E${item.IndexNumber}`
          : null,
        mediaTypeLabel: item.Type,
        backdropUrl: resolveBackdrop(item, serverAddress, backdropWidth),
        posterUrl: primaryUrl(serverAddress, item),
        year: item.ProductionYear ?? null,
        rating: item.OfficialRating ?? null,
        communityRating: item.CommunityRating ?? null,
        overview: item.Overview ?? null,
        genres,
      };
  }
}
