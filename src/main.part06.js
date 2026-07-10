  completeExpedition() {
    if (this.state.completed) return;
    this.state.completed = true;
    this.state.started = false;
    const timeBonus = Math.max(0, Math.round(12000 - this.state.elapsed * 12));
    this.state.score += timeBonus;
    ui.finalScore.textContent = formatNumber(this.state.score);
    ui.finalSummary.textContent = `Tiempo de misión: ${Math.floor(this.state.elapsed / 60)} min ${Math.floor(this.state.elapsed % 60)} s · Bonificación temporal: ${timeBonus} puntos.`;
    ui.endOverlay.classList.remove('hidden');
    localStorage.removeItem(SAVE_KEY);
    this.updateContinueButton();
    this.audio.success();
    setTimeout(() => this.audio.success(), 460);
    haptic([80, 50, 80, 50, 140]);
  }

  updateTargetMarker() {
    const target = this.getTarget();
    const world = this.getTargetPosition(target).clone();
    const distance = this.ship.position.distanceTo(world);
    this.camera.updateMatrixWorld();
    const projected = world.clone().project(this.camera);
    const behind = projected.z > 1;
    const marginX = 58 / innerWidth * 2;
    const marginY = 58 / innerHeight * 2;
    const x = clamp(projected.x, -1 + marginX, 1 - marginX);
    const y = clamp(projected.y, -1 + marginY, 1 - marginY);
    ui.targetMarker.style.left = `${(x * 0.5 + 0.5) * 100}%`;
    ui.targetMarker.style.top = `${(-y * 0.5 + 0.5) * 100}%`;
    ui.targetMarker.style.opacity = behind ? '0.35' : '1';
    ui.markerDistance.textContent = `${Math.round(distance * 4800).toLocaleString('es-CL')} km`;
  }

  updateRadar() {
    const context = this.radarContext;
    const width = ui.radar.width;
    const height = ui.radar.height;
    const center = width / 2;
    const radius = width * 0.44;
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(center, center);
    context.strokeStyle = 'rgba(104,226,255,.13)';
    context.lineWidth = 1;
    [0.33, 0.66, 1].forEach((scale) => {
      context.beginPath();
      context.arc(0, 0, radius * scale, 0, TAU);
      context.stroke();
    });
    context.beginPath();
    context.moveTo(-radius, 0); context.lineTo(radius, 0);
    context.moveTo(0, -radius); context.lineTo(0, radius);
    context.stroke();

    const inverse = this.ship.quaternion.clone().invert();
    const drawPoint = (position, color, size, ring = false) => {
      const local = position.clone().sub(this.ship.position).applyQuaternion(inverse);
      const scale = radius / 285;
      const x = clamp(local.x * scale, -radius, radius);
      const y = clamp(local.z * scale, -radius, radius);
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, size, 0, TAU);
      context.fill();
      if (ring) {
        context.strokeStyle = color;
        context.beginPath();
        context.arc(x, y, size + 4, 0, TAU);
        context.stroke();
      }
    };

    this.planets.forEach((planet, index) => drawPoint(planet.worldPosition, planet.scanned ? 'rgba(116,226,255,.28)' : `#${planet.color.toString(16).padStart(6, '0')}`, planet.size > 9 ? 3.6 : 2.4, this.state.stage === 'scan' && index === this.state.targetIndex));
    if (this.state.stage === 'return') drawPoint(this.finalGate.position, '#ffd56b', 3.2, true);
    this.fragments.forEach((fragment) => {
      if (!fragment.collected && fragment.group.position.distanceToSquared(this.ship.position) < 140 * 140) drawPoint(fragment.group.position, '#59f1c2', 1.2);
    });

    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(0, -7);
    context.lineTo(-5, 6);
    context.lineTo(5, 6);
    context.closePath();
    context.fill();
    context.restore();
  }

  updateUI() {
    const target = this.getTarget();
    const distance = this.ship.position.distanceTo(this.getTargetPosition(target));
    ui.speedValue.textContent = `${Math.round(this.state.speed * 12)} km/s`;
    ui.energyValue.textContent = `${Math.round(this.state.energy)}%`;
    ui.shieldValue.textContent = `${Math.round(this.state.shield)}%`;
    ui.atlasValue.textContent = `${this.state.visited}/8`;
    ui.scoreValue.textContent = formatNumber(this.state.score);
    ui.targetName.textContent = target.name;
    ui.targetDistance.textContent = `${Math.round(distance * 4800).toLocaleString('es-CL')} km`;
    ui.targetStatus.textContent = target.isGate ? 'TRANSMISIÓN' : target.scanned ? 'ESCANEADO' : distance <= target.size + 14 ? 'EN RANGO' : 'NO ESCANEADO';
    ui.scanProgress.style.width = `${this.state.scanProgress * 100}%`;
    ui.missionProgress.style.width = `${(this.state.stage === 'return' ? 1 : this.state.visited / 8) * 100}%`;
    if (this.state.toastTimer > 0) {
      this.state.toastTimer -= 1 / 60;
      if (this.state.toastTimer <= 0) ui.toast.classList.remove('visible');
    }
    if (this.state.warningTimer > 0) {
      this.state.warningTimer -= 1 / 60;
      if (this.state.warningTimer <= 0) ui.warning.classList.remove('visible');
    }
  }

  refreshMissionUI() {
    if (this.state.stage === 'return') {
      ui.missionStage.textContent = 'TRANSMISIÓN';
      ui.missionTitle.textContent = 'Regresa al Portal Helios';
      ui.missionText.textContent = 'Atraviesa el portal luminoso sobre el Sol para completar la expedición.';
    } else {
      ui.missionStage.textContent = 'CARTOGRAFÍA';
      ui.missionTitle.textContent = `Escanea los planetas · ${this.state.visited}/8`;
      ui.missionText.textContent = 'Sigue el marcador, entra en el rango azul y mantén ESCANEAR.';
    }
  }

  showToast(title, text) {
    ui.toastTitle.textContent = title;
    ui.toastText.textContent = text;
    ui.toast.classList.add('visible');
    this.state.toastTimer = 3.4;
  }

  showWarning(text) {
    ui.warning.textContent = text;
    ui.warning.classList.add('visible');
    this.state.warningTimer = 2.4;
  }

  applyQuality(level) {
    this.state.quality = level;
    const ratios = { high: 1.45, medium: 1.1, low: 0.78 };
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, ratios[level]));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.composer.setPixelRatio(Math.min(devicePixelRatio, ratios[level]));
    this.composer.setSize(innerWidth, innerHeight);
    this.bloomPass.enabled = level !== 'low';
    this.bloomPass.strength = level === 'high' ? 0.72 : 0.42;
    this.starfield.material.size = level === 'low' ? 1.0 : 1.25;
    this.scene.fog.density = level === 'low' ? 0.0009 : 0.00072;
    ui.qualityValue.textContent = `CALIDAD: ${level === 'high' ? 'ALTA' : level === 'medium' ? 'MEDIA' : 'RENDIMIENTO'}`;
  }

  monitorPerformance(dt) {
    if (this.settings.quality !== 'auto' || this.state.autoDowngraded || !this.state.started) return;
    this.state.fpsFrames += 1;
    this.state.fpsTime += dt;
    if (this.state.fpsTime < 7) return;
    const fps = this.state.fpsFrames / this.state.fpsTime;
    this.state.fpsFrames = 0;
    this.state.fpsTime = 0;
    if (fps < 38) {
      const next = this.state.quality === 'high' ? 'medium' : 'low';
      this.applyQuality(next);
      this.state.autoDowngraded = true;
      this.showToast('Rendimiento optimizado', `La calidad cambió a ${next === 'medium' ? 'media' : 'rendimiento'} para mantener la fluidez.`);
    }
  }

  saveProgress() {
    const save = {
      elapsed: this.state.elapsed,
      energy: this.state.energy,
      shield: this.state.shield,
      score: this.state.score,
      targetIndex: this.state.targetIndex,
      stage: this.state.stage,
      scanned: this.planets.map((planet) => planet.scanned),
      fragments: this.fragments.map((fragment) => fragment.collected),
      shipPosition: this.ship.position.toArray(),
      shipQuaternion: this.ship.quaternion.toArray(),
      savedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    this.updateContinueButton();
  }

  loadProgress() {
    try {
      const save = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!save) return this.resetState();
      this.state.elapsed = save.elapsed || 0;
      this.state.energy = save.energy ?? 100;
      this.state.shield = save.shield ?? 100;
      this.state.score = save.score || 0;
      this.state.targetIndex = save.targetIndex ?? 2;
      this.state.stage = save.stage || 'scan';
      this.planets.forEach((planet, index) => { planet.scanned = Boolean(save.scanned?.[index]); });
      this.state.visited = this.planets.filter((planet) => planet.scanned).length;
      this.fragments.forEach((fragment, index) => {
        fragment.collected = Boolean(save.fragments?.[index]);
        fragment.group.visible = !fragment.collected;
      });
      if (Array.isArray(save.shipPosition)) this.ship.position.fromArray(save.shipPosition);
      if (Array.isArray(save.shipQuaternion)) this.ship.quaternion.fromArray(save.shipQuaternion);
      this.finalGate.visible = this.state.stage === 'return';
      this.refreshMissionUI();
    } catch {
      this.resetState();
    }
  }

  updateContinueButton() {
    const hasSave = Boolean(localStorage.getItem(SAVE_KEY));
    ui.continueButton.style.display = hasSave ? '' : 'none';
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.composer.setSize(innerWidth, innerHeight);
  }
