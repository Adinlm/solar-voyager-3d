
  animate() {
    requestAnimationFrame(() => this.animate());
    const rawDelta = this.clock.getDelta();
    const dt = Math.min(rawDelta || 0.016, 0.05);
    this.state.elapsed += this.state.started ? dt : dt * 0.18;
    this.sunMaterial.uniforms.uTime.value = this.state.elapsed;
    this.sun.rotation.y += dt * 0.055;
    this.sunGlow.material.opacity = 0.78 + Math.sin(this.state.elapsed * 1.8) * 0.08;
    this.starfield.rotation.y += dt * 0.002;
    this.updatePlanets(dt);
    this.finalGate.rotation.y += dt * 0.65;
    this.finalGate.rotation.z -= dt * 0.24;

    if (this.state.started && !this.state.completed) {
      this.updateShip(dt);
      this.updateScanning(dt);
      this.updateFragments(dt);
      this.updateAsteroids(dt);
      this.updateTargetMarker();
      this.updateRadar();
      this.updateUI();
      this.monitorPerformance(dt);
      this.state.saveTimer += dt;
      if (this.state.saveTimer > 12) {
        this.state.saveTimer = 0;
        this.saveProgress();
      }
    } else {
      this.shipModel.position.y = Math.sin(this.state.elapsed * 0.8) * 0.15;
    }

    if (this.state.quality === 'low') this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }
}

let game;
try {
  game = new SolarVoyagerGame();
} catch (error) {
  console.error(error);
}

registerSW({
  immediate: true,
  onOfflineReady() {
    game?.showToast('Modo offline disponible', 'El juego quedó almacenado para ejecutarse sin conexión.');
  },
  onNeedRefresh() {
    game?.showToast('Actualización disponible', 'Recarga la página para usar la nueva versión.');
  }
});
