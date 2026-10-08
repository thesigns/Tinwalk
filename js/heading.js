// Which way the phone points, from its compass: degrees clockwise from north,
// or null when unknown (no compass, no permission, or no recent reading).
//
// Android Chrome reports the absolute orientation with
// `deviceorientationabsolute`; iPhones give a ready heading in
// `webkitCompassHeading`, but only after the player allows it, and the
// browser asks only in response to a tap. Desktops have no compass.

// How much each reading moves the smoothed heading; the compass jitters.
const SMOOTHING = 0.2;
// The smallest change worth redrawing the map for, in degrees.
const MIN_CHANGE = 2;
// A heading older than this is dropped (the sensor stopped, or the page slept).
const STALE_MS = 3000;

const RADIANS = Math.PI / 180;

export class HeadingTracker extends EventTarget {
  constructor() {
    super();
    this.heading = null;
    this.started = false;
    // The smoothed direction as a unit vector (east, north), so it averages
    // cleanly across north.
    this.east = 0;
    this.north = 0;
    this.reported = null;
    this.staleTimer = null;
    // Set by debug mode, which has no compass on a computer.
    this.manual = false;
  }

  // Debug mode: points the heading by hand, e.g. along the last move. The
  // compass, if there is one, no longer overrides it.
  setManual(degrees) {
    this.manual = true;
    clearTimeout(this.staleTimer);
    this.heading = degrees;
    this.reported = degrees;
    this.dispatchEvent(new Event('change'));
  }

  // Starts listening. Call it from a tap: on iPhones this asks for permission.
  start() {
    if (this.started) return;
    this.started = true;
    if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((answer) => {
          if (answer === 'granted') this.listen();
        })
        .catch((error) => console.warn('No access to the compass', error));
    } else {
      this.listen();
    }
  }

  listen() {
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', (event) => this.read(event));
    } else {
      window.addEventListener('deviceorientation', (event) => this.read(event));
    }
  }

  read(event) {
    if (this.manual) return;
    let heading = null;
    if (typeof event.webkitCompassHeading === 'number') {
      heading = event.webkitCompassHeading;
    } else if (event.absolute && event.alpha !== null) {
      heading = headingFromAngles(event.alpha, event.beta ?? 0, event.gamma ?? 0);
    }
    if (heading === null || Number.isNaN(heading)) return;
    // The page may be turned sideways, and the heading should follow the screen's top.
    heading += screen.orientation?.angle ?? window.orientation ?? 0;

    const east = Math.sin(heading * RADIANS);
    const north = Math.cos(heading * RADIANS);
    const fresh = this.heading === null;
    this.east = fresh ? east : this.east + (east - this.east) * SMOOTHING;
    this.north = fresh ? north : this.north + (north - this.north) * SMOOTHING;
    this.heading = (Math.atan2(this.east, this.north) / RADIANS + 360) % 360;
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.drop(), STALE_MS);

    const change = this.reported === null ? Infinity : Math.abs(((this.heading - this.reported + 540) % 360) - 180);
    if (change >= MIN_CHANGE) {
      this.reported = this.heading;
      this.dispatchEvent(new Event('change'));
    }
  }

  drop() {
    this.heading = null;
    this.reported = null;
    this.dispatchEvent(new Event('change'));
  }
}

// The compass heading of where the phone points, from its orientation angles
// (in degrees). Flat on a palm, that is where its top points; held upright,
// where its back faces. In between, the two blend, so tilting the phone
// doesn't swing the heading.
function headingFromAngles(alpha, beta, gamma) {
  const cA = Math.cos(alpha * RADIANS);
  const sA = Math.sin(alpha * RADIANS);
  const cB = Math.cos(beta * RADIANS);
  const sB = Math.sin(beta * RADIANS);
  const cG = Math.cos(gamma * RADIANS);
  const sG = Math.sin(gamma * RADIANS);
  // The device's top (its y axis) and back (minus its z axis), in east and north.
  const topEast = -sA * cB;
  const topNorth = cA * cB;
  const backEast = -cA * sG - sA * sB * cG;
  const backNorth = -sA * sG + cA * sB * cG;
  return (Math.atan2(topEast + backEast, topNorth + backNorth) / RADIANS + 360) % 360;
}
