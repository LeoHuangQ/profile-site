// modelDetector.mjs — pure-JS forward pass for the exported MLP + the
// game-facing jump decision. No TFJS needed: the model is 40->32->16->3.
// The model itself only returns probabilities; cooldown / re-arming lives
// here so the game never has to reason about probabilities.

function matVec(W, x, b) {
  // W: [out][in], x: [in], b: [out]
  const out = new Array(W.length);
  for (let i = 0; i < W.length; i++) {
    let s = b[i];
    const row = W[i];
    for (let j = 0; j < x.length; j++) s += row[j] * x[j];
    out[i] = s;
  }
  return out;
}

export function predictProbs(model, window40) {
  const x = window40.map(
    (v, i) => (v - model.scaler.mean[i]) / model.scaler.scale[i]
  );
  let h = matVec(model.layers[0].W, x, model.layers[0].b).map((v) =>
    Math.max(0, v)
  );
  h = matVec(model.layers[1].W, h, model.layers[1].b).map((v) =>
    Math.max(0, v)
  );
  const logits = matVec(model.layers[2].W, h, model.layers[2].b);
  const m = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((v) => v / sum);
  const out = {};
  model.classes.forEach((c, i) => (out[c] = probs[i]));
  return out;
}

// Stateful detector: feed it (probs, lastRise, nowMs) per frame.
// Fires at most once per cooldown, and only re-arms after the body has
// come back down (rise < 0.05), so one long airborne phase is one jump.
export class JumpDetector {
  constructor({ threshold = 0.6, cooldownMs = 500 } = {}) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.armed = true;
    this.lastFire = -1e9;
  }
  update(probs, lastRise, nowMs) {
    if (!this.armed && lastRise < 0.05) this.armed = true;
    const p = probs.jump ?? 0;
    if (
      this.armed &&
      p >= this.threshold &&
      nowMs - this.lastFire >= this.cooldownMs
    ) {
      this.armed = false;
      this.lastFire = nowMs;
      return true; // -> onJump()
    }
    return false;
  }
}
