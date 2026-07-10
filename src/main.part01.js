    this.master.connect(this.context.destination);

    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0.018;
    this.engineFilter = this.context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 220;
    this.engineFilter.Q.value = 4;
    this.engineGain.connect(this.engineFilter).connect(this.master);

    this.engineOscillator = this.context.createOscillator();
    this.engineOscillator.type = 'sawtooth';
    this.engineOscillator.frequency.value = 46;
    this.engineSub = this.context.createOscillator();
    this.engineSub.type = 'sine';
    this.engineSub.frequency.value = 23;
    this.engineOscillator.connect(this.engineGain);
    this.engineSub.connect(this.engineGain);
    this.engineOscillator.start();
    this.engineSub.start();

    this.ambientGain = this.context.createGain();
    this.ambientGain.gain.value = 0.022;
    this.ambientGain.connect(this.master);
    [55, 82.5, 110].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.18 / (index + 1);
      oscillator.connect(gain).connect(this.ambientGain);
      oscillator.start();
    });
  }

  update(speedRatio, boost, scanning) {
    if (!this.context || !this.engineGain) return;
    const time = this.context.currentTime;
    this.engineOscillator.frequency.setTargetAtTime(42 + speedRatio * 62 + (boost ? 42 : 0), time, 0.05);
    this.engineSub.frequency.setTargetAtTime(21 + speedRatio * 28, time, 0.07);
    this.engineFilter.frequency.setTargetAtTime(170 + speedRatio * 520 + (boost ? 800 : 0), time, 0.05);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.014 + speedRatio * 0.025 + (boost ? 0.032 : 0) + (scanning ? 0.006 : 0), time, 0.05);
  }

  tone(frequency, duration = 0.18, type = 'sine', gainValue = 0.08, delay = 0) {
    if (!this.context || this.muted) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  scanPing(progress = 0) {
    this.tone(420 + progress * 380, 0.12, 'sine', 0.055);
  }

  collect() {
    [540, 720, 960].forEach((frequency, index) => this.tone(frequency, 0.2, 'triangle', 0.055, index * 0.06));
  }

  success() {
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => this.tone(frequency, 0.34, 'sine', 0.075, index * 0.09));
  }

  impact() {
    this.tone(78, 0.3, 'sawtooth', 0.12);
    this.tone(48, 0.42, 'sine', 0.14, 0.02);
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.context.currentTime, 0.05);
    ui.soundButton.textContent = this.muted ? '🔇' : '🔊';
  }
}

class InputController {
  constructor() {
    this.axes = new THREE.Vector2();
    this.keyboard = new THREE.Vector2();
    this.gyro = new THREE.Vector2();
    this.boost = false;
    this.brake = false;
    this.scan = false;
    this.pointerId = null;
    this.center = new THREE.Vector2();
    this.radius = 48;
    this.install();
  }

  install() {
    const updateJoystick = (event) => {
      if (event.pointerId !== this.pointerId) return;
      const deltaX = event.clientX - this.center.x;
      const deltaY = event.clientY - this.center.y;
      const length = Math.hypot(deltaX, deltaY) || 1;
      const scale = Math.min(1, this.radius / length);
      const x = deltaX * scale;
      const y = deltaY * scale;
      this.axes.set(x / this.radius, y / this.radius);
      ui.joystickKnob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    ui.joystick.addEventListener('pointerdown', (event) => {
      this.pointerId = event.pointerId;
      ui.joystick.setPointerCapture(event.pointerId);
      const rect = ui.joystick.getBoundingClientRect();
      this.center.set(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.radius = rect.width * 0.31;
      updateJoystick(event);
    });
    ui.joystick.addEventListener('pointermove', updateJoystick);
    const releaseJoystick = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.axes.set(0, 0);
      ui.joystickKnob.style.transform = 'translate3d(0,0,0)';
    };
    ui.joystick.addEventListener('pointerup', releaseJoystick);
    ui.joystick.addEventListener('pointercancel', releaseJoystick);

    this.bindHold(ui.boostButton, 'boost');
    this.bindHold(ui.brakeButton, 'brake');
    this.bindHold(ui.scanButton, 'scan');

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') this.keyboard.x = -1;
      if (event.code === 'KeyD' || event.code === 'ArrowRight') this.keyboard.x = 1;
      if (event.code === 'KeyW' || event.code === 'ArrowUp') this.keyboard.y = -1;
      if (event.code === 'KeyS' || event.code === 'ArrowDown') this.keyboard.y = 1;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.boost = true;
      if (event.code === 'Space') this.scan = true;
      if (event.code === 'KeyX') this.brake = true;
      if (event.code === 'KeyE' && !event.repeat) game?.toggleAutopilot();
      if (event.code === 'KeyC' && !event.repeat) game?.cycleTarget();
    });
    window.addEventListener('keyup', (event) => {
      if ((event.code === 'KeyA' || event.code === 'ArrowLeft') && this.keyboard.x < 0) this.keyboard.x = 0;
      if ((event.code === 'KeyD' || event.code === 'ArrowRight') && this.keyboard.x > 0) this.keyboard.x = 0;
      if ((event.code === 'KeyW' || event.code === 'ArrowUp') && this.keyboard.y < 0) this.keyboard.y = 0;
      if ((event.code === 'KeyS' || event.code === 'ArrowDown') && this.keyboard.y > 0) this.keyboard.y = 0;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.boost = false;
      if (event.code === 'Space') this.scan = false;
      if (event.code === 'KeyX') this.brake = false;
    });
  }

  bindHold(element, property) {
    const release = () => {
      this[property] = false;
      element.classList.remove('active');
    };
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this[property] = true;
      element.classList.add('active');
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  getAxes(settings) {
    const touch = this.axes.clone();
    touch.x += this.keyboard.x;
    touch.y += this.keyboard.y;
    if (settings.gyro) {
      touch.x += this.gyro.x;
      touch.y += this.gyro.y;
    }
    touch.multiplyScalar(settings.sensitivity);
    if (touch.lengthSq() > 1) touch.normalize();
    return touch;
  }
}

const PLANET_DATA = [
  { name: 'Mercurio', radius: 54, size: 3.4, speed: 0.19, angle: 0.4, type: 'rock', colors: ['#8c8176', '#5a514a', '#c4b5a2'], color: 0xb8a898, fact: 'Un mundo metálico cubierto de cráteres y extremos térmicos.' },
  { name: 'Venus', radius: 73, size: 5.8, speed: 0.145, angle: 1.7, type: 'gas', colors: ['#d7a14c', '#f2c96f', '#a8662f'], color: 0xe5aa54, fact: 'Su espesa atmósfera convierte la superficie en un horno planetario.' },
  { name: 'Tierra', radius: 94, size: 6.2, speed: 0.115, angle: 3.15, type: 'earth', colors: ['#126cbd', '#1f91d1', '#0f4f94'], color: 0x4fc4ff, fact: 'Océanos líquidos, atmósfera activa y una biosfera extraordinaria.' },
  { name: 'Marte', radius: 116, size: 4.7, speed: 0.092, angle: 5.0, type: 'rock', colors: ['#a94c2e', '#c86c3f', '#71301f'], color: 0xff7b54, fact: 'Valles, volcanes gigantes y señales de un pasado mucho más húmedo.' },
  { name: 'Júpiter', radius: 151, size: 12.2, speed: 0.054, angle: 2.25, type: 'gas', colors: ['#d7b084', '#a66f4d', '#f0d0a1', '#7e4c38'], color: 0xffc28a, fact: 'El gigante del sistema, envuelto en bandas y tormentas colosales.' },
  { name: 'Saturno', radius: 190, size: 10.4, speed: 0.038, angle: 4.25, type: 'gas', colors: ['#e7ca8b', '#bfa267', '#f1d99d'], color: 0xffd98b, rings: true, fact: 'Sus anillos son un inmenso disco de hielo, roca y polvo.' },
  { name: 'Urano', radius: 225, size: 8.3, speed: 0.027, angle: 0.9, type: 'ice', colors: ['#71d5db', '#a6eff0', '#499fae'], color: 0x8ff7ff, rings: true, fact: 'Un gigante helado que rota casi recostado sobre su órbita.' },
  { name: 'Neptuno', radius: 260, size: 8.1, speed: 0.021, angle: 5.5, type: 'ice', colors: ['#315bd5', '#497cf0', '#17358e'], color: 0x4e78ff, fact: 'Vientos supersónicos recorren su atmósfera azul y profunda.' }
];

class SolarVoyagerGame {
  constructor() {
    this.settings = this.loadSettings();
    this.state = {
      started: false,
      elapsed: 0,
      speed: 18,
      targetSpeed: 18,
      energy: 100,
      shield: 100,
      score: 0,
      visited: 0,
      scanProgress: 0,
      targetIndex: 2,
      autopilot: false,
      stage: 'scan',
      collisionCooldown: 0,
      asteroidTimer: 0,
      saveTimer: 0,
      toastTimer: 0,
      warningTimer: 0,
      cameraShake: 0,
      quality: 'high',
      fpsFrames: 0,
