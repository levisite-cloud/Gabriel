/**
 * Physics & Platforming Engine
 * Colisão AABB precisa, plataformas móveis, trampolins, coyote-time e jump buffering
 */
class PhysicsEngine {
  constructor() {
    this.gravity = 0.55;
    this.maxFallSpeed = 14;
  }

  // Verifica sobreposição de caixas (AABB)
  checkAABB(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // Resolve física do jogador ou bot contra o mundo de plataformas
  resolveEntity(entity, platforms, delta = 1) {
    // Aplica gravidade se não estiver voando ou executando dash
    if (!entity.isDashing && !entity.isFlying) {
      entity.vy += this.gravity * delta;
      if (entity.vy > this.maxFallSpeed) {
        entity.vy = this.maxFallSpeed;
      }
    }

    // Movimento Horizontal
    entity.x += entity.vx * delta;
    for (const plat of platforms) {
      if (plat.type === 'hazard' || plat.isOneWay) continue;
      if (this.checkAABB(entity, plat)) {
        if (entity.vx > 0) {
          entity.x = plat.x - entity.width;
          entity.vx = 0;
          if (entity.onWallHit) entity.onWallHit(1);
        } else if (entity.vx < 0) {
          entity.x = plat.x + plat.width;
          entity.vx = 0;
          if (entity.onWallHit) entity.onWallHit(-1);
        }
      }
    }

    // Movimento Vertical
    entity.y += entity.vy * delta;
    entity.onGround = false;
    entity.currentPlatform = null;

    for (const plat of platforms) {
      if (plat.type === 'hazard') continue;

      // Plataforma Semi-sólida (One-way: pode pular de baixo para cima)
      if (plat.isOneWay) {
        const prevBottom = entity.y + entity.height - entity.vy * delta;
        if (entity.vy > 0 && prevBottom <= plat.y + 6 && this.checkAABB(entity, plat)) {
          entity.y = plat.y - entity.height;
          entity.vy = 0;
          entity.onGround = true;
          entity.currentPlatform = plat;
          if (plat.isSpring) {
            entity.vy = -16;
            plat.triggerSpring();
            if (window.soundEngine) window.soundEngine.playDoubleJump();
          }
        }
        continue;
      }

      // Plataforma Sólida padrão
      if (this.checkAABB(entity, plat)) {
        if (entity.vy > 0) {
          entity.y = plat.y - entity.height;
          entity.vy = 0;
          entity.onGround = true;
          entity.currentPlatform = plat;

          // Se for trampolim
          if (plat.isSpring) {
            entity.vy = -18;
            plat.triggerSpring();
            if (window.soundEngine) window.soundEngine.playDoubleJump();
            if (window.particleSystem) {
              window.particleSystem.emitSparkle(plat.x + plat.width / 2, plat.y, '#39ff14', 16);
            }
          }
        } else if (entity.vy < 0) {
          entity.y = plat.y + plat.height;
          entity.vy = 0;
        }
      }
    }

    // Se estiver sobre uma plataforma móvel, acompanha o movimento dela
    if (entity.onGround && entity.currentPlatform && entity.currentPlatform.vx) {
      entity.x += entity.currentPlatform.vx;
    }
  }
}

window.physicsEngine = new PhysicsEngine();
