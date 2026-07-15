const API_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/nocis_api";
const ASSET_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/nocis_asset";

const SUBTEST = "abstract";
const TOTAL_ITEMS = 20;
const TOTAL_ATTEMPTS = 3;

const MULTI_ANSWER_ITEMS = {
  14: 2
};

const scoreEl = document.getElementById("scoreEl");
const attemptsEl = document.getElementById("attemptsEl");
const questionImg = document.getElementById("questionImg");
const answerFields = document.getElementById("answerFields");
const submitBtn = document.getElementById("submitBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const finishBtn = document.getElementById("finishBtn");
const gameSection = document.getElementById("gameSection");

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


function answerFieldCount(itemId) {
  return MULTI_ANSWER_ITEMS[itemId] || 1;
}

async function loadNorm() {
  try {
    const r = await fetch('https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/noais2_norm/norm_abstract.json');
    if (r.ok) normoCache = await r.json();
  } catch {}
}

function renderAnswerFields(itemId) {
  const count = answerFieldCount(itemId);

  answerFields.innerHTML = "";

  for (let i = 1; i <= count; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.id = `answerInput${i}`;
    input.placeholder = count === 1 ? "Your answer" : `Answer ${i}`;
    answerFields.appendChild(input);
  }

  document.getElementById("answerInput1")?.focus();
}

function getCurrentAnswer() {
  const count = answerFieldCount(currentIndex);
  const parts = [];

  for (let i = 1; i <= count; i++) {
    const value = document.getElementById(`answerInput${i}`)?.value.trim() || "";
    if (value) parts.push(value);
  }

  return parts.join(",");
}

function showStatusPopup(message, isCorrect) {
  const modal = document.getElementById("statusModal");
  const content = document.getElementById("statusContent");

  if (!modal || !content) return;

  content.textContent = message;
  content.style.color = isCorrect ? "green" : "red";

  modal.classList.remove("hidden");

  setTimeout(() => modal.classList.add("show"), 10);

  setTimeout(() => {
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), 200);
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
  renderAnswerFields(index);
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
    payload.question_index = currentIndex - 1;
  }

  if (Number.isInteger(markSolvedQuestion)) {
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
  
    showStatusPopup(
      body?.error || "Unable to finish the quiz.",
      false
    );
  
    return {
      ok: false,
      error: body?.error || "Update failed"
    };
  }

  if (Array.isArray(body.solved_ids)) {
    solved = body.solved_ids.map(Number);
  }

  if (Array.isArray(body.attempts)) {
    attempts = body.attempts.map(Number);
  }

  updateTopBar();

  return body;
}

async function loadUserProgress() {
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
    : Array.isArray(user?.solved_ids_abstract)
      ? user.solved_ids_abstract.map(Number)
      : [];

  attempts = Array.isArray(payload.attempts)
    ? payload.attempts.map(Number)
    : Array.isArray(user?.attempts_a)
      ? user.attempts_a.map(Number)
      : Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS);

  updateTopBar();

  if (user?.finished_a === true) {
    return showFinalResults();
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
}

submitBtn.onclick = async () => {
  const rawAns = getCurrentAnswer();

  if (!rawAns) {
    showStatusPopup("Please enter an answer.", false);
    return;
  }

  submitBtn.disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "get_answer",
        email,
        password,
        subtest: SUBTEST,
        question: currentIndex,
        answer: rawAns
      })
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("get_answer failed:", payload);
      await loadUserProgress();
      submitBtn.disabled = false;
      return;
    }

    if (payload.correct === true) {
      await updateDB({
        markSolvedQuestion: currentIndex
      });

      showStatusPopup("Correct.", true);

      setTimeout(async () => {
        submitBtn.disabled = false;
        await loadNextQuestion();
      }, 1000);

      return;
    }

    await updateDB({
      decrementAttempt: true
    });

    showStatusPopup("Incorrect.", false);

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

    renderAnswerFields(currentIndex);
    updateTopBar();
    submitBtn.disabled = false;

  } catch (err) {
    console.error("Submit error:", err);
    showStatusPopup("Submission failed.", false);
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
    <h2 style="text-align:center">Abstract Subtest Completed</h2>
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

  if (!result?.ok || result.user?.finished_a !== true) {
    return;
  }

  showFinalResults();
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

finishBtn?.addEventListener("click", openEndTestModal);

confirmEndBtn?.addEventListener("click", async () => {
  closeEndTestModal();
  await endGame();
});

cancelEndBtn?.addEventListener("click", closeEndTestModal);

endTestModal?.addEventListener("click", e => {
  const box = endTestModal.querySelector(".modal-box");

  if (box && !box.contains(e.target)) {
    closeEndTestModal();
  }
});

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
