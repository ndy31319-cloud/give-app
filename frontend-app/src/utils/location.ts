import { NeighborhoodLocation, Post } from '@/src/types/app';

export function formatLocationLabel(location: NeighborhoodLocation) {
  return `${location.city} ${location.district} ${location.neighborhood}`.trim();
}

export function formatCompactLocation(location: NeighborhoodLocation) {
  return `${location.city} ${location.neighborhood}`.trim();
}

export function haversineDistanceKm(a: NeighborhoodLocation, b: NeighborhoodLocation) {
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

export function filterPostsByRadius(posts: Post[], origin: NeighborhoodLocation, radiusKm: number) {
  return posts.filter((post) => haversineDistanceKm(origin, post.location) <= radiusKm);
}

export function searchLocations(options: NeighborhoodLocation[], city: string, neighborhood: string) {
  const cityQuery = city.trim().toLowerCase();
  const neighborhoodQuery = neighborhood.trim().toLowerCase();

  return options.filter((option) => {
    const cityMatch = cityQuery ? option.city.toLowerCase().includes(cityQuery) : true;
    const neighborhoodMatch = neighborhoodQuery
      ? option.neighborhood.toLowerCase().includes(neighborhoodQuery) ||
        option.fullAddress.toLowerCase().includes(neighborhoodQuery)
      : true;

    return cityMatch && neighborhoodMatch;
  });
}
