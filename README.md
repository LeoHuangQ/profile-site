# Leo Huang — Project Showcase

Simple personal project site. Static HTML/CSS/JS, no framework, no build
step. Hosted on AWS **S3 + CloudFront** (see `DEPLOY.md`).

Address link in AWS: https://d8yh0awzcw6be.cloudfront.net/

<img width="719" height="764" alt="Screenshot 2026-11-13 at 11 43 21 AM" src="https://github.com/user-attachments/assets/1a06204c-f401-49e3-8e00-1577680e6e54" />


## Local preview

```sh
cd showcase-site
python3 -m http.server 8000
# open http://localhost:8000/
```

## How to add a project (a new tile)

1. Put the project folder under `projects/<id>/`, e.g. `projects/my-app/`.
   Keep the project's internal relative paths intact (Krun, for example,
   lives at `projects/krun/` with its own `web/`, `src/` and `model/`
   folders, because `web/game.html` loads `../model/model.json` and
   `../src/*.mjs`).
2. Add one entry to `projects.json`:

```json
{
  "id": "my-app",
  "title": "My App",
  "description": "One line about what it does.",
  "tags": ["React", "Node.js"],
  "url": "projects/my-app/index.html",
  "icon": "🚀"
}
```

3. Push. The GitHub Action syncs to S3 and invalidates CloudFront.
   The "More is coming" tile is always last and needs no editing.

## Structure

```
index.html          # intro + tile grid (rendered by main.js)
styles.css          # simple, clean styling
main.js             # loads projects.json, renders tiles + "More is coming"
projects.json       # the tile list — this is the only file to edit to add a tile
projects/
  krun/             # Krun — Camera Jump Game (runtime files only: web/, src/, model/)
.github/workflows/deploy.yml   # push to main → S3 sync → CloudFront invalidation
scripts/deploy.sh   # manual deploy from your laptop
DEPLOY.md           # full AWS setup steps (one-time)
```

## Later: adding a backend

The static site does not change. Add an API behind CloudFront
(`/api/*` → API Gateway → Lambda, or ALB → ECS Fargate) and a
database (DynamoDB for simple data, Aurora Serverless / RDS for
relational data). See `DEPLOY.md` → "Growing beyond static".
