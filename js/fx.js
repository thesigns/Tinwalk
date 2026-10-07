// DOM helpers for icons and small interface animations.

const SVG_NS = 'http://www.w3.org/2000/svg';
const FLY_DURATION_MS = 650;
const FLY_ARC_PX = 70;

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// An icon from the SVG sprite, e.g. iconElement('food').
export function iconElement(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

// Restarts a CSS animation class, e.g. to make a status bar value pop.
export function replayAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

// Flies a copy of an icon in an arc from one element to another.
// `from` is an element or a DOMRect: a dialog that has just closed no longer
// has a box, so the caller may remember where its icon was.
export function flyIcon(name, from, to) {
  if (prefersReducedMotion()) return Promise.resolve();
  const start = from instanceof Element ? from.getBoundingClientRect() : from;
  const end = to.getBoundingClientRect();
  const flyer = iconElement(name);
  flyer.classList.add('flyer');
  Object.assign(flyer.style, {
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${start.width}px`,
    height: `${start.height}px`,
  });
  document.body.append(flyer);

  const dx = end.left + end.width / 2 - (start.left + start.width / 2);
  const dy = end.top + end.height / 2 - (start.top + start.height / 2);
  const scale = end.width / start.width;
  const animation = flyer.animate(
    [
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${dx / 2}px, ${dy / 2 - FLY_ARC_PX}px) scale(${(1 + scale) / 2}) rotate(-20deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.7 },
    ],
    { duration: FLY_DURATION_MS, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' },
  );
  return animation.finished.then(() => flyer.remove());
}
