
/*
 * Audio upgrade: original procedural sci-fi score and cockpit-transmitted
 * propulsion audio. The music is intentionally new; it only shares the broad
 * ambient/navigation mood of classic space exploration soundtracks.
 */

const ENHANCED_AUDIO_VERSION = 3;

function makeAudioNoiseBuffer(context, seconds, generator) {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  generator(data);
  return buffer;
}

function makeBrownNoise(data) {
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.025 * white) / 1.025;
    data[i] = clamp(last * 3.2, -1, 1);
  }
}

function makeCombustionNoise(data) {
  let envelope = 0;
  for (let i = 0; i < data.length; i += 1) {
    const trigger = Math.random() > 0.995 ? 0.65 + Math.random() * 0.35 : 0;
    envelope = Math.max(trigger, envelope * 0.965);
    const white = Math.random() * 2 - 1;
    data[i] = clamp(white * (0.16 + envelope) + (Math.random() * 2 - 1) * 0.035, -1, 1);
  }
}

function makeReverbImpulse(context, seconds = 4.2, decay = 3.1) {
  const length = Math.floor(context.sampleRate * seconds);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const tail = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * tail * (channel === 0 ? 1 : 0.93);
    }
  }
  return impulse;
}

function createSafeStereoPanner(context, pan = 0) {
  if (typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    return panner;
  }
  return context.createGain();
}

function ensureEnhancedAudioState(audio) {
  if (audio.enhancedAudioVersion === ENHANCED_AUDIO_VERSION) return;
  audio.enhancedAudioVersion = ENHANCED_AUDIO_VERSION;
  audio.context = null;
  audio.master = null;
  audio.musicBus = null;
  audio.musicDry = null;
  audio.musicWet = null;
  audio.engineBus = null;
  audio.sfxBus = null;
  audio.engineGain = null;
  audio.engineFilter = null;
  audio.engineRumble = null;
  audio.engineHarmonic = null;
  audio.engineWhine = null;
  audio.engineNoiseSource = null;
  audio.engineNoiseFilter = null;
  audio.engineNoiseGain = null;
  audio.combustionSource = null;
  audio.combustionFilter = null;
  audio.combustionGain = null;
  audio.musicTimer = null;
  audio.musicBar = 0;
  audio.nextMusicBarTime = 0;
  audio.lastBoost = false;
  audio.muted = false;
}

AudioEngine.prototype.start = async function startEnhancedAudio() {
  ensureEnhancedAudioState(this);
  if (!this.context) this.build();
  if (!this.context) return;
  if (this.context.state !== 'running') await this.context.resume();
  this.startMusic();
};

AudioEngine.prototype.build = function buildEnhancedAudio() {
  ensureEnhancedAudioState(this);
  const BrowserAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!BrowserAudioContext || this.context) return;

  this.context = new BrowserAudioContext({ latencyHint: 'interactive' });
  const now = this.context.currentTime;

  this.master = this.context.createGain();
  this.master.gain.setValueAtTime(this.muted ? 0.0001 : 0.72, now);

  const limiter = this.context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 12;
  limiter.ratio.value = 5;
  limiter.attack.value = 0.006;
  limiter.release.value = 0.22;
  this.master.connect(limiter).connect(this.context.destination);

  this.musicBus = this.context.createGain();
  this.musicBus.gain.value = 0.19;
  this.engineBus = this.context.createGain();
  this.engineBus.gain.value = 0.78;
  this.sfxBus = this.context.createGain();
  this.sfxBus.gain.value = 0.72;
  this.musicBus.connect(this.master);
  this.engineBus.connect(this.master);
  this.sfxBus.connect(this.master);

  const reverb = this.context.createConvolver();
  reverb.buffer = makeReverbImpulse(this.context);
  this.musicDry = this.context.createGain();
  this.musicWet = this.context.createGain();
  this.musicDry.gain.value = 0.72;
  this.musicWet.gain.value = 0.42;
  this.musicDry.connect(this.musicBus);
  this.musicWet.connect(reverb).connect(this.musicBus);

  // A rocket cannot be heard through vacuum. This layer represents vibration
  // transmitted through the spacecraft hull, seat and cockpit structure.
  this.engineGain = this.context.createGain();
  this.engineGain.gain.value = 0.0001;
  this.engineFilter = this.context.createBiquadFilter();
  this.engineFilter.type = 'lowpass';
  this.engineFilter.frequency.value = 260;
  this.engineFilter.Q.value = 0.75;
  const engineCompressor = this.context.createDynamicsCompressor();
  engineCompressor.threshold.value = -20;
  engineCompressor.ratio.value = 4;
  engineCompressor.attack.value = 0.008;
  engineCompressor.release.value = 0.16;
  this.engineGain.connect(this.engineFilter).connect(engineCompressor).connect(this.engineBus);

  this.engineRumble = this.context.createOscillator();
  this.engineRumble.type = 'sine';
  this.engineRumble.frequency.value = 31;
  const rumbleGain = this.context.createGain();
  rumbleGain.gain.value = 0.58;
  this.engineRumble.connect(rumbleGain).connect(this.engineGain);

  this.engineHarmonic = this.context.createOscillator();
  this.engineHarmonic.type = 'triangle';
  this.engineHarmonic.frequency.value = 63;
  const harmonicGain = this.context.createGain();
  harmonicGain.gain.value = 0.24;
  this.engineHarmonic.connect(harmonicGain).connect(this.engineGain);

  this.engineWhine = this.context.createOscillator();
  this.engineWhine.type = 'sine';
  this.engineWhine.frequency.value = 126;
  const whineGain = this.context.createGain();
  whineGain.gain.value = 0.07;
  this.engineWhine.connect(whineGain).connect(this.engineGain);

  const brownNoise = makeAudioNoiseBuffer(this.context, 2.4, makeBrownNoise);
  this.engineNoiseSource = this.context.createBufferSource();
  this.engineNoiseSource.buffer = brownNoise;
  this.engineNoiseSource.loop = true;
  this.engineNoiseFilter = this.context.createBiquadFilter();
  this.engineNoiseFilter.type = 'bandpass';
  this.engineNoiseFilter.frequency.value = 115;
  this.engineNoiseFilter.Q.value = 0.8;
  this.engineNoiseGain = this.context.createGain();
  this.engineNoiseGain.gain.value = 0.32;
  this.engineNoiseSource.connect(this.engineNoiseFilter).connect(this.engineNoiseGain).connect(this.engineGain);

  const combustionNoise = makeAudioNoiseBuffer(this.context, 1.8, makeCombustionNoise);
  this.combustionSource = this.context.createBufferSource();
  this.combustionSource.buffer = combustionNoise;
  this.combustionSource.loop = true;
  this.combustionFilter = this.context.createBiquadFilter();
  this.combustionFilter.type = 'bandpass';
  this.combustionFilter.frequency.value = 620;
  this.combustionFilter.Q.value = 0.65;
  this.combustionGain = this.context.createGain();
  this.combustionGain.gain.value = 0.12;
  this.combustionSource.connect(this.combustionFilter).connect(this.combustionGain).connect(this.engineGain);

  this.engineRumble.start();
  this.engineHarmonic.start();
  this.engineWhine.start();
  this.engineNoiseSource.start();
  this.combustionSource.start();
};

AudioEngine.prototype.update = function updateEnhancedAudio(speedRatio, boost, scanning) {
  ensureEnhancedAudioState(this);
  if (!this.context || !this.engineGain) return;
  const now = this.context.currentTime;
  const throttle = clamp(speedRatio, 0, 1.4);
  const boostAmount = boost ? 1 : 0;

  this.engineRumble.frequency.setTargetAtTime(29 + throttle * 24 + boostAmount * 11, now, 0.075);
  this.engineHarmonic.frequency.setTargetAtTime(61 + throttle * 54 + boostAmount * 24, now, 0.065);
  this.engineWhine.frequency.setTargetAtTime(118 + throttle * 205 + boostAmount * 165, now, 0.045);
  this.engineFilter.frequency.setTargetAtTime(210 + throttle * 520 + boostAmount * 620, now, 0.06);
  this.engineNoiseFilter.frequency.setTargetAtTime(90 + throttle * 210 + boostAmount * 130, now, 0.08);
  this.combustionFilter.frequency.setTargetAtTime(430 + throttle * 720 + boostAmount * 680, now, 0.055);
  this.engineNoiseGain.gain.setTargetAtTime(0.25 + throttle * 0.27 + boostAmount * 0.12, now, 0.07);
  this.combustionGain.gain.setTargetAtTime(0.06 + throttle * 0.12 + boostAmount * 0.24, now, 0.045);

  const desiredGain = this.muted
    ? 0.0001
    : 0.018 + throttle * 0.046 + boostAmount * 0.055 + (scanning ? 0.004 : 0);
  this.engineGain.gain.setTargetAtTime(Math.max(0.0001, desiredGain), now, 0.055);

  if (boost && !this.lastBoost) this.ignitionBurst();
  this.lastBoost = boost;
};

AudioEngine.prototype.startMusic = function startProceduralMusic() {
  if (!this.context || this.musicTimer) return;
  this.musicBar = 0;
  this.nextMusicBarTime = this.context.currentTime + 0.08;
  const schedule = () => {
    if (!this.context) return;
    while (this.nextMusicBarTime < this.context.currentTime + 1.25) {
      this.scheduleMusicBar(this.musicBar, this.nextMusicBarTime);
      this.musicBar = (this.musicBar + 1) % 8;
      this.nextMusicBarTime += 3.2;
    }
  };
  schedule();
  this.musicTimer = window.setInterval(schedule, 220);
};

AudioEngine.prototype.scheduleMusicBar = function scheduleMusicBar(barIndex, start) {
  const chords = [
    [164.81, 220.0, 246.94, 329.63],
    [130.81, 196.0, 246.94, 293.66],
    [146.83, 220.0, 293.66, 369.99],
    [123.47, 185.0, 246.94, 329.63],
    [110.0, 164.81, 220.0, 246.94],
    [130.81, 164.81, 196.0, 246.94],
    [123.47, 146.83, 185.0, 246.94],
    [146.83, 185.0, 220.0, 293.66]
  ];
  const chord = chords[barIndex];
  const padDuration = 5.4;

  chord.forEach((frequency, voiceIndex) => {
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const panner = createSafeStereoPanner(this.context, [-0.58, -0.18, 0.24, 0.6][voiceIndex]);
    oscillator.type = voiceIndex % 2 === 0 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency / (voiceIndex === 0 ? 2 : 1), start);
    oscillator.detune.setValueAtTime((voiceIndex - 1.5) * 3.2, start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(720 + voiceIndex * 180, start);
    filter.Q.value = 0.45;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.024 / (voiceIndex * 0.28 + 1), start + 1.05);
    gain.gain.setValueAtTime(0.019 / (voiceIndex * 0.25 + 1), start + 3.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + padDuration);
    oscillator.connect(filter).connect(gain).connect(panner);
    panner.connect(this.musicDry);
    panner.connect(this.musicWet);
    oscillator.start(start);
    oscillator.stop(start + padDuration + 0.08);
  });

  const arpOrder = [0, 2, 1, 3, 2, 1, 3, 1];
  arpOrder.forEach((chordIndex, step) => {
    const noteStart = start + 0.18 + step * 0.36;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const panner = createSafeStereoPanner(this.context, step % 2 === 0 ? -0.34 : 0.34);
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(chord[chordIndex] * (step % 3 === 0 ? 2 : 1), noteStart);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1750, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.028, noteStart + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.42);
    oscillator.connect(filter).connect(gain).connect(panner);
    panner.connect(this.musicDry);
    panner.connect(this.musicWet);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.48);
  });

  const pulseStart = start + 0.04;
  const pulse = this.context.createOscillator();
  const pulseGain = this.context.createGain();
  pulse.type = 'sine';
  pulse.frequency.setValueAtTime(chord[0] / 4, pulseStart);
  pulseGain.gain.setValueAtTime(0.0001, pulseStart);
  pulseGain.gain.exponentialRampToValueAtTime(0.04, pulseStart + 0.08);
  pulseGain.gain.exponentialRampToValueAtTime(0.0001, pulseStart + 1.6);
  pulse.connect(pulseGain).connect(this.musicWet);
  pulse.start(pulseStart);
  pulse.stop(pulseStart + 1.7);
};

AudioEngine.prototype.ignitionBurst = function ignitionBurst() {
  if (!this.context || this.muted) return;
  const now = this.context.currentTime;
  const source = this.context.createBufferSource();
  source.buffer = makeAudioNoiseBuffer(this.context, 0.55, makeCombustionNoise);
  const filter = this.context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1250, now);
  filter.frequency.exponentialRampToValueAtTime(180, now + 0.48);
  const gain = this.context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
  source.connect(filter).connect(gain).connect(this.engineBus);
  source.start(now);
  source.stop(now + 0.56);
};

AudioEngine.prototype.tone = function enhancedTone(frequency, duration = 0.18, type = 'sine', gainValue = 0.08, delay = 0, pan = 0) {
  if (!this.context || this.muted) return;
  const start = this.context.currentTime + delay;
  const oscillator = this.context.createOscillator();
  const gain = this.context.createGain();
  const panner = createSafeStereoPanner(this.context, pan);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(panner).connect(this.sfxBus);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
};

AudioEngine.prototype.scanPing = function enhancedScanPing(progress = 0) {
  this.tone(440 + progress * 420, 0.14, 'sine', 0.048, 0, -0.18 + progress * 0.36);
  this.tone(880 + progress * 260, 0.08, 'triangle', 0.018, 0.035, 0.2);
};

AudioEngine.prototype.collect = function enhancedCollect() {
  [523.25, 659.25, 880].forEach((frequency, index) => this.tone(frequency, 0.22, 'triangle', 0.052, index * 0.065, -0.3 + index * 0.3));
};

AudioEngine.prototype.success = function enhancedSuccess() {
  [329.63, 440, 554.37, 739.99].forEach((frequency, index) => this.tone(frequency, 0.42, 'sine', 0.062, index * 0.095, -0.45 + index * 0.3));
};

AudioEngine.prototype.impact = function enhancedImpact() {
  if (!this.context || this.muted) return;
  const now = this.context.currentTime;
  const source = this.context.createBufferSource();
  source.buffer = makeAudioNoiseBuffer(this.context, 0.38, (data) => {
    for (let i = 0; i < data.length; i += 1) {
      const decay = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }
  });
  const filter = this.context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(90, now + 0.34);
  const gain = this.context.createGain();
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  source.connect(filter).connect(gain).connect(this.sfxBus);
  source.start(now);
  source.stop(now + 0.4);
  this.tone(46, 0.42, 'sine', 0.12, 0.01);
};

AudioEngine.prototype.toggle = function toggleEnhancedAudio() {
  ensureEnhancedAudioState(this);
  this.muted = !this.muted;
  if (this.master && this.context) {
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.72, this.context.currentTime, 0.045);
  }
  ui.soundButton.textContent = this.muted ? '🔇' : '🔊';
  ui.soundButton.setAttribute('aria-label', this.muted ? 'Activar sonido' : 'Silenciar sonido');
};
