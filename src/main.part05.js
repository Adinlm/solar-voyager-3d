      const desiredDirection = targetPosition.sub(this.ship.position).normalize();
      this.tempQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), desiredDirection);
      this.ship.quaternion.slerp(this.tempQuaternion, 1 - Math.exp(-dt * 1.7));
    } else {
      const turnRate = 1.18;
      this.ship.rotateY(-axes.x * turnRate * dt);
      this.ship.rotateX(-axes.y * turnRate * dt);
    }

    this.shipModel.rotation.z = lerp(this.shipModel.rotation.z, -axes.x * 0.62, 1 - Math.exp(-dt * 6));
    this.shipModel.rotation.x = lerp(this.shipModel.rotation.x, axes.y * 0.12, 1 - Math.exp(-dt * 6));

    const target = this.getTarget();
    const targetPosition = this.getTargetPosition(target).clone();
    const targetDistance = this.ship.position.distanceTo(targetPosition);
    const canBoost = this.input.boost && this.state.energy > 1;
    const autoSlow = this.state.autopilot && targetDistance < (target.isGate ? 35 : target.size + 32);
    if (this.input.brake || autoSlow) this.state.targetSpeed = targetDistance < 18 ? 4 : 8;
    else if (canBoost) this.state.targetSpeed = 74;
    else this.state.targetSpeed = 26;

    this.state.speed = lerp(this.state.speed, this.state.targetSpeed, 1 - Math.exp(-dt * (this.input.brake ? 5.5 : 2.2)));
    if (canBoost) this.state.energy = Math.max(0, this.state.energy - dt * 16);
    else this.state.energy = Math.min(100, this.state.energy + dt * (this.ship.position.length() < 80 ? 5.2 : 2.4));

    if (!canBoost && this.state.energy > 35 && this.state.shield < 100) this.state.shield = Math.min(100, this.state.shield + dt * 0.42);

    const forward = this.temp3.set(0, 0, -1).applyQuaternion(this.ship.quaternion).normalize();
    this.ship.position.addScaledVector(forward, this.state.speed * dt);

    if (this.ship.position.length() > 325) {
      const correction = this.ship.position.clone().normalize().multiplyScalar(-dt * 8);
      this.ship.position.add(correction);
      this.showWarning('Límite del sector: corrige el rumbo hacia el sistema interior.');
    }

    const boostScale = canBoost ? 1.85 : 1;
    this.thrusters.forEach((thruster, index) => {
      const flicker = 0.88 + Math.sin(this.state.elapsed * 29 + index * 1.7) * 0.12;
      thruster.scale.set(1.35 * boostScale, 3.3 * boostScale * flicker, 1);
      thruster.material.opacity = canBoost ? 1 : 0.78;
    });
    ui.speedLines.classList.toggle('active', canBoost);
    this.audio.update(this.state.speed / 74, canBoost, this.input.scan);

    const cameraTarget = this.temp2.set(0, 4.8, canBoost ? 16.5 : 13.5);
    this.camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 3.2));
    this.camera.fov = lerp(this.camera.fov, canBoost ? 78 : 67, 1 - Math.exp(-dt * 3.2));
    this.camera.updateProjectionMatrix();

    if (this.state.cameraShake > 0) {
      this.state.cameraShake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.state.cameraShake * 0.7;
      this.camera.position.y += (Math.random() - 0.5) * this.state.cameraShake * 0.55;
    }

    this.updateTrail(canBoost);
  }

  updateTrail(boosting) {
    const positions = this.trail.geometry.attributes.position.array;
    const exhaust = new THREE.Vector3(0, 0, 3.3).applyQuaternion(this.ship.quaternion).add(this.ship.position);
    for (let i = 0; i < (boosting ? 3 : 1); i += 1) {
      const index = this.trailCursor * 3;
      positions[index] = exhaust.x + (Math.random() - 0.5) * 1.3;
      positions[index + 1] = exhaust.y + (Math.random() - 0.5) * 0.8;
      positions[index + 2] = exhaust.z + (Math.random() - 0.5) * 1.3;
      this.trailCursor = (this.trailCursor + 1) % (positions.length / 3);
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.material.size = boosting ? 1.1 : 0.62;
    this.trail.material.opacity = boosting ? 0.9 : 0.48;
  }

  updateScanning(dt) {
    const target = this.getTarget();
    const position = this.getTargetPosition(target).clone();
    const distance = this.ship.position.distanceTo(position);

    if (target.isGate) {
      ui.scanHint.textContent = distance < 15 ? 'PORTAL LISTO' : 'ACÉRCATE';
      ui.scanButton.classList.toggle('ready', distance < 15);
      if (distance < 10) this.completeExpedition();
      this.state.scanProgress = clamp(1 - distance / 40, 0, 1);
      return;
    }

    const range = target.size + 14;
    const inRange = distance <= range;
    ui.scanButton.classList.toggle('ready', inRange && !target.scanned);
    ui.scanHint.textContent = target.scanned ? 'COMPLETADO' : inRange ? 'MANTENER' : 'FUERA DE RANGO';

    if (target.scanned) {
      this.state.scanProgress = 1;
      return;
    }

    if (inRange && this.input.scan) {
      this.state.scanProgress = Math.min(1, this.state.scanProgress + dt / 2.35);
      this.state.targetSpeed = Math.min(this.state.targetSpeed, 10);
      this.scanPingTimer -= dt;
      if (this.scanPingTimer <= 0) {
        this.audio.scanPing(this.state.scanProgress);
        this.scanPingTimer = 0.34 - this.state.scanProgress * 0.12;
      }
      if (this.state.scanProgress >= 1) this.completeScan(target);
    } else {
      this.state.scanProgress = Math.max(0, this.state.scanProgress - dt * (inRange ? 0.08 : 0.28));
    }
  }

  completeScan(target) {
    target.scanned = true;
    this.state.visited += 1;
    const reward = 1500 + Math.round(this.state.shield * 4 + this.state.energy * 3);
    this.state.score += reward;
    this.state.energy = Math.min(100, this.state.energy + 24);
    this.state.scanProgress = 0;
    this.audio.success();
    haptic([30, 40, 70]);
    this.showToast(`${target.name} cartografiado`, `${target.fact} +${reward} puntos.`);
    this.saveProgress();

    if (this.state.visited >= this.planets.length) {
      this.state.stage = 'return';
      this.finalGate.visible = true;
      this.state.autopilot = false;
      ui.autopilotButton.classList.remove('active');
      this.showToast('Atlas completo', 'El Portal Helios está activo sobre el Sol. Regresa para transmitir los datos.');
    } else {
      this.cycleTarget();
    }
    this.refreshMissionUI();
  }

  updateFragments(dt) {
    this.fragments.forEach((fragment) => {
      if (fragment.collected) return;
      fragment.phase += dt;
      fragment.group.rotation.y += dt * 1.7;
      fragment.group.rotation.x += dt * 0.7;
      fragment.group.position.y += Math.sin(fragment.phase * 1.8) * dt * 0.22;
      if (this.ship.position.distanceToSquared(fragment.group.position) < 15) {
        fragment.collected = true;
        fragment.group.visible = false;
        this.state.energy = Math.min(100, this.state.energy + 18);
        this.state.score += 250;
        this.audio.collect();
        haptic(18);
        this.showToast('Fragmento solar recuperado', 'Energía restaurada · +250 puntos.');
      }
    });
  }

  updateAsteroids(dt) {
    this.asteroidBelt.rotation.y += dt * 0.012;
    this.state.asteroidTimer -= dt;
    this.state.collisionCooldown = Math.max(0, this.state.collisionCooldown - dt);
    if (this.state.asteroidTimer > 0 || this.state.collisionCooldown > 0) return;
    this.state.asteroidTimer = 0.13;

    const rotation = this.asteroidBelt.rotation.y;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const ship = this.ship.position;
    for (const asteroid of this.asteroidPositions) {
      const x = asteroid.position.x * cosine + asteroid.position.z * sine;
      const z = -asteroid.position.x * sine + asteroid.position.z * cosine;
      const dx = x - ship.x;
      const dy = asteroid.position.y - ship.y;
      const dz = z - ship.z;
      const limit = asteroid.radius + 2.2;
      if (dx * dx + dy * dy + dz * dz < limit * limit) {
        this.handleImpact('asteroid');
        break;
      }
    }

    if (this.ship.position.lengthSq() < 26 * 26) {
      this.handleImpact('sun');
      return;
    }

    for (const planet of this.planets) {
      const limit = planet.size + 2.6;
      if (this.ship.position.distanceToSquared(planet.worldPosition) < limit * limit) {
        this.handleImpact('planet');
        break;
      }
    }
  }

  handleImpact(type) {
    this.state.collisionCooldown = 1.35;
    const damage = type === 'sun' ? 38 : type === 'planet' ? 24 : 14;
    this.state.shield = Math.max(0, this.state.shield - damage);
    this.state.score = Math.max(0, this.state.score - 180);
    this.state.cameraShake = 0.8;
    this.state.speed *= 0.36;
    this.audio.impact();
    haptic([70, 35, 90]);
    ui.damageFlash.classList.add('active');
    setTimeout(() => ui.damageFlash.classList.remove('active'), 180);
    this.showWarning(type === 'sun' ? 'Radiación crítica: aléjate inmediatamente del Sol.' : type === 'planet' ? 'Impacto gravitacional: aléjate de la superficie.' : 'Colisión con asteroide: escudo dañado.');

    const push = this.ship.position.clone().normalize().multiplyScalar(6);
    if (push.lengthSq() < 0.01) push.set(0, 5, 0);
    this.ship.position.add(push);
    if (this.state.shield <= 0) this.emergencyRecovery();
  }

  emergencyRecovery() {
    this.state.shield = 55;
    this.state.energy = Math.max(this.state.energy, 45);
    this.state.score = Math.max(0, this.state.score - 600);
    this.ship.position.set(0, 14, 112);
    this.ship.rotation.set(0, 0, 0);
    this.showToast('Recuperación de emergencia', 'La nave fue trasladada a una zona segura. Penalización: 600 puntos.');
  }

