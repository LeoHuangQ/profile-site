# Jump Recognition v1 — Recognition First, App Second

The goal of this step is not the game. It is to prove one pipeline works on a
real person: camera → pose → self-trained classifier → `onJump()` event.
The game later subscribes only to `onJump()` and never touches pose code.

## Run the Full Pipeline (No Camera Needed, ~5 Minutes)

```bash
cd jump-recognition-v1
python3 training/generate_synthetic.py
python3 training/train.py
node training/test_js_inference.mjs
```

Expected: leave-one-person-out (LOPO) mean accuracy > 0.90, false-trigger
rate < 0.10, and JS inference agreeing with the Python model's predicted
class. Synthetic data is only a placeholder — metrics will drop on real
data, and that is normal. Record the real numbers honestly in the model card.

## Replace Synthetic Data with Real Data

1. Start a local server (do not double-click to open via `file://` — the
   browser will block the model `fetch`):
   ```bash
   python3 -m http.server 8000
   # Open http://localhost:8000/web/recorder.html
   ```
2. Per person: open the camera → stand straight and calibrate for 2 seconds →
   record several clips per label (jump / stand / squat, 1.5–3 seconds each,
   containing the full action).
3. Export the JSON, merge the clips arrays from 3–5 people into one file,
   and save it as `data/real_dataset.json`.
4. Retrain and regenerate `model/model.json`:
   `python3 training/train.py data/real_dataset.json`
5. Open `web/validator.html`: calibrate → load the model → jump, and check
   P(jump) and the events — including false triggers (does it fire while
   you are standing still or squatting?).

## Acceptance Criteria (Must Pass Before Building the Game)

- A real person standing still for 30 seconds: 0 false triggers.
- A real person jumping 10 times in a row: ≥ 8 detected, exactly 1 event
  per jump (cooldown + re-arming must be working).
- Squatting 10 times: ≤ 1 misclassified as a jump.
- Inference latency: model forward pass < 5 ms (pose excluded; end-to-end
  target < 100 ms).
- If it does not pass, do not build the game yet: add hard-case data first
  (side angle, dim light, different distances), or raise the threshold from
  0.60 — at the cost of more missed jumps. Record that trade-off in the
  model card.

## Play the Game (Uses the Existing Model — No Retraining Needed)

Open `web/game.html` through the local server (same `http://localhost:8000`
rule as the recorder/validator):

1. No buttons and no text above the game by default — the instructions
   are a picture mask drawn on the game canvas itself, shown on every
   refresh while the game is idle: three stick-figure panels, **Hands up —
   Start / Pause**, **Jump — Play**, **Hands crossed — Pause**, plus
   "Space also works • Double jump". It goes away when the game starts.
   Raise **both hands** to start (or to pause mid-game, and again to
   resume), **cross both hands** to pause, or press **Space** (also starts,
   and jumps; click the game to start/jump too). The camera auto-opens on
   page load so gestures work immediately; if permission is denied, Space
   still plays with the keyboard. Every start (and resume) shows a
   3-second countdown on the canvas first. The purple cat now has two
   forms, drawing only: a walking form while running (feet alternate
   stepping, body bobs, tail sways, step rate follows game speed) and a
   jumping form while airborne (feet tucked, body stretched, tail high).
2. The model (`model/model.json`, currently the synthetic-trained
   model) auto-loads on page open, and a successful calibration is saved in
   `localStorage` and reused on the next visit — the 3-second countdown
   runs calibration on first visit (stand still during it). A real jump fires the
   same `onJump()` as Space; the game never sees probabilities, only events.
   Modes: **Close-up (upper body)** is the default — only shoulders and up
   need to be in frame, so you can stand much closer; it uses a shoulder-rise
   rule (fire at shoulderRise > 0.20, re-arm below 0.05) with its own saved
   calibration (`jumpGameCalibrationClose`), no MLP — expect more false jumps
   than full-body mode, because there is no ankle/knee signal. **Full body**
   is the original MLP model and needs head to ankles in frame. Calibration
   and model loading are both automatic (model on page open, calibration
   during the 3-second countdown on first visit). Starting and resuming both
   show the 3-second countdown. Hand gestures (camera on): both hands above
   the shoulders, hold ~0.8 s, starts the game or resumes from pause; hands
   crossed over the chest, hold ~0.4 s, pauses. Cross detection (fixed
   2026-11-06): wrists together near the chest, wrist visibility down to
   0.3, and a 300 ms flicker grace so one dropped frame does not reset the
   hold — the old strict left-wrist-image-left check never fired when the
   wrists overlapped. Fixed again 2026-11-06 (build -d): cross is now
   checked before hands-up, hands-up needs wrists clearly above the
   shoulders (0.08, was 0.03) with wrists apart and uncrossed, and a cross
   done high on the upper chest is allowed — the old order let a high
   cross be read as "hands up 100%" and the cross never fired. Simplified
   again 2026-11-06 (build -e): cross is now only the wrist x-order
   flipping (left wrist image-left of right wrist), any height — chest,
   waist or above the head. Test buttons are now hidden by default in the
   HTML itself and only shown by test mode; the old JS-hides-them design
   left them visible forever when the script never ran (old cached file).
   The page carries a static "Build 2026-11-06-e" stamp, so the file in
   use is visible even if the script fails. All buttons and debug lines
   (mode switch, Play/Start/Pause/Jump, Recalibrate, Reload model,
   P(jump)/features/log, full-body mode) are test-only and only show when
   the page is opened with `?mode=test` (also `?test=1` / `?test` / `#test`)
   in the URL, e.g. `web/game.html?mode=test`; test mode shows a
   "Test mode ON" badge and a gesture-debug line with live wrist
   coordinates and up/cross booleans. If the badge does not appear on
   `?mode=test`, the page is a cached old copy — replace the file and
   hard-refresh (Cmd+Shift+R). Current build 2026-11-06-g.
3. Game rules: one hit ends the game, passing an obstacle scores +10,
   speed grows with distance up to 450 px/s, best score is kept in
   `localStorage`. The jump arc is ~0.75 s (velocity -900 px/s, gravity
   2400 px/s²). **Double jump (2026-11-06): up to 2 jumps before landing**
   — the 2nd jump mid-air resets the upward velocity, so it can clear a
   second close obstacle; a 3rd while airborne does nothing, and landing
   resets the count. Obstacle gaps were also widened (minimum ~0.95 s,
   was 0.75 s) because late-game obstacles were coming too close together.

## Swap in a Retrained Model Later (One File, No Code Change)

When real-data training is done, retraining overwrites `model/model.json`
(`python3 training/train.py data/real_dataset.json`), and the game picks
it up on the next page reload — no game code changes. The game also maps
`model.decision.jumpThreshold` explicitly into `JumpDetector`, so a
threshold change in a retrained model actually takes effect here (unlike
the validator's v1 gap, where the name mismatch left the default 0.6 in
place). Re-run the validator acceptance checks after every swap before
trusting the new model in the game.

## Next Step (After Recognition Works)

Move `src/features.mjs` + `src/modelDetector.mjs` unchanged into a React/Vite
app (they are framework-independent). The game module subscribes only to
`onJump()`; keep the rule-based detector as a fallback. See the module tree
in `../scaffold-and-classifier-spec.md` for the app scaffold.
