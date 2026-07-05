const API_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/nocis_api";

const SUBTEST = "numerical";
const TOTAL_ITEMS = 25;
const TOTAL_ATTEMPTS = 3;

const scoreEl = document.getElementById("scoreEl");
const attemptsEl = document.getElementById("attemptsEl");
const submitBtn = document.getElementById("submitBtn");
const gameSection = document.getElementById("gameSection");

let email = localStorage.getItem("email");
let password = sessionStorage.getItem("password");

if (!email || !password) {
  window.location.href = "login.html";
  throw new Error("Missing login data");
}

let solved = [];
let attempts = Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS);
let hasSubmittedOnce = false;
let finished = false;
let normoCache = null;

function answerForItem(id) {
  const single = document.getElementById(`ans${id}`);

  if (single) {
    return single.value.trim();
  }

  const parts = [];
  let k = 1;

  while (true) {
    const input = document.getElementById(`ans${id}.${k}`);
    if (!input) break;

    const value = input.value.trim();
    if (value) parts.push(value);

    k++;
  }

  return parts.join(",");
}

function itemRow(id) {
  const input =
    document.getElementById(`ans${id}`) ||
    document.getElementById(`ans${id}.1`);

  return input ? input.closest(".item-row") : null;
}

function setItemInputsDisabled(id, disabled) {
  const single = document.getElementById(`ans${id}`);

  if (single) {
    single.disabled = disabled;
    return;
  }

  let k = 1;

  while (true) {
    const input = document.getElementById(`ans${id}.${k}`);
    if (!input) break;

    input.disabled = disabled;
    k++;
  }
}

function clearItemInputs(id) {
  const single = document.getElementById(`ans${id}`);

  if (single) {
    single.value = "";
    return;
  }

  let k = 1;

  while (true) {
    const input = document.getElementById(`ans${id}.${k}`);
    if (!input) break;

    input.value = "";
    k++;
  }
}

function hideSolvedAndLockedItems() {
  for (let id = 1; id <= TOTAL_ITEMS; id++) {
    const row = itemRow(id);
    if (!row) continue;

    const isSolved = solved.includes(id);
    const left = attempts[id - 1] ?? 0;

    row.classList.toggle("solved", isSolved);
    row.classList.toggle("locked", !isSolved && left <= 0);

    setItemInputsDisabled(id, isSolved || left <= 0);
  }
}

async function loadNorm() {
  try {
    const r = await fetch('https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/noais2_norm/norm_numerical.json');
    if (r.ok) normoCache = await r.json();
  } catch {}
}

function noAvailableItems() {
  for (let id = 1; id <= TOTAL_ITEMS; id++) {
    if (!solved.includes(id) && Number(attempts[id - 1]) > 0) {
      return false;
    }
  }

  return true;
}

function updateTopBar() {
  scoreEl.textContent = `Raw score: ${solved.length} / ${TOTAL_ITEMS}`;

  const remainingAttempts = Math.max(
    0,
    ...attempts
      .filter((left, idx) => !solved.includes(idx + 1))
      .map(Number)
  );

  attemptsEl.textContent = `Attempts left: ${remainingAttempts}`;
}

function showBigPopup(message, isError = false) {
  let overlay = document.getElementById("bigPopupOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "bigPopupOverlay";
    overlay.className = "big-popup-overlay";

    const box = document.createElement("div");
    box.id = "bigPopupBox";
    box.className = "big-popup";

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  const box = document.getElementById("bigPopupBox");

  box.textContent = message;
  box.classList.toggle("error", isError);

  overlay.classList.add("show");

  setTimeout(() => {
    overlay.classList.remove("show");
  }, 1800);
}

function showFirstSubmitConfirm() {
  return new Promise(resolve => {
    let overlay = document.getElementById("firstSubmitConfirm");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "firstSubmitConfirm";
      overlay.className = "confirm-overlay";

      overlay.innerHTML = `
        <div class="confirm-box">
          <h2>Warning</h2>
          <p>
            After submitting, only unsolved items will remain available.
          </p>
          <div class="confirm-actions">
            <button id="confirmSubmitBtn" type="button">Submit</button>
            <button id="cancelSubmitBtn" type="button" class="secondary">Cancel</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
    }

    const confirmBtn = document.getElementById("confirmSubmitBtn");
    const cancelBtn = document.getElementById("cancelSubmitBtn");

    function cleanup(value) {
      overlay.classList.remove("show");
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(value);
    }

    confirmBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);

    overlay.classList.add("show");
  });
}

async function showFinalResults() {
  finished = true;
  await  loadNorm()

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
    <h2 style="text-align:center">Numerical Subtest Completed</h2>
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


async function updateDB({
  decrementAttempt = false,
  markSolvedQuestion = null,
  extraUpdate = {}
} = {}) {
  const payload = {
    action: "update_user",
    email,
    password,
    subtest: SUBTEST,
    update: {
      ...extraUpdate
    }
  };

  if (decrementAttempt) {
    payload.decrement_attempt = true;
    payload.question_index = markSolvedQuestion - 1;
  }

  if (Number.isInteger(markSolvedQuestion) && !decrementAttempt) {
    payload.mark_solved_question = markSolvedQuestion;
  }

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
    return body;
  }

  if (Array.isArray(body.solved_ids)) {
    solved = body.solved_ids.map(Number);
  }

  if (Array.isArray(body.attempts)) {
    attempts = body.attempts.map(Number);
  }

  hideSolvedAndLockedItems();
  updateTopBar();

  return body;
}

async function loadProgress() {
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
    console.error("loadProgress failed", await res.text().catch(() => ""));
    return;
  }

  const payload = await res.json().catch(() => ({}));
  const user = payload.user ?? payload;

  solved = Array.isArray(payload.solved_ids)
    ? payload.solved_ids.map(Number)
    : Array.isArray(user?.solved_ids_numerical)
      ? user.solved_ids_numerical.map(Number)
      : [];

  const globalAttempts = Number(user?.attempt_n ?? TOTAL_ATTEMPTS);

  attempts = Array(TOTAL_ITEMS).fill(
    Number.isFinite(globalAttempts) ? Math.max(0, globalAttempts) : TOTAL_ATTEMPTS
  );

  finished = Number(user?.attempt_n ?? TOTAL_ATTEMPTS) <= 0;

  hasSubmittedOnce = attempts.some(n => Number(n) < TOTAL_ATTEMPTS);

  hideSolvedAndLockedItems();
  updateTopBar();

  if (finished || noAvailableItems()) {
    showFinalResults();
  }
}

async function submitAll() {
  if (finished || submitBtn.disabled) return;

  submitBtn.disabled = true;

  try {
    if (!hasSubmittedOnce) {
      const ok = await showFirstSubmitConfirm();

      if (!ok) {
        submitBtn.disabled = false;
        return;
      }
    }

    showBigPopup("Scoring…");

    const answers = {};

    for (let id = 1; id <= TOTAL_ITEMS; id++) {
      if (solved.includes(id)) continue;
      if ((attempts[id - 1] ?? 0) <= 0) continue;

      answers[String(id)] = answerForItem(id);
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "submit_form",
        email,
        password,
        subtest: SUBTEST,
        answers
      })
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("submit_form failed:", body);
      showBigPopup("Submission failed.", true);
      submitBtn.disabled = false;
      return;
    }

    showBigPopup("Submitted.");

    setTimeout(() => {
      window.location.reload();
    }, 900);

  } catch (err) {
    console.error("Submit error:", err);
    showBigPopup("Submission failed.", true);
    submitBtn.disabled = false;
  }
}

submitBtn?.addEventListener("click", submitAll);


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

  await loadProgress();
})();