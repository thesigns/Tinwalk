// Sound effects synthesized with the Web Audio API, so the game needs no audio files.

import { isSettingOn, saveSetting } from './settings.js';

const SETTING_KEY = 'tinwalk.sound';
const MASTER_VOLUME = 0.6;

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
};
