const UPDATE_USER_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user_noctae";
const GET_ANSWER_URL  = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_answer_noctae";
const GET_ASSET_URL   = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_noctae_asset";

const TOTAL_ITEMS = 48;
const TOTAL_ATTEMPTS = 3;
const FALLBACK_TOTAL_TIME_SECONDS = 4 * 3600;
const SPATIAL_ITEMS = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48];
const TWO_ANSWERS = [7, 10, 13, 23, 34, 38];

const scoreEl = document.getElementById("scoreEl");
const attemptsEl = document.getElementById("attemptsEl");
const questionImg = document.getElementById("questionImg");
const submitBtn = document.getElementById("submitBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const finishBtn = document.getElementById("finishBtn");
const spatialContainer = document.getElementById("spatialContainer");
const spatialCanvas = document.getElementById("spatialCanvas");
const rowsInput = document.getElementById("rowsInput");
const colsInput = document.getElementById("colsInput");
const resetCanvasBtn = document.getElementById("resetCanvasBtn");
const timerEl = document.getElementById("timerEl");

const CELL_SIZE = 40;

let timerInterval = null;
let testStartIso = null;
let remainingSeconds = FALLBACK_TOTAL_TIME_SECONDS;
let darkMode = localStorage.getItem("noctae_dark_mode") === "true";
let currentQuestionObjectUrl = null;

let email = localStorage.getItem("email");
let username = localStorage.getItem("username") || "";
let password = sessionStorage.getItem("password");

if (!email || !password) {
  window.location.href = "login.html";
  throw new Error("Missing login data");
}

let solved = [];
let attempts = Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS);
let currentIndex = 0;
let normoCache = null;
let spatialGrid = [];

/* -------------------- Spatial grid -------------------- */

function initSpatialGrid(rows, cols) {
  spatialGrid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );
  spatialCanvas.width = cols * CELL_SIZE;
  spatialCanvas.height = rows * CELL_SIZE;
  drawSpatialGrid();
}

function drawSpatialGrid() {
  if (!spatialGrid.length || !spatialGrid[0]?.length) return;

  const ctx = spatialCanvas.getContext("2d");
  const filledColor = darkMode ? "#fff" : "#000";
  const emptyColor = darkMode ? "#000" : "#fff";
  const strokeColor = darkMode ? "#c7d0dd" : "#000";

  ctx.clearRect(0, 0, spatialCanvas.width, spatialCanvas.height);

  for (let r = 0; r < spatialGrid.length; r++) {
    for (let c = 0; c < spatialGrid[0].length; c++) {
      ctx.fillStyle = spatialGrid[r][c] ? filledColor : emptyColor;
      ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
}

function updateSpatialGridFromInputs() {
  let rows = Math.round(Number(rowsInput.value));
  let cols = Math.round(Number(colsInput.value));

  if (!Number.isFinite(rows)) rows = 4;
  if (!Number.isFinite(cols)) cols = 4;

  rows = Math.max(3, Math.min(8, rows));
  cols = Math.max(3, Math.min(8, cols));

  rowsInput.value = rows;
  colsInput.value = cols;

  initSpatialGrid(rows, cols);
}

function toggleCellFromEvent(x, y) {
  if (!spatialGrid.length || !spatialGrid[0]?.length) return;

  const rect = spatialCanvas.getBoundingClientRect();
  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;
  const c = Math.floor((x - rect.left) / (spatialCanvas.width / cols));
  const r = Math.floor((y - rect.top) / (spatialCanvas.height / rows));

  if (r >= 0 && r < rows && c >= 0 && c < cols) {
    spatialGrid[r][c] ^= 1;
    drawSpatialGrid();
  }
}

function serializeSpatialAnswer() {
  if (!spatialGrid.length || !spatialGrid[0]?.length) return "";
  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;
  const flat = spatialGrid.map(row => row.join("")).join("");
  return `${cols}x${rows}:${flat}`;
}

rowsInput?.addEventListener("change", updateSpatialGridFromInputs);
colsInput?.addEventListener("change", updateSpatialGridFromInputs);
resetCanvasBtn?.addEventListener("click", () => updateSpatialGridFromInputs());

spatialCanvas?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  if (touch) toggleCellFromEvent(touch.clientX, touch.clientY);
});

spatialCanvas?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  toggleCellFromEvent(e.clientX, e.clientY);
});

/* -------------------- Status popup -------------------- */

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

/* -------------------- Timer -------------------- */

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setTimerText(seconds) {
  if (timerEl) timerEl.innerText = `Time left: ${formatTime(seconds)}`;
}

function startTimerFromStartIso(startIso) {
  testStartIso = startIso || null;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const tick = async () => {
    if (!testStartIso) {
      remainingSeconds = FALLBACK_TOTAL_TIME_SECONDS;
      setTimerText(remainingSeconds);
      return;
    }

    const startMs = new Date(testStartIso).getTime();
    const nowMs = Date.now();
    const elapsed = Math.floor((nowMs - startMs) / 1000);
    remainingSeconds = Math.max(0, FALLBACK_TOTAL_TIME_SECONDS - elapsed);

    setTimerText(remainingSeconds);

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      await endGameBecauseTimeExpired();
    }
  };

  tick();
  timerInterval = setInterval(tick, 1000);
}

async function startTestIfNeeded(user) {
  if (user?.start) {
    startTimerFromStartIso(user.start);
    return user;
  }

  const res = await fetch(UPDATE_USER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      update: { started: true }
    })
  });

  if (!res.ok) {
    console.error("Failed to start test timer");
    startTimerFromStartIso(null);
    return user;
  }

  const payload = await res.json().catch(() => ({}));
  const updatedUser = payload.user ?? user;
  startTimerFromStartIso(updatedUser?.start || null);
  return updatedUser;
}

async function endGameBecauseTimeExpired() {
  showStatusPopup("Time is over.", false);
  await updateDB({ extraUpdate: { finished: true } });
  showFinalResults();
}

/* -------------------- Asset loading -------------------- */

async function fetchPrivateAsset(path) {
  const res = await fetch(GET_ASSET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, path })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Asset load failed: ${res.status} ${txt}`);
  }

  return res;
}

async function loadQuestionImage(index) {
  const padded = String(index).padStart(4, "0");
  const filename = `${darkMode ? "Dark" : "Light"}_page-${padded}.jpg`;

  try {
    const res = await fetchPrivateAsset(filename);
    const blob = await res.blob();

    if (currentQuestionObjectUrl) {
      URL.revokeObjectURL(currentQuestionObjectUrl);
    }

    currentQuestionObjectUrl = URL.createObjectURL(blob);
    questionImg.src = currentQuestionObjectUrl;
  } catch (err) {
    console.error("Failed to load question image:", err);
    questionImg.removeAttribute("src");
  }
}

async function loadNorm() {
  try {
    const r = await fetchPrivateAsset("norm.json");
    normoCache = await r.json();
  } catch (e) {
    console.error("Could not load norm", e);
  }
}

/* -------------------- Dark mode -------------------- */

function applyDarkMode() {
  document.body.classList.toggle("dark-mode", darkMode);

  const darkModeBtn = document.getElementById("darkModeBtn");
  if (darkModeBtn) {
    darkModeBtn.textContent = darkMode ? "Light Mode" : "Dark Mode";
  }

  localStorage.setItem("noctae_dark_mode", String(darkMode));
  drawSpatialGrid();

  if (currentIndex > 0) {
    loadQuestionImage(currentIndex);
  }
}

document.getElementById("darkModeBtn")?.addEventListener("click", () => {
  darkMode = !darkMode;
  applyDarkMode();
});

/* -------------------- Username modal -------------------- */

const changeUsernameModal = document.getElementById("changeUsernameModal");
const newUsernameInput = document.getElementById("newUsernameInput");
const usernameStatus = document.getElementById("usernameStatus");
const changeUsernameBtn = document.getElementById("changeUsernameBtn");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const cancelUsernameBtn = document.getElementById("cancelUsernameBtn");

function openUsernameModal() {
  newUsernameInput.value = localStorage.getItem("username") || "";
  usernameStatus.textContent = "";
  changeUsernameModal.classList.remove("hidden");
  changeUsernameModal.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    changeUsernameModal.classList.add("show");
    newUsernameInput.focus();
  }, 50);
}

function closeUsernameModal() {
  changeUsernameModal.classList.remove("show");
  setTimeout(() => {
    changeUsernameModal.classList.add("hidden");
    changeUsernameModal.setAttribute("aria-hidden", "true");
    usernameStatus.textContent = "";
  }, 200);
}

changeUsernameBtn?.addEventListener("click", () => {
  openUsernameModal();
});

cancelUsernameBtn?.addEventListener("click", () => {
  closeUsernameModal();
});

changeUsernameModal?.addEventListener("click", (e) => {
  const modalBox = changeUsernameModal.querySelector(".modal-box");
  if (modalBox && !modalBox.contains(e.target)) {
    closeUsernameModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && changeUsernameModal && !changeUsernameModal.classList.contains("hidden")) {
    closeUsernameModal();
  }
});

saveUsernameBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const newName = newUsernameInput.value.trim();
  if (!newName) {
    usernameStatus.style.color = "crimson";
    usernameStatus.textContent = "Username cannot be empty";
    return;
  }

  usernameStatus.style.color = "#2a7a2a";
  usernameStatus.textContent = "Updating…";

  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        update: { name: newName }
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("Username update failed:", txt);
      usernameStatus.style.color = "crimson";
      usernameStatus.textContent = "Update failed";
      return;
    }

    const payload = await res.json().catch(() => ({}));
    if (payload?.error) {
      usernameStatus.style.color = "crimson";
      usernameStatus.textContent = payload.error || "Update failed";
      return;
    }

    localStorage.setItem("username", newName);
    username = newName;

    usernameStatus.style.color = "#2a7a2a";
    usernameStatus.textContent = "Updated!";

    setTimeout(() => closeUsernameModal(), 900);
  } catch (err) {
    console.error("Username update error:", err);
    usernameStatus.style.color = "crimson";
    usernameStatus.textContent = "Network error";
  }
});

/* -------------------- End test modal -------------------- */

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
  await updateDB({ extraUpdate: { finished: true } });
  showFinalResults();
});

cancelEndBtn?.addEventListener("click", () => {
  closeEndTestModal();
});

endTestModal?.addEventListener("click", (e) => {
  const box = endTestModal.querySelector(".modal-box");
  if (box && !box.contains(e.target)) {
    closeEndTestModal();
  }
});

/* -------------------- Helpers -------------------- */

function normalizeClient(s) {
  if (s === undefined || s === null) return "";
  let t = String(s);
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");
  t = t.replace(/^[\s"']+|[\s"']+$/g, "");
  return t.toLowerCase().replace(/\s+/g, "");
}

function clearInputs() {
  const input1 = document.getElementById("answerInput1");
  const input2 = document.getElementById("answerInput2");
  if (input1) input1.value = "";
  if (input2) input2.value = "";
}

function findNextUnsolved(start, forward = true) {
  let i = start;

  for (let step = 0; step < TOTAL_ITEMS; step++) {
    i = forward
      ? (i % TOTAL_ITEMS) + 1
      : (i - 2 + TOTAL_ITEMS) % TOTAL_ITEMS + 1;

    const isSolved = solved.includes(i);
    const remaining = attempts[i - 1] ?? TOTAL_ATTEMPTS;

    if (!isSolved && remaining > 0) return i;
  }

  return null;
}

/* -------------------- Question loading -------------------- */

async function loadQuestionByIndex(index) {
  currentIndex = index;

  await loadQuestionImage(index);

  const answerInput1 = document.getElementById("answerInput1");
  const answerInput2 = document.getElementById("answerInput2");

  if (SPATIAL_ITEMS.includes(index)) {
    spatialContainer.classList.remove("hidden");
    answerInput1.style.display = "none";
    if (answerInput2) answerInput2.style.display = "none";
    updateSpatialGridFromInputs();
  } else {
    spatialContainer.classList.add("hidden");
    answerInput1.style.display = "block";

    if (TWO_ANSWERS.includes(index)) {
      answerInput2.style.display = "block";
      answerInput1.placeholder = "Answer 1";
      answerInput2.placeholder = "Answer 2";
    } else {
      answerInput2.style.display = "none";
      answerInput1.placeholder = "Your answer…";
    }

    answerInput1.focus();
  }

  updateTopBar();
}

async function loadNextQuestion() {
  const next = findNextUnsolved(currentIndex, true);
  if (!next) return endGame();
  await loadQuestionByIndex(next);
}

if (prevBtn) {
  prevBtn.onclick = async () => {
    const prev = findNextUnsolved(currentIndex, false);
    if (!prev) return endGame();
    await loadQuestionByIndex(prev);
  };
}

if (nextBtn) {
  nextBtn.onclick = async () => {
    const next = findNextUnsolved(currentIndex, true);
    if (!next) return endGame();
    await loadQuestionByIndex(next);
  };
}

/* -------------------- Server sync -------------------- */

async function updateDB({
  extraUpdate = {},
  decrementAttempt = false,
  markSolvedQuestion = null
} = {}) {
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) return;

  const payload = {
    email: cleanEmail,
    password,
    update: { ...extraUpdate }
  };

  if (decrementAttempt) {
    payload.decrement_attempt = true;
    payload.question_index = Math.max(0, currentIndex - 1);
  }

  if (Number.isInteger(markSolvedQuestion)) {
    payload.mark_solved_question = markSolvedQuestion;
  }

  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("update_user failed:", res.status, body);
      return body;
    }

    if (body?.user) {
      const u = body.user;

      solved = Array.isArray(u.solved_ids)
        ? u.solved_ids.map(x => Number(x))
        : solved;

      if (Array.isArray(u.attempts) && u.attempts.length === TOTAL_ITEMS) {
        attempts = u.attempts.map(n =>
          Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0
        );
      }

      updateTopBar();
    }

    return body;
  } catch (err) {
    console.error("updateDB network error:", err);
    throw err;
  }
}

async function loadUserProgress() {
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      console.error("loadUserProgress: failed", await res.text().catch(() => ""));
      return;
    }

    const payload = await res.json().catch(() => ({}));
    let user = payload.user ?? payload;

    solved = Array.isArray(user?.solved_ids)
      ? user.solved_ids.map(x => Number(x))
      : [];

    if (Array.isArray(user?.attempts) && user.attempts.length === TOTAL_ITEMS) {
      attempts = user.attempts.map(n =>
        Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : TOTAL_ATTEMPTS
      );
    } else {
      attempts = Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS);
    }

    username = localStorage.getItem("username") || user?.name || username;
    if (username) localStorage.setItem("username", username);

    updateTopBar();

    if (user?.finished === true) {
      if (user?.start) startTimerFromStartIso(user.start);
      return showFinalResults();
    }

    user = await startTestIfNeeded(user);

    const firstAvailable = findNextUnsolved(0, true);
    if (!firstAvailable) {
      await updateDB({ extraUpdate: { finished: true } });
      return showFinalResults();
    }

    await loadQuestionByIndex(firstAvailable);
  } catch (err) {
    console.error("loadUserProgress error:", err);
  }
}

/* -------------------- Submit answer -------------------- */

if (submitBtn) {
  submitBtn.onclick = async () => {
    let rawAns;

    if (SPATIAL_ITEMS.includes(currentIndex)) {
      rawAns = serializeSpatialAnswer();
      if (!rawAns) return;
    } else {
      const input1 = document.getElementById("answerInput1").value.trim();
      const input2El = document.getElementById("answerInput2");

      if (TWO_ANSWERS.includes(currentIndex)) {
        const input2 = input2El.value.trim();
        if (!input1 || !input2) return;

        const sorted = [input1, input2]
          .map(v => normalizeClient(v))
          .sort();

        rawAns = sorted.join(",");
      } else {
        if (!input1) return;
        rawAns = input1;
      }
    }

    try {
      const res = await fetch(GET_ANSWER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          question: currentIndex,
          answer: rawAns
        })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("get_answer failed:", txt);

        try {
          const parsed = JSON.parse(txt);
          if (parsed?.error === "Question already solved" || parsed?.error === "No attempts left") {
            await loadUserProgress();
          }
        } catch (_) {}

        return;
      }

      const payload = await res.json().catch(() => ({}));
      const correct = payload?.correct === true;

      if (correct) {
        await updateDB({ markSolvedQuestion: currentIndex });
        showStatusPopup("Correct!", true);
        clearInputs();

        setTimeout(async () => {
          await loadNextQuestion();
        }, 1000);

        return;
      }

      showStatusPopup("Incorrect!", false);
      await updateDB({ decrementAttempt: true });

      const remaining = attempts[currentIndex - 1] ?? 0;
      if (remaining <= 0) {
        const next = findNextUnsolved(currentIndex, true);
        if (!next) return endGame();
        await loadQuestionByIndex(next);
        return;
      }

      clearInputs();
      updateTopBar();
    } catch (err) {
      console.error("Submit error:", err);
    }
  };
}

/* -------------------- UI update -------------------- */

function updateTopBar() {
  scoreEl.innerText = `Score: ${solved.length}`;

  if (currentIndex > 0) {
    const remaining = attempts[currentIndex - 1] ?? 0;
    attemptsEl.innerText = `Attempts left: ${remaining}`;
  } else {
    attemptsEl.innerText = "Attempts left: -";
  }

  const iqVal = (normoCache && normoCache[solved.length]) ? normoCache[solved.length] : "N/A";
  let iqEl = document.getElementById("iqEl");

  if (!iqEl) {
    iqEl = document.createElement("span");
    iqEl.id = "iqEl";
    scoreEl.parentNode.appendChild(iqEl);
  }

  if (solved.length === 0) {
    iqEl.innerText = "IQ: N/A";
  } else {
    iqEl.innerText = `IQ: ${iqVal} (Wechsler Scale)`;
  }
}

/* -------------------- Final results -------------------- */

async function loadLeaderboardState() {
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) return false;

    const payload = await res.json().catch(() => ({}));
    const user = payload.user ?? payload;
    return user?.leaderboard === true;
  } catch {
    return false;
  }
}

function showFinalResults() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const toggleVideoLink = document.getElementById("toggleVideoLink");
  toggleVideoLink?.parentElement?.remove();

  const rawScore = solved.length;
  let iq = normoCache?.[rawScore] ?? "N/A";

  if (rawScore === 0) {
    iq = `${iq} or lower`;
  } else if (rawScore === TOTAL_ITEMS) {
    iq = `${iq} or higher`;
  }

  document.querySelector(".container").innerHTML = `
    <h2>Test Completed</h2>
    <p><strong>Raw score:</strong> ${rawScore} / ${TOTAL_ITEMS}</p>
    <p><strong>Estimated IQ (Wechsler Scale):</strong> ${iq}</p>

    <label style="display:flex; align-items:center; gap:8px; margin-top:20px;">
      <input type="checkbox" id="leaderboardCheckbox">
      Be visible on the NOCTAE leaderboard
    </label>

    <p id="leaderboardStatus" style="margin-top:10px; font-weight:bold;"></p>

    <div style="text-align:center; margin-top:20px;">
      <button id="changeUsernameBtn">Change Username</button>
    </div>

    <form id="certForm" style="margin-top: 20px;">
      <label>Email:</label>
      <input type="email" id="email" value="${email}" readonly />
      <button type="submit" class="button">Show Certificate</button>
    </form>

    <div id="result" style="margin-top: 20px;"></div>
  `;

  const checkbox = document.getElementById("leaderboardCheckbox");
  const statusMsg = document.getElementById("leaderboardStatus");

  loadLeaderboardState().then(isOnBoard => {
    if (checkbox) checkbox.checked = isOnBoard;
  });

  document.getElementById("certForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailValue = document.getElementById("email").value;
    const container = document.getElementById("result");
    container.innerHTML = `<p style="font-weight:bold;">Certificate is being generated…</p>`;

    try {
      const res = await fetch(
        "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_noctae_cert",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailValue }),
        }
      );

      if (!res.ok) {
        container.innerHTML = `<p style="color:red;">Certificate not available or wrong email.</p>`;
        return;
      }

      const { url } = await res.json();
      container.innerHTML = `<iframe src="${url}" style="width:100%;height:600px;border:1px solid #ccc;margin-top:10px;" allowfullscreen></iframe>`;
    } catch (err) {
      container.innerHTML = `<p style="color:red;">An error occurred. Please try again later.</p>`;
      console.error(err);
    }
  });

  checkbox?.addEventListener("change", async () => {
    const wantLeaderboard = checkbox.checked;

    try {
      const r = await fetch(UPDATE_USER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          update: { leaderboard: wantLeaderboard }
        })
      });

      if (r.ok) {
        statusMsg.innerText = wantLeaderboard ? "Added to leaderboard!" : "Removed from leaderboard.";
      } else {
        statusMsg.innerText = "Failed. Try again.";
      }
    } catch {
      statusMsg.innerText = "Network error";
    }
  });

  document.getElementById("changeUsernameBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openUsernameModal();
  });
}

async function endGame() {
  await updateDB({ extraUpdate: { finished: true } });
  showFinalResults();
}

/* -------------------- Init -------------------- */

applyDarkMode();

(async function init() {
  await loadNorm();
  await loadUserProgress();
})();
