// Showcase tiles are data-driven: to add a project, add one entry to
// projects.json (and upload its folder under projects/<id>/). No HTML
// edit is needed. The "More is coming" tile is always last.
const FALLBACK_PROJECTS = [
  {
    id: "krun",
    title: "Krun — Camera Jump Game",
    description:
      "Jump in front of your camera and a purple cat jumps over obstacles. MediaPipe pose + a self-trained jump classifier, running entirely in the browser.",
    tags: ["MediaPipe", "JavaScript", "Machine Learning"],
    url: "projects/krun/web/game.html",
    icon: "🐱",
  },
];

function tileEl(p) {
  const a = document.createElement("a");
  a.className = "tile";
  a.href = p.url;
  a.innerHTML =
    `<span class="icon">${p.icon || "📦"}</span>` +
    `<h3>${p.title}</h3>` +
    `<p>${p.description}</p>` +
    `<span class="tags">${(p.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}</span>` +
    `<span class="go">Open project →</span>`;
  return a;
}

function moreTileEl() {
  const d = document.createElement("div");
  d.className = "tile more";
  d.innerHTML = `<span class="icon">✦</span><h3>More is coming</h3><p>New projects will appear here as they ship.</p>`;
  return d;
}

async function render() {
  const grid = document.getElementById("tiles");
  let projects = FALLBACK_PROJECTS;
  try {
    const res = await fetch("projects.json");
    if (res.ok) projects = await res.json();
  } catch (e) {
    // file:// preview or fetch blocked: fall back to the built-in list.
  }
  grid.innerHTML = "";
  for (const p of projects) grid.appendChild(tileEl(p));
  grid.appendChild(moreTileEl());
}

render();
