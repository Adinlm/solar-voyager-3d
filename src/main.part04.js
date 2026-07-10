    this.finalGate.position.set(0, 38, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0xffd56b, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(8, 0.42, 12, 96), material);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.16, 8, 72), material.clone());
    ring2.rotation.y = Math.PI / 2;
    this.finalGate.add(ring1, ring2);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeRadialTexture('rgba(255,255,255,.9)', 'rgba(255,208,80,.3)', 'rgba(0,0,0,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.set(28, 28, 1);
    this.finalGate.add(sprite);
    this.scene.add(this.finalGate);
  }

  initUI() {
    ui.qualitySelect.value = this.settings.quality;
    ui.sensitivityRange.value = String(this.settings.sensitivity);
    ui.gyroToggle.checked = this.settings.gyro;
    ui.hapticsToggle.checked = this.settings.haptics;

    ui.startButton.addEventListener('click', () => this.start(false));
    ui.continueButton.addEventListener('click', () => this.start(true));
    ui.restartButton.addEventListener('click', () => this.restart());
    ui.resetButton.addEventListener('click', () => {
      localStorage.removeItem(SAVE_KEY);
      this.updateContinueButton();
      this.showToast('Progreso eliminado', 'La próxima expedición comenzará desde cero.');
    });
    ui.soundButton.addEventListener('click', () => this.audio.toggle());
    ui.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
    ui.settingsButton.addEventListener('click', () => ui.settingsOverlay.classList.remove('hidden'));
    ui.closeSettingsButton.addEventListener('click', () => ui.settingsOverlay.classList.add('hidden'));
    ui.cycleTargetButton.addEventListener('click', () => this.cycleTarget());
    ui.autopilotButton.addEventListener('click', () => this.toggleAutopilot());

    ui.qualitySelect.addEventListener('change', () => {
      this.settings.quality = ui.qualitySelect.value;
      this.saveSettings();
      this.applyQuality(this.resolveInitialQuality());
    });
    ui.sensitivityRange.addEventListener('input', () => {
      this.settings.sensitivity = Number(ui.sensitivityRange.value);
      this.saveSettings();
    });
    ui.hapticsToggle.addEventListener('change', () => {
      this.settings.haptics = ui.hapticsToggle.checked;
      this.saveSettings();
    });
    ui.gyroToggle.addEventListener('change', async () => {
      if (ui.gyroToggle.checked) {
        const granted = await this.enableGyro();
        if (!granted) ui.gyroToggle.checked = false;
        this.settings.gyro = granted;
      } else {
        this.settings.gyro = false;
      }
      this.saveSettings();
    });

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clock.stop();
      else {
        this.clock.start();
        this.audio.start().catch(() => {});
      }
    });
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      ui.installButton.classList.remove('install-hidden');
    });
    ui.installButton.addEventListener('click', async () => {
      if (!this.deferredInstallPrompt) return;
      this.deferredInstallPrompt.prompt();
      await this.deferredInstallPrompt.userChoice;
      this.deferredInstallPrompt = null;
      ui.installButton.classList.add('install-hidden');
    });
    window.addEventListener('appinstalled', () => {
      ui.installButton.classList.add('install-hidden');
      this.showToast('Juego instalado', 'Solar Voyager ya puede abrirse como una aplicación.');
    });
  }

  async enableGyro() {
    try {
      if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
        const permission = await window.DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') return false;
      }
      this.gyroCalibration = null;
      window.addEventListener('deviceorientation', (event) => this.handleOrientation(event), { passive: true });
      this.showToast('Control por inclinación activo', 'Inclina suavemente el teléfono para corregir la trayectoria.');
      return true;
    } catch {
      this.showWarning('El navegador no permitió usar el sensor de orientación.');
      return false;
    }
  }

  handleOrientation(event) {
    if (!this.settings.gyro || event.gamma == null || event.beta == null) return;
    if (!this.gyroCalibration) this.gyroCalibration = { gamma: event.gamma, beta: event.beta };
    const gamma = clamp((event.gamma - this.gyroCalibration.gamma) / 28, -0.65, 0.65);
    const beta = clamp((event.beta - this.gyroCalibration.beta) / 30, -0.65, 0.65);
    this.input.gyro.set(gamma, beta);
  }

  async start(continueGame) {
    await this.audio.start().catch(() => {});
    if (continueGame) this.loadProgress();
    else this.resetState();
    this.state.started = true;
    ui.startOverlay.classList.add('hidden');
    ui.endOverlay.classList.add('hidden');
    this.clock.start();
    this.requestWakeLock();
    try {
      if (screen.orientation?.lock && matchMedia('(pointer: coarse)').matches) await screen.orientation.lock('landscape');
    } catch {
      // Orientation locking is optional and can be denied by the browser.
    }
    this.showToast('Sistemas en línea', 'Selecciona un planeta o activa el piloto automático.');
  }

  resetState() {
    this.state.elapsed = 0;
    this.state.speed = 18;
    this.state.targetSpeed = 18;
    this.state.energy = 100;
    this.state.shield = 100;
    this.state.score = 0;
    this.state.visited = 0;
    this.state.scanProgress = 0;
    this.state.targetIndex = 2;
    this.state.autopilot = false;
    this.state.stage = 'scan';
    this.state.completed = false;
    this.planets.forEach((planet) => { planet.scanned = false; });
    this.fragments.forEach((fragment) => {
      fragment.collected = false;
      fragment.group.visible = true;
    });
    this.ship.position.set(0, 9, 118);
    this.ship.rotation.set(0, 0, 0);
    this.finalGate.visible = false;
    localStorage.removeItem(SAVE_KEY);
    this.refreshMissionUI();
  }

  restart() {
    this.resetState();
    this.state.started = true;
    ui.endOverlay.classList.add('hidden');
    this.audio.start().catch(() => {});
    this.showToast('Nueva expedición', 'El atlas ha sido reiniciado.');
  }

  requestWakeLock() {
    navigator.wakeLock?.request('screen').catch(() => {});
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  toggleAutopilot() {
    if (!this.state.started || this.state.completed) return;
    this.state.autopilot = !this.state.autopilot;
    ui.autopilotButton.classList.toggle('active', this.state.autopilot);
    haptic(16);
    this.showToast(this.state.autopilot ? 'Piloto automático conectado' : 'Control manual restaurado', this.state.autopilot ? 'La nave corregirá su rumbo hacia el objetivo.' : 'Tienes control completo de la nave.');
  }

  cycleTarget() {
    if (this.state.stage === 'return') return;
    let index = this.state.targetIndex;
    for (let i = 0; i < this.planets.length; i += 1) {
      index = (index + 1) % this.planets.length;
      if (!this.planets[index].scanned) break;
    }
    this.state.targetIndex = index;
    this.state.scanProgress = 0;
    this.audio.tone(370, 0.1, 'triangle', 0.04);
    haptic(10);
  }

  getTargetPosition(target = this.getTarget()) {
    if (!target) return this.temp.set(0, 0, 0);
    if (target.isGate) return this.temp.copy(this.finalGate.position);
    return target.container.getWorldPosition(this.temp);
  }

  getTarget() {
    if (this.state.stage === 'return') return { name: 'Portal Helios', size: 7, scanned: false, isGate: true, color: 0xffd56b };
    return this.planets[this.state.targetIndex];
  }

  updatePlanets(dt) {
    this.planets.forEach((planet, index) => {
      planet.pivot.rotation.y += planet.speed * dt;
      planet.mesh.rotation.y += dt * (0.1 + index * 0.012);
      if (planet.container.userData.clouds) planet.container.userData.clouds.rotation.y += dt * 0.16;
      if (planet.container.userData.moonPivot) planet.container.userData.moonPivot.rotation.y += dt * 0.38;
      planet.scanRing.rotation.z += dt * (0.18 + index * 0.02);
      planet.scanRing.material.opacity = planet.scanned ? 0.12 : 0.52 + Math.sin(this.state.elapsed * 2.2 + index) * 0.2;
      planet.marker.material.opacity = planet.scanned ? 0.1 : 0.36 + Math.sin(this.state.elapsed * 1.5 + index) * 0.15;
      planet.worldPosition.copy(planet.container.getWorldPosition(this.temp2));
    });
  }

  updateShip(dt) {
    const axes = this.input.getAxes(this.settings);
    if (axes.lengthSq() > 0.02 && this.state.autopilot) {
      this.state.autopilot = false;
      ui.autopilotButton.classList.remove('active');
    }

    if (this.state.autopilot) {
      const targetPosition = this.getTargetPosition().clone();
