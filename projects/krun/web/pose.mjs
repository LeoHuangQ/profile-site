// pose.mjs — camera + PoseLandmarker setup, shared by recorder/validator.
// Video is processed locally and never uploaded. Requires HTTPS or
// localhost (getUserMedia rule), and a camera permission grant.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export async function createLandmarker() {
  // Pin the WASM to the SAME exact version as the JS bundle in the
  // importmap of recorder/validator/game.html (0.10.18). The old code
  // left the WASM path unversioned, so jsDelivr served npm `latest`
  // while the JS stayed on 0.10.x — a JS/WASM version mismatch, which
  // fails inside MediaPipe as "ASM_CONSTS[code] is not a function"
  // before the camera is even opened. Never let the two drift apart.
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
  );
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

// Minimal skeleton for the overlay canvas (dots + torso/limb lines).
const LINES = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [28, 30],
];
export function drawSkeleton(ctx, landmarks, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2;
  for (const [a, b] of LINES) {
    if (landmarks[a][3] < 0.5 || landmarks[b][3] < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(landmarks[a][0] * w, landmarks[a][1] * h);
    ctx.lineTo(landmarks[b][0] * w, landmarks[b][1] * h);
    ctx.stroke();
  }
  ctx.fillStyle = "#facc15";
  for (const p of landmarks) {
    if (p[3] < 0.5) continue;
    ctx.beginPath(); ctx.arc(p[0] * w, p[1] * h, 3, 0, Math.PI * 2); ctx.fill();
  }
}
