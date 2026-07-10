          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      })
    );
  }

  createOrbitsAndPlanets() {
    PLANET_DATA.forEach((data, index) => {
      this.createOrbitLine(data.radius);
      const pivot = new THREE.Group();
      pivot.rotation.y = data.angle;
      this.scene.add(pivot);

      const container = new THREE.Group();
      container.position.x = data.radius;
      container.position.y = Math.sin(index * 1.71) * 2.5;
      pivot.add(container);

      const texture = makePlanetTexture(data.type, data.colors, index + 1);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(data.size, data.size > 9 ? 48 : 36, data.size > 9 ? 30 : 24),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0.02 })
      );
      mesh.rotation.z = index % 2 ? 0.18 : -0.08;
      container.add(mesh);

      if (data.name === 'Tierra') {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(data.size * 1.016, 36, 24),
          new THREE.MeshStandardMaterial({ map: makeCloudTexture(), transparent: true, opacity: 0.42, depthWrite: false })
        );
        container.add(clouds);
        container.userData.clouds = clouds;
        const moonPivot = new THREE.Group();
        const moon = new THREE.Mesh(new THREE.SphereGeometry(1.25, 18, 12), new THREE.MeshStandardMaterial({ color: 0xbcc6cf, roughness: 1 }));
        moon.position.x = 10.5;
        moonPivot.add(moon);
        container.add(moonPivot);
        container.userData.moonPivot = moonPivot;
      }

      if (data.rings) {
        const ringTexture = this.makeRingTexture(data.name === 'Saturno' ? ['#d8c08a', '#7d6a48'] : ['#9adbe2', '#4b7f8a']);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(data.size * 1.35, data.size * (data.name === 'Saturno' ? 2.15 : 1.75), 96),
          new THREE.MeshBasicMaterial({ map: ringTexture, side: THREE.DoubleSide, transparent: true, opacity: data.name === 'Saturno' ? 0.86 : 0.45, depthWrite: false })
        );
        ring.rotation.x = Math.PI / 2 + (data.name === 'Urano' ? 1.15 : 0.2);
        container.add(ring);
      }

      const atmosphere = this.createAtmosphere(data.size, data.color);
      container.add(atmosphere);

      const scanRing = new THREE.Mesh(
        new THREE.TorusGeometry(data.size + 8, 0.22, 10, 96),
        new THREE.MeshBasicMaterial({ color: 0x58e7ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      scanRing.rotation.x = Math.PI / 2;
      container.add(scanRing);

      const marker = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeRadialTexture('rgba(255,255,255,.95)', 'rgba(66,219,255,.42)', 'rgba(0,0,0,0)'),
        color: data.color,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      marker.scale.set(data.size * 5.6, data.size * 5.6, 1);
      container.add(marker);

      this.planets.push({ ...data, pivot, container, mesh, atmosphere, scanRing, marker, scanned: false, worldPosition: new THREE.Vector3() });
    });
  }

  makeRingTexture(colors) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.13, colors[1]);
    gradient.addColorStop(0.35, colors[0]);
    gradient.addColorStop(0.48, 'rgba(255,255,255,.2)');
    gradient.addColorStop(0.67, colors[0]);
    gradient.addColorStop(0.9, colors[1]);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  createAsteroidBelt() {
    const random = seededRandom(7701);
    const count = 420;
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x716a66, roughness: 1, metalness: 0.08 });
    this.asteroidBelt = new THREE.Group();
    this.asteroids = new THREE.InstancedMesh(geometry, material, count);
    this.asteroids.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const angle = random() * TAU;
      const radius = 128 + (random() - 0.5) * 16;
      const position = new THREE.Vector3(Math.cos(angle) * radius, (random() - 0.5) * 13, Math.sin(angle) * radius);
      const scale = 0.28 + Math.pow(random(), 2) * 2.3;
      dummy.position.copy(position);
      dummy.rotation.set(random() * TAU, random() * TAU, random() * TAU);
      dummy.scale.set(scale * (0.7 + random() * 0.6), scale, scale * (0.7 + random() * 0.6));
      dummy.updateMatrix();
      this.asteroids.setMatrixAt(i, dummy.matrix);
      this.asteroidPositions.push({ position, radius: scale * 1.1 });
    }
    this.asteroids.computeBoundingSphere();
    this.asteroidBelt.add(this.asteroids);
    this.scene.add(this.asteroidBelt);
  }

  createFragments() {
    const random = seededRandom(32109);
    const material = new THREE.MeshStandardMaterial({ color: 0x79f7ff, emissive: 0x18a9cf, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.35 });
    const glowTexture = makeRadialTexture('rgba(255,255,255,1)', 'rgba(67,236,255,.55)', 'rgba(0,0,0,0)');
    for (let i = 0; i < 26; i += 1) {
      const group = new THREE.Group();
      const radius = 62 + random() * 210;
      const angle = random() * TAU;
      group.position.set(Math.cos(angle) * radius, (random() - 0.5) * 28, Math.sin(angle) * radius);
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), material.clone());
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0x62eeff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(7, 7, 1);
      group.add(mesh, glow);
      this.scene.add(group);
      this.fragments.push({ group, mesh, collected: false, phase: random() * TAU });
    }
  }

  createShip() {
    this.ship = new THREE.Group();
    this.ship.position.set(0, 9, 118);
    this.ship.rotation.y = 0;
    this.scene.add(this.ship);

    this.shipModel = new THREE.Group();
    this.ship.add(this.shipModel);
    const hullMaterial = new THREE.MeshStandardMaterial({ color: 0xcfefff, metalness: 0.72, roughness: 0.25, side: THREE.DoubleSide });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x13233e, metalness: 0.85, roughness: 0.22 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x5feaff, emissive: 0x167da0, emissiveIntensity: 2.2, metalness: 0.4, roughness: 0.2 });

    const hull = new THREE.Mesh(new THREE.ConeGeometry(1.55, 6.5, 8, 1), hullMaterial);
    hull.rotation.x = -Math.PI / 2;
    hull.position.z = -0.55;
    hull.scale.x = 0.78;
    this.shipModel.add(hull);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 14), accentMaterial);
    cockpit.scale.set(0.75, 0.45, 1.1);
    cockpit.position.set(0, 0.48, -1.2);
    this.shipModel.add(cockpit);

    const wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, -1.1, -4.2, 0, 2.3, -0.8, 0, 1.5,
      0, 0, -1.1, 4.2, 0, 2.3, 0.8, 0, 1.5
    ], 3));
    wingGeometry.computeVertexNormals();
    const wings = new THREE.Mesh(wingGeometry, hullMaterial);
    wings.position.y = -0.18;
    this.shipModel.add(wings);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 2.8), darkMaterial);
    fin.position.set(0, 0.7, 1.35);
    fin.rotation.x = -0.25;
    this.shipModel.add(fin);

    this.thrusters = [];
    const glowTexture = makeRadialTexture('rgba(255,255,255,1)', 'rgba(59,224,255,.7)', 'rgba(0,0,0,0)');
    [-0.72, 0.72].forEach((x) => {
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 1.1, 16), darkMaterial);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(x, -0.12, 2.3);
      this.shipModel.add(engine);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0x5eeaff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.position.set(x, -0.12, 3.25);
      flame.scale.set(1.35, 3.3, 1);
      this.shipModel.add(flame);
      this.thrusters.push(flame);
    });

    this.camera.position.set(0, 4.8, 13.5);
    this.ship.add(this.camera);
  }

  createTrail() {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) positions[i * 3 + 1] = -9999;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trail = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0x61eaff,
      size: 0.7,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    this.scene.add(this.trail);
  }

  createFinalGate() {
    this.finalGate = new THREE.Group();
    this.finalGate.visible = false;
