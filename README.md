# Solar Voyager 3D

Juego de exploración espacial 3D optimizado para teléfonos, construido con Three.js, Vite, SCSS, Web Audio API y tecnologías PWA.

**Jugar:** https://adinlm.github.io/solar-voyager-3d/

[![Deploy Solar Voyager to GitHub Pages](https://github.com/Adinlm/solar-voyager-3d/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Adinlm/solar-voyager-3d/actions/workflows/deploy-pages.yml)

## Qué incluye

- Sistema solar 3D compacto con ocho planetas, órbitas animadas, atmósferas, lunas y anillos.
- Sol animado mediante shaders GLSL, nebulosas, campo de estrellas y bloom adaptativo.
- Nave controlable con joystick táctil, teclado, giroscopio opcional y soporte para pantalla completa.
- Misiones de escaneo, selección de objetivos, piloto automático y portal final.
- Cinturón de asteroides, escudo, recuperación de emergencia y fragmentos de energía.
- Sonido procedural con Web Audio API: motor, impulso, escaneo, impactos y música ambiental.
- Radar 2D, HUD adaptable, vibración y guardado automático en `localStorage`.
- Ajuste dinámico de calidad para mantener una buena tasa de cuadros en móviles.
- Instalación como PWA y funcionamiento offline después de la primera carga.

## Controles

### Teléfono

- **Joystick izquierdo:** dirigir la nave.
- **Impulso:** acelerar consumiendo energía.
- **Freno:** aproximación precisa.
- **Escanear:** mantener presionado dentro del rango azul.
- **Auto piloto:** orientar la nave hacia el objetivo seleccionado.
- **Cambiar:** seleccionar el siguiente planeta pendiente.

### Teclado

- `WASD` o flechas: dirección.
- `Shift`: impulso.
- `Espacio`: escanear.
- `X`: freno.
- `E`: piloto automático.
- `C`: cambiar objetivo.

## Desarrollo local

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev
```

Para comprobar la compilación de producción:

```bash
npm run build
npm run preview
```

## Arquitectura

- `index.html`: interfaz, HUD y controles.
- `src/main.js`: motor del juego, física arcade, planetas, shaders, audio y persistencia.
- `src/styles.scss`: diseño adaptable para pantallas táctiles, retrato y horizontal.
- `public/icons`: iconos de la aplicación instalable.
- `vite.config.js`: compilación y configuración PWA.
- `.github/workflows/deploy-pages.yml`: compilación y despliegue automático en GitHub Pages.

Las texturas planetarias y todos los sonidos se generan en tiempo de ejecución, por lo que el juego no depende de servidores externos durante una partida.

## Despliegue

Cada `push` a `main` ejecuta GitHub Actions:

1. Instala las dependencias con `npm ci`.
2. Compila la versión optimizada con Vite.
3. Genera el service worker y el manifiesto PWA.
4. Publica `dist/` en GitHub Pages.

El workflow intenta habilitar GitHub Pages automáticamente. Si GitHub solicita aprobación del entorno `github-pages`, se puede autorizar desde la ejecución del workflow.

## Licencia

Código publicado bajo la licencia MIT. Three.js mantiene su propia licencia MIT.
