import './styles.scss';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { registerSW } from 'virtual:pwa-register';

const $ = (selector) => document.querySelector(selector);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;
const SAVE_KEY = 'solar-voyager-v2-save';
const SETTINGS_KEY = 'solar-voyager-v2-settings';

const ui = {
  game: $('#game'),
  radar: $('#radar'),
  startOverlay: $('#startOverlay'),
  settingsOverlay: $('#settingsOverlay'),
  endOverlay: $('#endOverlay'),
  startButton: $('#startButton'),
  continueButton: $('#continueButton'),
  resetButton: $('#resetButton'),
  restartButton: $('#restartButton'),
  soundButton: $('#soundButton'),
  installButton: $('#installButton'),
  fullscreenButton: $('#fullscreenButton'),
  settingsButton: $('#settingsButton'),
  closeSettingsButton: $('#closeSettingsButton'),
  qualitySelect: $('#qualitySelect'),
  sensitivityRange: $('#sensitivityRange'),
  gyroToggle: $('#gyroToggle'),
  hapticsToggle: $('#hapticsToggle'),
  speedValue: $('#speedValue'),
  energyValue: $('#energyValue'),
  shieldValue: $('#shieldValue'),
  atlasValue: $('#atlasValue'),
  scoreValue: $('#scoreValue'),
  qualityValue: $('#qualityValue'),
  missionStage: $('#missionStage'),
  missionTitle: $('#missionTitle'),
  missionText: $('#missionText'),
  missionProgress: $('#missionProgress'),
  targetStatus: $('#targetStatus'),
  targetName: $('#targetName'),
  targetDistance: $('#targetDistance'),
  scanProgress: $('#scanProgress'),
  targetMarker: $('#targetMarker'),
  markerDistance: $('#markerDistance'),
  toast: $('#toast'),
  toastTitle: $('#toastTitle'),
  toastText: $('#toastText'),
  warning: $('#warning'),
  speedLines: $('#speedLines'),
  damageFlash: $('#damageFlash'),
  joystick: $('#joystick'),
  joystickKnob: $('#joystickKnob'),
  autopilotButton: $('#autopilotButton'),
  scanButton: $('#scanButton'),
  scanHint: $('#scanHint'),
  brakeButton: $('#brakeButton'),
  boostButton: $('#boostButton'),
  cycleTargetButton: $('#cycleTargetButton'),
  finalScore: $('#finalScore'),
  finalSummary: $('#finalSummary')
};

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function formatNumber(value) {
  return Math.max(0, Math.round(value)).toString().padStart(6, '0');
}

function haptic(pattern = 20) {
  if (game?.settings.haptics && navigator.vibrate) navigator.vibrate(pattern);
}

function makeRadialTexture(inner, middle, outer, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.36, middle);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePlanetTexture(type, colors, seed) {
  const random = seededRandom(seed);
  const width = 384;
  const height = 192;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, height);
  colors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, colors.length - 1), color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  if (type === 'earth') {
    context.fillStyle = '#3da665';
    for (let i = 0; i < 34; i += 1) {
      context.beginPath();
      context.ellipse(random() * width, random() * height, 7 + random() * 28, 4 + random() * 15, random() * Math.PI, 0, TAU);
      context.fill();
    }
    context.strokeStyle = 'rgba(255,255,255,.5)';
    context.lineWidth = 2;
    for (let i = 0; i < 14; i += 1) {
      const y = random() * height;
      context.beginPath();
      context.moveTo(-30, y);
      context.bezierCurveTo(80, y - 22, 230, y + 20, width + 30, y - 5);
      context.stroke();
    }
  } else if (type === 'gas') {
    for (let y = 0; y < height; y += 5) {
      context.globalAlpha = 0.18 + random() * 0.6;
      context.fillStyle = colors[Math.floor(random() * colors.length)];
      context.fillRect(0, y, width, 2 + random() * 6);
    }
    context.globalAlpha = 1;
    if (seed === 5) {
      context.fillStyle = 'rgba(180,57,35,.72)';
      context.beginPath();
      context.ellipse(270, 116, 32, 12, -0.08, 0, TAU);
      context.fill();
    }
  } else if (type === 'rock') {
    context.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 150; i += 1) {
      const radius = 1 + random() * 10;
      context.fillStyle = `rgba(35,22,24,${0.04 + random() * 0.2})`;
      context.beginPath();
      context.arc(random() * width, random() * height, radius, 0, TAU);
      context.fill();
    }
    context.globalCompositeOperation = 'source-over';
  } else if (type === 'ice') {
    context.strokeStyle = 'rgba(230,255,255,.26)';
    for (let i = 0; i < 24; i += 1) {
      context.lineWidth = 1 + random() * 3;
      context.beginPath();
      context.moveTo(0, random() * height);
      context.quadraticCurveTo(width / 2, random() * height, width, random() * height);
      context.stroke();
    }
  }

  const image = context.getImageData(0, 0, width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (random() - 0.5) * 18;
    image.data[i] = clamp(image.data[i] + noise, 0, 255);
    image.data[i + 1] = clamp(image.data[i + 1] + noise, 0, 255);
    image.data[i + 2] = clamp(image.data[i + 2] + noise, 0, 255);
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeCloudTexture(seed = 42) {
  const random = seededRandom(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255,255,255,.58)';
  for (let i = 0; i < 55; i += 1) {
    context.beginPath();
    context.ellipse(random() * canvas.width, random() * canvas.height, 9 + random() * 28, 2 + random() * 8, random() * Math.PI, 0, TAU);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.engineGain = null;
    this.engineOscillator = null;
    this.engineSub = null;
    this.engineFilter = null;
    this.ambientGain = null;
    this.muted = false;
  }

  async start() {
    if (!this.context) this.build();
    if (this.context.state !== 'running') await this.context.resume();
  }

  build() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.55;
