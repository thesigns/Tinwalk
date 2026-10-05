// The sun's position in the sky, from simplified NOAA formulas. Accurate to
// within a few minutes, which is plenty for telling day from night.

const DAY_MS = 24 * 60 * 60 * 1000;
// Julian date of the Unix epoch, and of J2000.0, which the formulas count from.
const UNIX_EPOCH_JD = 2440587.5;
const J2000_JD = 2451545;
const RAD = Math.PI / 180;

// The sun's elevation above the horizon in degrees at a { lat, lon }
// position and a time in ms; negative when it is below the horizon.
export function sunElevation(position, time) {
  const days = time / DAY_MS + UNIX_EPOCH_JD - J2000_JD;
  const meanLongitude = 280.46 + 0.9856474 * days;
  const meanAnomaly = (357.528 + 0.9856003 * days) * RAD;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * days) * RAD;
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  // Sidereal time at Greenwich, in degrees.
  const siderealTime = 280.46061837 + 360.98564736629 * days;
  const hourAngle = (siderealTime + position.lon) * RAD - rightAscension;
  const latitude = position.lat * RAD;
  const sine =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, sine))) / RAD;
}

const STEP_MS = 5 * 60 * 1000;

// When the sun next crosses the given elevation, rising or setting, within a
// day and a half; null if it doesn't (polar day or night). Found in 5-minute
// steps, close enough for "dark in 2 h".
export function nextCrossing(position, time, elevation) {
  const above = sunElevation(position, time) >= elevation;
  for (let t = time + STEP_MS; t <= time + 1.5 * DAY_MS; t += STEP_MS) {
    if (sunElevation(position, t) >= elevation !== above) return t;
  }
  return null;
}
