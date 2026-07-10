      fpsTime: 0,
      autoDowngraded: false,
      completed: false
    };
    this.audio = new AudioEngine();
    this.input = new InputController();
    this.clock = new THREE.Clock();
    this.temp = new THREE.Vector3();
    this.temp2 = new THREE.Vector3();
    this.temp3 = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();
    this.tempMatrix = new THREE.Matrix4();
    this.radarContext = ui.radar.getContext('2d');
    this.fragments = [];
    this.planets = [];
    this.asteroidPositions = [];
    this.trailCursor = 0;
    this.scanPingTimer = 0;
    this.deferredInstallPrompt = null;
    this.gyroCalibration = null;

    this.initRenderer();
    this.initScene();
    this.initUI();
    this.applyQuality(this.resolveInitialQuality());
    this.updateContinueButton();
    this.animate();
  }

  loadSettings() {
    const defaults = { quality: 'auto', sensitivity: 1, gyro: false, haptics: true };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch {
      return defaults;
    }
  }

  saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  resolveInitialQuality() {
    if (this.settings.quality !== 'auto') return this.settings.quality;
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const mobile = matchMedia('(pointer: coarse)').matches;
    if (memory >= 8 && cores >= 8 && !mobile) return 'high';
    if (memory >= 4 && cores >= 6) return 'medium';
    return 'low';
  }

  initRenderer() {
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) {
      ui.startButton.disabled = true;
      ui.startButton.textContent = 'WEBGL 2 NO DISPONIBLE';
      $('.start-copy').textContent = 'Este navegador no ofrece WebGL 2. Abre el juego en una versión reciente de Chrome, Samsung Internet, Edge o Safari.';
      throw new Error('WebGL 2 unavailable');
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    ui.game.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x01030a);
    this.scene.fog = new THREE.FogExp2(0x020713, 0.00072);
    this.camera = new THREE.PerspectiveCamera(67, innerWidth / innerHeight, 0.08, 1200);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.48, 0.72);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  initScene() {
    this.scene.add(new THREE.HemisphereLight(0x87b5ff, 0x050710, 0.32));
    this.createStarfield();
    this.createNebulae();
    this.createSun();
    this.createOrbitsAndPlanets();
    this.createAsteroidBelt();
    this.createFragments();
    this.createShip();
    this.createTrail();
    this.createFinalGate();
  }

  createStarfield() {
    const random = seededRandom(90210);
    const count = 3300;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    const palette = [0xffffff, 0xb6d8ff, 0x9eeaff, 0xffdcb2, 0xcab8ff];
    for (let i = 0; i < count; i += 1) {
      const radius = 340 + random() * 650;
      const theta = random() * TAU;
      const phi = Math.acos(2 * random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      color.setHex(palette[Math.floor(random() * palette.length)]);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.starfield = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 1.25,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    }));
    this.scene.add(this.starfield);
  }

  createNebulae() {
    const texture = makeRadialTexture('rgba(255,255,255,.28)', 'rgba(86,76,255,.12)', 'rgba(0,0,0,0)', 256);
    [
      [-290, 140, -410, 360, 0x6979ff],
      [330, -90, -350, 320, 0xad5aff],
      [70, 260, 420, 300, 0x42c7ff]
    ].forEach(([x, y, z, size, color]) => {
      const material = new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(x, y, z);
      sprite.scale.set(size, size, 1);
      this.scene.add(sprite);
    });
  }

  createSun() {
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const fragmentShader = `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        float bands = sin(vUv.y * 92.0 + sin(vUv.x * 28.0 + uTime * 0.7) * 4.0 + uTime * 2.1);
        float cells = sin((vUv.x + vUv.y) * 48.0 - uTime * 1.4) * sin((vUv.x - vUv.y) * 36.0 + uTime);
        float turbulence = bands * 0.16 + cells * 0.11;
        float rim = pow(1.0 - abs(vNormal.z), 2.0);
        vec3 deep = vec3(1.0, 0.22, 0.025);
        vec3 bright = vec3(1.0, 0.86, 0.28);
        vec3 color = mix(deep, bright, 0.62 + turbulence) + rim * vec3(0.6, 0.15, 0.02);
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    this.sunMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader,
      fragmentShader
    });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(21, 64, 40), this.sunMaterial);
    this.scene.add(this.sun);

    const glowTexture = makeRadialTexture('rgba(255,255,230,1)', 'rgba(255,158,30,.45)', 'rgba(0,0,0,0)', 256);
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.sunGlow.scale.set(82, 82, 1);
    this.scene.add(this.sunGlow);

    const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xff7f2e, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    outerGlow.scale.set(140, 140, 1);
    this.scene.add(outerGlow);

    this.sunLight = new THREE.PointLight(0xffd39a, 3.2, 620, 1.25);
    this.scene.add(this.sunLight);
  }

  createOrbitLine(radius) {
    const points = [];
    for (let i = 0; i <= 128; i += 1) {
      const angle = (i / 128) * TAU;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x4a83a8, transparent: true, opacity: 0.12 });
    this.scene.add(new THREE.Line(geometry, material));
  }

  createAtmosphere(size, color) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(size * 1.065, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color(color) } },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPositionNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          varying vec3 vNormal;
          varying vec3 vPositionNormal;
          void main() {
            float intensity = pow(0.72 - dot(vNormal, vPositionNormal), 2.1);
            gl_FragColor = vec4(glowColor, intensity * 0.45);
