// gameEngine.mjs — pure endless-runner logic, no DOM, no pose, no model.
// The game only knows one input: jump(). Whether that call came from the
// camera model, the keyboard, or a tap button is decided outside this file.
// That is what makes swapping the model later a file replacement, not a
// game change: retrain -> overwrite model/model.json -> reload the page.
//
// Physics (tuned for a ~0.75 s jump arc, matching a real in-place jump):
//   jump velocity -900 px/s, gravity 2400 px/s^2
//   apex = 900^2 / (2*2400) = ~169 px, air time = 2*900/2400 = 0.75 s
// Double jump: up to 2 jumps before landing (the 2nd resets the
// vertical velocity mid-air, so it can clear a second, close obstacle).
// jumpsUsed resets to 0 on landing.
// Coordinates: y grows downwards. groundY is the player's feet line.

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 360;

export class RunnerGame {
  constructor({ groundY = 320, playerX = 80 } = {}) {
    this.width = GAME_WIDTH;
    this.height = GAME_HEIGHT;
    this.groundY = groundY;
    this.playerX = playerX;
    this.playerW = 36;
    this.playerH = 48;
    this.gravity = 2400;
    this.jumpVelocity = -900;
    this.baseSpeed = 220;
    this.maxSpeed = 450;
    this.reset();
  }

  reset() {
    this.state = "idle"; // idle | playing | over
    this.paused = false;
    this.score = 0;
    this.distance = 0;
    this.speed = this.baseSpeed;
    this.playerY = this.groundY - this.playerH;
    this.playerVy = 0;
    this.grounded = true;
    this.jumpsUsed = 0; // jumps since last landing; max 2 (double jump)
    this.obstacles = [];
    this.spawnTimer = 1.0; // first obstacle after 1 s, so the player can settle
    this.time = 0;
  }

  start() {
    this.reset();
    this.state = "playing";
  }

  // Returns true only if a jump actually started. Up to 2 jumps per
  // landing: the 1st from the ground, the 2nd mid-air (it resets the
  // vertical velocity, so the cat rises again). A 3rd call while still
  // airborne is ignored, and landing resets the count.
  jump() {
    if (this.state !== "playing" || this.paused || this.jumpsUsed >= 2) return false;
    this.playerVy = this.jumpVelocity;
    this.grounded = false;
    this.jumpsUsed += 1;
    return true;
  }

  spawnObstacle(width, height) {
    this.obstacles.push({
      x: this.width,
      width: width ?? 30 + Math.random() * 22,
      height: height ?? 42 + Math.random() * 28,
      counted: false,
    });
  }

  // dt in seconds. Returns "hit" on the frame the player collides, else null.
  update(dt) {
    if (this.state !== "playing" || this.paused) return null;
    const clamped = Math.min(Math.max(dt, 0), 0.05);
    this.time += clamped;
    this.distance += this.speed * clamped;
    // Speed grows with distance, capped: ~+15 px/s per 100 m-ish of distance.
    this.speed = Math.min(
      this.maxSpeed,
      this.baseSpeed + Math.floor(this.distance / 500) * 12
    );
    this.score += clamped * this.speed * 0.1;

    // Player physics.
    if (!this.grounded) {
      this.playerVy += this.gravity * clamped;
      this.playerY += this.playerVy * clamped;
      if (this.playerY >= this.groundY - this.playerH) {
        this.playerY = this.groundY - this.playerH;
        this.playerVy = 0;
        this.grounded = true;
        this.jumpsUsed = 0;
      }
    }

    // Obstacles: spawn, move, score when passed, collide, cull.
    this.spawnTimer -= clamped;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      // Next gap shrinks as speed grows, but never below ~0.95 s (was
      // 0.75 s — obstacles were coming too close together late in the
      // game, when the speed is highest and jumping gets tiring).
      this.spawnTimer = Math.max(0.95, 1.8 - this.speed / 500 + Math.random() * 0.5);
    }
    // Forgiving hitbox: shrink the player box by 6 px each side, 4 px top.
    const px0 = this.playerX + 6;
    const px1 = this.playerX + this.playerW - 6;
    const py0 = this.playerY + 4;
    const py1 = this.playerY + this.playerH;
    for (const ob of this.obstacles) {
      ob.x -= this.speed * clamped;
      const oy0 = this.groundY - ob.height;
      const oy1 = this.groundY;
      if (!ob.counted && ob.x + ob.width < this.playerX) {
        ob.counted = true;
        this.score += 10;
      }
      if (ob.x < px1 && ob.x + ob.width > px0 && oy0 < py1 && oy1 > py0) {
        this.state = "over";
        return "hit";
      }
    }
    this.obstacles = this.obstacles.filter((ob) => ob.x + ob.width > -10);
    return null;
  }
}
