const API_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/nocis_api";
const ASSET_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/nocis_asset";

const SUBTEST = "spatial";
const TOTAL_ITEMS = 25;
const TOTAL_ATTEMPTS = 3;

const scoreEl = document.getElementById("scoreEl");
const attemptsEl = document.getElementById("attemptsEl");
const questionImg = document.getElementById("questionImg");
const submitBtn = document.getElementById("submitBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const finishBtn = document.getElementById("finishBtn");
const gameSection = document.getElementById("gameSection");

const spatialCanvas = document.getElementById("spatialCanvas");
const ctx = spatialCanvas.getContext("2d");
const canvasStatusEl = document.getElementById("canvasStatus");

let currentQuestionObjectUrl = null;

let email = localStorage.getItem("email");
let password = sessionStorage.getItem("password");

if (!email || !password) {
  window.location.href = "login.html";
  throw new Error("Missing login data");
}

let solved = [];
let attempts = Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS);
let currentIndex = 0;
let normoCache = null;

const state = {
  tool: "select",
  shapes: [],
  draftPoints: [],
  arcDraft: null,
  previewPoint: null,
  pointerDown: false,
  dragShapeIndex: -1,
  dragPointIndex: -1,
  dragOffset: null,
  hoverShapeIndex: -1,
  history: [],
  matrixDragStarted: false,
  mode: "regular"
};

function getGridDivisions() {
  return 10;
}

function getDecimals() {
  return 2;
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshot() {
  return {
    shapes: cloneData(state.shapes),
    draftPoints: cloneData(state.draftPoints),
    arcDraft: cloneData(state.arcDraft),
    tool: state.tool,
    mode: state.mode
  };
}

async function loadNorm() {
  try {
    const r = await fetch('https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/noais2_norm/norm_spatial.json');
    if (r.ok) normoCache = await r.json();
  } catch {}
}

function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > 200) state.history.shift();
}

function undoLastAction() {
  const last = state.history.pop();

  if (!last) {
    setCanvasStatus("Nothing to undo.");
    return;
  }

  state.shapes = last.shapes;
  state.draftPoints = last.draftPoints;
  state.arcDraft = last.arcDraft;
  state.tool = last.tool || "select";
  state.mode = last.mode || "regular";

  applyToolbarState();
  render();
  setCanvasStatus("Last action undone.");
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function snap(v) {
  const g = getGridDivisions();
  return clamp(Math.round(v * g) / g, 0, 1);
}

function pointsEqual(a, b, eps = 1e-9) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

function roundN(value) {
  const d = getDecimals();
  const f = 10 ** d;
  return Math.round(value * f) / f;
}

function fmt(value) {
  const n = roundN(value);
  return Number.isInteger(n) ? String(n) : String(n);
}

function normToCanvas(p) {
  return {
    x: p.x * spatialCanvas.width,
    y: p.y * spatialCanvas.height
  };
}

function canvasToNorm(x, y, shouldSnap = false) {
  const rect = spatialCanvas.getBoundingClientRect();

  const px = clamp((x - rect.left) / rect.width, 0, 1);
  const py = clamp((y - rect.top) / rect.height, 0, 1);

  return shouldSnap
    ? { x: snap(px), y: snap(py) }
    : { x: px, y: py };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function degToRad(d) {
  return d * Math.PI / 180;
}

function snapAngle45(deg) {
  let a = Math.round(deg / 45) * 45;
  a %= 360;
  if (a < 0) a += 360;
  return a;
}

function angleFromCenter(center, point) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  let deg = Math.atan2(dy, dx) * 180 / Math.PI;
  if (deg < 0) deg += 360;

  return snapAngle45(deg);
}

function setCanvasStatus(msg) {
  if (canvasStatusEl) {
    canvasStatusEl.textContent = msg;
  }
}

function createMatrixCells(cols, rows) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );
}

function clearCanvasState() {
  state.shapes = [];
  state.draftPoints = [];
  state.arcDraft = null;
  state.previewPoint = null;
  state.matrixDragStarted = false;
  state.dragShapeIndex = -1;
  state.dragPointIndex = -1;
  state.dragOffset = null;
  state.hoverShapeIndex = -1;
}

function resetSpatialAnswerCanvas() {
  clearCanvasState();

  state.pointerDown = false;
  state.history = [];
  state.mode = "regular";
  state.tool = "select";

  applyToolbarState();
  render();
  setCanvasStatus("Move point mode: drag existing line or arc points only.");
}

function getShapeSnapPoints() {
  const points = [];

  for (const shape of state.shapes) {
    if (shape.type === "line") {
      points.push(shape.p1, shape.p2);
    }

    if (shape.type === "arc") {
      points.push(
        shape.c,
        {
          x: shape.c.x + shape.r * Math.cos(degToRad(shape.a0)),
          y: shape.c.y + shape.r * Math.sin(degToRad(shape.a0))
        },
        {
          x: shape.c.x + shape.r * Math.cos(degToRad(shape.a1)),
          y: shape.c.y + shape.r * Math.sin(degToRad(shape.a1))
        }
      );

      if (shape.fullCircle) {
        points.push(
          { x: shape.c.x + shape.r, y: shape.c.y },
          { x: shape.c.x - shape.r, y: shape.c.y },
          { x: shape.c.x, y: shape.c.y + shape.r },
          { x: shape.c.x, y: shape.c.y - shape.r }
        );
      }
    }

    if (shape.type === "matrix") {
      const cs = shape.cellSize;

      for (let r = 0; r <= shape.rows; r++) {
        for (let c = 0; c <= shape.cols; c++) {
          points.push({
            x: shape.origin.x + c * cs,
            y: shape.origin.y + r * cs
          });
        }
      }
    }
  }

  const unique = [];

  for (const p of points) {
    const clamped = {
      x: clamp(p.x, 0, 1),
      y: clamp(p.y, 0, 1)
    };

    if (!unique.some(q => pointsEqual(q, clamped))) {
      unique.push(clamped);
    }
  }

  return unique;
}

function getSnapThresholdNorm() {
  const rect = spatialCanvas.getBoundingClientRect();
  const size = Math.max(1, Math.min(rect.width, rect.height));
  return 14 / size;
}

function snapPoint(p, options = {}) {
  const {
    includeShapePoints = false,
    requireNearShapePoint = true
  } = options;

  const snappedGrid = {
    x: snap(p.x),
    y: snap(p.y)
  };

  let best = snappedGrid;
  let bestDist = dist(p, snappedGrid);

  if (includeShapePoints) {
    const threshold = getSnapThresholdNorm();

    for (const candidate of getShapeSnapPoints()) {
      const d = dist(p, candidate);
      const closeEnough = !requireNearShapePoint || d <= threshold;

      if (closeEnough && d < bestDist) {
        best = candidate;
        bestDist = d;
      }
    }
  }

  return {
    x: clamp(best.x, 0, 1),
    y: clamp(best.y, 0, 1)
  };
}

function applyToolbarState() {
  const matrixButton = document.querySelector('[data-tool="matrix"]');
  const lineButton = document.querySelector('[data-tool="line"]');
  const arcButton = document.querySelector('[data-tool="arc"]');
  const selectButton = document.querySelector('[data-tool="select"]');

  const inMatrixMode = state.mode === "matrix";

  matrixButton?.classList.toggle("active", inMatrixMode);
  lineButton?.classList.toggle("active", !inMatrixMode && state.tool === "line");
  arcButton?.classList.toggle("active", !inMatrixMode && state.tool === "arc");
  selectButton?.classList.toggle("active", !inMatrixMode && state.tool === "select");

  if (lineButton) lineButton.disabled = inMatrixMode;
  if (arcButton) arcButton.disabled = inMatrixMode;
  if (selectButton) selectButton.disabled = inMatrixMode;
}

function setTool(tool) {
  if (tool === "matrix") {
    if (state.mode === "matrix") {
      pushHistory();
      clearCanvasState();
      state.mode = "regular";
      state.tool = "line";
      applyToolbarState();
      setCanvasStatus("Regular mode. You can create lines and arcs.");
      render();
      return;
    }

    pushHistory();
    clearCanvasState();
    state.mode = "matrix";
    state.tool = "matrix";
    applyToolbarState();

    setCanvasStatus("Matrix mode: drag from corner to corner to create a matrix. Click cells to toggle them.");
    render();
    return;
  }

  if (state.mode === "matrix") return;

  state.tool = tool;
  state.draftPoints = [];
  state.arcDraft = null;
  state.previewPoint = null;
  state.matrixDragStarted = false;

  applyToolbarState();

  if (state.tool === "arc") {
    setCanvasStatus("Arc mode: click center, then start point, then end point.");
  } else if (state.tool === "line") {
    setCanvasStatus("Line mode: click two points.");
  } else if (state.tool === "select") {
    setCanvasStatus("Move point mode: drag existing line or arc points only.");
  }

  render();
}

function normalizeLine(shape) {
  const a = shape.p1;
  const b = shape.p2;

  const sa = `${fmt(a.x)},${fmt(a.y)}`;
  const sb = `${fmt(b.x)},${fmt(b.y)}`;

  return sb.localeCompare(sa) < 0
    ? {
        ...shape,
        p1: { x: roundN(b.x), y: roundN(b.y) },
        p2: { x: roundN(a.x), y: roundN(a.y) }
      }
    : {
        ...shape,
        p1: { x: roundN(a.x), y: roundN(a.y) },
        p2: { x: roundN(b.x), y: roundN(b.y) }
      };
}

function normalizeArc(shape) {
  return {
    ...shape,
    c: {
      x: roundN(shape.c.x),
      y: roundN(shape.c.y)
    },
    r: roundN(shape.r),
    a0: Math.round(shape.a0),
    a1: Math.round(shape.a1),
    fullCircle: !!shape.fullCircle
  };
}

function normalizeMatrix(shape) {
  return {
    ...shape,
    origin: {
      x: roundN(shape.origin.x),
      y: roundN(shape.origin.y)
    },
    cellSize: roundN(shape.cellSize),
    cells: cloneData(shape.cells)
  };
}

function matrixRowsText(cells) {
  return cells.map(row => row.join("")).join(" ");
}

function shapeToText(shape) {
  if (shape.type === "line") {
    const s = normalizeLine(shape);
    return `L[(${fmt(s.p1.x)},${fmt(s.p1.y)}),(${fmt(s.p2.x)},${fmt(s.p2.y)})]`;
  }

  if (shape.type === "arc") {
    const s = normalizeArc(shape);
    return `A[(${fmt(s.c.x)},${fmt(s.c.y)}),${fmt(s.r)},${s.a0},${s.fullCircle ? 360 : s.a1}]`;
  }

  if (shape.type === "matrix") {
    const s = normalizeMatrix(shape);
    return `${s.cols}x${s.rows}:${matrixRowsText(s.cells)}`;
  }

  return "";
}

function shapeSortKey(shape) {
  if (shape.type === "line") {
    return `L|${fmt(shape.p1.x)},${fmt(shape.p1.y)}|${fmt(shape.p2.x)},${fmt(shape.p2.y)}`;
  }

  if (shape.type === "arc") {
    return `A|${fmt(shape.c.x)},${fmt(shape.c.y)}|${fmt(shape.r)}|${Math.round(shape.a0)}|${shape.fullCircle ? 360 : Math.round(shape.a1)}`;
  }

  if (shape.type === "matrix") {
    return `M|${shape.cols}x${shape.rows}|${matrixRowsText(shape.cells)}`;
  }

  return "";
}

function computeOriginalBounds(shapes) {
  if (!shapes.length) {
    return {
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      scale: 1
    };
  }

  const points = [];

  for (const shape of shapes) {
    if (shape.type === "line") {
      points.push(shape.p1, shape.p2);
    } else if (shape.type === "arc") {
      points.push(
        {
          x: shape.c.x - shape.r,
          y: shape.c.y - shape.r
        },
        {
          x: shape.c.x + shape.r,
          y: shape.c.y + shape.r
        }
      );
    } else if (shape.type === "matrix") {
      points.push(
        shape.origin,
        {
          x: shape.origin.x + shape.cols * shape.cellSize,
          y: shape.origin.y + shape.rows * shape.cellSize
        }
      );
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const scale = Math.max(1e-9, maxX - minX, maxY - minY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    scale
  };
}

function getLineSignature(shape) {
  const dx = shape.p2.x - shape.p1.x;
  const dy = shape.p2.y - shape.p1.y;
  const len = Math.hypot(dx, dy);

  if (len < 1e-9) return null;

  let ux = dx / len;
  let uy = dy / len;

  if (ux < -1e-9 || (Math.abs(ux) < 1e-9 && uy < 0)) {
    ux = -ux;
    uy = -uy;
  }

  const nx = -uy;
  const ny = ux;
  const c = nx * shape.p1.x + ny * shape.p1.y;

  return {
    ux,
    uy,
    nx,
    ny,
    c
  };
}

function mergeLines(shapes) {
  const groups = new Map();

  for (const shape of shapes) {
    if (shape.type !== "line") continue;

    const n = normalizeLine(shape);
    const sig = getLineSignature(n);

    if (!sig) continue;

    const key = `${roundN(sig.ux)}|${roundN(sig.uy)}|${roundN(sig.c)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        sig,
        segments: []
      });
    }

    const t1 = n.p1.x * sig.ux + n.p1.y * sig.uy;
    const t2 = n.p2.x * sig.ux + n.p2.y * sig.uy;

    groups.get(key).segments.push({
      start: Math.min(t1, t2),
      end: Math.max(t1, t2)
    });
  }

  const merged = [];

  for (const { sig, segments } of groups.values()) {
    segments.sort((a, b) => a.start - b.start || a.end - b.end);

    const intervals = [];

    for (const seg of segments) {
      const last = intervals[intervals.length - 1];

      if (!last || seg.start > last.end + 1e-9) {
        intervals.push({ ...seg });
      } else {
        last.end = Math.max(last.end, seg.end);
      }
    }

    for (const interval of intervals) {
      const p1 = {
        x: sig.ux * interval.start + sig.nx * sig.c,
        y: sig.uy * interval.start + sig.ny * sig.c
      };

      const p2 = {
        x: sig.ux * interval.end + sig.nx * sig.c,
        y: sig.uy * interval.end + sig.ny * sig.c
      };

      merged.push(normalizeLine({
        type: "line",
        p1,
        p2
      }));
    }
  }

  return merged;
}

function getArcSegments45(shape) {
  const arc = normalizeArc(shape);

  if (arc.fullCircle) {
    return Array.from({ length: 8 }, (_, i) => i);
  }

  const segments = [];
  let current = arc.a0 % 360;
  const end = arc.a1 % 360;
  let guard = 0;

  while (current !== end && guard < 16) {
    segments.push((current / 45) % 8);
    current = (current + 45) % 360;
    guard += 1;
  }

  return [...new Set(segments)];
}

function mergeArcs(shapes) {
  const groups = new Map();

  for (const shape of shapes) {
    if (shape.type !== "arc") continue;

    const arc = normalizeArc(shape);
    const key = `${fmt(arc.c.x)}|${fmt(arc.c.y)}|${fmt(arc.r)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        c: arc.c,
        r: arc.r,
        covered: new Set()
      });
    }

    const group = groups.get(key);

    for (const seg of getArcSegments45(arc)) {
      group.covered.add(seg);
    }
  }

  const merged = [];

  for (const group of groups.values()) {
    const covered = Array.from(group.covered).sort((a, b) => a - b);

    if (!covered.length) continue;

    if (covered.length === 8) {
      merged.push({
        type: "arc",
        c: group.c,
        r: group.r,
        a0: 0,
        a1: 360,
        fullCircle: true
      });
      continue;
    }

    const starts = [];

    for (const seg of covered) {
      const prev = (seg + 7) % 8;

      if (!group.covered.has(prev)) {
        starts.push(seg);
      }
    }

    for (const start of starts) {
      let endSeg = start;

      while (
        group.covered.has((endSeg + 1) % 8) &&
        (endSeg + 1) % 8 !== start
      ) {
        endSeg = (endSeg + 1) % 8;
      }

      merged.push({
        type: "arc",
        c: group.c,
        r: group.r,
        a0: start * 45,
        a1: ((endSeg + 1) % 8) * 45,
        fullCircle: false
      });
    }
  }

  return merged;
}

function canonicalizeShapes(shapes) {
  const normalized = shapes.map(shape => {
    if (shape.type === "line") return normalizeLine(shape);
    if (shape.type === "arc") return normalizeArc(shape);
    if (shape.type === "matrix") return normalizeMatrix(shape);
    return shape;
  });

  const matrices = normalized
    .filter(s => s.type === "matrix")
    .map(normalizeMatrix);

  const lines = mergeLines(normalized.filter(s => s.type === "line"));
  const arcs = mergeArcs(normalized.filter(s => s.type === "arc"));

  const merged = [...lines, ...arcs, ...matrices];

  merged.sort((a, b) => shapeSortKey(a).localeCompare(shapeSortKey(b)));

  return merged;
}

function normalizeShapesForScoring(shapes) {
  const canonical = canonicalizeShapes(shapes);
  const bounds = computeOriginalBounds(canonical);

  const normalized = canonical.map(shape => {
    if (shape.type === "line") {
      return normalizeLine({
        ...shape,
        p1: {
          x: (shape.p1.x - bounds.minX) / bounds.scale,
          y: (shape.p1.y - bounds.minY) / bounds.scale
        },
        p2: {
          x: (shape.p2.x - bounds.minX) / bounds.scale,
          y: (shape.p2.y - bounds.minY) / bounds.scale
        }
      });
    }

    if (shape.type === "arc") {
      return normalizeArc({
        ...shape,
        c: {
          x: (shape.c.x - bounds.minX) / bounds.scale,
          y: (shape.c.y - bounds.minY) / bounds.scale
        },
        r: shape.r / bounds.scale
      });
    }

    if (shape.type === "matrix") {
      return normalizeMatrix({
        ...shape,
        origin: {
          x: (shape.origin.x - bounds.minX) / bounds.scale,
          y: (shape.origin.y - bounds.minY) / bounds.scale
        },
        cellSize: shape.cellSize / bounds.scale
      });
    }

    return shape;
  });

  normalized.sort((a, b) => shapeSortKey(a).localeCompare(shapeSortKey(b)));

  return normalized;
}

function serializeSpatialAnswer() {
  return normalizeShapesForScoring(state.shapes)
    .map(shape => {
      if (shape.type === "matrix") {
        return `${shape.cols}x${shape.rows}:${matrixRowsText(shape.cells)}`;
      }

      return shapeToText(shape);
    })
    .join(";");
}

function drawGrid() {
  const g = getGridDivisions();

  ctx.save();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, spatialCanvas.width, spatialCanvas.height);

  ctx.strokeStyle = "#ecece8";
  ctx.lineWidth = 1;

  for (let i = 0; i <= g; i++) {
    const v = i / g;
    const x = v * spatialCanvas.width;
    const y = v * spatialCanvas.height;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, spatialCanvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(spatialCanvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPoint(p, radius = 4, color = "#171717") {
  const c = normToCanvas(p);

  ctx.beginPath();
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawMatrixShape(shape, active) {
  const cs = shape.cellSize * spatialCanvas.width;
  const origin = normToCanvas(shape.origin);
  const borderWidth = active ? 3 : 2;

  for (let r = 0; r < shape.rows; r++) {
    for (let c = 0; c < shape.cols; c++) {
      const x = origin.x + c * cs;
      const y = origin.y + r * cs;

      ctx.fillStyle = shape.cells[r][c] ? "#111111" : "#ffffff";
      ctx.fillRect(x, y, cs, cs);

      ctx.strokeStyle = active ? "#0b5cff" : "#171717";
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(x, y, cs, cs);
    }
  }

  const moveHandle = normToCanvas(shape.origin);

  const resizeHandle = normToCanvas({
    x: shape.origin.x + shape.cols * shape.cellSize,
    y: shape.origin.y + shape.rows * shape.cellSize
  });

  ctx.fillStyle = active ? "#0b5cff" : "#171717";

  ctx.fillRect(moveHandle.x - 5, moveHandle.y - 5, 10, 10);
  ctx.fillRect(resizeHandle.x - 5, resizeHandle.y - 5, 10, 10);
}

function drawShape(shape, index) {
  const active = index === state.hoverShapeIndex;

  ctx.save();

  ctx.lineWidth = active ? 3 : 2;
  ctx.strokeStyle = active ? "#0b5cff" : "#171717";

  const pointColor = active ? "#0b5cff" : "#171717";

  if (shape.type === "line") {
    const a = normToCanvas(shape.p1);
    const b = normToCanvas(shape.p2);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    drawPoint(shape.p1, 4, pointColor);
    drawPoint(shape.p2, 4, pointColor);
  }

  if (shape.type === "arc") {
    const c = normToCanvas(shape.c);

    ctx.beginPath();

    if (shape.fullCircle) {
      ctx.arc(c.x, c.y, shape.r * spatialCanvas.width, 0, Math.PI * 2, false);
    } else {
      ctx.arc(
        c.x,
        c.y,
        shape.r * spatialCanvas.width,
        degToRad(shape.a0),
        degToRad(shape.a1),
        false
      );
    }

    ctx.stroke();

    drawPoint(shape.c, 4, pointColor);

    drawPoint({
      x: shape.c.x + shape.r * Math.cos(degToRad(shape.a0)),
      y: shape.c.y + shape.r * Math.sin(degToRad(shape.a0))
    }, 4, pointColor);

    drawPoint({
      x: shape.c.x + shape.r * Math.cos(degToRad(shape.a1)),
      y: shape.c.y + shape.r * Math.sin(degToRad(shape.a1))
    }, 4, pointColor);
  }

  if (shape.type === "matrix") {
    drawMatrixShape(shape, active);
  }

  ctx.restore();
}

function renderDrafts() {
  ctx.save();

  ctx.strokeStyle = "#8a8a8a";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  if (state.tool === "line" && state.draftPoints.length === 1 && state.previewPoint) {
    const a = normToCanvas(state.draftPoints[0]);
    const b = normToCanvas(state.previewPoint);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  if (state.tool === "arc" && state.arcDraft) {
    drawPoint(state.arcDraft.center, 5, "#8a8a8a");

    if (!state.arcDraft.start && state.previewPoint) {
      const a = normToCanvas(state.arcDraft.center);
      const b = normToCanvas(state.previewPoint);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (state.arcDraft.start && state.previewPoint) {
      const c = state.arcDraft.center;
      const s = state.arcDraft.start;
      const e = state.previewPoint;

      const center = normToCanvas(c);
      const r = dist(c, s);
      const a0 = angleFromCenter(c, s);
      const a1 = angleFromCenter(c, e);
      const fullCircle = a0 === a1;

      ctx.beginPath();

      if (fullCircle) {
        ctx.arc(center.x, center.y, r * spatialCanvas.width, 0, Math.PI * 2, false);
      } else {
        ctx.arc(
          center.x,
          center.y,
          r * spatialCanvas.width,
          degToRad(a0),
          degToRad(a1),
          false
        );
      }

      ctx.stroke();
    }
  }

  if (state.mode === "matrix" && state.draftPoints.length === 1 && state.previewPoint) {
    const a = state.draftPoints[0];
    const b = state.previewPoint;

    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x, b.x);
    const maxY = Math.max(a.y, b.y);

    const origin = normToCanvas({
      x: minX,
      y: minY
    });

    ctx.strokeRect(
      origin.x,
      origin.y,
      (maxX - minX) * spatialCanvas.width,
      (maxY - minY) * spatialCanvas.height
    );
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, spatialCanvas.width, spatialCanvas.height);
  drawGrid();
  state.shapes.forEach(drawShape);
  renderDrafts();
}

function distToSegment(p, a, b) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;

  if (l2 === 0) return dist(p, a);

  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = clamp(t, 0, 1);

  return dist(p, {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y)
  });
}

function hitTestMatrixCell(shape, p) {
  if (shape.type !== "matrix") return null;

  const x0 = shape.origin.x;
  const y0 = shape.origin.y;
  const x1 = x0 + shape.cols * shape.cellSize;
  const y1 = y0 + shape.rows * shape.cellSize;
  const eps = 1e-9;

  if (p.x < x0 || p.y < y0 || p.x >= x1 - eps || p.y >= y1 - eps) {
    return null;
  }

  const localX = p.x - x0;
  const localY = p.y - y0;

  const col = Math.min(shape.cols - 1, Math.floor((localX + eps) / shape.cellSize));
  const row = Math.min(shape.rows - 1, Math.floor((localY + eps) / shape.cellSize));

  if (col < 0 || row < 0 || col >= shape.cols || row >= shape.rows) {
    return null;
  }

  return {
    row,
    col,
    key: `${row}:${col}`
  };
}

function hitTestShape(p) {
  const threshold = 0.03;

  for (let i = state.shapes.length - 1; i >= 0; i--) {
    const s = state.shapes[i];

    if (s.type === "line" && distToSegment(p, s.p1, s.p2) < threshold) {
      return i;
    }

    if (s.type === "arc" && (Math.abs(dist(p, s.c) - s.r) < threshold || dist(p, s.c) < threshold)) {
      return i;
    }

    if (s.type === "matrix") {
      if (
        p.x >= s.origin.x &&
        p.y >= s.origin.y &&
        p.x <= s.origin.x + s.cols * s.cellSize &&
        p.y <= s.origin.y + s.rows * s.cellSize
      ) {
        return i;
      }
    }
  }

  return -1;
}

function findVertex(shape, p) {
  const threshold = 0.03;

  if (shape.type === "line") {
    if (dist(shape.p1, p) < threshold) return 0;
    if (dist(shape.p2, p) < threshold) return 1;
  }

  if (shape.type === "arc") {
    if (dist(shape.c, p) < threshold) return 0;

    const start = {
      x: shape.c.x + shape.r * Math.cos(degToRad(shape.a0)),
      y: shape.c.y + shape.r * Math.sin(degToRad(shape.a0))
    };

    const end = {
      x: shape.c.x + shape.r * Math.cos(degToRad(shape.a1)),
      y: shape.c.y + shape.r * Math.sin(degToRad(shape.a1))
    };

    if (dist(start, p) < threshold) return 1;
    if (dist(end, p) < threshold) return 2;
  }

  if (shape.type === "matrix") {
    const moveHandle = shape.origin;

    const resizeHandle = {
      x: shape.origin.x + shape.cols * shape.cellSize,
      y: shape.origin.y + shape.rows * shape.cellSize
    };

    if (dist(moveHandle, p) < threshold) return 0;
    if (dist(resizeHandle, p) < threshold) return 1;
  }

  return -1;
}

function onCanvasClick(ev) {
  const rawP = canvasToNorm(ev.clientX, ev.clientY, false);

  const p = snapPoint(rawP, {
    includeShapePoints: state.tool === "line" || state.tool === "arc",
    requireNearShapePoint: true
  });

  if (state.mode !== "regular") return;

  if (state.tool === "line") {
    if (state.draftPoints.length === 0) {
      pushHistory();
    }

    state.draftPoints.push(p);

    if (state.draftPoints.length === 2) {
      state.shapes.push({
        type: "line",
        p1: state.draftPoints[0],
        p2: state.draftPoints[1]
      });

      state.draftPoints = [];
    }
  } else if (state.tool === "arc") {
    if (!state.arcDraft) {
      pushHistory();

      state.arcDraft = {
        center: p,
        start: null
      };

      setCanvasStatus("Arc mode: now click the start point.");
    } else if (!state.arcDraft.start) {
      state.arcDraft.start = p;
      setCanvasStatus("Arc mode: now click the end point.");
    } else {
      const c = state.arcDraft.center;
      const s = state.arcDraft.start;
      const e = p;
      const r = roundN(dist(c, s));

      if (r > 0) {
        const a0 = angleFromCenter(c, s);
        const a1 = angleFromCenter(c, e);

        state.shapes.push({
          type: "arc",
          c,
          r,
          a0,
          a1,
          fullCircle: a0 === a1
        });
      }

      state.arcDraft = null;
      setCanvasStatus("Arc mode: click center, then start point, then end point.");
    }
  }

  render();
}

function onPointerDown(ev) {
  const rawP = canvasToNorm(ev.clientX, ev.clientY, false);

  const snappedP = snapPoint(rawP, {
    includeShapePoints: state.mode === "regular",
    requireNearShapePoint: true
  });

  state.pointerDown = true;
  spatialCanvas.setPointerCapture(ev.pointerId);

  if (state.mode === "matrix") {
    const p = rawP;
    const matrixIndex = state.shapes.findIndex(s => s.type === "matrix");

    if (matrixIndex >= 0) {
      const matrix = state.shapes[matrixIndex];

      const handlePoint = snapPoint(rawP, {
        includeShapePoints: false
      });

      const vertex = findVertex(matrix, handlePoint);

      if (vertex >= 0) {
        pushHistory();

        state.dragShapeIndex = matrixIndex;
        state.dragPointIndex = vertex;
        state.dragOffset = handlePoint;

        render();
        return;
      }

      const cell = hitTestMatrixCell(matrix, p);

      if (cell && ev.button === 0) {
        pushHistory();

        const current = matrix.cells[cell.row][cell.col];
        matrix.cells[cell.row][cell.col] = current ? 0 : 1;

        render();
        setCanvasStatus(`Cell ${cell.col + 1},${cell.row + 1} toggled.`);
      } else if (!cell) {
        setCanvasStatus("Matrix mode: drag from corner to corner to create a matrix.");
      }

      state.pointerDown = false;
      return;
    }

    state.draftPoints = [
      snapPoint(rawP, {
        includeShapePoints: false
      })
    ];

    state.previewPoint = state.draftPoints[0];
    state.matrixDragStarted = true;

    render();
    return;
  }

  if (state.tool !== "select") return;

  const p = snappedP;
  let idx = hitTestShape(p);

  if (idx >= 0 && state.shapes[idx]?.type === "matrix") {
    idx = -1;
  }

  state.dragShapeIndex = idx;

  if (idx >= 0) {
    pushHistory();

    const shape = state.shapes[idx];
    state.dragPointIndex = findVertex(shape, p);
    state.dragOffset = p;
  } else {
    state.dragPointIndex = -1;
  }

  render();
}

function onPointerMove(ev) {
  const rawP = canvasToNorm(ev.clientX, ev.clientY, false);

  const snappedP = snapPoint(rawP, {
    includeShapePoints: state.mode === "regular",
    requireNearShapePoint: true
  });

  state.previewPoint = state.mode === "matrix"
    ? snapPoint(rawP, { includeShapePoints: false })
    : snappedP;

  state.hoverShapeIndex = hitTestShape(state.mode === "matrix" ? rawP : snappedP);

  if (state.mode === "matrix") {
    const matrixIndex = state.shapes.findIndex(s => s.type === "matrix");

    if (state.pointerDown && matrixIndex >= 0 && state.dragShapeIndex === matrixIndex) {
      const shape = state.shapes[matrixIndex];

      const p = snapPoint(rawP, {
        includeShapePoints: false
      });

      if (state.dragPointIndex === 0) {
        shape.origin = p;
      } else if (state.dragPointIndex === 1) {
        const g = getGridDivisions();
        const cellSize = 1 / g;

        const cols = Math.max(2, Math.round((p.x - shape.origin.x) / cellSize));
        const rows = Math.max(2, Math.round((p.y - shape.origin.y) / cellSize));

        const newCells = Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => shape.cells[r]?.[c] ?? 0)
        );

        shape.cols = cols;
        shape.rows = rows;
        shape.cells = newCells;
      }

      render();
      return;
    }

    if (state.pointerDown && state.draftPoints.length === 1 && state.matrixDragStarted) {
      state.previewPoint = snapPoint(rawP, {
        includeShapePoints: false
      });

      render();
    }

    return;
  }

  if (state.tool === "select" && state.pointerDown && state.dragShapeIndex >= 0) {
    const p = snappedP;
    const shape = state.shapes[state.dragShapeIndex];

    if (state.dragPointIndex >= 0) {
      if (shape.type === "line") {
        if (state.dragPointIndex === 0) shape.p1 = p;
        if (state.dragPointIndex === 1) shape.p2 = p;
      }

      if (shape.type === "arc") {
        if (state.dragPointIndex === 0) {
          shape.c = p;
        }

        if (state.dragPointIndex === 1) {
          shape.a0 = angleFromCenter(shape.c, p);
          shape.fullCircle = false;
        }

        if (state.dragPointIndex === 2) {
          shape.a1 = angleFromCenter(shape.c, p);
          shape.fullCircle = false;
        }
      }
    }
  }

  render();
}

function onPointerUp(ev) {
  if (ev && spatialCanvas.hasPointerCapture?.(ev.pointerId)) {
    spatialCanvas.releasePointerCapture(ev.pointerId);
  }

  if (
    state.mode === "matrix" &&
    state.pointerDown &&
    state.draftPoints.length === 1 &&
    state.previewPoint &&
    state.matrixDragStarted
  ) {
    const a = state.draftPoints[0];
    const b = state.previewPoint;
    const g = getGridDivisions();

    const startCol = Math.round(Math.min(a.x, b.x) * g);
    const startRow = Math.round(Math.min(a.y, b.y) * g);
    const endCol = Math.round(Math.max(a.x, b.x) * g);
    const endRow = Math.round(Math.max(a.y, b.y) * g);

    const cols = endCol - startCol;
    const rows = endRow - startRow;

    if (cols >= 2 && rows >= 2) {
      pushHistory();

      const cellSize = 1 / g;

      state.shapes = state.shapes.filter(s => s.type !== "matrix");

      state.shapes.push({
        type: "matrix",
        origin: {
          x: startCol / g,
          y: startRow / g
        },
        cols,
        rows,
        cellSize,
        cells: createMatrixCells(cols, rows)
      });

      setCanvasStatus(`Matrix created: ${cols}x${rows}.`);
    } else if (!(a.x === b.x && a.y === b.y)) {
      setCanvasStatus("Matrix must be at least 2x2 grid cells.");
    }

    state.draftPoints = [];
    state.previewPoint = null;
    state.matrixDragStarted = false;
  }

  state.pointerDown = false;
  state.dragShapeIndex = -1;
  state.dragPointIndex = -1;
  state.dragOffset = null;

  render();
}

document.querySelectorAll("[data-tool]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    setTool(btn.dataset.tool);
  });
});

document.getElementById("undoAction")?.addEventListener("click", undoLastAction);

document.getElementById("clearAll")?.addEventListener("click", () => {
  pushHistory();
  clearCanvasState();
  render();
  setCanvasStatus("Canvas cleared.");
});

spatialCanvas.addEventListener("click", onCanvasClick);
spatialCanvas.addEventListener("pointerdown", onPointerDown);
spatialCanvas.addEventListener("pointermove", onPointerMove);
spatialCanvas.addEventListener("pointerup", onPointerUp);
spatialCanvas.addEventListener("pointercancel", onPointerUp);

spatialCanvas.addEventListener("pointerleave", ev => {
  if (!state.pointerDown) {
    state.previewPoint = null;
  }

  onPointerUp(ev);
});

spatialCanvas.addEventListener("contextmenu", ev => {
  ev.preventDefault();
});

window.addEventListener("keydown", ev => {
  const isUndo = (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z";

  if (isUndo) {
    ev.preventDefault();
    undoLastAction();
  }
});


function showStatusPopup(message, isCorrect) {
  const modal = document.getElementById("statusModal");
  const content = document.getElementById("statusContent");

  if (!modal || !content) return;

  content.textContent = message;
  content.style.color = isCorrect ? "green" : "red";

  modal.classList.remove("hidden");

  setTimeout(() => {
    modal.classList.add("show");
  }, 10);

  setTimeout(() => {
    modal.classList.remove("show");

    setTimeout(() => {
      modal.classList.add("hidden");
    }, 200);
  }, 1000);
}

async function fetchPrivateAsset(path) {
  const res = await fetch(ASSET_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      subtest: SUBTEST,
      path
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Asset load failed: ${res.status} ${txt}`);
  }

  return res;
}

async function loadQuestionImage(index) {
  const padded = String(index).padStart(2, "0");
  const filename = `Base_${padded}.jpg`;

  try {
    const res = await fetchPrivateAsset(filename);
    const blob = await res.blob();

    if (currentQuestionObjectUrl) {
      URL.revokeObjectURL(currentQuestionObjectUrl);
    }

    currentQuestionObjectUrl = URL.createObjectURL(blob);
    questionImg.src = currentQuestionObjectUrl;

    questionImg.onload = () => {
      const displayWidth = Math.min(
        questionImg.naturalWidth,
        document.querySelector(".container").clientWidth - 32
      );

      questionImg.style.width = `${displayWidth}px`;
    };
  } catch (err) {
    console.error("Failed to load question image:", err);
    questionImg.removeAttribute("src");
  }
}

const endTestModal = document.getElementById("endTestModal");
const confirmEndBtn = document.getElementById("confirmEndBtn");
const cancelEndBtn = document.getElementById("cancelEndBtn");

function openEndTestModal() {
  endTestModal.classList.remove("hidden");
  setTimeout(() => endTestModal.classList.add("show"), 10);
}

function closeEndTestModal() {
  endTestModal.classList.remove("show");
  setTimeout(() => endTestModal.classList.add("hidden"), 200);
}

finishBtn?.addEventListener("click", () => {
  openEndTestModal();
});

confirmEndBtn?.addEventListener("click", async () => {
  closeEndTestModal();

  await updateDB({
    extraUpdate: {
      finished: true
    }
  });

  showFinalResults();
});

cancelEndBtn?.addEventListener("click", () => {
  closeEndTestModal();
});

endTestModal?.addEventListener("click", e => {
  const box = endTestModal.querySelector(".modal-box");

  if (box && !box.contains(e.target)) {
    closeEndTestModal();
  }
});

function findNextUnsolved(start, forward = true) {
  let i = start;

  for (let step = 0; step < TOTAL_ITEMS; step++) {
    i = forward
      ? (i % TOTAL_ITEMS) + 1
      : (i - 2 + TOTAL_ITEMS) % TOTAL_ITEMS + 1;

    const isSolved = solved.includes(i);
    const remaining = attempts[i - 1] ?? TOTAL_ATTEMPTS;

    if (!isSolved && remaining > 0) {
      return i;
    }
  }

  return null;
}

async function loadQuestionByIndex(index) {
  currentIndex = index;

  await loadQuestionImage(index);

  resetSpatialAnswerCanvas();
  updateTopBar();
}

async function loadNextQuestion() {
  const next = findNextUnsolved(currentIndex, true);

  if (!next) {
    return endGame();
  }

  await loadQuestionByIndex(next);
}

prevBtn.onclick = async () => {
  const prev = findNextUnsolved(currentIndex, false);

  if (!prev) {
    return endGame();
  }

  await loadQuestionByIndex(prev);
};

nextBtn.onclick = async () => {
  const next = findNextUnsolved(currentIndex, true);

  if (!next) {
    return endGame();
  }

  await loadQuestionByIndex(next);
};

async function updateDB({
  extraUpdate = {},
  decrementAttempt = false,
  markSolvedQuestion = null
} = {}) {
  const cleanEmail = String(email || "").trim();

  if (!cleanEmail) return;

  const payload = {
    action: "update_user",
    email: cleanEmail,
    password,
    subtest: SUBTEST,
    update: {
      ...extraUpdate
    }
  };

  if (decrementAttempt) {
    payload.decrement_attempt = true;
    payload.question_index = currentIndex - 1;
  }

  if (Number.isInteger(markSolvedQuestion)) {
    payload.mark_solved_question = markSolvedQuestion;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("update_user failed:", body);
    
      showStatusPopup(
        body?.error || "Unable to finish the quiz.",
        false
      );
    
      return {
        ok: false,
        error: body?.error || "Update failed"
      };
    }

    if (Array.isArray(body?.solved_ids)) {
      solved = body.solved_ids.map(Number);
    }

    if (Array.isArray(body?.attempts)) {
      attempts = body.attempts.map(n =>
        Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0
      );
    }

    updateTopBar();

    return body;

  } catch (err) {
    console.error("updateDB network error:", err);
    throw err;
  }
}

async function loadUserProgress() {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "update_user",
        email,
        password,
        subtest: SUBTEST
      })
    });

    if (!res.ok) {
      console.error("loadUserProgress failed", await res.text().catch(() => ""));
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const user = payload.user ?? payload;

    solved = Array.isArray(payload.solved_ids)
      ? payload.solved_ids.map(Number)
      : Array.isArray(user?.solved_ids_spatial)
        ? user.solved_ids_spatial.map(Number)
        : [];

    attempts = Array.isArray(payload.attempts)
      ? payload.attempts.map(Number)
      : Array.isArray(user?.attempts_s)
        ? user.attempts_s.map(Number)
        : Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS);

    updateTopBar();

    if (user?.finished_s === true) {
      return showFinalResults();
    }

    if (!user?.start) {
      await updateDB({
        extraUpdate: {
          started: true
        }
      });
    }

    const firstAvailable = findNextUnsolved(0, true);

    if (!firstAvailable) {
      const result = await updateDB({
          extraUpdate: {
              finished: true
          }
      });
      
      if (!result?.ok || result.user?.finished_a !== true) {
          return;
      }
      
      return showFinalResults();
    }

    await loadQuestionByIndex(firstAvailable);

  } catch (err) {
    console.error("loadUserProgress error:", err);
  }
}

submitBtn.onclick = async () => {
  const rawAns = serializeSpatialAnswer();

  if (!rawAns) {
    setCanvasStatus("Please draw your answer before submitting.");
    return;
  }

  submitBtn.disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get_answer",
        email,
        password,
        subtest: SUBTEST,
        question: currentIndex,
        answer: rawAns
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("get_answer failed:", txt);

      try {
        const parsed = JSON.parse(txt);

        if (
          parsed?.error === "Question already solved" ||
          parsed?.error === "No attempts left"
        ) {
          await loadUserProgress();
        }
      } catch (_) {}

      submitBtn.disabled = false;
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const correct = payload?.correct === true;

    if (correct) {
      await updateDB({
        markSolvedQuestion: currentIndex
      });

      showStatusPopup("Correct!", true);

      setTimeout(async () => {
        submitBtn.disabled = false;
        await loadNextQuestion();
      }, 1000);

      return;
    }

    showStatusPopup("Incorrect!", false);

    await updateDB({
      decrementAttempt: true
    });

    const remaining = attempts[currentIndex - 1] ?? 0;

    if (remaining <= 0) {
      const next = findNextUnsolved(currentIndex, true);

      if (!next) {
        submitBtn.disabled = false;
        return endGame();
      }

      setTimeout(async () => {
        submitBtn.disabled = false;
        await loadQuestionByIndex(next);
      }, 1000);

      return;
    }

    resetSpatialAnswerCanvas();
    updateTopBar();
    submitBtn.disabled = false;

  } catch (err) {
    console.error("Submit error:", err);
    submitBtn.disabled = false;
  }
};

function updateTopBar() {
  scoreEl.innerText = `Raw score: ${solved.length} / ${TOTAL_ITEMS}`;

  if (currentIndex > 0) {
    const remaining = attempts[currentIndex - 1] ?? 0;
    attemptsEl.innerText = `Attempts left: ${remaining}`;
  } else {
    attemptsEl.innerText = "Attempts left: -";
  }
}

async function showFinalResults() {
  await loadNorm()

  const rawScore = solved.length;

  let standardScore = normoCache?.[rawScore] ?? "N/A";

  if (standardScore !== "N/A") {
    standardScore = Math.round(Number(standardScore));

    if (rawScore === 0) {
      standardScore += " or lower";
    } else if (rawScore === TOTAL_ITEMS) {
      standardScore += " or higher";
    }
  }

  document.querySelector(".container").innerHTML = `
    <h2 style="text-align:center">Spatial Subtest Completed</h2>
    <p><strong>Raw score:</strong> ${rawScore} / ${TOTAL_ITEMS}</p>
    <p><strong>Estimated standard score:</strong> ${standardScore}</p>

    <p>Thank you for your participation in the project.</p>
    <p>M.N.</p>

    <div style="text-align:center; margin-top:35px;">
        <button id="returnBtn" class="secondary-btn">
          Return to NOAIS-Form 2 index
        </button>
      </div>
    `;
  document.getElementById("returnBtn").addEventListener("click", returnToIndex);
}
document.getElementById("returnBtn").addEventListener("click", returnToIndex);

function returnToIndex() {
  if (history.length > 1) {
    history.back();
  } else {
    window.location.href = "login.html";
  }
}

async function endGame() {
  await updateDB({
    extraUpdate: {
      finished: true
    }
  });

  if (!result?.ok || result.user?.finished_s !== true) {
      return;
  }

  showFinalResults();
}

applyToolbarState();
render();
setCanvasStatus("Move point mode: drag existing line or arc points only.");

async function checkQuizAccess() {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "update_user",
      email,
      password,
      subtest: SUBTEST
    })
  });

  if (!res.ok) {
    sessionStorage.removeItem("password");
    window.location.href = "login.html";
    return false;
  }

  return true;
}

(async function init() {
  const allowed = await checkQuizAccess();
  if (!allowed) return;
  gameSection?.classList.remove("hidden");
  await loadUserProgress();
})();
