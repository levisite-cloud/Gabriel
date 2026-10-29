/**
 * Particle & Visual FX Engine
 * Sistema avançado de partículas com blend modes, física e iluminação dinâmica
 */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 600;
  }

  add(p) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    this.particles.push({
      x: p.x || 0,
      y: p.y || 0,
      vx: p.vx || (Math.random() * 2 - 1),
      vy: p.vy || (Math.random() * 2 - 1),
      size: p.size || 4,
      color: p.color || '#00f2fe',
      alpha: p.alpha !== undefined ? p.alpha : 1,
      decay: p.decay || 0.02,
      gravity: p.gravity !== undefined ? p.gravity : 0.05,
      friction: p.friction !== undefined ? p.friction : 0.98,
      shape: p.shape || 'circle',
      rotation: p.rotation || 0,
      vRot: p.vRot || 0,
      glow: p.glow || false
    });
  }

  // Efeito de Poeira ao Correr / Pousar
  emitDust(x, y, count = 4, color = 'rgba(200, 220, 255, 0.6)') {
    for (let i = 0; i < count; i++) {
      this.add({
        x: x + (Math.random() * 12 - 6),
        y: y,
        vx: (Math.random() * 2 - 1) * 1.5,
        vy: -Math.random() * 1.5 - 0.5,
        size: Math.random() * 3 + 2,
        color: color,
        alpha: 0.7,
        decay: 0.04,
        gravity: 0.03
      });
    }
  }

  // Efeito de Rastro do Dash (Phantom / Afterimage)
  emitDashTrail(x, y, width, height, facing) {
    for (let i = 0; i < 8; i++) {
      this.add({
        x: x + Math.random() * width,
        y: y + Math.random() * height,
        vx: -facing * (Math.random() * 2 + 1),
        vy: (Math.random() * 2 - 1) * 0.5,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.5 ? '#00f2fe' : '#ffffff',
        alpha: 0.9,
        decay: 0.05,
        gravity: 0,
        glow: true
      });
    }
  }

  // Brilho ao Coletar Moeda / Gema
  emitSparkle(x, y, color = '#ffd700', count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1;
      this.add({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 2,
        color: color,
        alpha: 1,
        decay: 0.03,
        gravity: 0.04,
        shape: 'star',
        glow: true
      });
    }
  }

  // Explosão ao Destruir Bot / Inimigo
  emitExplosion(x, y, color = '#ff416c', count = 25) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1.5;
      this.add({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: Math.random() * 5 + 3,
        color: Math.random() > 0.3 ? color : '#ffd700',
        alpha: 1,
        decay: 0.025,
        gravity: 0.15,
        shape: Math.random() > 0.5 ? 'spark' : 'circle',
        glow: true
      });
    }
  }

  // Faíscas de Impacto de Espada
  emitSparks(x, y, dirX, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = (dirX > 0 ? 0 : Math.PI) + (Math.random() * 1.2 - 0.6);
      const speed = Math.random() * 4 + 2;
      this.add({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size: Math.random() * 3 + 1,
        color: '#ffffff',
        alpha: 1,
        decay: 0.04,
        gravity: 0.1,
        shape: 'spark',
        glow: true
      });
    }
  }

  // Confetes de Vitória
  emitConfetti(x, y, count = 40) {
    const colors = ['#00f2fe', '#ffd700', '#ff416c', '#39ff14', '#a8ff78', '#ff00ff'];
    for (let i = 0; i < count; i++) {
      this.add({
        x: x + (Math.random() * 200 - 100),
        y: y - 50,
        vx: (Math.random() * 4 - 2),
        vy: -Math.random() * 5 - 2,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.01,
        gravity: 0.08,
        friction: 0.99,
        shape: 'rect',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() * 0.2 - 0.1)
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.friction;
      p.vy += p.gravity;
      p.alpha -= p.decay;
      p.rotation += p.vRot;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx, camera) {
    ctx.save();
    for (const p of this.particles) {
      const screenX = p.x - camera.x;
      const screenY = p.y - camera.y;

      // Descarte fora da tela
      if (screenX < -20 || screenX > camera.width + 20 ||
          screenY < -20 || screenY > camera.height + 20) {
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.glow) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
      }

      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.beginPath();
        for (let j = 0; j < 4; j++) {
          ctx.rotate(Math.PI / 4);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(0, p.size);
        }
        ctx.fill();
        ctx.restore();
      } else if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.shape === 'spark') {
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-p.size * 1.5, -1, p.size * 3, 2);
        ctx.restore();
      }

      ctx.restore();
    }
    ctx.restore();
  }
}

window.particleSystem = new ParticleSystem();
