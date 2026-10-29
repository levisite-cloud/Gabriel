/**
 * World & Level Design Engine
 * Cenário em camadas de Parallax, plataformas móveis, trampolins, espinhos e checkpoints
 */

class Platform {
  constructor(x, y, width, height, options = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.isOneWay = options.isOneWay || false;
    this.isSpring = options.isSpring || false;
    this.type = options.type || 'solid'; // 'solid', 'hazard', 'checkpoint', 'portal'
    this.color = options.color || '#1e293b';
    this.border = options.border || '#00f2fe';
    this.theme = options.theme || 'tech'; // 'grass', 'crystal', 'fortress'

    // Plataforma Móvel
    this.isMoving = options.isMoving || false;
    this.startX = x;
    this.startY = y;
    this.rangeX = options.rangeX || 0;
    this.rangeY = options.rangeY || 0;
    this.moveSpeed = options.moveSpeed || 0.02;
    this.moveTimer = 0;
    this.vx = 0;
    this.vy = 0;

    // Estado Trampolim
    this.springSquish = 0;

    // Estado Checkpoint / Portal
    this.activated = false;
  }

  triggerSpring() {
    this.springSquish = 12;
  }

  update() {
    if (this.springSquish > 0) {
      this.springSquish -= 1.2;
    }

    if (this.isMoving) {
      this.moveTimer += this.moveSpeed;
      const prevX = this.x;
      const prevY = this.y;

      if (this.rangeX !== 0) {
        this.x = this.startX + Math.sin(this.moveTimer) * this.rangeX;
      }
      if (this.rangeY !== 0) {
        this.y = this.startY + Math.cos(this.moveTimer) * this.rangeY;
      }

      this.vx = this.x - prevX;
      this.vy = this.y - prevY;
    }
  }

  render(ctx, camera) {
    const rx = this.x - camera.x;
    const ry = this.y - camera.y;

    // Descarte se fora da tela
    if (rx + this.width < -50 || rx > camera.width + 50 ||
        ry + this.height < -50 || ry > camera.height + 50) {
      return;
    }

    ctx.save();

    // 1. TRAMPOLIM
    if (this.isSpring) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rx, ry + 8, this.width, this.height - 8);

      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#39ff14';
      const squish = Math.max(0, this.springSquish);
      ctx.fillRect(rx + 4, ry + squish, this.width - 8, 8);
      ctx.restore();
      return;
    }

    // 2. ESPINHOS / PERIGO
    if (this.type === 'hazard') {
      ctx.fillStyle = '#ff416c';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff416c';
      const spikeWidth = 14;
      const count = Math.floor(this.width / spikeWidth);
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.moveTo(rx + i * spikeWidth, ry + this.height);
        ctx.lineTo(rx + (i + 0.5) * spikeWidth, ry);
        ctx.lineTo(rx + (i + 1) * spikeWidth, ry + this.height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // 3. CHECKPOINT
    if (this.type === 'checkpoint') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(rx + this.width / 2 - 3, ry, 6, this.height);
      ctx.fillStyle = this.activated ? '#00f2fe' : '#64748b';
      ctx.shadowBlur = this.activated ? 15 : 0;
      ctx.shadowColor = '#00f2fe';
      ctx.beginPath();
      ctx.moveTo(rx + this.width / 2 + 3, ry + 2);
      ctx.lineTo(rx + this.width / 2 + 28, ry + 12);
      ctx.lineTo(rx + this.width / 2 + 3, ry + 22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    // 4. PORTAL FINAL DE VITÓRIA
    if (this.type === 'portal') {
      ctx.fillStyle = '#ffd700';
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ffd700';
      ctx.beginPath();
      ctx.ellipse(rx + this.width / 2, ry + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(rx + this.width / 2, ry + this.height / 2, this.width / 3, this.height / 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '24px sans-serif';
      ctx.fillText('🏆', rx + this.width / 2 - 14, ry + this.height / 2 + 8);
      ctx.restore();
      return;
    }

    // 5. PLATAFORMA SÓLIDA COM TEXTURA E ESTILO
    // Preenchimento base
    ctx.fillStyle = this.color;
    ctx.fillRect(rx, ry, this.width, this.height);

    // Borda de Topo Neon iluminada
    ctx.fillStyle = this.border;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.border;
    ctx.fillRect(rx, ry, this.width, 4);

    // Detalhes estilizados por tema
    if (this.theme === 'grass') {
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(rx, ry, this.width, 3);
    } else if (this.theme === 'crystal') {
      ctx.fillStyle = '#00f2fe';
      ctx.fillRect(rx + 6, ry + 6, 4, 4);
      ctx.fillRect(rx + this.width - 12, ry + 6, 4, 4);
    }

    ctx.restore();
  }
}

class World {
  constructor() {
    this.width = 6200;
    this.height = 1400;
    this.platforms = [];
    this.collectibles = [];
    this.enemies = [];
    this.spawnPoint = { x: 80, y: 1050 };
    this.boss = null;
    this.stars = [];
    this.initBackground();
    this.buildWorld();
  }

  initBackground() {
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * 2500,
        y: Math.random() * 1000,
        size: Math.random() * 2 + 0.5,
        twinkle: Math.random() * Math.PI
      });
    }
  }

  buildWorld() {
    this.platforms = [];
    this.collectibles = [];
    this.enemies = [];

    // ==========================================
    // SETOR 1: VALE DO DESPERTAR (x: 0 a 1600)
    // ==========================================
    // Chão inicial
    this.platforms.push(new Platform(0, 1150, 1400, 250, { theme: 'grass', border: '#39ff14' }));
    this.platforms.push(new Platform(250, 1030, 180, 24, { isOneWay: true }));
    this.platforms.push(new Platform(500, 920, 180, 24, { isOneWay: true }));
    this.platforms.push(new Platform(750, 830, 200, 24, { isOneWay: true }));

    // Trampolim de impulso
    this.platforms.push(new Platform(1020, 1140, 50, 15, { isSpring: true }));

    // Ilha flutuante alta com gema rara
    this.platforms.push(new Platform(950, 680, 220, 26, { border: '#00f2fe' }));
    this.collectibles.push(new Collectible(1050, 630, 'gem'));

    // Moedas do Setor 1
    for (let i = 0; i < 6; i++) {
      this.collectibles.push(new Collectible(280 + i * 90, 1100, 'coin'));
    }

    // Inimigos do Setor 1: PatrolBots
    this.enemies.push(new PatrolBot(600, 1100));
    this.enemies.push(new PatrolBot(1150, 1100));
    this.enemies.push(new FlyDroneBot(800, 800));

    // Checkpoint 1
    const cp1 = new Platform(1320, 1090, 20, 60, { type: 'checkpoint' });
    this.platforms.push(cp1);

    // ==========================================
    // SETOR 2: DESFILADEIRO E PLATAFORMAS MÓVEIS (x: 1400 a 3000)
    // ==========================================
    // Abismo com espinhos no fundo
    this.platforms.push(new Platform(1400, 1340, 1600, 60, { type: 'hazard' }));

    // Plataformas Móveis e Ilhas
    this.platforms.push(new Platform(1500, 1050, 140, 24, {
      isMoving: true, rangeX: 120, moveSpeed: 0.025, border: '#ffd700'
    }));

    this.platforms.push(new Platform(1850, 950, 160, 26, { border: '#00f2fe' }));
    this.collectibles.push(new Collectible(1920, 900, 'heart'));

    this.platforms.push(new Platform(2150, 950, 140, 24, {
      isMoving: true, rangeY: 100, moveSpeed: 0.03, border: '#ffd700'
    }));

    this.platforms.push(new Platform(2450, 880, 200, 26, { border: '#39ff14' }));
    this.collectibles.push(new Collectible(2530, 830, 'gem'));

    this.platforms.push(new Platform(2800, 1050, 300, 150, { theme: 'crystal', border: '#00f2fe' }));

    // Inimigos do Setor 2
    this.enemies.push(new FlyDroneBot(1700, 850));
    this.enemies.push(new FlyDroneBot(2300, 780));
    this.enemies.push(new PatrolBot(2850, 1000));

    // Checkpoint 2
    const cp2 = new Platform(3020, 990, 20, 60, { type: 'checkpoint' });
    this.platforms.push(cp2);

    // ==========================================
    // SETOR 3: MINAS TECNOLÓGICAS E ELEVAÇÃO VERTICAL (x: 3100 a 4600)
    // ==========================================
    this.platforms.push(new Platform(3150, 1150, 1400, 250, { theme: 'crystal', border: '#00f2fe' }));

    // Escadaria de plataformas com perigos
    this.platforms.push(new Platform(3300, 1020, 140, 24, { isOneWay: true }));
    this.platforms.push(new Platform(3500, 900, 140, 24, { isOneWay: true }));
    this.platforms.push(new Platform(3450, 1140, 60, 15, { isSpring: true }));

    // Perigo de lasers
    this.platforms.push(new Platform(3750, 1135, 120, 15, { type: 'hazard' }));

    this.platforms.push(new Platform(3950, 960, 180, 24, {
      isMoving: true, rangeX: 150, moveSpeed: 0.035, border: '#ffd700'
    }));

    this.platforms.push(new Platform(4300, 860, 260, 30, { border: '#00f2fe' }));
    this.collectibles.push(new Collectible(4380, 800, 'gem'));
    this.collectibles.push(new Collectible(4450, 800, 'heart'));

    // Inimigos do Setor 3
    this.enemies.push(new PatrolBot(3350, 1100));
    this.enemies.push(new PatrolBot(4100, 1100));
    this.enemies.push(new FlyDroneBot(3600, 750));
    this.enemies.push(new FlyDroneBot(4200, 700));

    // Checkpoint 3 (Antes do Boss)
    const cp3 = new Platform(4500, 800, 20, 60, { type: 'checkpoint' });
    this.platforms.push(cp3);

    // ==========================================
    // SETOR 4: FORTALEZA FLUTUANTE & ARENA DO CHEFÃO GOLIATH (x: 4800 a 6200)
    // ==========================================
    // Piso colossal da arena
    this.platforms.push(new Platform(4800, 1050, 1300, 300, { theme: 'fortress', border: '#ffd700' }));

    // Plataformas táticas na arena
    this.platforms.push(new Platform(4950, 880, 160, 24, { isOneWay: true }));
    this.platforms.push(new Platform(5300, 820, 200, 24, { isOneWay: true }));
    this.platforms.push(new Platform(5650, 880, 160, 24, { isOneWay: true }));

    // Trampolim de escape na arena
    this.platforms.push(new Platform(5000, 1040, 50, 15, { isSpring: true }));
    this.platforms.push(new Platform(5800, 1040, 50, 15, { isSpring: true }));

    // O MEGA CHEFÃO GOLIATH
    this.boss = new BossMechaBot(5450, 950);
    this.enemies.push(this.boss);

    // Portal de Vitória Supremo atrás da arena do Boss
    this.portal = new Platform(6000, 950, 60, 90, { type: 'portal' });
    this.platforms.push(this.portal);
  }

  renderBackground(ctx, camera) {
    const w = camera.width;
    const h = camera.height;

    // 1. Céu Estrelado Profundo (Parallax Lento 0.05)
    ctx.save();
    for (const star of this.stars) {
      star.twinkle += 0.03;
      const sx = (star.x - camera.x * 0.05) % w;
      const sy = (star.y - camera.y * 0.05) % h;
      const alpha = 0.5 + Math.sin(star.twinkle) * 0.4;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(sx < 0 ? sx + w : sx, sy < 0 ? sy + h : sy, star.size, star.size);
    }

    // Lua Cibernética
    const moonX = w * 0.75 - camera.x * 0.02;
    const moonY = 90 - camera.y * 0.02;
    ctx.fillStyle = '#00f2fe';
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#00f2fe';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 45, 0, Math.PI * 2);
    ctx.fill();

    // Anel planetário da lua
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(moonX, moonY, 75, 18, -Math.PI / 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 2. Montanhas Distantes (Parallax Médio 0.15)
    ctx.save();
    ctx.fillStyle = '#0b1329';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 120) {
      const worldX = x + camera.x * 0.15;
      const mountainH = Math.sin(worldX * 0.003) * 120 + 260;
      ctx.lineTo(x, h - mountainH);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Estruturas Tecnológicas em Segundo Plano (Parallax 0.3)
    ctx.save();
    ctx.fillStyle = '#111e3b';
    for (let i = 0; i < 15; i++) {
      const bX = (i * 300 - camera.x * 0.3) % (w + 400);
      const bW = 70;
      const bH = 200 + (i % 3) * 60;
      const drawX = bX < -100 ? bX + w + 400 : bX;
      ctx.fillRect(drawX, h - bH, bW, bH);

      // Luzes das torres
      ctx.fillStyle = '#00f2fe';
      ctx.fillRect(drawX + 15, h - bH + 20, 6, 6);
      ctx.fillRect(drawX + 45, h - bH + 20, 6, 6);
      ctx.fillStyle = '#111e3b';
    }
    ctx.restore();
  }
}
