/**
 * Entities & Autonomous AI Engine
 * Gabriel (Herói), Bot Companheiro Amigo, e Bots Inimigos com IA Autônoma
 */

// ==========================================
// 1. CLASSE PROJÉTIL
// ==========================================
class Projectile {
  constructor(x, y, vx, vy, isEnemy = false, damage = 25, color = '#00f2fe') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = 12;
    this.height = 12;
    this.isEnemy = isEnemy;
    this.damage = damage;
    this.color = color;
    this.life = 120;
    this.alive = true;
  }

  update(platforms) {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;

    if (this.life <= 0) {
      this.alive = false;
      return;
    }

    // Rastro de partículas
    if (window.particleSystem && Math.random() > 0.4) {
      window.particleSystem.add({
        x: this.x + this.width / 2,
        y: this.y + this.height / 2,
        vx: -this.vx * 0.1 + (Math.random() * 0.4 - 0.2),
        vy: -this.vy * 0.1 + (Math.random() * 0.4 - 0.2),
        size: 3,
        color: this.color,
        alpha: 0.8,
        decay: 0.05,
        gravity: 0,
        glow: true
      });
    }

    // Colisão com plataformas
    for (const p of platforms) {
      if (p.isOneWay || p.type === 'hazard') continue;
      if (window.physicsEngine.checkAABB(this, p)) {
        this.alive = false;
        if (window.particleSystem) {
          window.particleSystem.emitExplosion(this.x, this.y, this.color, 8);
        }
        break;
      }
    }
  }

  render(ctx, camera) {
    const rx = this.x - camera.x;
    const ry = this.y - camera.y;

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(rx + this.width / 2, ry + this.height / 2, this.width / 2, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo branco
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx + this.width / 2, ry + this.height / 2, this.width / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ==========================================
// 2. GABRIEL (PROTAGONISTA)
// ==========================================
class Gabriel {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 38;
    this.height = 54;
    this.vx = 0;
    this.vy = 0;

    // Atributos de Vida & Energia
    this.maxHp = 100;
    this.hp = 100;
    this.maxSp = 100;
    this.sp = 100;

    // Física e Movimentação
    this.speed = 5.2;
    this.accel = 0.8;
    this.friction = 0.78;
    this.jumpForce = -12.8;
    this.facing = 1; // 1 = direita, -1 = esquerda
    this.onGround = false;

    // Habilidades Avançadas
    this.jumpCount = 0;
    this.maxJumps = 2; // Pulo Duplo!
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;

    // Dash
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashSpeed = 15;

    // Ataques
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.slashHitbox = { x: 0, y: 0, width: 50, height: 48 };

    this.shootCooldown = 0;

    // Animação & Efeitos
    this.animFrame = 0;
    this.animTimer = 0;
    this.invulnerableTimer = 0;
    this.isFlying = false;

    // Placar
    this.coins = 0;
    this.gems = 0;
    this.kills = 0;
    this.score = 0;
  }

  update(input, platforms, projectiles) {
    // Timers de Cooldown e Buffers
    if (this.coyoteTimer > 0) this.coyoteTimer--;
    if (this.jumpBuffer > 0) this.jumpBuffer--;
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.invulnerableTimer > 0) this.invulnerableTimer--;

    // Regeneração lenta de SP (Stamina)
    if (this.sp < this.maxSp && !this.isDashing) {
      this.sp = Math.min(this.maxSp, this.sp + 0.35);
    }

    // DASH EXECUTION
    if (this.isDashing) {
      this.dashTimer--;
      this.vx = this.facing * this.dashSpeed;
      this.vy = 0;

      if (window.particleSystem) {
        window.particleSystem.emitDashTrail(this.x, this.y, this.width, this.height, this.facing);
      }

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.vx *= 0.4;
      }
    } else {
      // CONTROLE HORIZONTAL NORMAL (TECLADO OU ANALÓGICO TOUCH)
      if (input.analogX !== undefined && Math.abs(input.analogX) > 0.05) {
        const factor = Math.abs(input.analogX);
        this.vx += input.analogX * this.accel * 1.2;
        this.facing = input.analogX > 0 ? 1 : -1;
        this.vx = Math.max(-this.speed * factor, Math.min(this.speed * factor, this.vx));
      } else if (input.left) {
        this.vx -= this.accel;
        this.facing = -1;
        this.vx = Math.max(-this.speed, Math.min(this.speed, this.vx));
      } else if (input.right) {
        this.vx += this.accel;
        this.facing = 1;
        this.vx = Math.max(-this.speed, Math.min(this.speed, this.vx));
      } else {
        this.vx *= this.friction;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
      }

      // Partículas ao correr
      if (this.onGround && Math.abs(this.vx) > 2 && Math.random() > 0.6) {
        if (window.particleSystem) {
          window.particleSystem.emitDust(this.x + this.width / 2, this.y + this.height, 2);
        }
      }

      // Buffer de pulo
      if (input.jumpPressed) {
        this.jumpBuffer = 7;
      }

      // EXECUÇÃO DO PULO
      if (this.jumpBuffer > 0) {
        if (this.onGround || this.coyoteTimer > 0) {
          // Primeiro pulo
          this.vy = this.jumpForce;
          this.jumpCount = 1;
          this.coyoteTimer = 0;
          this.jumpBuffer = 0;
          if (window.soundEngine) window.soundEngine.playJump();
          if (window.particleSystem) {
            window.particleSystem.emitDust(this.x + this.width / 2, this.y + this.height, 6);
          }
        } else if (this.jumpCount < this.maxJumps) {
          // Pulo Duplo acrobático
          this.vy = this.jumpForce * 0.95;
          this.jumpCount = 2;
          this.jumpBuffer = 0;
          if (window.soundEngine) window.soundEngine.playDoubleJump();
          if (window.particleSystem) {
            window.particleSystem.emitSparkle(this.x + this.width / 2, this.y + this.height / 2, '#00f2fe', 10);
          }
        }
      }

      // DASH TRIGGER
      if (input.dashPressed && this.dashCooldown <= 0 && this.sp >= 25) {
        this.isDashing = true;
        this.dashTimer = 12;
        this.dashCooldown = 35;
        this.sp -= 25;
        this.invulnerableTimer = 14;
        if (window.soundEngine) window.soundEngine.playDash();
      }

      // ATAQUE DE ESPADA
      if (input.attackPressed && this.attackCooldown <= 0) {
        this.isAttacking = true;
        this.attackTimer = 14;
        this.attackCooldown = 22;
        if (window.soundEngine) window.soundEngine.playSlash();
      }

      // DISPARO DE PLASMA
      if (input.shootPressed && this.shootCooldown <= 0 && this.sp >= 15) {
        this.sp -= 15;
        this.shootCooldown = 18;
        const pVx = this.facing * 11;
        const pX = this.facing > 0 ? this.x + this.width + 4 : this.x - 16;
        const pY = this.y + this.height * 0.45;
        projectiles.push(new Projectile(pX, pY, pVx, 0, false, 35, '#00f2fe'));
        if (window.soundEngine) window.soundEngine.playShoot();
      }
    }

    // Atualiza Ataque de Espada
    if (this.isAttacking) {
      this.attackTimer--;
      this.slashHitbox.x = this.facing > 0 ? this.x + this.width - 5 : this.x - this.slashHitbox.width + 5;
      this.slashHitbox.y = this.y + 4;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
      }
    }

    // Executa física
    const prevOnGround = this.onGround;
    window.physicsEngine.resolveEntity(this, platforms);

    if (this.onGround) {
      this.jumpCount = 0;
      this.coyoteTimer = 7;
      if (!prevOnGround && window.particleSystem) {
        window.particleSystem.emitDust(this.x + this.width / 2, this.y + this.height, 5);
      }
    } else {
      if (prevOnGround && this.jumpCount === 0) {
        this.coyoteTimer = 7;
      }
    }

    // Animação de passos
    this.animTimer++;
    if (this.animTimer % 6 === 0) {
      this.animFrame = (this.animFrame + 1) % 4;
    }
  }

  takeDamage(amount, sourceX) {
    if (this.invulnerableTimer > 0) return false;
    this.hp -= amount;
    this.invulnerableTimer = 45; // ~0.75s de invulnerabilidade
    this.vy = -6;
    this.vx = sourceX > this.x ? -7 : 7;
    if (window.soundEngine) window.soundEngine.playHit();
    if (window.particleSystem) {
      window.particleSystem.emitExplosion(this.x + this.width / 2, this.y + this.height / 2, '#ff416c', 14);
    }
    return true;
  }

  render(ctx, camera) {
    // Piscar quando invulnerável
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
      return;
    }

    const rx = this.x - camera.x;
    const ry = this.y - camera.y;

    ctx.save();
    ctx.translate(rx + this.width / 2, ry + this.height / 2);
    ctx.scale(this.facing, 1);

    // 1. Capa de Herói com física de vento
    ctx.fillStyle = '#0052cc';
    ctx.beginPath();
    const capeWiggle = Math.sin(this.animTimer * 0.2) * 4;
    const capeTilt = this.onGround ? (Math.abs(this.vx) * 3) : 10;
    ctx.moveTo(-8, -12);
    ctx.lineTo(-24 - capeTilt, 18 + capeWiggle);
    ctx.lineTo(-12, 22);
    ctx.lineTo(-2, -4);
    ctx.closePath();
    ctx.fill();

    // 2. Corpo / Armadura Cibernética de Gabriel
    // Pernas animadas
    const legOffset = this.onGround && Math.abs(this.vx) > 0.5 ? Math.sin(this.animTimer * 0.35) * 6 : 0;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-12, 10, 8, 16 + legOffset);
    ctx.fillRect(4, 10, 8, 16 - legOffset);

    // Botas Tecnológicas
    ctx.fillStyle = '#00f2fe';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00f2fe';
    ctx.fillRect(-13, 22 + legOffset, 10, 5);
    ctx.fillRect(3, 22 - legOffset, 10, 5);
    ctx.shadowBlur = 0;

    // Tronco / Peitoral
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-14, -12, 28, 22);
    // Placa de Peito com Reator
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-10, -10, 20, 16);
    ctx.fillStyle = '#00f2fe';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00f2fe';
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cabeça
    ctx.fillStyle = '#ffdbac'; // Tom de pele
    ctx.fillRect(-8, -26, 16, 14);

    // Cabelo Estiloso
    ctx.fillStyle = '#451a03'; // Castanho escuro
    ctx.beginPath();
    ctx.moveTo(-10, -26);
    ctx.lineTo(9, -26);
    ctx.lineTo(12, -22);
    ctx.lineTo(10, -18);
    ctx.lineTo(-9, -20);
    ctx.closePath();
    ctx.fill();

    // Faixa / Visor Tecnológico do Gabriel
    ctx.fillStyle = '#00f2fe';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00f2fe';
    ctx.fillRect(-2, -22, 10, 4);
    ctx.shadowBlur = 0;

    // Braços e Espada de Luz
    if (this.isAttacking) {
      // Golpe de Espada Dinâmico
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f2fe';
      ctx.beginPath();
      ctx.arc(22, 0, 32, -Math.PI * 0.4, Math.PI * 0.4, false);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#00f2fe';
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // Braço segurando espada em guarda
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(4, -8, 8, 14);
      // Cabo e lâmina guardada
      ctx.fillStyle = '#00f2fe';
      ctx.fillRect(8, -14, 3, 16);
    }

    ctx.restore();
  }
}

// ==========================================
// 3. BOT AMIGO COMPANHEIRO (IA ALIADA)
// ==========================================
class CompanionBot {
  constructor(owner) {
    this.owner = owner;
    this.x = owner.x - 25;
    this.y = owner.y - 25;
    this.targetX = this.x;
    this.targetY = this.y;
    this.width = 24;
    this.height = 24;
    this.floatAngle = 0;
    this.shootTimer = 0;
    this.state = 'SEGUINDO'; // SEGUINDO, ATACANDO, COLETANDO
  }

  update(enemies, items, projectiles) {
    this.floatAngle += 0.08;
    this.shootTimer++;

    // Posição de repouso suave orbitando Gabriel
    const offsetX = this.owner.facing > 0 ? -32 : 32;
    this.targetX = this.owner.x + offsetX + Math.cos(this.floatAngle) * 8;
    this.targetY = this.owner.y - 24 + Math.sin(this.floatAngle) * 8;

    // Movimento suave com interpolação (lerp)
    this.x += (this.targetX - this.x) * 0.12;
    this.y += (this.targetY - this.y) * 0.12;

    // 1. Ímã de Coleta Autônomo para Moedas próximas
    for (const item of items) {
      if (item.collected) continue;
      const dist = Math.hypot(item.x - this.x, item.y - this.y);
      if (dist < 180) {
        // Atrai a moeda até Gabriel
        item.x += (this.owner.x - item.x) * 0.14;
        item.y += (this.owner.y - item.y) * 0.14;
        this.state = 'COLETANDO';
      }
    }

    // 2. Disparo Autônomo contra Inimigos próximos
    if (this.shootTimer >= 45) { // Atira a cada ~0.75s se houver ameaça
      let nearestEnemy = null;
      let minDist = 360;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (dist < minDist) {
          minDist = dist;
          nearestEnemy = enemy;
        }
      }

      if (nearestEnemy) {
        this.state = 'ATACANDO';
        const angle = Math.atan2(
          (nearestEnemy.y + nearestEnemy.height / 2) - this.y,
          (nearestEnemy.x + nearestEnemy.width / 2) - this.x
        );
        const pVx = Math.cos(angle) * 9;
        const pVy = Math.sin(angle) * 9;

        projectiles.push(new Projectile(this.x, this.y, pVx, pVy, false, 20, '#39ff14'));
        this.shootTimer = 0;
        if (window.soundEngine) window.soundEngine.playShoot();
        if (window.particleSystem) {
          window.particleSystem.emitSparkle(this.x, this.y, '#39ff14', 6);
        }
      } else {
        this.state = 'SEGUINDO';
      }
    }

    // Partículas de propulsão do Drone
    if (window.particleSystem && Math.random() > 0.5) {
      window.particleSystem.add({
        x: this.x + this.width / 2,
        y: this.y + this.height,
        vx: (Math.random() * 0.6 - 0.3),
        vy: Math.random() * 1.5 + 0.5,
        size: 2.5,
        color: '#39ff14',
        alpha: 0.8,
        decay: 0.05,
        gravity: 0,
        glow: true
      });
    }
  }

  render(ctx, camera) {
    const rx = this.x - camera.x;
    const ry = this.y - camera.y;

    ctx.save();
    ctx.translate(rx + this.width / 2, ry + this.height / 2);

    // Halo protetor
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Corpo Esférico do Drone
    ctx.fillStyle = '#0f172a';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#39ff14';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    // Olho / Visor Inteligente do Bot
    ctx.fillStyle = this.state === 'ATACANDO' ? '#ff416c' : (this.state === 'COLETANDO' ? '#ffd700' : '#39ff14');
    ctx.beginPath();
    ctx.arc(0, -1, 4, 0, Math.PI * 2);
    ctx.fill();

    // Antenas rotativas
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-14, -9);
    ctx.moveTo(10, -4);
    ctx.lineTo(14, -9);
    ctx.stroke();

    ctx.restore();
  }
}

// ==========================================
// 4. BOTS INIMIGOS COM IA AUTÔNOMA
// ==========================================

// Base Bot Inimigo
class HostileBot {
  constructor(x, y, width, height, hp) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.hp = hp;
    this.maxHp = hp;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.onGround = false;
    this.alive = true;
    this.aiState = 'PATROL'; // PATROL, ALERT, CHASE, ATTACK
    this.alertTimer = 0;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (window.soundEngine) window.soundEngine.playHit();
    if (window.particleSystem) {
      window.particleSystem.emitExplosion(this.x + this.width / 2, this.y + this.height / 2, '#ffd700', 10);
    }
    if (this.hp <= 0) {
      this.alive = false;
      if (window.soundEngine) window.soundEngine.playExplosion();
      if (window.particleSystem) {
        window.particleSystem.emitExplosion(this.x + this.width / 2, this.y + this.height / 2, '#ff416c', 25);
      }
      return true;
    }
    return false;
  }
}

// BOT 1: PATROL BOT (Andador Terrestre com Salto de Obstáculos)
class PatrolBot extends HostileBot {
  constructor(x, y) {
    super(x, y, 36, 46, 60);
    this.speed = 1.8;
    this.chaseSpeed = 3.2;
    this.patrolRange = 220;
    this.startX = x;
    this.jumpCooldown = 0;
  }

  update(player, platforms, projectiles) {
    if (this.jumpCooldown > 0) this.jumpCooldown--;

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    const seesPlayer = distToPlayer < 280 && Math.abs(player.y - this.y) < 120;

    // IA MÁQUINA DE ESTADOS
    if (seesPlayer) {
      this.aiState = 'CHASE';
      this.facing = player.x > this.x ? 1 : -1;
      this.vx = this.facing * this.chaseSpeed;

      // Se o jogador estiver acima ou tiver obstáculo, pula!
      if (this.onGround && this.jumpCooldown <= 0 && (player.y < this.y - 40 || Math.abs(this.vx) < 0.2)) {
        this.vy = -11;
        this.jumpCooldown = 60;
      }
    } else {
      this.aiState = 'PATROL';
      this.vx = this.facing * this.speed;

      // Inverte patrulha ao atingir limite
      if (this.x > this.startX + this.patrolRange) this.facing = -1;
      if (this.x < this.startX - this.patrolRange) this.facing = 1;
    }

    // Físicas
    window.physicsEngine.resolveEntity(this, platforms);

    // Dano ao jogador ao colidir
    if (window.physicsEngine.checkAABB(this, player)) {
      player.takeDamage(15, this.x);
    }
  }

  onWallHit(dir) {
    // Ao bater na parede, pula ou inverte patrulha
    if (this.aiState === 'CHASE' && this.onGround && this.jumpCooldown <= 0) {
      this.vy = -12;
      this.jumpCooldown = 45;
    } else {
      this.facing = -dir;
    }
  }

  render(ctx, camera) {
    const rx = this.x - camera.x;
    const ry = this.y - camera.y;

    ctx.save();
    ctx.translate(rx + this.width / 2, ry + this.height / 2);
    ctx.scale(this.facing, 1);

    // Pernas robóticas
    ctx.fillStyle = '#334155';
    ctx.fillRect(-10, 10, 6, 14);
    ctx.fillRect(4, 10, 6, 14);

    // Chassi Robótico
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-14, -12, 28, 24);

    // Olho Cíclope IA (Vermelho em alerta/perseguição, Azul em patrulha)
    ctx.fillStyle = this.aiState === 'CHASE' ? '#ff0055' : '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(2, -6, 10, 6);
    ctx.shadowBlur = 0;

    // Mini Barra de Vida
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(rx, ry - 10, this.width, 5);
    ctx.fillStyle = '#ff416c';
    ctx.fillRect(rx, ry - 10, (this.hp / this.maxHp) * this.width, 5);
    ctx.restore();
  }
}

// BOT 2: FLY DRONE BOT (Drone Voador com Canhão Laser)
class FlyDroneBot extends HostileBot {
  constructor(x, y) {
    super(x, y, 32, 28, 45);
    this.isFlying = true;
    this.startY = y;
    this.floatTimer = Math.random() * 10;
    this.shootTimer = 0;
  }

  update(player, platforms, projectiles) {
    this.floatTimer += 0.05;
    this.shootTimer++;

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    const seesPlayer = distToPlayer < 350;

    if (seesPlayer) {
      this.aiState = 'ATTACK';
      this.facing = player.x > this.x ? 1 : -1;

      // Aproximação tática mantendo altitude
      const targetX = player.x + (this.facing > 0 ? -120 : 120);
      const targetY = player.y - 90 + Math.sin(this.floatTimer) * 15;

      this.vx += (targetX - this.x) * 0.02;
      this.vy += (targetY - this.y) * 0.02;
      this.vx *= 0.92;
      this.vy *= 0.92;

      // Disparo de plasma inimigo
      if (this.shootTimer >= 80) {
        const angle = Math.atan2((player.y + player.height / 2) - this.y, (player.x + player.width / 2) - this.x);
        projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 6, Math.sin(angle) * 6, true, 18, '#ff0055'));
        this.shootTimer = 0;
        if (window.soundEngine) window.soundEngine.playShoot();
      }
    } else {
      this.aiState = 'PATROL';
      this.vx = Math.sin(this.floatTimer * 0.5) * 1.5;
      this.vy = Math.cos(this.floatTimer) * 1;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Dano de toque
    if (window.physicsEngine.checkAABB(this, player)) {
      player.takeDamage(12, this.x);
    }
  }

  render(ctx, camera) {
    const rx = this.x - camera.x;
    const ry = this.y - camera.y;

    ctx.save();
    ctx.translate(rx + this.width / 2, ry + this.height / 2);

    // Hélices / Propulsores
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-18, -12, 36, 3);

    // Corpo do Drone
    ctx.fillStyle = '#0f172a';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff0055';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Canhão Frontal
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// BOT 3: CHEFÃO MECHA AUTÔNOMO (GOLIATH-BOT 3000)
class BossMechaBot extends HostileBot {
  constructor(x, y) {
    super(x, y, 76, 94, 400);
    this.speed = 1.4;
    this.phaseTimer = 0;
    this.phase = 1; // 1 = Marcha e Esmagamento, 2 = Salto Épico, 3 = Salva de Mísseis
    this.isEnraged = false;
  }

  update(player, platforms, projectiles, enemies) {
    this.phaseTimer++;

    // Fase de fúria com menos de 50% de HP
    if (this.hp < this.maxHp * 0.5 && !this.isEnraged) {
      this.isEnraged = true;
      this.speed = 2.2;
      if (window.particleSystem) {
        window.particleSystem.emitExplosion(this.x + this.width / 2, this.y, '#ff416c', 30);
      }
    }

    this.facing = player.x > this.x ? 1 : -1;

    // Ciclo de Ataques Autônomos
    const cycle = this.phaseTimer % 360;

    if (cycle < 180) {
      // Movimento de marcha em direção a Gabriel
      this.vx = this.facing * this.speed;
    } else if (cycle >= 180 && cycle < 240) {
      // Preparação para salto ou investida
      this.vx *= 0.8;
      if (cycle === 200 && this.onGround) {
        this.vy = -14;
        this.vx = this.facing * 6;
      }
    } else if (cycle === 270) {
      // Disparo em leque de mísseis quádruplos
      for (let angle = -0.4; angle <= 0.4; angle += 0.25) {
        const dir = this.facing;
        const vx = dir * Math.cos(angle) * 6;
        const vy = Math.sin(angle) * 6 - 2;
        projectiles.push(new Projectile(this.x + this.width / 2, this.y + 20, vx, vy, true, 20, '#ff416c'));
      }
      if (window.soundEngine) window.soundEngine.playShoot();
    }

    // Físicas
    window.physicsEngine.resolveEntity(this, platforms);

    // Efeito de impacto no solo ao pousar
    if (this.onGround && Math.abs(this.vy) > 8 && window.particleSystem) {
      window.particleSystem.emitDust(this.x + this.width / 2, this.y + this.height, 12, '#ff416c');
    }

    // Colisão direta
    if (window.physicsEngine.checkAABB(this, player)) {
      player.takeDamage(25, this.x);
    }
  }

  render(ctx, camera) {
    const rx = this.x - camera.x;
    const ry = this.y - camera.y;

    ctx.save();
    ctx.translate(rx + this.width / 2, ry + this.height / 2);
    ctx.scale(this.facing, 1);

    // Pernas Pesadas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-22, 24, 16, 24);
    ctx.fillRect(8, 24, 16, 24);

    // Torso Blindado
    ctx.fillStyle = this.isEnraged ? '#450a0a' : '#0f172a';
    ctx.fillRect(-34, -36, 68, 60);

    // Placa de Energia Central
    ctx.fillStyle = '#ff416c';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff416c';
    ctx.fillRect(-18, -18, 36, 24);

    // Canhão de Ombro
    ctx.fillStyle = '#334155';
    ctx.fillRect(10, -48, 24, 14);

    ctx.restore();

    // Barra de Vida Superior do Boss
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(rx - 10, ry - 18, this.width + 20, 8);
    ctx.fillStyle = '#ff416c';
    ctx.fillRect(rx - 10, ry - 18, ((this.hp / this.maxHp) * (this.width + 20)), 8);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx - 10, ry - 18, this.width + 20, 8);
    ctx.restore();
  }
}

// ==========================================
// 5. COLETÁVEIS (MOEDAS, GEMAS, TRAMPOLINS)
// ==========================================
class Collectible {
  constructor(x, y, type = 'coin') {
    this.x = x;
    this.y = y;
    this.width = 22;
    this.height = 22;
    this.type = type; // 'coin', 'gem', 'heart'
    this.collected = false;
    this.animTimer = Math.random() * 10;
  }

  update(player) {
    this.animTimer += 0.08;

    if (window.physicsEngine.checkAABB(this, player)) {
      this.collected = true;
      if (this.type === 'coin') {
        player.coins++;
        player.score += 100;
        if (window.soundEngine) window.soundEngine.playCoin();
        if (window.particleSystem) window.particleSystem.emitSparkle(this.x, this.y, '#ffd700', 12);
      } else if (this.type === 'gem') {
        player.gems++;
        player.score += 500;
        if (window.soundEngine) window.soundEngine.playGem();
        if (window.particleSystem) window.particleSystem.emitSparkle(this.x, this.y, '#00f2fe', 18);
      } else if (this.type === 'heart') {
        player.hp = Math.min(player.maxHp, player.hp + 35);
        if (window.soundEngine) window.soundEngine.playGem();
        if (window.particleSystem) window.particleSystem.emitSparkle(this.x, this.y, '#ff416c', 16);
      }
    }
  }

  render(ctx, camera) {
    const rx = this.x - camera.x;
    const ry = this.y - camera.y + Math.sin(this.animTimer) * 4;

    ctx.save();
    if (this.type === 'coin') {
      ctx.fillStyle = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffd700';
      ctx.beginPath();
      ctx.arc(rx + 11, ry + 11, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx + 9, ry + 6, 4, 10);
    } else if (this.type === 'gem') {
      ctx.fillStyle = '#00f2fe';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#00f2fe';
      ctx.beginPath();
      ctx.moveTo(rx + 11, ry);
      ctx.lineTo(rx + 22, ry + 11);
      ctx.lineTo(rx + 11, ry + 22);
      ctx.lineTo(rx, ry + 11);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'heart') {
      ctx.fillStyle = '#ff416c';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff416c';
      ctx.font = '20px sans-serif';
      ctx.fillText('❤️', rx, ry + 18);
    }
    ctx.restore();
  }
}
