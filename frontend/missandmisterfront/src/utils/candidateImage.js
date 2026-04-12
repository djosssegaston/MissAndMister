import { resolveMediaUrl } from './mediaUrl';

const buildMediaUrl = (path = '') => resolveMediaUrl(path);

export const getCandidateImageSources = (candidate = {}, preferred = 'medium') => {
  const urls = candidate.photo_urls || {};
  const large = resolveMediaUrl(urls.large) || resolveMediaUrl(candidate.photo_url) || buildMediaUrl(candidate.photo_path);
  const medium = resolveMediaUrl(urls.medium) || large;
  const thumbnail = resolveMediaUrl(urls.thumbnail) || medium || large;
  const original = resolveMediaUrl(urls.original) || buildMediaUrl(candidate.photo_original_path);
  const portrait = original || large || medium || thumbnail || null;
  const backdrop = medium || large || thumbnail || portrait || null;

  const src = {
    thumbnail,
    medium,
    large,
    original,
    portrait,
  }[preferred] || portrait || medium || large || thumbnail || original || null;

  const srcSetItems = [];
  const shouldExposeVariantSrcSet = src !== original && preferred !== 'portrait' && preferred !== 'original';
  if (shouldExposeVariantSrcSet) {
    if (thumbnail) srcSetItems.push(`${thumbnail} 480w`);
    if (medium && medium !== thumbnail) srcSetItems.push(`${medium} 800w`);
    if (large && large !== medium) srcSetItems.push(`${large} 1400w`);
  }

  return {
    src,
    thumbnail,
    medium,
    large,
    original,
    portrait,
    backdrop,
    srcSet: srcSetItems.length > 0 ? srcSetItems.join(', ') : undefined,
  };
};

export { buildMediaUrl };
