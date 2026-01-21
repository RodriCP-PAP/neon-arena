/* Neon Arena — Phaser 3
   Fix: MainScene definido ANTES do config/new Phaser.Game
*/

const WIDTH = 1280;
const HEIGHT = 720;

const STORAGE_KEY = "neon_arena_highscore_v1";

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

class MainScene extends Phaser.Scene {
  constructor(){ super("MainScene"); }

  create(){
    // Estado
    this.score = 0;
    this.timeAlive = 0;
    this.wave = 1;

    this.high = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);

    // Input
    this.keys = this.input.keyboard.addKeys({
      w: "W", a: "A", s: "S", d: "D",
      shift: "SHIFT",
      e: "E",
      r: "R"
    });

    this.input.mouse.disableContextMenu();

    // Texturas
    this.makeTextures();

    // Fundo
    this.bg = this.add.tileSprite(0, 0, WIDTH, HEIGHT, "grid").setOrigin(0);

    // Partículas
    this.particles = this.add.particles(0, 0, "spark");

    this.trail = this.particles.createEmitter({
      speed: { min: 10, max: 60 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 140, max: 260 },
      quantity: 2,
      frequency: 20,
      blendMode: "ADD"
    });
    this.trail.stop();

    // Player
    this.player = this.physics.add.image(WIDTH * 0.5, HEIGHT * 0.5, "player");
    this.player.setDamping(true);
    this.player.setDrag(0.88);
    this.player.setMaxVelocity(520);
    this.player.setCircle(14);
    this.player.setDepth(2);

    this.playerHP = 3;
    this.invuln = 0;

    // Balas
    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 120,
      runChildUpdate: false
    });

    this.fireRateMs = 120;
    this.lastShot = 0;

    // Dash
    this.dashCdMs = 900;
    this.lastDash = -9999;
    this.dashIFramesMs = 260;

    // Slow-mo
    this.slowCdMs = 2600;
    this.lastSlow = -9999;
    this.slowDurationMs = 900;
    this.slowActiveUntil = 0;

    // Inimigos
    this.enemies = this.physics.add.group();
    this.spawnTimer = 0;

    // Explosões
    this.boom = (x, y, power = 1) => {
      this.particles.createEmitter({
        x, y,
        speed: { min: 60 * power, max: 260 * power },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        lifespan: { min: 180, max: 420 },
        quantity: 24,
        blendMode: "ADD"
      }).explode(24, x, y);
    };

    // Colisões
    this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
      bullet.setActive(false).setVisible(false);
      bullet.body.enable = false;

      enemy.hp -= 1;
      this.boom(enemy.x, enemy.y, 1);

      if (enemy.hp <= 0) {
        this.score += 35 + Math.floor(enemy.speed * 0.05);
        this.boom(enemy.x, enemy.y, 1.2);
        enemy.destroy();
        this.cameras.main.shake(60, 0.006);
      }
    });

    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
      if (this.invuln > 0) return;

      this.playerHP -= 1;
      this.invuln = this.dashIFramesMs;

      this.boom(player.x, player.y, 1.2);
      this.cameras.main.shake(160, 0.012);

      // knockback
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      player.body.velocity.x += (dx / len) * 380;
      player.body.velocity.y += (dy / len) * 380;

      if (this.playerHP <= 0) this.gameOver();
    });

    // HUD
    this.hud = this.add.text(16, 14, "", {
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: "16px",
      color: "#e8eefc"
    }).setDepth(5);

    this.sub = this.add.text(16, 38, "", {
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: "13px",
      color: "#9fb0d0"
    }).setDepth(5);

    // Mira
    this.cross = this.add.image(0, 0, "cross").setDepth(6).setAlpha(0.9);

    // Glow
    this.glow = this.add.image(this.player.x, this.player.y, "glow").setDepth(1).setAlpha(0.6);

    // Primeiros inimigos
    for (let i = 0; i < 5; i++) this.spawnEnemy();

    // Restart
    this.input.keyboard.on("keydown-R", () => this.scene.restart());

    this.input.on("pointerdown", () => this.game.canvas.focus());
  }

  makeTextures(){
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Grid
    g.clear();
    g.fillStyle(0x0b1020, 1);
    g.fillRect(0, 0, 256, 256);
    g.lineStyle(2, 0x1a2a55, 0.45);
    for (let i = 0; i <= 256; i += 32) {
      g.lineBetween(i, 0, i, 256);
      g.lineBetween(0, i, 256, i);
    }
    g.generateTexture("grid", 256, 256);

    // Player
    g.clear();
    g.fillStyle(0x69f0ff, 1);
    g.fillCircle(16, 16, 14);
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeCircle(16, 16, 14);
    g.generateTexture("player", 32, 32);

    // Enemy
    g.clear();
    g.fillStyle(0xff4d6d, 1);
    g.fillCircle(16, 16, 13);
    g.lineStyle(2, 0xffffff, 0.55);
    g.strokeCircle(16, 16, 13);
    g.generateTexture("enemy", 32, 32);

    // Bullet
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 4);
    g.generateTexture("bullet", 12, 12);

    // Spark
    g.clear();
    g.fillStyle(0x9ad7ff, 1);
    g.fillCircle(4, 4, 3);
    g.generateTexture("spark", 8, 8);

    // Crosshair
    g.clear();
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(16, 16, 10);
    g.lineBetween(16, 2, 16, 8);
    g.lineBetween(16, 24, 16, 30);
    g.lineBetween(2, 16, 8, 16);
    g.lineBetween(24, 16, 30, 16);
    g.generateTexture("cross", 32, 32);

    // Glow
    g.clear();
    g.fillStyle(0x69f0ff, 0.20);
    g.fillCircle(64, 64, 58);
    g.fillStyle(0x69f0ff, 0.12);
    g.fillCircle(64, 64, 44);
    g.fillStyle(0x69f0ff, 0.08);
    g.fillCircle(64, 64, 30);
    g.generateTexture("glow", 128, 128);

    g.destroy();
  }

  update(time, delta){
    this.bg.tilePositionX += 0.25;
    this.bg.tilePositionY += 0.18;

    const p = this.input.activePointer;
    this.cross.setPosition(p.worldX, p.worldY);

    this.timeAlive += delta / 1000;

    if (this.invuln > 0) {
      this.invuln -= delta;
      this.player.setAlpha((Math.floor(time / 70) % 2) ? 0.35 : 1);
    } else {
      this.player.setAlpha(1);
    }

    const slowNow = time < this.slowActiveUntil;
    const targetScale = slowNow ? 0.35 : 1.0;
    this.time.timeScale = Phaser.Math.Linear(this.time.timeScale, targetScale, 0.12);
    this.physics.world.timeScale = this.time.timeScale;

    const move = new Phaser.Math.Vector2(0, 0);
    if (this.keys.w.isDown) move.y -= 1;
    if (this.keys.s.isDown) move.y += 1;
    if (this.keys.a.isDown) move.x -= 1;
    if (this.keys.d.isDown) move.x += 1;
    if (move.lengthSq() > 0) move.normalize();

    const baseAccel = slowNow ? 900 : 1100;
    this.player.body.acceleration.x = move.x * baseAccel;
    this.player.body.acceleration.y = move.y * baseAccel;

    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, p.worldX, p.worldY);
    this.player.setRotation(ang);

    if (p.isDown) this.tryShoot(time, ang);
    if (Phaser.Input.Keyboard.JustDown(this.keys.shift)) this.tryDash(time, ang);
    if (Phaser.Input.Keyboard.JustDown(this.keys.e)) this.trySlow(time);

    const speed = this.player.body.velocity.length();
    if (speed > 120) {
      this.trail.start();
      this.trail.setPosition(this.player.x, this.player.y);
    } else {
      this.trail.stop();
    }

    this.glow.setPosition(this.player.x, this.player.y);

    this.updateEnemies(delta);

    this.spawnTimer += delta;
    const spawnEvery = clamp(980 - this.timeAlive * 18, 360, 980);
    if (this.spawnTimer > spawnEvery) {
      this.spawnTimer = 0;
      this.spawnEnemy();
      if (Math.random() < 0.15) this.spawnEnemy();
    }

    const newWave = 1 + Math.floor(this.timeAlive / 18);
    if (newWave !== this.wave) this.wave = newWave;

    this.bullets.children.iterate((b) => {
      if (!b || !b.active) return;
      if (b.x < -50 || b.x > WIDTH + 50 || b.y < -50 || b.y > HEIGHT + 50) {
        b.setActive(false).setVisible(false);
        b.body.enable = false;
      }
    });

    const dashReady = (time - this.lastDash) >= this.dashCdMs;
    const slowReady = (time - this.lastSlow) >= this.slowCdMs;

    this.hud.setText(
      `HP: ${"♥".repeat(this.playerHP)}${"·".repeat(Math.max(0, 3 - this.playerHP))}   ` +
      `Score: ${this.score}   High: ${this.high}   Wave: ${this.wave}`
    );

    this.sub.setText(
      `Dash: ${dashReady ? "OK" : Math.ceil((this.dashCdMs - (time - this.lastDash)) / 100) / 10 + "s"}   ` +
      `Slow-mo: ${slowReady ? "OK" : Math.ceil((this.slowCdMs - (time - this.lastSlow)) / 100) / 10 + "s"}   ` +
      `${slowNow ? "— SLOW-MO ATIVO" : ""}`
    );
  }

  tryShoot(time, ang){
    if (time - this.lastShot < this.fireRateMs) return;
    this.lastShot = time;

    const b = this.bullets.get(this.player.x, this.player.y, "bullet");
    if (!b) return;

    b.setActive(true).setVisible(true);
    b.body.enable = true;
    b.setRotation(ang);
    b.setDepth(3);

    const speed = 900;
    b.body.velocity.x = Math.cos(ang) * speed;
    b.body.velocity.y = Math.sin(ang) * speed;

    this.player.body.velocity.x -= Math.cos(ang) * 18;
    this.player.body.velocity.y -= Math.sin(ang) * 18;

    this.particles.createEmitter({
      x: this.player.x + Math.cos(ang) * 18,
      y: this.player.y + Math.sin(ang) * 18,
      speed: { min: 50, max: 220 },
      angle: Phaser.Math.RadToDeg(ang) + 180,
      spread: 25,
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 80, max: 160 },
      quantity: 6,
      blendMode: "ADD"
    }).explode(6, this.player.x, this.player.y);
  }

  tryDash(time, ang){
    if (time - this.lastDash < this.dashCdMs) return;
    this.lastDash = time;

    const dashSpeed = 980;
    this.player.body.velocity.x = Math.cos(ang) * dashSpeed;
    this.player.body.velocity.y = Math.sin(ang) * dashSpeed;

    this.invuln = this.dashIFramesMs;
    this.boom(this.player.x, this.player.y, 1.05);
    this.cameras.main.shake(90, 0.01);
  }

  trySlow(time){
    if (time - this.lastSlow < this.slowCdMs) return;
    this.lastSlow = time;
    this.slowActiveUntil = time + this.slowDurationMs;
    this.cameras.main.flash(80, 105, 240, 255, true);
  }

  spawnEnemy(){
    const side = Phaser.Math.Between(0, 3);
    let x, y;
    const pad = 40;

    if (side === 0) { x = -pad; y = Phaser.Math.Between(0, HEIGHT); }
    if (side === 1) { x = WIDTH + pad; y = Phaser.Math.Between(0, HEIGHT); }
    if (side === 2) { x = Phaser.Math.Between(0, WIDTH); y = -pad; }
    if (side === 3) { x = Phaser.Math.Between(0, WIDTH); y = HEIGHT + pad; }

    const e = this.physics.add.image(x, y, "enemy");
    e.setDepth(2);
    e.setCircle(13);
    e.hp = 2 + Math.floor(this.wave * 0.35);
    e.speed = 90 + this.wave * 16 + Phaser.Math.Between(0, 35);
    e.separation = 120;
    e.drag = 0.92;

    this.enemies.add(e);
  }

  updateEnemies(delta){
    const enemies = this.enemies.getChildren();
    const px = this.player.x, py = this.player.y;

    for (let i = 0; i < enemies.length; i++){
      const e = enemies[i];
      if (!e.active) continue;

      let vx = px - e.x;
      let vy = py - e.y;
      let d = Math.max(1, Math.hypot(vx, vy));
      vx /= d; vy /= d;

      let sx = 0, sy = 0;
      for (let j = 0; j < enemies.length; j++){
        if (i === j) continue;
        const o = enemies[j];
        if (!o.active) continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < e.separation) {
          const push = (e.separation - dist) / e.separation;
          sx += (dx / dist) * push;
          sy += (dy / dist) * push;
        }
      }

      const steerX = vx * 1.0 + sx * 1.35;
      const steerY = vy * 1.0 + sy * 1.35;

      const len = Math.max(1, Math.hypot(steerX, steerY));
      const dirX = steerX / len;
      const dirY = steerY / len;

      const accel = e.speed * 6.2 * (delta / 1000);
      e.body.velocity.x = e.body.velocity.x * e.drag + dirX * accel * 60;
      e.body.velocity.y = e.body.velocity.y * e.drag + dirY * accel * 60;

      const ang = Phaser.Math.Angle.Between(0, 0, e.body.velocity.x, e.body.velocity.y);
      e.setRotation(ang);
    }
  }

  gameOver(){
    if (this.score > this.high) {
      this.high = this.score;
      localStorage.setItem(STORAGE_KEY, String(this.high));
    }

    this.add.rectangle(WIDTH/2, HEIGHT/2, WIDTH, HEIGHT, 0x000000, 0.55).setDepth(20);
    this.add.text(WIDTH/2, HEIGHT/2 - 50, "GAME OVER", {
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: "56px",
      color: "#e8eefc"
    }).setOrigin(0.5).setDepth(21);

    this.add.text(WIDTH/2, HEIGHT/2 + 20,
      `Score: ${this.score}  ·  High: ${this.high}\nPressiona R para recomeçar`,
      {
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: "18px",
        color: "#9fb0d0",
        align: "center"
      }
    ).setOrigin(0.5).setDepth(21);

    this.physics.pause();
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;
    this.trail.stop();
    this.cameras.main.shake(220, 0.02);
  }
}

/* ✅ config e new Phaser.Game só depois de MainScene existir */
const config = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#070a14",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH,
    height: HEIGHT
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [MainScene]
};

new Phaser.Game(config);
