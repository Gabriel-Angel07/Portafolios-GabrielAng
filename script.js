/**
 * ARCHIVO / SEÑAL // SISTEMA DE ONDAS INTERACTIVAS Y CONTROL DE ESTADO
 * Universidad Autónoma del Carmen — Periodo 2026
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. TIMECODE EN VIVO (HH:MM:SS:FF)
  const timecodeEl = document.getElementById('live-timecode');
  if (timecodeEl) {
    let frame = 0;
    setInterval(() => {
      frame = (frame + 1) % 30;
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const f = String(frame).padStart(2, '0');
      timecodeEl.textContent = `TC ${h}:${m}:${s}:${f}`;
    }, 1000 / 30);
  }

  // 2. OBSERVADOR DE SECCIÓN ACTIVA EN NAVEGACIÓN
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('section[id]');
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach(item => {
          if (item.getAttribute('href') === `#${id}`) {
            item.classList.add('nav-item--active');
          } else {
            item.classList.remove('nav-item--active');
          }
        });
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

  sections.forEach(s => navObserver.observe(s));

  // 3. MOTOR DE ONDAS INTERACTIVAS (CANVAS FULLSCREEN)
  const canvas = document.getElementById('interactive-surface-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const signalBadge = document.getElementById('signal-state-badge');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Estado del puntero
  const pointer = {
    x: width * 0.5,
    y: height * 0.5,
    isHovering: false,
    radius: 120
  };

  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.isHovering = true;
  });

  document.addEventListener('mouseleave', () => {
    pointer.isHovering = false;
  });

  // Estructura de ondas por clic / tap
  const ripples = [];

  class Ripple {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 0;
      this.maxRadius = Math.max(width, height) * 0.85;
      this.speed = 3.8;
      this.amplitude = 36;
      this.wavelength = 60;
      this.life = 1.0;
      this.decay = 0.009;
    }

    update() {
      this.radius += this.speed;
      this.life -= this.decay;
      return this.life > 0 && this.radius < this.maxRadius;
    }

    getDisplacement(px, py) {
      const dx = px - this.x;
      const dy = py - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist - this.radius;

      if (Math.abs(delta) < this.wavelength) {
        const factor = Math.cos((delta / this.wavelength) * Math.PI * 0.5);
        return Math.sin(delta * 0.12) * this.amplitude * factor * this.life;
      }
      return 0;
    }
  }

  // Generador de ondas por clic / tap en cualquier parte libre del fondo
  window.addEventListener('pointerdown', (e) => {
    // Si el usuario da clic en un botón interactivo o video, no interferir con su uso
    if (e.target.closest('a, button, video, input, select, textarea')) return;

    ripples.push(new Ripple(e.clientX, e.clientY));
    if (signalBadge) {
      signalBadge.textContent = '● SIGNAL: IMPULSE';
      signalBadge.classList.add('signal-state-badge--streaming');
      setTimeout(() => {
        if (!isPlayingMedia) {
          signalBadge.textContent = '● SIGNAL: IDLE';
          signalBadge.classList.remove('signal-state-badge--streaming');
        }
      }, 650);
    }
  });

  // Control de reproducción de videos
  let isPlayingMedia = false;
  const mediaElements = document.querySelectorAll('video');
  mediaElements.forEach(video => {
    video.addEventListener('play', () => {
      mediaElements.forEach(other => {
        if (other !== video && !other.paused) other.pause();
      });
      isPlayingMedia = true;
      if (signalBadge) {
        signalBadge.textContent = `● SIGNAL: STREAMING [${video.dataset.trackId || 'AV'}]`;
        signalBadge.classList.add('signal-state-badge--streaming');
      }
    });

    video.addEventListener('pause', () => {
      isPlayingMedia = false;
      if (signalBadge) {
        signalBadge.textContent = '● SIGNAL: IDLE';
        signalBadge.classList.remove('signal-state-badge--streaming');
      }
    });

    video.addEventListener('ended', () => {
      isPlayingMedia = false;
      if (signalBadge) {
        signalBadge.textContent = '● SIGNAL: IDLE';
        signalBadge.classList.remove('signal-state-badge--streaming');
      }
    });
  });

  // Configuración de la retícula de osciloscopio
  const lineSpacing = 32;
  const pointStep = 18;
  let time = 0;

  function renderInteractiveSurface() {
    ctx.clearRect(0, 0, width, height);

    time += 0.012 + (isPlayingMedia ? 0.025 : 0);

    // Actualizar ondas de clic
    for (let i = ripples.length - 1; i >= 0; i--) {
      if (!ripples[i].update()) {
        ripples.splice(i, 1);
      }
    }

    const rows = Math.ceil(height / lineSpacing) + 2;
    const cols = Math.ceil(width / pointStep) + 2;

    for (let r = 0; r < rows; r++) {
      const baseY = r * lineSpacing;
      ctx.beginPath();

      let hasActiveSignal = false;

      for (let c = 0; c < cols; c++) {
        const baseX = c * pointStep;

        // 1. Onda ambiental lenta (Idle)
        let offsetY = Math.sin(baseX * 0.003 + time + r * 0.2) * 4.5 +
                      Math.cos(baseY * 0.004 - time * 0.8) * 3;

        // 2. Perturbación suave por proximidad del cursor
        if (pointer.isHovering) {
          const dx = baseX - pointer.x;
          const dy = baseY - pointer.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < pointer.radius) {
            const push = Math.cos((dist / pointer.radius) * Math.PI * 0.5);
            offsetY += Math.sin(time * 3 + dist * 0.05) * 8 * push;
            hasActiveSignal = true;
          }
        }

        // 3. Impacto de ondas circulares por clic
        for (let k = 0; k < ripples.length; k++) {
          const disp = ripples[k].getDisplacement(baseX, baseY);
          offsetY += disp;
          if (Math.abs(disp) > 1.5) hasActiveSignal = true;
        }

        // 4. Boost si hay video reproduciéndose
        if (isPlayingMedia) {
          offsetY += Math.sin(baseX * 0.015 + time * 4) * 6;
        }

        const plotX = baseX;
        const plotY = baseY + offsetY;

        if (c === 0) ctx.moveTo(plotX, plotY);
        else ctx.lineTo(plotX, plotY);
      }

      // Estilo de trazo según intensidad de perturbación
      if (hasActiveSignal || isPlayingMedia) {
        ctx.strokeStyle = (r % 3 === 0) ? 'rgba(255, 87, 34, 0.45)' : 'rgba(139, 92, 246, 0.35)';
        ctx.lineWidth = 1.3;
      } else {
        ctx.strokeStyle = (r % 2 === 0) ? 'rgba(139, 92, 246, 0.14)' : 'rgba(6, 182, 212, 0.09)';
        ctx.lineWidth = 1;
      }

      ctx.stroke();
    }

    requestAnimationFrame(renderInteractiveSurface);
  }

  renderInteractiveSurface();
});