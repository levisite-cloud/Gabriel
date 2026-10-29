/**
 * Master Game Controller & Loop (Otimizado para Mobile Touch & Desktop)
 * Controles táteis diretos ◀ e ▶, suporte multi-touch, opção de ocultar/mostrar HUD
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.radarCanvas = document.getElementById('radarCanvas');
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Estado do Jogo e Visibilidade da HUD
    this.state = 'START'; // 'START', 'PLAYING', 'GAMEOVER', 'VICTORY'
    this.hudVisible = true;
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

    // Joystick Analógico Flutuante
    this.joystick = {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
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

  toggleHUD() {
    this.hudVisible = !this.hudVisible;
    const toggleBtn = document.getElementById('btn-toggle-hud');
    const hudContent = document.getElementById('hud-content');
    const toggleIcon = document.getElementById('toggle-hud-icon');
    const toggleText = document.getElementById('toggle-hud-text');

    if (this.hudVisible) {
      if (hudContent) hudContent.classList.remove('hud-hidden');
      if (toggleBtn) toggleBtn.classList.remove('is-hidden');
      if (toggleIcon) toggleIcon.textContent = '👁️';
      if (toggleText) toggleText.textContent = 'OCULTAR HUD';
      this.showToast('👁️ Informações da Tela Exibidas');
    } else {
      if (hudContent) hudContent.classList.add('hud-hidden');
      if (toggleBtn) toggleBtn.classList.add('is-hidden');
      if (toggleIcon) toggleIcon.textContent = '🙈';
      if (toggleText) toggleText.textContent = 'MOSTRAR HUD';
      this.showToast('🙈 Janelas Ocultadas - Tela 100% Limpa!');
    }
    this.vibrate(20);
  }

  initTouchControls() {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');
    const btnAttack = document.getElementById('btn-attack');
    const btnShoot = document.getElementById('btn-shoot');
    const btnDash = document.getElementById('btn-dash');

    // Helper para botões direcionais
    const bindDirButton = (btn, onDown, onUp) => {
      if (!btn) return;

      const handleDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDown();
        btn.classList.add('active');
        this.vibrate(20);
      };

      const handleUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onUp();
        btn.classList.remove('active');
      };

      btn.addEventListener('pointerdown', handleDown);
      btn.addEventListener('pointerup', handleUp);
      btn.addEventListener('pointercancel', handleUp);
      btn.addEventListener('pointerleave', handleUp);

      btn.addEventListener('touchstart', handleDown, { passive: false });
      btn.addEventListener('touchend', handleUp, { passive: false });
      btn.addEventListener('touchcancel', handleUp, { passive: false });
    };

    // 1. BOTÃO ESQUERDA (◀)
    bindDirButton(btnLeft, () => {
      this.input.left = true;
      this.input.right = false;
      this.input.analogX = -1;
    }, () => {
      this.input.left = false;
      if (!this.input.right) this.input.analogX = 0;
    });

    // 2. BOTÃO DIREITA (▶)
    bindDirButton(btnRight, () => {
      this.input.right = true;
      this.input.left = false;
      this.input.analogX = 1;
    }, () => {
      this.input.right = false;
      if (!this.input.left) this.input.analogX = 0;
    });

    // 3. BOTÕES DE AÇÃO
    const bindActionButton = (btn, onTrigger) => {
      if (!btn) return;

      const trigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onTrigger();
        btn.classList.add('active');
        this.vibrate(25);
        setTimeout(() => btn.classList.remove('active'), 120);
      };

      btn.addEventListener('pointerdown', trigger);
      btn.addEventListener('touchstart', trigger, { passive: false });
    };

    bindActionButton(btnJump, () => {
      this.input.jumpPressed = true;
      this.input.jump = true;
    });

    bindActionButton(btnAttack, () => {
      this.input.attackPressed = true;
    });

    bindActionButton(btnShoot, () => {
      this.input.shootPressed = true;
    });

    bindActionButton(btnDash, () => {
      this.input.dashPressed = true;
    });

    // 4. TOQUE LIVRE NA TELA (LADO ESQUERDO)
    window.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING') return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX < window.innerWidth * 0.45 && !touch.target.closest('button')) {
          this.joystick.active = true;
          this.joystick.touchId = touch.identifier;
          this.joystick.startX = touch.clientX;
          this.joystick.startY = touch.clientY;

          if (this.joystick.container) {
            this.joystick.container.style.left = `${touch.clientX}px`;
            this.joystick.container.style.top = `${touch.clientY}px`;
            this.joystick.container.classList.remove('hidden');
          }
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
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

          if (this.joystick.stick) {
            this.joystick.stick.style.transform = `translate(${stickX}px, ${stickY}px)`;
          }

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

          if (dy < -35 && !this.input.jump) {
            this.input.jumpPressed = true;
            this.input.jump = true;
          }
          break;
        }
      }
    }, { passive: true });

    const endScreenTouch = (e) => {
      if (!this.joystick.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystick.touchId) {
          this.joystick.active = false;
          this.joystick.touchId = null;
          if (!btnLeft.classList.contains('active') && !btnRight.classList.contains('active')) {
            this.input.left = false;
            this.input.right = false;
            this.input.analogX = 0;
          }
          if (this.joystick.container) {
            this.joystick.container.classList.add('hidden');
          }
          break;
        }
      }
    };

    window.addEventListener('touchend', endScreenTouch, { passive: true });
    window.addEventListener('touchcancel', endScreenTouch, { passive: true });
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
      if (code === 'KeyH') {
        this.toggleHUD();
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

    // Botão de Ocultar / Mostrar Informações da Tela
    const toggleBtn = document.getElementById('btn-toggle-hud');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => { e.preventDefault(); this.toggleHUD(); });
      toggleBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.toggleHUD(); }, { passive: false });
    }

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

    // Início e Reinício
    const attachStart = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => { e.preventDefault(); action(); });
      el.addEventListener('touchend', (e) => { e.preventDefault(); action(); }, { passive: false });
    };

    attachStart('btn-start', () => this.startGame());
    attachStart('btn-restart', () => this.restartGame());
    attachStart('btn-victory-restart', () => this.restartGame());
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
    this.showToast('🚀 Gabriel na Aventura! Use os botões na tela para jogar!');
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

    // Atualiza Gabriel com os inputs
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

    // Atualiza HUD Visual somente se estiver visível
    if (this.hudVisible) {
      this.updateHUD();
      this.renderRadar();
    }
  }

  updateHUD() {
    const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    const spPct = Math.max(0, (this.player.sp / this.player.maxSp) * 100);

    const hpBar = document.getElementById('hp-bar');
    const hpText = document.getElementById('hp-text');
    const spBar = document.getElementById('sp-bar');
    const spText = document.getElementById('sp-text');

    if (hpBar) hpBar.style.width = `${hpPct}%`;
    if (hpText) hpText.textContent = `${Math.ceil(this.player.hp)}/${this.player.maxHp}`;
    if (spBar) spBar.style.width = `${spPct}%`;
    if (spText) spText.textContent = `${Math.ceil(this.player.sp)}/${this.player.maxSp}`;

    const coinCount = document.getElementById('coin-counter');
    const gemCount = document.getElementById('gem-counter');
    const scoreCount = document.getElementById('score-counter');
    const compStatus = document.getElementById('companion-status');

    if (coinCount) coinCount.textContent = this.player.coins;
    if (gemCount) gemCount.textContent = this.player.gems;
    if (scoreCount) scoreCount.textContent = String(this.player.score).padStart(5, '0');
    if (compStatus) compStatus.textContent = this.companion.state;
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
