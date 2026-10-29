/**
 * Master Game Controller & Loop (Otimizado para Mobile Touch & Desktop)
 * Loop principal, analógico virtual touch dinâmico, câmera suave, HUD e combates
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.radarCanvas = document.getElementById('radarCanvas');
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Estado do Jogo
    this.state = 'START'; // 'START', 'PLAYING', 'GAMEOVER', 'VICTORY'
    this.lastTime = performance.now();

    // Câmera Dinâmica
    this.camera = {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      shake: 0
    };

    // Gerenciamento de Inputs
    this.input = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      dashPressed: false,
      attackPressed: false,
      shootPressed: false,
      analogX: 0
    };

    // Controle Touch / Joystick Analógico Virtual
    this.joystick = {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      maxRadius: 45,
      container: document.getElementById('virtual-joystick'),
      stick: document.getElementById('joystick-stick')
    };

    // Entidades e Mundo
    this.world = new World();
    this.player = new Gabriel(this.world.spawnPoint.x, this.world.spawnPoint.y);
    this.companion = new CompanionBot(this.player);
    this.projectiles = [];

    // Checkpoint ativo
    this.lastCheckpoint = { x: this.world.spawnPoint.x, y: this.world.spawnPoint.y };

    this.initEvents();
    this.initTouchControls();
    this.resizeCanvas();
    this.checkOrientation();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.checkOrientation();
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.resizeCanvas();
        this.checkOrientation();
      }, 200);
    });

    // Inicia loop
    requestAnimationFrame((t) => this.loop(t));
  }

  resizeCanvas() {
    // Escala Retina / High-DPI para celular (com limite em 2.2 para 60fps cravados)
    const dpr = Math.min(window.devicePixelRatio || 1, 2.2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.resetTransform ? this.ctx.resetTransform() : this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.camera.width = w;
    this.camera.height = h;

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'medium';
  }

  checkOrientation() {
    const hint = document.getElementById('orientation-hint');
    if (!hint) return;
    if (window.innerHeight > window.innerWidth && window.innerWidth < 800) {
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  }

  vibrate(ms = 25) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  initTouchControls() {
    const leftZone = document.getElementById('touch-zone-left');
    const touchHint = document.querySelector('.touch-hint-left');

    if (!leftZone) return;

    // 1. INÍCIO DO TOQUE NA ZONA ESQUERDA (Spawn do Analógico Virtual no dedo)
    leftZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.joystick.active) return;

      const touch = e.changedTouches[0];
      this.joystick.active = true;
      this.joystick.touchId = touch.identifier;
      this.joystick.startX = touch.clientX;
      this.joystick.startY = touch.clientY;
      this.joystick.currentX = touch.clientX;
      this.joystick.currentY = touch.clientY;

      // Posiciona o elemento visual do joystick exatamente onde o jogador tocou
      if (this.joystick.container) {
        this.joystick.container.style.left = `${touch.clientX}px`;
        this.joystick.container.style.top = `${touch.clientY}px`;
        this.joystick.container.classList.remove('hidden');
      }

      if (this.joystick.stick) {
        this.joystick.stick.style.transform = 'translate(0px, 0px)';
      }

      if (touchHint) touchHint.classList.add('hidden');
      this.vibrate(15);
    }, { passive: false });

    // 2. MOVIMENTO DO DEDO (Cálculo Analógico e Direcional)
    leftZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.joystick.active) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystick.touchId) {
          const dx = touch.clientX - this.joystick.startX;
          const dy = touch.clientY - this.joystick.startY;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);

          const clampDist = Math.min(dist, this.joystick.maxRadius);
          const stickX = Math.cos(angle) * clampDist;
          const stickY = Math.sin(angle) * clampDist;

          // Atualiza visual da haste do stick
          if (this.joystick.stick) {
            this.joystick.stick.style.transform = `translate(${stickX}px, ${stickY}px)`;
          }

          // Normaliza valor de -1 a 1 para velocidade analógica suave
          const normX = stickX / this.joystick.maxRadius;
          this.input.analogX = normX;

          if (normX < -0.15) {
            this.input.left = true;
            this.input.right = false;
          } else if (normX > 0.15) {
            this.input.right = true;
            this.input.left = false;
          } else {
            this.input.left = false;
            this.input.right = false;
          }

          // Se empurrar o analógico para cima com força, pula!
          if (dy < -35 && !this.input.jump) {
            this.input.jumpPressed = true;
            this.input.jump = true;
            this.vibrate(20);
          } else if (dy >= -20) {
            this.input.jump = false;
          }

          break;
        }
      }
    }, { passive: false });

    // 3. FIM DO TOQUE (Liberação do Analógico)
    const endTouch = (e) => {
      if (!this.joystick.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystick.touchId) {
          this.joystick.active = false;
          this.joystick.touchId = null;
          this.input.left = false;
          this.input.right = false;
          this.input.analogX = 0;
          this.input.jump = false;

          if (this.joystick.container) {
            this.joystick.container.classList.add('hidden');
          }
          break;
        }
      }
    };

    leftZone.addEventListener('touchend', endTouch, { passive: false });
    leftZone.addEventListener('touchcancel', endTouch, { passive: false });

    // ==========================================
    // 4. BOTÕES DE AÇÃO TOUCH (DIREITA) ERGONÔMICOS
    // ==========================================
    const bindTouchAction = (id, onTrigger) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const trigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onTrigger();
        this.vibrate(25);
      };

      btn.addEventListener('touchstart', trigger, { passive: false });
      btn.addEventListener('mousedown', trigger);
    };

    bindTouchAction('btn-jump', () => { this.input.jumpPressed = true; });
    bindTouchAction('btn-attack', () => { this.input.attackPressed = true; });
    bindTouchAction('btn-shoot', () => { this.input.shootPressed = true; });
    bindTouchAction('btn-dash', () => { this.input.dashPressed = true; });
  }

  initEvents() {
    // Teclado (Desktop)
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'PLAYING') return;

      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') { this.input.left = true; this.input.analogX = -1; }
      if (code === 'KeyD' || code === 'ArrowRight') { this.input.right = true; this.input.analogX = 1; }
      if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') {
        if (!this.input.jump) this.input.jumpPressed = true;
        this.input.jump = true;
      }
      if (code === 'KeyL' || code === 'ShiftLeft' || code === 'ShiftRight') {
        this.input.dashPressed = true;
      }
      if (code === 'KeyJ') {
        this.input.attackPressed = true;
      }
      if (code === 'KeyK') {
        this.input.shootPressed = true;
      }
      if (code === 'KeyM') {
        this.toggleAudio();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') { this.input.left = false; this.input.analogX = 0; }
      if (code === 'KeyD' || code === 'ArrowRight') { this.input.right = false; this.input.analogX = 0; }
      if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') this.input.jump = false;
    });

    // Botão de Áudio
    document.getElementById('btn-audio-toggle').addEventListener('click', () => this.toggleAudio());

    // Botão de Tela Cheia
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Modais e Início
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-restart').addEventListener('click', () => this.restartGame());
    document.getElementById('btn-victory-restart').addEventListener('click', () => this.restartGame());
  }

  toggleAudio() {
    if (window.soundEngine) {
      const isMuted = window.soundEngine.toggleMute();
      const btn = document.getElementById('btn-audio-toggle');
      if (btn) btn.textContent = isMuted ? '🔇' : '🔊';
      this.showToast(isMuted ? '🔇 Áudio Silenciado' : '🔊 Áudio Ativado!');
    }
  }

  showToast(msg) {
    const toast = document.getElementById('game-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2400);
  }

  startGame() {
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('start-screen').classList.add('hidden');
    this.state = 'PLAYING';
    if (window.soundEngine) {
      window.soundEngine.init();
      window.soundEngine.startBGM();
    }
    this.showToast('🚀 Gabriel no Mundo dos Bots! Toque na tela para controlar!');
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    this.vibrate([100, 50, 150]);
    document.getElementById('go-coins').textContent = this.player.coins;
    document.getElementById('go-kills').textContent = this.player.kills;
    document.getElementById('go-score').textContent = this.player.score;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('active');
  }

  triggerVictory() {
    this.state = 'VICTORY';
    this.vibrate([80, 40, 80, 40, 150]);
    if (window.soundEngine) window.soundEngine.playVictory();
    if (window.particleSystem) {
      window.particleSystem.emitConfetti(this.player.x, this.player.y, 80);
    }
    document.getElementById('vic-coins').textContent = this.player.coins;
    document.getElementById('vic-gems').textContent = this.player.gems;
    document.getElementById('vic-kills').textContent = this.player.kills;
    document.getElementById('vic-score').textContent = this.player.score;
    document.getElementById('victory-screen').classList.remove('hidden');
    document.getElementById('victory-screen').classList.add('active');
  }

  restartGame() {
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.remove('active');
    document.getElementById('victory-screen').classList.add('hidden');
    document.getElementById('victory-screen').classList.remove('active');

    this.world = new World();
    this.player = new Gabriel(this.world.spawnPoint.x, this.world.spawnPoint.y);
    this.companion = new CompanionBot(this.player);
    this.projectiles = [];
    this.lastCheckpoint = { x: this.world.spawnPoint.x, y: this.world.spawnPoint.y };
    this.state = 'PLAYING';
    if (window.soundEngine) window.soundEngine.startBGM();
  }

  update() {
    if (this.state !== 'PLAYING') return;

    // Atualiza Plataformas Móveis
    for (const plat of this.world.platforms) {
      plat.update();
    }

    // Atualiza Gabriel com os inputs (teclado ou analógico touch)
    this.player.update(this.input, this.world.platforms, this.projectiles);

    // Reseta flags de clique único
    this.input.jumpPressed = false;
    this.input.dashPressed = false;
    this.input.attackPressed = false;
    this.input.shootPressed = false;

    // Queda no abismo
    if (this.player.y > this.world.height + 100) {
      this.player.takeDamage(40, this.player.x);
      this.vibrate(80);
      if (this.player.hp > 0) {
        this.player.x = this.lastCheckpoint.x;
        this.player.y = this.lastCheckpoint.y - 20;
        this.player.vx = 0;
        this.player.vy = 0;
        this.showToast('⚠️ Gabriel voltou ao Checkpoint!');
      }
    }

    // Morte de Gabriel
    if (this.player.hp <= 0) {
      this.triggerGameOver();
      return;
    }

    // Atualiza Bot Companheiro
    this.companion.update(this.world.enemies, this.world.collectibles, this.projectiles);

    // Atualiza Inimigos Autônomos
    for (let i = this.world.enemies.length - 1; i >= 0; i--) {
      const enemy = this.world.enemies[i];
      if (enemy instanceof BossMechaBot) {
        enemy.update(this.player, this.world.platforms, this.projectiles, this.world.enemies);
      } else {
        enemy.update(this.player, this.world.platforms, this.projectiles);
      }

      // Golpe de Espada de Gabriel
      if (this.player.isAttacking && window.physicsEngine.checkAABB(this.player.slashHitbox, enemy)) {
        const dead = enemy.takeDamage(45);
        this.camera.shake = 8;
        this.vibrate(30);
        if (dead) {
          this.player.kills++;
          this.player.score += 250;
        }
      }

      // Remove inimigo derrotado
      if (!enemy.alive) {
        this.world.enemies.splice(i, 1);
      }
    }

    // Atualiza Projéteis
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(this.world.platforms);

      // Projétil Inimigo atinge Gabriel
      if (p.isEnemy && window.physicsEngine.checkAABB(p, this.player)) {
        p.alive = false;
        this.player.takeDamage(p.damage, p.x);
        this.camera.shake = 5;
        this.vibrate(40);
      }

      // Projétil Amigo atinge Inimigos
      if (!p.isEnemy) {
        for (const enemy of this.world.enemies) {
          if (enemy.alive && window.physicsEngine.checkAABB(p, enemy)) {
            p.alive = false;
            const dead = enemy.takeDamage(p.damage);
            if (dead) {
              this.player.kills++;
              this.player.score += 200;
            }
            break;
          }
        }
      }

      if (!p.alive) {
        this.projectiles.splice(i, 1);
      }
    }

    // Atualiza Coletáveis
    for (let i = this.world.collectibles.length - 1; i >= 0; i--) {
      const item = this.world.collectibles[i];
      item.update(this.player);
      if (item.collected) {
        this.vibrate(15);
        this.world.collectibles.splice(i, 1);
      }
    }

    // Interações com Checkpoints e Portais
    for (const plat of this.world.platforms) {
      if (plat.type === 'checkpoint' && !plat.activated) {
        if (window.physicsEngine.checkAABB(this.player, plat)) {
          plat.activated = true;
          this.lastCheckpoint = { x: plat.x, y: plat.y };
          if (window.soundEngine) window.soundEngine.playGem();
          this.showToast('🚩 Checkpoint Ativado!');
          this.vibrate(35);
        }
      }

      if (plat.type === 'portal') {
        if (window.physicsEngine.checkAABB(this.player, plat)) {
          if (!this.world.boss || !this.world.boss.alive) {
            this.triggerVictory();
          } else {
            this.showToast('🔒 Derrote o Chefão Mecha para abrir o Portal!');
          }
        }
      }
    }

    // Atualiza Partículas
    if (window.particleSystem) {
      window.particleSystem.update();
    }

    // Câmera Suave (Lerp)
    const targetCamX = this.player.x - this.camera.width * 0.4 + (this.player.facing * 80);
    const targetCamY = this.player.y - this.camera.height * 0.55;

    this.camera.x += (targetCamX - this.camera.x) * 0.08;
    this.camera.y += (targetCamY - this.camera.y) * 0.08;

    this.camera.x = Math.max(0, Math.min(this.world.width - this.camera.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(this.world.height - this.camera.height, this.camera.y));

    // Screen Shake
    if (this.camera.shake > 0) {
      this.camera.x += (Math.random() * 2 - 1) * this.camera.shake;
      this.camera.y += (Math.random() * 2 - 1) * this.camera.shake;
      this.camera.shake *= 0.85;
      if (this.camera.shake < 0.2) this.camera.shake = 0;
    }

    // Atualiza HUD Visual
    this.updateHUD();
    this.renderRadar();
  }

  updateHUD() {
    const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    const spPct = Math.max(0, (this.player.sp / this.player.maxSp) * 100);

    document.getElementById('hp-bar').style.width = `${hpPct}%`;
    document.getElementById('hp-text').textContent = `${Math.ceil(this.player.hp)}/${this.player.maxHp}`;
    document.getElementById('sp-bar').style.width = `${spPct}%`;
    document.getElementById('sp-text').textContent = `${Math.ceil(this.player.sp)}/${this.player.maxSp}`;

    document.getElementById('coin-counter').textContent = this.player.coins;
    document.getElementById('gem-counter').textContent = this.player.gems;
    document.getElementById('score-counter').textContent = String(this.player.score).padStart(5, '0');
    document.getElementById('companion-status').textContent = this.companion.state;
  }

  renderRadar() {
    const rctx = this.radarCtx;
    const rw = this.radarCanvas.width;
    const rh = this.radarCanvas.height;

    rctx.clearRect(0, 0, rw, rh);

    const scaleX = rw / this.world.width;
    const scaleY = rh / this.world.height;

    // Plataformas
    rctx.fillStyle = 'rgba(0, 242, 254, 0.4)';
    for (const p of this.world.platforms) {
      if (p.type === 'hazard') continue;
      rctx.fillRect(p.x * scaleX, p.y * scaleY, Math.max(2, p.width * scaleX), Math.max(2, p.height * scaleY));
    }

    // Coletáveis
    rctx.fillStyle = '#ffd700';
    for (const c of this.world.collectibles) {
      rctx.fillRect(c.x * scaleX, c.y * scaleY, 2, 2);
    }

    // Inimigos
    rctx.fillStyle = '#ff416c';
    for (const e of this.world.enemies) {
      rctx.fillRect(e.x * scaleX, e.y * scaleY, 3, 3);
    }

    // Gabriel
    rctx.fillStyle = '#39ff14';
    rctx.fillRect(this.player.x * scaleX, this.player.y * scaleY, 4, 4);
  }

  render() {
    this.ctx.clearRect(0, 0, this.camera.width, this.camera.height);

    // 1. Cenário Parallax
    this.world.renderBackground(this.ctx, this.camera);

    // 2. Plataformas do Mundo
    for (const plat of this.world.platforms) {
      plat.render(this.ctx, this.camera);
    }

    // 3. Coletáveis
    for (const item of this.world.collectibles) {
      item.render(this.ctx, this.camera);
    }

    // 4. Inimigos Autônomos
    for (const enemy of this.world.enemies) {
      enemy.render(this.ctx, this.camera);
    }

    // 5. Gabriel e Bot Amigo
    this.player.render(this.ctx, this.camera);
    this.companion.render(this.ctx, this.camera);

    // 6. Projéteis
    for (const p of this.projectiles) {
      p.render(this.ctx, this.camera);
    }

    // 7. Partículas
    if (window.particleSystem) {
      window.particleSystem.render(this.ctx, this.camera);
    }
  }

  loop(currentTime) {
    this.update();
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}

// Inicializa o jogo quando o DOM carregar
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
