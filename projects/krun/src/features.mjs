// features.mjs — jump-data-v1 feature extraction.
// Single source of truth for the browser side. training/train.py mirrors
// these formulas exactly; if you change one, change the other and bump
// the data version.
// Landmarks: MediaPipe Pose order, 33 points, each [x, y, z, visibility].
// Only 8 points are used: shoulders 11/12, hips 23/24, knees 25/26,
// ankles 27/28. A frame with any of them below visibility 0.5 is dropped.

export const WINDOW = 10;
export const USED = [11, 12, 23, 24, 25, 26, 27, 28];

const avg = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function kneeAngleDeg(hip, knee, ankle) {
  const v1 = [hip[0] - knee[0], hip[1] - knee[1]];
  const v2 = [ankle[0] - knee[0], ankle[1] - knee[1]];
  const n1 = Math.hypot(...v1) || 1e-6;
  const n2 = Math.hypot(...v2) || 1e-6;
  const cos = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// One frame -> [rise, ankleRise, kneeFlex, hipVel] or null if invalid.
// state carries prevRise / prevVel for the EMA velocity; mutate per frame.
export function frameFeatures(landmarks, calibration, state) {
  for (const i of USED) {
    if (!landmarks[i] || landmarks[i][3] < 0.5) return null;
  }
  const shoulder = avg(landmarks[11], landmarks[12]);
  const hip = avg(landmarks[23], landmarks[24]);
  const ankle = avg(landmarks[27], landmarks[28]);
  const scale = Math.max(0.05, dist(shoulder, hip));
  void scale; // scale is used only through calibration for rise; kept for clarity
  const rise = (calibration.hipY - hip[1]) / calibration.scale;
  const ankleRise = (calibration.ankleY - ankle[1]) / calibration.scale;
  const kneeDeg =
    (kneeAngleDeg(landmarks[23], landmarks[25], landmarks[27]) +
      kneeAngleDeg(landmarks[24], landmarks[26], landmarks[28])) / 2;
  const kneeFlex = Math.max(0, Math.min(1, (180 - kneeDeg) / 180));

  let vel = 0;
  if (state.prevRise !== null && state.prevT !== null) {
    const dt = Math.max(0.01, Math.min(0.1, state.t - state.prevT));
    const raw = (rise - state.prevRise) / dt;
    vel = 0.5 * raw + 0.5 * (state.prevVel ?? 0);
  }
  state.prevRise = rise;
  state.prevVel = vel;
  state.prevT = state.t;
  return [rise, ankleRise, kneeFlex, vel];
}

// Push a frame feature into a rolling window; returns a flat 40-dim
// vector once the window is full, else null.
export function pushWindow(window, feat) {
  window.push(feat);
  if (window.length > WINDOW) window.shift();
  if (window.length < WINDOW) return null;
  return window.flat();
}

export function calibrationFromFrames(frames) {
  // frames: list of landmark arrays (standing still). Median is robust
  // to a few noisy frames; mean would be pulled by outliers.
  const med = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const hips = [];
  const ankles = [];
  const scales = [];
  for (const lm of frames) {
    if (!lm) continue;
    const shoulder = avg(lm[11], lm[12]);
    const hip = avg(lm[23], lm[24]);
    const ankle = avg(lm[27], lm[28]);
    hips.push(hip[1]);
    ankles.push(ankle[1]);
    scales.push(Math.max(0.05, dist(shoulder, hip)));
  }
  if (!hips.length) return null;
  return { hipY: med(hips), ankleY: med(ankles), scale: med(scales) };
}
