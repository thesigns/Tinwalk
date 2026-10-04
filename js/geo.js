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

// Initial bearing from a to b in degrees, clockwise from north (0-360).
export function bearingDegrees(a, b) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLon = toRadians(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

// Average of { lat, lon, accuracy } readings, weighted so more accurate readings count more.
// Plain averaging of degrees is fine for points a few dozen meters apart.
export function averagePosition(readings) {
  let lat = 0;
  let lon = 0;
  let totalWeight = 0;
  for (const reading of readings) {
    const weight = 1 / Math.max(reading.accuracy, 1) ** 2;
    lat += reading.lat * weight;
    lon += reading.lon * weight;
    totalWeight += weight;
  }
  return { lat: lat / totalWeight, lon: lon / totalWeight };
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
