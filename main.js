/* ============================================================================
   Budapest Metro — Main Script
   Sections:
   0) Constants & DOM references
   1) Small utilities (modal, sizing, colors)
   2) Data loading & station indexing
   3) Geometry helpers
   4) Rendering (grid, river, stations, segments)
   5) Game config & state (lines, timer, deck, scoring)
   6) Per-line build state
   7) Card + UI helpers
   8) Validation & mutations (canConnect/addSegment)
   9) Screen flow (start, round, finish)
  10) Event wiring
============================================================================ */


/* ────────────────────────────────────────────────────────────────────────────
   0) CONSTANTS & DOM REFERENCES
──────────────────────────────────────────────────────────────────────────── */
const GRID_SIZE = 10;
const BOARD_PAD = 12; // must match CSS .board padding

// Transfer exception: Deák tér
const STATION_TRANSFER_EXCEPTION = 30;

// Screens
const menu      = document.querySelector("#menu");
const game      = document.querySelector("#game");

// HUD
const hudPlayer = document.querySelector("#hud-player");
const hudTime   = document.querySelector("#hud-time");
const hudLine   = document.querySelector("#hud-line");
const hudRounds = document.querySelector("#hud-rounds");

// Score HUD
const hudRoundScore = document.querySelector("#hud-round-score");
const hudTotalScore = document.querySelector("#hud-total-score");
const hudPP         = document.querySelector("#hud-pp");
const trainSlider   = document.querySelector("#train-slider");

const hudResultsRow   = document.querySelector("#hud-results");
const resultSummary   = document.querySelector("#result-summary");
const resultExplanation   = document.querySelector("#result-explanation");
const resultRounds    = document.querySelector("#result-rounds");
const resultJunctions = document.querySelector("#result-junctions");

// Controls & card
const cardEl      = document.querySelector("#card");
const btnDraw     = document.querySelector("#btn-draw");
const btnSkip     = document.querySelector("#btn-skip");
const btnEnd      = document.querySelector("#btn-end");
const btnMainMenu = document.querySelector("#btn-main-menu");

// Board
const grid  = document.querySelector("#grid");
const svg   = document.querySelector("#svg");
const river = document.querySelector("#river");

// Rules modal
const rulesModal    = document.querySelector("#rules-modal");
const btnRules      = document.querySelector("#btn-rules");
const btnRulesClose = document.querySelector("#rules-close");


/* ────────────────────────────────────────────────────────────────────────────
   1) SMALL UTILITIES (MODAL, SIZING, COLORS)
──────────────────────────────────────────────────────────────────────────── */
function openRules() {
  rulesModal.classList.add("show");
  rulesModal.setAttribute("aria-hidden", "false");
  document.body.dataset.prevOverflow = document.body.style.overflow || "";
  document.body.style.overflow = "hidden";
}
function closeRules() {
  rulesModal.classList.remove("show");
  rulesModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = document.body.dataset.prevOverflow || "";
  delete document.body.dataset.prevOverflow;
}

// Grid coordinate (0..GRID_SIZE-1) -> pixel center within .board
function posToPx(x, y) {
  const board = document.querySelector(".board");
  const rect = board.getBoundingClientRect();
  const cell = (rect.width - BOARD_PAD * 2) / GRID_SIZE;
  return [BOARD_PAD + (x + 0.5) * cell, BOARD_PAD + (y + 0.5) * cell];
}

// Grid -> SVG (0..1000) centered per cell
function toSvgPoint(st) {
  const step = 1000 / GRID_SIZE;
  const pad  = step / 2;
  return [st.x * step + pad, st.y * step + pad];
}

// Hex color -> rgba string with alpha
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const bigint = parseInt(n, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


/* ────────────────────────────────────────────────────────────────────────────
   2) DATA LOADING & STATION INDEXING
──────────────────────────────────────────────────────────────────────────── */
let lastStations      = [];           // from stations.json (position + type)
let stationById       = new Map();    // id -> basic station (id,x,y,type)
let stationAt         = new Map();    // "x,y" -> station
let stationMetaById   = new Map();    // id -> full metadata (district, side, train)
const TRAIN_STATION_IDS = [];         // ids of stations that are train stations

/**
 * Build station lookups based on lastStations.
 */
function rebuildStationIndex() {
  stationById = new Map(lastStations.map(s => [s.id, s]));
  stationAt   = new Map(lastStations.map(s => [`${s.x},${s.y}`, s]));
}

/**
 * Get full metadata for a station id.
 */
function getStationMeta(id) {
  const meta = stationMetaById.get(id);
  if (meta) return meta;
  const basic = stationById.get(id);
  if (!basic) return null;
  return { ...basic, train: false, side: null, district: null };
}

// Load stations.json once
(async function initData() {
  try {
    const res = await fetch("stations.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const full = await res.json();

    // basic geometry list
    lastStations = full.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      type: s.type
    }));
    stationMetaById = new Map(full.map(s => [s.id, s]));
    rebuildStationIndex();

    TRAIN_STATION_IDS.length = 0;
    for (const s of full) {
      if (s.train) TRAIN_STATION_IDS.push(s.id);
    }
  } catch (err) {
    console.error("Failed to load stations.json:", err);
  }
})();


/* ────────────────────────────────────────────────────────────────────────────
   3) GEOMETRY HELPERS
──────────────────────────────────────────────────────────────────────────── */
function isStraightOrDiag(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx === 0 || dy === 0 || dx === dy;
}

// Disallow passing through stations strictly between A and B
function pathPassesThroughStation(a, b) {
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  let x = a.x + dx;
  let y = a.y + dy;
  while (x !== b.x || y !== b.y) {
    if (stationAt.get(`${x},${y}`)) return true;
    x += dx;
    y += dy;
  }
  return false;
}

// Segment intersection (allow shared endpoints, but detect others)
function segmentsIntersect(a1, a2, b1, b2) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSeg = (p, q, r) =>
    Math.min(p.x, r.x) <= q.x &&
    q.x <= Math.max(p.x, r.x) &&
    Math.min(p.y, r.y) <= q.y &&
    q.y <= Math.max(p.y, r.y);

  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  if (d1 === 0 && onSeg(a1, b1, a2)) return true;
  if (d2 === 0 && onSeg(a1, b2, a2)) return true;
  if (d3 === 0 && onSeg(b1, a1, b2)) return true;
  if (d4 === 0 && onSeg(b1, a2, b2)) return true;

  return false;
}


/* ────────────────────────────────────────────────────────────────────────────
   4) RENDERING (GRID, RIVER, STATIONS, SEGMENTS)
──────────────────────────────────────────────────────────────────────────── */
// Build static grid once
(function buildGrid() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    frag.appendChild(cell);
  }
  grid.appendChild(frag);
})();

/**
 * Draw the Danube river as a soft vertical zig overlay.
 */
function renderRiver() {
  if (!river) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = river.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  if (w === 0 || h === 0) return;

  river.width  = Math.max(1, Math.floor(w * dpr));
  river.height = Math.max(1, Math.floor(h * dpr));

  const ctx = river.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(116,192,252,0.45)";

  ctx.beginPath();
  ctx.moveTo(w * 0.52, 0);
  ctx.lineTo(w * 0.46, h * 0.35);
  ctx.lineTo(w * 0.55, h);
  ctx.stroke();
}
renderRiver();

function renderStations(stations) {
  document.querySelectorAll(".station").forEach(n => n.remove());
  const board = document.querySelector(".board");
  const line = currentLine(); // might be undefined on menu

  stations.forEach(s => {
    const el = document.createElement("div");
    el.className = "station" + (s.type === "?" ? " joker" : "");
    if (TRAIN_STATION_IDS.includes(s.id)) el.classList.add("hub");
    if (line && s.id === line.start) {
      el.classList.add("start");
      el.style.setProperty("--line-color", line.color);
    }
    el.dataset.id = s.id;
    el.textContent = s.type === "?" ? "?" : s.type;

    const [left, top] = posToPx(s.x, s.y);
    el.style.left = left + "px";
    el.style.top  = top  + "px";
    board.appendChild(el);
  });
}

function drawSegments() {
  svg.innerHTML = "";
  for (const [lineId, LS] of lineStates) {
    const line = LINES.find(l => l.id === lineId);
    for (const seg of LS.segments) {
      const A = stationById.get(seg.a);
      const B = stationById.get(seg.b);
      if (!A || !B) continue;
      const [x1, y1] = toSvgPoint(A);
      const [x2, y2] = toSvgPoint(B);

      const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
      el.setAttribute("x1", x1);
      el.setAttribute("y1", y1);
      el.setAttribute("x2", x2);
      el.setAttribute("y2", y2);
      el.setAttribute("stroke", line.color);
      el.setAttribute("stroke-width", "10");
      el.setAttribute("stroke-linecap", "round");
      svg.appendChild(el);
    }
  }
}


/* ────────────────────────────────────────────────────────────────────────────
   5) GAME CONFIG & STATE (LINES, TIMER, DECK, SCORING)
──────────────────────────────────────────────────────────────────────────── */
const LINES = [
  { id: 0, name: "M1", color: "#FFD800", start: 19 },
  { id: 1, name: "M2", color: "#E41F18", start: 28 },
  { id: 2, name: "M3", color: "#005CA5", start: 3  },
  { id: 3, name: "M4", color: "#4CA22F", start: 39 }
];

const state = {
  player: "",
  seconds: 0,
  timer: null,
  order: [],        // randomized line ids
  roundIndex: 0,    // index within order
  deck: [],         // cards { ptype, sym }
  drawsThisRound: 0,
  centerCount: 0,
  sideCount: 0,
  currentCard: null, // { ptype, sym } | null
  buildUsedForThisCard: false, // one build per card
  roundComplete: false,        // becomes true when round-ending conditions are met
  heldCard: null,              // optional stored card for switch ability (not currently surfaced)
  switchUsedThisRound: false,  // whether the switch button was already used this round
  pencilMode: false,           // when true, draws planning (pencil) segments instead of real ones
};
// Scoreboard (localStorage-backed)
const SCORES_KEY = "budapest_metro_scores";

// Create a simple scores panel inside the menu so results are visible from the start screen
const scoresPanel = document.createElement("section");
scoresPanel.className = "scores-panel";
scoresPanel.innerHTML = `
  <h2>Previous games</h2>
  <ul id="score-list"></ul>
`;
menu.appendChild(scoresPanel);
const scoreList = scoresPanel.querySelector("#score-list");

function formatDuration(seconds) {
  const m = (seconds / 60) | 0;
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function loadScores() {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to load scores from localStorage", e);
    return [];
  }
}

function saveScores(scores) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch (e) {
    console.warn("Failed to save scores to localStorage", e);
  }
}

function renderScores() {
  if (!scoreList) return;
  const scores = loadScores().slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score; // higher score first
    return a.seconds - b.seconds; // tie-breaker: faster time wins
  });
  scoreList.innerHTML = "";
  scores.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = `${entry.name || "Player"}: ${entry.score} pts — ${formatDuration(entry.seconds || 0)}`;
    scoreList.appendChild(li);
  });
}

// initial render of scores on load
renderScores();

// Per-round scoring results
const roundResults = []; // { lineId, PK, PM, PD, FP }

// Station -> owning line (for transfer restrictions)
const stationOwner = new Map(); // stationId -> lineId

// Timer
function startTimer() {
  stopTimer();
  state.seconds = 0;
  state.timer = setInterval(() => {
    state.seconds++;
    const m = (state.seconds / 60) | 0;
    const s = (state.seconds % 60).toString().padStart(2, "0");
    hudTime.textContent = `${m}:${s}`;
  }, 1000);
}
function stopTimer() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

// Deck (A/B/C/D/Joker × center/side; ptype unused for now)
function buildDeck() {
  const base = ["A","B","C","D","Joker"];
  const deck = [];
  for (const ptype of ["center","side"]) {
    for (const sym of base) deck.push({ ptype, sym });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}


/* ────────────────────────────────────────────────────────────────────────────
   6) PER-LINE BUILD STATE
──────────────────────────────────────────────────────────────────────────── */
// Map<lineId, { segments:[{a,b}], endpoints:Set<number>, visited:Set<number> }>
const lineStates = new Map();

function currentLine() {
  return LINES.find(l => l.id === state.order[state.roundIndex]);
}
function ensureLineState(lineId) {
  if (!lineStates.has(lineId)) {
    const startId = LINES.find(l => l.id === lineId).start;
    lineStates.set(lineId, {
      segments: [],
      endpoints: new Set(),
      visited: new Set([startId]),
    });
  }
  return lineStates.get(lineId);
}


/* ────────────────────────────────────────────────────────────────────────────
   7) CARD + UI HELPERS
──────────────────────────────────────────────────────────────────────────── */
function setCardUI(cardData) {
  if (!cardEl) return;
  if (!cardData) {
    cardEl.textContent = "—";
    cardEl.dataset.ptype = "";
    return;
  }
  cardEl.textContent = cardData.sym === "Joker" ? "★" : cardData.sym;
  cardEl.dataset.ptype = cardData.ptype; // "center" or "side"
}

function renderRounds() {
  hudRounds.innerHTML = "";
  state.order.forEach((id, idx) => {
    const pill = document.createElement("div");
    const isActive = idx === state.roundIndex;
    pill.className = "pill" + (isActive ? " active" : "");

    const line = LINES.find(l => l.id === id);
    pill.textContent = line.name;

    const bg = hexToRgba(line.color, isActive ? 0.35 : 0.08);
    pill.style.background = bg;
    pill.style.borderColor = line.color;
    pill.style.color   = isActive ? "#fff" : "#7f8fa4";
    pill.style.opacity = isActive ? "1"    : "0.6";

    hudRounds.appendChild(pill);
  });
}

function updateHeaderLine() {
  const line = currentLine();
  hudLine.innerHTML = `<span style="display:inline-grid;grid-auto-flow:column;align-items:center;gap:8px">
    <span style="width:12px;height:12px;border-radius:50%;background:${line.color};display:inline-block"></span>
    ${line.name}
  </span>`;
}

// Station symbol vs card
function stationMatchesCard(target) {
  if (!state.currentCard) return false;
  // Deák tér acts as joker target for any card symbol
  if (target.id === STATION_TRANSFER_EXCEPTION) return true;
  const sym = state.currentCard.sym;
  if (sym === "Joker" || target.type === "?") return true;
  return target.type === sym;
}


/* ────────────────────────────────────────────────────────────────────────────
   8) VALIDATION & MUTATIONS
──────────────────────────────────────────────────────────────────────────── */
/**
 * Update PP (train stations visited) and slider live based on current lineStates.
 * Returns PP.
 */
function updatePPView() {
  if (!hudPP && !trainSlider) return 0;
  const visitedTrainStations = new Set();
  for (const [, LS] of lineStates) {
    for (const sid of LS.visited) {
      const meta = getStationMeta(sid);
      if (meta && meta.train) visitedTrainStations.add(sid);
    }
  }
  const PP = visitedTrainStations.size;
  if (hudPP) hudPP.textContent = String(PP);
  if (trainSlider) {
    trainSlider.max = String(TRAIN_STATION_IDS.length || 5);
    trainSlider.value = String(PP);
  }
  return PP;
}

/**
 * Compute and store score for the current round (line).
 * PK: number of districts covered
 * PM: max stations in any district
 * PD: Danube crossings
 * FP: PK * PM + PD
 */
function computeCurrentRoundScore() {
  const lineId = state.order[state.roundIndex];
  const LS = ensureLineState(lineId);
  const visited = Array.from(LS.visited);

  // Districts
  const districtCounts = new Map();
  for (const sid of visited) {
    const meta = getStationMeta(sid);
    if (!meta || meta.district == null) continue;
    const d = meta.district;
    districtCounts.set(d, (districtCounts.get(d) || 0) + 1);
  }
  const PK = districtCounts.size;
  const PM = districtCounts.size ? Math.max(...districtCounts.values()) : 0;

  // Danube crossings (side changes)
  let PD = 0;
  for (const seg of LS.segments) {
    const a = getStationMeta(seg.a);
    const b = getStationMeta(seg.b);
    if (!a || !b || !a.side || !b.side) continue;
    if (a.side !== b.side) PD++;
  }

  const FP = PK * PM + PD;
  const result = { lineId, PK, PM, PD, FP };
  roundResults.push(result);

  if (hudRoundScore) hudRoundScore.textContent = String(FP);
  const sumFP = roundResults.reduce((sum, r) => sum + r.FP, 0);
  if (hudTotalScore) hudTotalScore.textContent = String(sumFP);

  return result;
}

/**
 * Station ownership: each station can belong to only one line,
 * except Deák tér (ID 30) and the current line's start station.
 */
function canConnect(fromId, toId) {
  const lineId = state.order[state.roundIndex];
  const LS = ensureLineState(lineId);

  const A = stationById.get(fromId);
  const B = stationById.get(toId);
  if (!A || !B || fromId === toId) return false;

  const startId = currentLine().start;
  const isTransferAllowed = (id) =>
    id === STATION_TRANSFER_EXCEPTION || id === startId;
  const ownerFrom = stationOwner.get(fromId);
  const ownerTo   = stationOwner.get(toId);
  if (ownerFrom !== undefined && ownerFrom !== lineId && !isTransferAllowed(fromId)) return false;
  if (ownerTo   !== undefined && ownerTo   !== lineId && !isTransferAllowed(toId))   return false;

  // Geometry: must be straight or 45°
  if (!isStraightOrDiag(A, B)) return false;

  // Origin: first segment from start, later from endpoints
  const isFirst = LS.segments.length === 0;
  if (isFirst) {
    if (fromId !== startId) return false;
  } else {
    if (!LS.endpoints.has(fromId)) return false;
  }

  // Target must match card
  if (!stationMatchesCard(B)) return false;

  // No pass-through stations
  if (pathPassesThroughStation(A, B)) return false;

  // No duplicate segments anywhere (any line, either direction)
  for (const [, OLS] of lineStates) {
    for (const s of OLS.segments) {
      if (
        (s.a === fromId && s.b === toId) ||
        (s.a === toId && s.b === fromId)
      ) {
        return false;
      }
    }
  }

  // No crossings unless sharing an endpoint
  const a1 = { x: A.x, y: A.y };
  const a2 = { x: B.x, y: B.y };
  for (const [, OLS] of lineStates) {
    for (const s of OLS.segments) {
      const C = stationById.get(s.a);
      const D = stationById.get(s.b);
      const b1 = { x: C.x, y: C.y };
      const b2 = { x: D.x, y: D.y };
      if (!segmentsIntersect(a1, a2, b1, b2)) continue;
      const sharesEndpoint =
        fromId === s.a ||
        fromId === s.b ||
        toId === s.a ||
        toId === s.b;
      if (!sharesEndpoint) return false;
    }
  }

  // No loops: cannot go to station already visited by this line
  if (LS.visited.has(toId)) return false;

  return true;
}

function addSegment(fromId, toId) {
  const lineId = state.order[state.roundIndex];
  const LS = ensureLineState(lineId);
  LS.segments.push({ a: fromId, b: toId });

  // Toggle endpoints
  const toggle = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));
  toggle(LS.endpoints, fromId);
  toggle(LS.endpoints, toId);

  // Track visited
  LS.visited.add(fromId);
  LS.visited.add(toId);

  // Assign station ownership. Start station always becomes owned by the current line.
  const startId2 = currentLine().start;
  if (fromId !== STATION_TRANSFER_EXCEPTION) {
    if (fromId === startId2 || !stationOwner.has(fromId)) {
      stationOwner.set(fromId, lineId);
    }
  }
  if (toId !== STATION_TRANSFER_EXCEPTION) {
    if (toId === startId2 || !stationOwner.has(toId)) {
      stationOwner.set(toId, lineId);
    }
  }

  drawSegments();
  updatePPView();
}


/* ────────────────────────────────────────────────────────────────────────────
   9) SCREEN FLOW (START, ROUND, FINISH)
──────────────────────────────────────────────────────────────────────────── */
function resetGameState() {
  // Stop timer and reset basic state
  stopTimer();
  state.seconds = 0;
  state.order = [];
  state.roundIndex = 0;
  state.deck = [];
  state.drawsThisRound = 0;
  state.centerCount = 0;
  state.sideCount = 0;
  state.currentCard = null;
  state.buildUsedForThisCard = false;
  state.roundComplete = false;
  state.heldCard = null;
  state.switchUsedThisRound = false;
  state.pencilMode = false;

  // Clear per-line build state and scoring
  lineStates.clear();
  stationOwner.clear();
  roundResults.length = 0;

  // Reset HUD
  if (hudTime) hudTime.textContent = "0:00";
  if (hudLine) hudLine.textContent = "Current line: —";
  setCardUI(null);
  if (hudRoundScore) hudRoundScore.textContent = "0";
  if (hudTotalScore) hudTotalScore.textContent = "0";
  if (hudResultsRow) hudResultsRow.style.display = "none";
  if (resultSummary) resultSummary.textContent = "";
  if (resultExplanation) resultExplanation.textContent = "";
  if (resultRounds) resultRounds.innerHTML = "";
  if (resultJunctions) resultJunctions.textContent = "";
  updatePPView();

  // Clear board visuals
  if (svg) {
    svg.innerHTML = "";
  }
  // Remove any temporary pencil lines and reset pencil button state
  if (svg) {
    svg.querySelectorAll(".pencil-line").forEach(n => n.remove());
  }
  if (btnPencil) {
    btnPencil.classList.remove("active");
  }
  document.querySelectorAll(".station").forEach(n => n.remove());

  // Reset control buttons
  if (btnDraw) btnDraw.disabled = false;
  if (btnSkip) btnSkip.disabled = false;
  if (btnEnd)  btnEnd.disabled  = true;

  // Clear selection if defined
  if (typeof selectedStationId !== "undefined") {
    selectedStationId = null;
  }
}

function startGame(name) {
  state.player = name;
  hudPlayer.textContent = `Player: ${name}`;

  // Reset everything to a clean state before starting a new game
  resetGameState();

  // show game screen
  menu.classList.remove("active");
  game.classList.add("active");

  // init timer + line order + deck
  startTimer();
  state.order = [...LINES.map(l => l.id)].sort(() => Math.random() - 0.5);
  state.roundIndex = 0;
  state.deck = buildDeck();
  // The above resets are already done above

  setCardUI(null);
  renderRounds();
  updateHeaderLine();

  // render after line order is known so the start station gets highlighted
  renderStations(lastStations);
  renderRiver();

  btnEnd.disabled  = true;
  btnDraw.disabled = false;
  btnSkip.disabled = false;
}

function updateRoundEndingState() {
  const reachedTypeLimit = state.centerCount >= 5 || state.sideCount >= 5;
  const reachedMaxCards  = state.drawsThisRound >= 8;
  if (reachedTypeLimit || reachedMaxCards) {
    state.roundComplete = true;
    btnDraw.disabled = true;
    btnSkip.disabled = true;
    btnEnd.disabled  = false; // player must press End round
  } else {
    state.roundComplete = false;
    btnDraw.disabled = false;
    btnSkip.disabled = false;
    btnEnd.disabled  = true;
  }
}

function drawCard() {
  // If round already complete, do not draw any more cards
  if (state.roundComplete) return;

  if (state.deck.length === 0) state.deck = buildDeck();
  state.currentCard = state.deck.pop();
  state.drawsThisRound++;
  state.buildUsedForThisCard = false; // one build per card

  // Count platform type for alternative round-ending condition
  if (state.currentCard.ptype === "center") {
    state.centerCount++;
  } else if (state.currentCard.ptype === "side") {
    state.sideCount++;
  }

  updateRoundEndingState();
  setCardUI(state.currentCard);
}

function finishGame() {
  stopTimer();
  btnDraw.disabled = btnSkip.disabled = btnEnd.disabled = true;
  hudLine.textContent = "Game finished";
  setCardUI(null);

  // stationId -> Set<lineId>
  const stationLines = new Map();
  for (const [lineId, LS] of lineStates) {
    for (const sid of LS.visited) {
      if (!stationLines.has(sid)) stationLines.set(sid, new Set());
      stationLines.get(sid).add(lineId);
    }
  }

  let P2 = 0, P3 = 0, P4 = 0;
  for (const [, lineSet] of stationLines) {
    const count = lineSet.size;
    if (count === 2) P2++;
    else if (count === 3) P3++;
    else if (count >= 4) P4++;
  }

  const PP = updatePPView();
  const sumFP = roundResults.reduce((sum, r) => sum + r.FP, 0);
  const finalScore = sumFP + PP + 2 * P2 + 5 * P3 + 9 * P4;

  if (hudTotalScore) hudTotalScore.textContent = String(finalScore);

  // Persist result to localStorage and refresh scoreboard
  const scores = loadScores();
  scores.push({
    name: state.player || "Player",
    score: finalScore,
    seconds: state.seconds,
    date: new Date().toISOString(),
  });
  // sort by score desc, then time asc
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.seconds - b.seconds;
  });
  saveScores(scores);
  renderScores();

    // Show results in the HUD
    if (hudResultsRow) {
        hudResultsRow.style.display = "block";

        if (resultSummary) {
            resultSummary.textContent = `Final score: ${finalScore}`;
        }

      if (resultExplanation) {
        resultExplanation.textContent = "FP - Round score, PK - Number of districts covered," +
            " PM - Maximum number of stations in a single district," +
            " PD - Number of Danube crossings";
      }

        if (resultRounds) {
            resultRounds.innerHTML = "";
            roundResults.forEach(r => {
                const line = LINES.find(l => l.id === r.lineId);
                const li = document.createElement("li");
                li.textContent = `${line.name}: FP=${r.FP} (PK=${r.PK}, PM=${r.PM}, PD=${r.PD})`;
                resultRounds.appendChild(li);
            });
        }

        if (resultJunctions) {
            resultJunctions.textContent =
                `Train stations (PP): ${PP} — Junctions P2=${P2}, P3=${P3}, P4=${P4}`;
        }
    }
}

function nextRound() {
  // score the line we just completed
  computeCurrentRoundScore();

  state.roundIndex++;
  if (state.roundIndex >= state.order.length) {
    finishGame();
    return;
  }

  state.deck = buildDeck();
  state.drawsThisRound = 0;
  state.centerCount = 0;
  state.sideCount = 0;
  state.currentCard = null;
  state.buildUsedForThisCard = false;
  state.roundComplete = false;
  state.switchUsedThisRound = false;
  state.heldCard = null;

  setCardUI(null);
  renderRounds();
  updateHeaderLine();

  // new start marker
  renderStations(lastStations);
  renderRiver();

  btnEnd.disabled  = true;
  btnDraw.disabled = false;
  btnSkip.disabled = false;
}

// Switch card ability: allows redrawing the current card once per round
function switchCard() {
  // Can only switch if we currently have a card, haven't built with it yet,
  // and haven't used the switch in this round.
  if (!state.currentCard) return;
  if (state.buildUsedForThisCard) return;
  if (state.switchUsedThisRound) return;

  // If deck is empty, rebuild it (same behavior as drawCard).
  if (state.deck.length === 0) state.deck = buildDeck();

  // Discard the current card and draw a replacement.
  state.currentCard = state.deck.pop();
  state.switchUsedThisRound = true;

  // Note: we deliberately do NOT change drawsThisRound or the center/side counters
  // here, so the switch acts as a "redraw" of the same draw rather than an extra draw.
  setCardUI(state.currentCard);
  updateRoundEndingState();
}


/* ────────────────────────────────────────────────────────────────────────────
  10) EVENT WIRING
──────────────────────────────────────────────────────────────────────────── */
// Menu form submit
document.querySelector("#menu-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.querySelector("#player-name");
  const name = input.value.trim();
  if (!name) {
    input.focus();
    input.style.borderColor = "#ef4444";
    setTimeout(() => (input.style.borderColor = "#2a365c"), 600);
    return;
  }
  startGame(name);
});

// Window resize: keep visuals in sync while game visible
window.addEventListener("resize", () => {
  if (!game.classList.contains("active")) return;
  renderStations(lastStations);
  drawSegments();
  renderRiver();
});

// Rules modal
btnRules.addEventListener("click", openRules);
btnRulesClose.addEventListener("click", closeRules);
rulesModal.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-backdrop")) closeRules();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && rulesModal.classList.contains("show")) closeRules();
});

// Build interaction: click origin -> click target
let selectedStationId = null;
document.addEventListener("click", (e) => {
  if (!game.classList.contains("active")) return;
  const node = e.target.closest(".station");
  if (!node) return;

  const id = +node.dataset.id;
  const lineId = state.order[state.roundIndex];
  const LS = ensureLineState(lineId);
  const isPencil = state.pencilMode;

  // origin must be start (first) or one of the endpoints
  if (selectedStationId === null) {
    const isFirst = LS.segments.length === 0;
    const okOrigin = isFirst ? (id === currentLine().start) : LS.endpoints.has(id);
    if (!okOrigin) return;
    selectedStationId = id;
    node.classList.add("selected");
    return;
  }

  // attempt connection
  const fromId = selectedStationId;
  const toId = id;

  const prevSel = document.querySelector(".station.selected");
  if (prevSel) prevSel.classList.remove("selected");
  selectedStationId = null;

  // In pencil mode we draw a temporary planning segment that does not affect game state.
  if (isPencil) {
    if (fromId === toId) return;

    const A = stationById.get(fromId);
    const B = stationById.get(toId);
    if (!A || !B) return;

    const [x1, y1] = toSvgPoint(A);
    const [x2, y2] = toSvgPoint(B);

    const pencilLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    pencilLine.setAttribute("x1", x1);
    pencilLine.setAttribute("y1", y1);
    pencilLine.setAttribute("x2", x2);
    pencilLine.setAttribute("y2", y2);
    pencilLine.setAttribute("stroke-width", "6");
    pencilLine.setAttribute("stroke-linecap", "round");
    pencilLine.setAttribute("stroke-dasharray", "6 6");
    pencilLine.setAttribute("class", "pencil-line");
    // Use a neutral gray for planning lines so they are visually distinct.
    pencilLine.setAttribute("stroke", "#9ca3af");

    svg.appendChild(pencilLine);
    return;
  }

  // Real build mode: must draw a card first and only one build per card
  if (!state.currentCard) return;
  if (state.buildUsedForThisCard) return;

  if (canConnect(fromId, toId)) {
    addSegment(fromId, toId);
    state.buildUsedForThisCard = true;

    // if this was the 8th card (round complete), move to the next round automatically
    if (state.roundComplete) {
      nextRound();
    }
  } else {
    // tiny feedback on invalid move
    cardEl?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-4px)" },
        { transform: "translateY(0)" }
      ],
      { duration: 300 }
    );
  }
});

// Control buttons
btnDraw.addEventListener("click", drawCard);
btnSkip.addEventListener("click", () => {
  drawCard();
});
btnEnd.addEventListener("click", nextRound);

if (btnSwitch) {
  btnSwitch.addEventListener("click", () => {
    switchCard();
  });
}

if (btnPencil) {
  btnPencil.addEventListener("click", () => {
    state.pencilMode = !state.pencilMode;

    if (btnPencil) {
      btnPencil.classList.toggle("active", state.pencilMode);
    }

    // When turning pencil mode off, clear any temporary planning lines.
    if (!state.pencilMode && svg) {
      svg.querySelectorAll(".pencil-line").forEach(n => n.remove());
    }
  });
}

if (btnMainMenu) {
  btnMainMenu.addEventListener("click", () => {
    resetGameState();
    game.classList.remove("active");
    menu.classList.add("active");
  });
}