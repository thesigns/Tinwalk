// Sound effects synthesized with the Web Audio API, so the game needs no audio files.

import { isSettingOn, saveSetting } from './settings.js';

const SETTING_KEY = 'tinwalk.sound';
const MASTER_VOLUME = 0.6;
// Geiger counter clicks per second at the edge of the fallout and in its hottest core.
const CRACKLE_MIN_RATE = 6;
const CRACKLE_MAX_RATE = 60;

export class SoundEffects {
  constructor() {
    this.enabled = isSettingOn(SETTING_KEY);
    this.context = null;
  }

  // Browsers only allow audio to start from a user gesture, so call this from one.
  unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = MASTER_VOLUME;
      this.master.connect(this.context.destination);
      this.noiseBuffer = createNoiseBuffer(this.context);
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    saveSetting(SETTING_KEY, enabled);
  }

  play(name) {
    if (!this.enabled || !this.context) return;
    SOUNDS[name]?.(this, this.context.currentTime);
  }

  // A Geiger counter's clicks for `duration` seconds, at random like the decays
  // it counts, and faster the hotter the fallout (intensity from 0 to 1).
  crackle(intensity, duration) {
    if (!this.enabled || !this.context) return;
    const start = this.context.currentTime;
    const rate = CRACKLE_MIN_RATE + (CRACKLE_MAX_RATE - CRACKLE_MIN_RATE) * intensity;
    for (let t = randomInterval(rate); t < duration; t += randomInterval(rate)) {
      this.noise(start + t, {
        duration: 0.004 + Math.random() * 0.004,
        volume: 0.5 + Math.random() * 0.4,
        frequency: 2500 + Math.random() * 1500,
        filter: 'highpass',
        q: 0.7,
      });
    }
  }

  // A single oscillator note with a sharp attack and an exponential fade.
  tone(time, { frequency, endFrequency = frequency, type = 'sine', duration, volume, attack = 0.005 }) {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    this.envelope(oscillator, time, duration, volume, attack);
  }

  // A burst of filtered noise: rustling, scraping, thuds.
  noise(time, { duration, volume, frequency, filter = 'bandpass', q = 1 }) {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const biquad = this.context.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = frequency;
    biquad.Q.value = q;
    source.connect(biquad);
    this.envelope(biquad, time, duration, volume, 0.003, source);
  }

  // Steady filtered noise that fades in and out, e.g. radio static.
  hiss(time, { duration, volume, frequency, q = 0.7, fade = 0.3 }) {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const biquad = this.context.createBiquadFilter();
    biquad.type = 'bandpass';
    biquad.frequency.value = frequency;
    biquad.Q.value = q;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + fade);
    gain.gain.setValueAtTime(volume, time + duration - fade);
    gain.gain.linearRampToValueAtTime(0, time + duration);
    source.connect(biquad);
    biquad.connect(gain);
    gain.connect(this.master);
    source.start(time);
    source.stop(time + duration + 0.05);
  }

  envelope(node, time, duration, volume, attack, source = node) {
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    node.connect(gain);
    gain.connect(this.master);
    source.start(time);
    source.stop(time + duration + 0.05);
  }
}

// Time to the next of events happening at random at `rate` per second.
function randomInterval(rate) {
  return -Math.log(1 - Math.random()) / rate;
}

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// A tin can being tapped: a few inharmonic partials that ring out briefly.
function clink(sound, time, pitch) {
  for (const [ratio, volume] of [[1, 0.22], [2.76, 0.1], [5.4, 0.05]]) {
    sound.tone(time, { frequency: 1250 * pitch * ratio, duration: 0.35, volume, attack: 0.002 });
  }
}

function thud(sound, time, volume) {
  sound.tone(time, { frequency: 130, endFrequency: 55, duration: 0.28, volume });
  sound.noise(time, { duration: 0.1, volume: volume * 0.6, frequency: 350, filter: 'lowpass' });
}

const SOUNDS = {
  // Rummaging through debris.
  search(sound, time) {
    for (let i = 0; i < 9; i++) {
      sound.noise(time + i * 0.14 + Math.random() * 0.05, {
        duration: 0.06 + Math.random() * 0.06,
        volume: 0.6 + Math.random() * 0.5,
        frequency: 900 + Math.random() * 1800,
        q: 2,
      });
    }
  },
  found(sound, time) {
    clink(sound, time, 1);
    clink(sound, time + 0.09, 1.26);
  },
  full(sound, time) {
    thud(sound, time, 0.5);
  },
  // A hopeful little arpeggio.
  survivor(sound, time) {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
      sound.tone(time + i * 0.09, { frequency, type: 'triangle', duration: 0.4, volume: 0.2 });
    });
  },
  // Items dropped into storage.
  unload(sound, time) {
    for (let i = 0; i < 4; i++) clink(sound, time + i * 0.07, 0.95 - i * 0.08);
    thud(sound, time + 0.3, 0.45);
  },
  // A stamp hitting the map.
  stamp(sound, time) {
    thud(sound, time, 0.7);
    clink(sound, time + 0.16, 1.45);
  },
  // Supplies tossed on the ground.
  drop(sound, time) {
    thud(sound, time, 0.4);
    sound.noise(time + 0.04, { duration: 0.12, volume: 0.35, frequency: 700, filter: 'lowpass' });
  },
  // An item landing in the backpack.
  land(sound, time) {
    sound.noise(time, { duration: 0.05, volume: 0.7, frequency: 2400, q: 3 });
  },
  // A growl, then a squeal.
  enemy(sound, time) {
    sound.tone(time, { frequency: 110, endFrequency: 70, type: 'sawtooth', duration: 0.5, volume: 0.1 });
    sound.noise(time, { duration: 0.45, volume: 0.5, frequency: 300, filter: 'lowpass' });
    sound.tone(time + 0.45, { frequency: 1900, endFrequency: 2600, type: 'triangle', duration: 0.18, volume: 0.12 });
  },
  // A swing that lands.
  hit(sound, time) {
    sound.noise(time, { duration: 0.12, volume: 0.5, frequency: 3000, q: 0.7 });
    thud(sound, time + 0.1, 0.6);
    clink(sound, time + 0.12, 0.8);
  },
  // A playing card snapped onto the table.
  flip(sound, time) {
    sound.noise(time, { duration: 0.06, volume: 0.5, frequency: 2400, q: 0.8 });
    sound.noise(time + 0.05, { duration: 0.03, volume: 0.6, frequency: 900, filter: 'lowpass' });
  },
  // Blades clashing, and neither gives way.
  stalemate(sound, time) {
    clink(sound, time, 1.5);
    clink(sound, time + 0.1, 1.4);
  },
  // Knocked down: two thuds and a falling note.
  defeat(sound, time) {
    thud(sound, time, 0.6);
    thud(sound, time + 0.18, 0.45);
    sound.tone(time + 0.1, { frequency: 330, endFrequency: 150, type: 'triangle', duration: 0.6, volume: 0.15 });
  },
  // Running footsteps.
  flee(sound, time) {
    for (let i = 0; i < 6; i++) {
      sound.noise(time + i * 0.11, { duration: 0.05, volume: 0.6 - i * 0.07, frequency: 500, filter: 'lowpass' });
    }
  },
  // Hammering scrap into shape.
  craft(sound, time) {
    for (let i = 0; i < 3; i++) {
      thud(sound, time + i * 0.2, 0.3);
      clink(sound, time + i * 0.2, 0.7 + i * 0.05);
    }
  },
  // A bandage, then a gentle rising pair of notes.
  heal(sound, time) {
    sound.noise(time, { duration: 0.25, volume: 0.25, frequency: 4000, filter: 'highpass' });
    sound.tone(time + 0.15, { frequency: 659.25, type: 'triangle', duration: 0.35, volume: 0.18 });
    sound.tone(time + 0.3, { frequency: 880, type: 'triangle', duration: 0.5, volume: 0.18 });
  },
  // Turning the dial through static, with crackles. Lasts about as long as
  // listening does in main.js.
  listen(sound, time) {
    sound.hiss(time, { duration: 3.4, volume: 0.22, frequency: 1800 });
    for (let i = 0; i < 14; i++) {
      sound.noise(time + 0.2 + Math.random() * 3, {
        duration: 0.02 + Math.random() * 0.04,
        volume: 0.3 + Math.random() * 0.4,
        frequency: 2500 + Math.random() * 2500,
        q: 4,
      });
    }
    // Squeals of the dial passing stations.
    for (const start of [0.6, 1.9]) {
      sound.tone(time + start, { frequency: 1400, endFrequency: 700, type: 'sine', duration: 0.4, volume: 0.04 });
    }
  },
  // A voice breaking through: Morse-like beeps.
  call(sound, time) {
    [0, 0.12, 0.24, 0.5, 0.74, 0.98, 1.24, 1.36, 1.48].forEach((start, i) => {
      const long = i >= 3 && i <= 5;
      sound.tone(time + start, { frequency: 880, type: 'square', duration: long ? 0.2 : 0.08, volume: 0.05 });
    });
  },
  // Nothing but static, dying out.
  static(sound, time) {
    sound.noise(time, { duration: 0.5, volume: 0.35, frequency: 1800, q: 0.7 });
  },
  // The signal fading out for good.
  lost(sound, time) {
    sound.hiss(time, { duration: 1.2, volume: 0.15, frequency: 1500, fade: 0.1 });
    sound.tone(time + 0.2, { frequency: 440, endFrequency: 180, type: 'triangle', duration: 0.9, volume: 0.15 });
  },
  // A new place stamped onto the map.
  landmark(sound, time) {
    thud(sound, time, 0.6);
    [659.25, 987.77].forEach((frequency, i) => {
      sound.tone(time + 0.15 + i * 0.12, { frequency, type: 'triangle', duration: 0.45, volume: 0.16 });
    });
  },
  // Pages riffling.
  manual(sound, time) {
    for (let i = 0; i < 5; i++) {
      sound.noise(time + i * 0.05, { duration: 0.04, volume: 0.4, frequency: 3500, filter: 'highpass' });
    }
    clink(sound, time + 0.3, 1.26);
  },
};
