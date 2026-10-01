// Geographic math: distances between points and the Web Mercator projection used by the map.

const EARTH_RADIUS = 6371008.8;
const MERCATOR_RADIUS = 6378137;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

// Haversine distance in meters between two { lat, lon } points.
export function distanceMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

export function toMercator({ lat, lon }) {
  return {
    x: MERCATOR_RADIUS * toRadians(lon),
    y: MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + toRadians(lat) / 2)),
  };
}

export function fromMercator({ x, y }) {
  return {
    lat: toDegrees(2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2),
    lon: toDegrees(x / MERCATOR_RADIUS),
  };
}

// Web Mercator stretches distances away from the equator; this is how many
// Mercator units correspond to one real meter at the given latitude.
export function mercatorUnitsPerMeter(lat) {
  return 1 / Math.cos(toRadians(lat));
}
