import { NeighborhoodLocation, Post } from '@/src/types/app';

export function formatLocationLabel(location: NeighborhoodLocation) {
  return `${location.city ?? ''} ${location.district ?? ''} ${location.neighborhood ?? location.dongName ?? ''}`.trim();
}

export function formatCompactLocation(location: NeighborhoodLocation) {
  return `${location.city ?? ''} ${location.neighborhood ?? location.dongName ?? ''}`.trim();
}

export function haversineDistanceKm(a: NeighborhoodLocation, b: NeighborhoodLocation) {
  if (
    typeof a.latitude !== 'number' ||
    typeof a.longitude !== 'number' ||
    typeof b.latitude !== 'number' ||
    typeof b.longitude !== 'number' ||
    !Number.isFinite(a.latitude) ||
    !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) ||
    !Number.isFinite(b.longitude)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return Number((earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))).toFixed(1));
}

function normalizeLocationText(value?: string | null) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function isSameNeighborhood(a: NeighborhoodLocation, b: NeighborhoodLocation) {
  const originNames = [
    a.dongName,
    a.neighborhood,
    a.fullAddress,
  ].map(normalizeLocationText).filter(Boolean);

  const postNames = [
    b.dongName,
    b.neighborhood,
    b.fullAddress,
  ].map(normalizeLocationText).filter(Boolean);

  return originNames.some((originName) =>
    postNames.some((postName) => originName === postName || originName.includes(postName) || postName.includes(originName)),
  );
}

export function filterPostsByRadius(posts: Post[], origin: NeighborhoodLocation, radiusKm: number) {
  return posts.filter((post) => {
    if (!post.location) return false;

    if (isSameNeighborhood(origin, post.location)) {
      return true;
    }

    const distance = haversineDistanceKm(origin, post.location);
    return Number.isFinite(distance) && distance <= radiusKm;
  });
}

export function searchLocations(options: NeighborhoodLocation[], city: string, neighborhood: string) {
  const cityQuery = city.trim().toLowerCase();
  const neighborhoodQuery = neighborhood.trim().toLowerCase();

  return options.filter((option) => {
    const cityText = String(option.city ?? '').toLowerCase();
    const neighborhoodText = String(option.neighborhood ?? option.dongName ?? '').toLowerCase();
    const addressText = String(option.fullAddress ?? '').toLowerCase();
    const cityMatch = cityQuery ? cityText.includes(cityQuery) : true;
    const neighborhoodMatch = neighborhoodQuery
      ? neighborhoodText.includes(neighborhoodQuery) || addressText.includes(neighborhoodQuery)
      : true;

    return cityMatch && neighborhoodMatch;
  });
}
