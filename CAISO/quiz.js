const CAISO_STATE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/caiso_state";
const GET_QUIZ_IMAGE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_quiz_image2";

const CAISO_ITEM_COUNT = 26;
const CAISO_FIRST_ID = 31;
const CAISO_LAST_ID = 56;
const TOTAL_ATTEMPTS = 3;

const SPATIAL_ITEMS = [35, 37, 44, 50, 55];
const TWO_ANSWERS = [47, 51, 54];

let testStart = null;
const MIN_LOST_ATTEMPTS_TO_FINISH = 5;
const MIN_TEST_DURATION_MS = 2 * 60 * 60 * 1000;

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

const CELL_SIZE = 40;

let spatialGrid = [];

function initSpatialGrid(rows, cols) {
  spatialGrid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  spatialCanvas.width = cols * CELL_SIZE;
  spatialCanvas.height = rows * CELL_SIZE;

  drawSpatialGrid();
}

function drawSpatialGrid() {
  const ctx = spatialCanvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    spatialCanvas.width,
    spatialCanvas.height
  );

  for (let r = 0; r < spatialGrid.length; r++) {
    for (let c = 0; c < spatialGrid[0].length; c++) {
      ctx.fillStyle = spatialGrid[r][c] ? "#000" : "#fff";
      ctx.fillRect(
        c * CELL_SIZE,
        r * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );
      ctx.strokeRect(
        c * CELL_SIZE,
        r * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );
    }
  }
}

function updateSpatialGridFromInputs() {
  let rows = Number(rowsInput.value);
  let cols = Number(colsInput.value);

  if (!Number.isFinite(rows)) rows = 2;
  if (!Number.isFinite(cols)) cols = 2;

  rows = Math.trunc(rows);
  cols = Math.trunc(cols);

  rows = Math.min(6, Math.max(2, rows));
  cols = Math.min(12, Math.max(2, cols));

  rowsInput.value = rows;
  colsInput.value = cols;

  initSpatialGrid(rows, cols);
}

rowsInput.addEventListener(
  "change",
  updateSpatialGridFromInputs
);

colsInput.addEventListener(
  "change",
  updateSpatialGridFromInputs
);

resetCanvasBtn.addEventListener(
  "click",
  () => updateSpatialGridFromInputs()
);

function toggleSpatialCellFromCoordinates(
  clientX,
  clientY
) {
  const rect = spatialCanvas.getBoundingClientRect();

  const x =
    (clientX - rect.left) *
    (spatialCanvas.width / rect.width);

  const y =
    (clientY - rect.top) *
    (spatialCanvas.height / rect.height);

  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;

  const cellW = spatialCanvas.width / cols;
  const cellH = spatialCanvas.height / rows;

  const c = Math.floor(x / cellW);
  const r = Math.floor(y / cellH);

  if (
    r >= 0 &&
    r < rows &&
    c >= 0 &&
    c < cols
  ) {
    spatialGrid[r][c] ^= 1;
    drawSpatialGrid();
  }
}

spatialCanvas.addEventListener(
  "contextmenu",
  e => {
    e.preventDefault();

    toggleSpatialCellFromCoordinates(
      e.clientX,
      e.clientY
    );
  }
);

let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

const TOUCH_MOVE_TOLERANCE = 10;

spatialCanvas.addEventListener(
  "touchstart",
  e => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchMoved = false;
  },
  { passive: true }
);

spatialCanvas.addEventListener(
  "touchmove",
  e => {
    if (
      e.touches.length !== 1
    ) {
      return;
    }

    const touch = e.touches[0];

    const dx =
      touch.clientX - touchStartX;

    const dy =
      touch.clientY - touchStartY;

    if (
      Math.sqrt(
        dx * dx +
        dy * dy
      ) > TOUCH_MOVE_TOLERANCE
    ) {
      touchMoved = true;
    }
  },
  { passive: true }
);

spatialCanvas.addEventListener(
  "touchend",
  e => {
    if (touchMoved) return;

    toggleSpatialCellFromCoordinates(
      touchStartX,
      touchStartY
    );
  },
  { passive: true }
);

spatialCanvas.addEventListener(
  "touchcancel",
  () => {
    touchMoved = true;
  },
  { passive: true }
);

function serializeSpatialAnswer() {
  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;

  const flat = spatialGrid
    .map(row => row.join(""))
    .join("");

  return `${cols}x${rows}:${flat}`;
}

function getLostAttempts() {
  const totalAttempts =
    CAISO_ITEM_COUNT * TOTAL_ATTEMPTS;

  const remainingAttempts =
    attempts.reduce(
      (sum, value) =>
        sum + Math.max(0, Number(value) || 0),
      0
    );

  return (
    totalAttempts -
    remainingAttempts
  );
}
function canManuallyFinish() {
  if (!testStart) {
    return false;
  }

  const startTime =
    new Date(testStart).getTime();

  if (!Number.isFinite(startTime)) {
    return false;
  }

  const enoughTime =
    Date.now() - startTime >=
    MIN_TEST_DURATION_MS;

  const enoughLostAttempts =
    getLostAttempts() >=
    MIN_LOST_ATTEMPTS_TO_FINISH;

  return (
    enoughTime &&
    enoughLostAttempts
  );
}

function updateFinishButton() {
  if (!finishBtn) return;

  finishBtn.style.display =
    canManuallyFinish()
      ? ""
      : "none";
}

function showStatusPopup(message, isCorrect) {
  const modal = document.getElementById("statusModal");
  const content = document.getElementById("statusContent");

  content.textContent = message;
  content.style.color = isCorrect
    ? "green"
    : "red";

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

let email = localStorage.getItem("email");
let password = sessionStorage.getItem("password");

if (!email || !password) {
  window.location.href = "login.html";
}


let solved = [];
let attempts = Array(CAISO_ITEM_COUNT).fill(
  TOTAL_ATTEMPTS
);

let currentIndex = CAISO_FIRST_ID;
let normoCache = null;

async function loadNorm() {
  try {
    const r = await fetch(
      "https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/caiso_norms/norm.json"
    );

    if (r.ok) {
      normoCache = await r.json();
    }
  } catch (e) {
    console.error(
      "Could not load norm",
      e
    );
  }
}

function normalizeClient(s) {
  if (
    s === undefined ||
    s === null
  ) {
    return "";
  }

  let t = String(s);

  t = t.replace(
    /[\u200B-\u200D\uFEFF]/g,
    ""
  );

  t = t.replace(
    /^[\s"']+|[\s"']+$/g,
    ""
  );

  return t
    .toLowerCase()
    .replace(/\s+/g, "");
}

function findNextUnsolved(
  start,
  forward = true
) {
  let current = start;

  for (
    let step = 0;
    step < CAISO_ITEM_COUNT;
    step++
  ) {
    if (forward) {
      current++;

      if (current > CAISO_LAST_ID) {
        current = CAISO_FIRST_ID;
      }
    } else {
      current--;

      if (current < CAISO_FIRST_ID) {
        current = CAISO_LAST_ID;
      }
    }
    const isSolved =
      solved.includes(current);

    const attemptIndex =
      current - CAISO_FIRST_ID;

    const remaining =
      attempts[attemptIndex] ??
      TOTAL_ATTEMPTS;

    if (
      !isSolved &&
      remaining > 0
    ) {
      return current;
    }
  }

  return null;
}


async function loadUserProgress() {
  try {
    const res = await fetch(
      CAISO_STATE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "progress",
          email,
          password
        })
      }
    );

    if (!res.ok) {
      console.error(
        "loadUserProgress failed:",
        await res.text().catch(() => "")
      );
      return;
    }

    const payload =
      await res.json().catch(() => ({}));

    const user = payload?.user;
    testStart = user?.start || null;
    

    solved =
      Array.isArray(user?.solved_ids)
        ? user.solved_ids
            .map(x => Number(x))
            .filter(
              x =>
                Number.isInteger(x) &&
                x >= 1 &&
                x <= CAISO_LAST_ID
            )
        : [];

    if (
      Array.isArray(user?.attempts) &&
      user.attempts.length ===
        CAISO_ITEM_COUNT
    ) {
      attempts =
        user.attempts.map(n =>
          Number.isFinite(Number(n))
            ? Math.max(
                0,
                Number(n)
              )
            : TOTAL_ATTEMPTS
        );
    } else {
      attempts =
        Array(CAISO_ITEM_COUNT).fill(
          TOTAL_ATTEMPTS
        );
    }

    updateTopBar();

    if (user?.finished === true) {
      return showFinalResults();
    }

    const firstAvailable =
      findNextUnsolved(
        CAISO_LAST_ID,
        true
      );

    if (!firstAvailable) {
      await finishTestOnServer(true);
      return showFinalResults();
    }

    loadQuestionByIndex(
      firstAvailable
    );
  } catch (err) {
    console.error(
      "loadUserProgress error:",
      err
    );
  }
}

function clearInputs() {
  const input1 =
    document.getElementById(
      "answerInput1"
    );

  const input2 =
    document.getElementById(
      "answerInput2"
    );

  if (input1) {
    input1.value = "";
  }

  if (input2) {
    input2.value = "";
  }
}

function loadQuestionByIndex(index) {
  if (
    index < CAISO_FIRST_ID ||
    index > CAISO_LAST_ID
  ) {
    return;
  }

  currentIndex = index;

  const storedEmail =
    encodeURIComponent(
      localStorage.getItem("email") || ""
    );

  const storedPassword =
    encodeURIComponent(
      sessionStorage.getItem("password") || ""
    );

  const imageIndex =
    index - CAISO_FIRST_ID + 1;

  questionImg.src = `${GET_QUIZ_IMAGE_URL}?bucket=caiso_questions_items&index=${imageIndex}&email=${storedEmail}&password=${storedPassword}`;

  const answerInput1 =
    document.getElementById(
      "answerInput1"
    );

  const answerInput2 =
    document.getElementById(
      "answerInput2"
    );

  if (
    SPATIAL_ITEMS.includes(index)
  ) {
    spatialContainer.classList.remove(
      "hidden"
    );

    answerInput1.style.display =
      "none";

    if (answerInput2) {
      answerInput2.style.display =
        "none";
    }

    updateSpatialGridFromInputs();
  } else {
    spatialContainer.classList.add(
      "hidden"
    );

    answerInput1.style.display =
      "block";

    if (
      TWO_ANSWERS.includes(index)
    ) {
      answerInput2.style.display =
        "block";

      answerInput1.placeholder =
        "Answer 1";

      answerInput2.placeholder =
        "Answer 2";
    } else {
      answerInput2.style.display =
        "none";

      answerInput1.placeholder =
        "Your answer…";
    }

    answerInput1.focus();
  }

  updateTopBar();
}

function loadNextQuestion() {
  const next =
    findNextUnsolved(
      currentIndex,
      true
    );

  if (!next) {
    return endGame();
  }

  loadQuestionByIndex(next);
}

if (prevBtn) {
  prevBtn.onclick = () => {
    const prev =
      findNextUnsolved(
        currentIndex,
        false
      );

    if (!prev) {
      return endGame();
    }

    loadQuestionByIndex(prev);
  };
}

if (nextBtn) {
  nextBtn.onclick = () => {
    const next =
      findNextUnsolved(
        currentIndex,
        true
      );

    if (!next) {
      return endGame();
    }

    loadQuestionByIndex(next);
  };
}

async function syncUserFromResponse(
  payload
) {
  const u = payload?.user;

  if (!u) return;

  if (
    Array.isArray(u.solved_ids)
  ) {
    solved =
      u.solved_ids
        .map(x => Number(x))
        .filter(
          x =>
            Number.isInteger(x) &&
            x >= 1 &&
            x <= CAISO_LAST_ID
        );
  }

  if (
    Array.isArray(u.attempts) &&
    u.attempts.length ===
      CAISO_ITEM_COUNT
  ) {
    attempts =
      u.attempts.map(n =>
        Number.isFinite(Number(n))
          ? Math.max(
              0,
              Number(n)
            )
          : 0
      );
  }

  updateTopBar();
}

async function finishTestOnServer(force = false) {
  const res = await fetch(
    CAISO_STATE_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "finish",
        email,
        password,
        force
      })
    }
  );

  const payload =
    await res.json().catch(() => ({}));

  if (
    !res.ok ||
    payload?.error
  ) {
    console.error(
      "finish failed:",
      payload?.error ||
        res.status
    );

    return payload;
  }

  await syncUserFromResponse(
    payload
  );

  return payload;
}

if (submitBtn) {
  submitBtn.onclick =
    async () => {
      let rawAns;

      if (
        SPATIAL_ITEMS.includes(
          currentIndex
        )
      ) {
        rawAns =
          serializeSpatialAnswer();
      } else {
        const input1 =
          document
            .getElementById(
              "answerInput1"
            )
            .value.trim();

        const input2El =
          document.getElementById(
            "answerInput2"
          );

        if (
          TWO_ANSWERS.includes(
            currentIndex
          )
        ) {
          const input2 =
            input2El.value.trim();

          if (
            !input1 ||
            !input2
          ) {
            return;
          }

          const sorted =
            [input1, input2]
              .map(v =>
                normalizeClient(v)
              )
              .sort();

          rawAns =
            sorted.join(",");
        } else {
          if (!input1) {
            return;
          }

          rawAns = input1;
        }
      }

      submitBtn.disabled = true;

      try {
        const res =
          await fetch(
            CAISO_STATE_URL,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body:
                JSON.stringify({
                  action:
                    "answer",
                  email,
                  password,
                  question:
                    currentIndex,
                  answer:
                    rawAns
                })
            }
          );

        const payload =
          await res.json().catch(
            () => ({})
          );

        if (!res.ok) {
          console.error(
            "answer failed:",
            payload?.error ||
              res.status
          );

          submitBtn.disabled =
            false;

          return;
        }

        await syncUserFromResponse(
          payload
        );

        if (payload?.blocked === true) {
          sessionStorage.removeItem("password");
          localStorage.removeItem("email");

          alert(
            "Access to CAISO has been blocked."
          );

          window.location.href =
            "login.html";

          return;
        }

        const correct =
          payload?.correct === true;

        if (correct) {
          showStatusPopup(
            "Correct!",
            true
          );

          clearInputs();

          setTimeout(() => {
            submitBtn.disabled = false;
            loadNextQuestion();
          }, 1000);

          return;
        }

        showStatusPopup(
          "Incorrect!",
          false
        );

        const attemptIndex =
          currentIndex -
          CAISO_FIRST_ID;

        const remaining =
          attempts[
            attemptIndex
          ] ?? 0;

        if (remaining <= 0) {
          const next =
            findNextUnsolved(
              currentIndex,
              true
            );

          if (!next) {
            return endGame();
          }

          submitBtn.disabled = false;
          loadQuestionByIndex(
            next
          );

          return;
        }

        clearInputs();
        updateTopBar();

        submitBtn.disabled =
          false;
      } catch (err) {
        console.error(
          "Submit error:",
          err
        );

        submitBtn.disabled =
          false;
      }
    };
}
function updateTopBar() {
  updateFinishButton();
  scoreEl.innerText =
    `Score: ${solved.length}`;

  let remaining = "";

  if (
    currentIndex >=
      CAISO_FIRST_ID &&
    currentIndex <=
      CAISO_LAST_ID
  ) {
    const attemptIndex =
      currentIndex -
      CAISO_FIRST_ID;

    remaining =
      attempts[
        attemptIndex
      ] ?? 0;

    attemptsEl.innerText =
      `Attempts left: ${remaining}`;
  } else {
    attemptsEl.innerText =
      "Attempts left: -";
  }
  updateFinishButton();
}

function showFinalResults() {
  const rawScore =
    solved.length;

  let iq =
    normoCache?.[rawScore] ??
    "N/A";

  if (rawScore === 0) {
    iq = `${iq} or lower`;
  } else if (
    rawScore === 56
  ) {
    iq = `${iq} or higher`;
  }

  document.querySelector(
    ".container"
  ).innerHTML = `
    <h2>Test Completed</h2>
    <p><strong>Raw score:</strong> ${rawScore} / 56</p>
    <p><strong>Estimated IQ (Wechsler Scale):</strong> ${iq}</p>
    <form id="certForm" style="margin-top: 20px;">
      <button type="submit" class="button">Show Certificate</button>
    </form>
    <div id="result" style="margin-top: 20px;"></div>
  `;

  document
    .getElementById("certForm")
    .addEventListener(
      "submit",
      async e => {
        e.preventDefault();

        const email =
          document.getElementById(
            "email"
          ).value;

        const container =
          document.getElementById(
            "result"
          );

        container.innerHTML =
          `<p style="font-weight:bold;">Certificate is being generated…</p>`;

        try {
          const res =
            await fetch(
              "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_caiso_cert",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json"
                },
                body:
                  JSON.stringify({
                    email
                  })
              }
            );

          if (!res.ok) {
            container.innerHTML =
              `<p style="color:red;">Certificate not available or wrong email.</p>`;

            return;
          }

          const { url } =
            await res.json();

          container.innerHTML =
            `<iframe src="${url}" style="width:100%;height:600px;border:1px solid #ccc;margin-top:10px;" allowfullscreen></iframe>`;
        } catch (err) {
          container.innerHTML =
            `<p style="color:red;">An error occurred. Please try again later.</p>`;

          console.error(err);
        }
      }
    );
}

async function endGame() {
  await finishTestOnServer();
  showFinalResults();
}

finishBtn?.addEventListener(
  "click",
  async () => {
    const ok =
      window.confirm(
        "Are you sure you want to finish the test?"
      );

    if (!ok) return;

    const payload =
      await finishTestOnServer(false);

    if (payload?.ok) {
      showFinalResults();
    } else if (payload?.error) {
      alert(payload.error);
      updateFinishButton();
    }
  }
);

setInterval(  updateFinishButton,  600 * 1000);

(async () => {
  await loadNorm();
  await loadUserProgress();
})();
