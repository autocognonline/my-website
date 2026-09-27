const UPDATE_USER_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user";
const GET_ANSWER_URL  = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_answer";
const GET_QUIZ_IMAGE_URL =  "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_quiz_image";
const TOTAL_ITEMS = 50;
const TOTAL_ATTEMPTS = 30;

const scoreEl       = document.getElementById("scoreEl");
const attemptsEl    = document.getElementById("attemptsEl");
const questionImg   = document.getElementById("questionImg");
const statusEl      = document.getElementById("status");
const answerInput   = document.getElementById("answerInput");
const submitBtn     = document.getElementById("submitBtn");
const prevBtn       = document.getElementById("prevBtn");
const nextBtn       = document.getElementById("nextBtn");
const darkModeBtn   = document.getElementById("darkModeBtn");
const finishBtn = document.getElementById("finishBtn");

let email = localStorage.getItem("email");

if (!email) {
  window.location.href = "login.html";
}

let password = sessionStorage.getItem("password");
if (!password) {
  window.location.href = "login.html";
}

let solved = [];
let attempts = TOTAL_ATTEMPTS;
let currentIndex = 0;
let normoCache = null;

const savedTheme = localStorage.getItem("darkMode");
if (savedTheme === "enabled") {
  document.body.classList.add("dark-mode");
  if (darkModeBtn) darkModeBtn.textContent = "Light Mode";
} else if (darkModeBtn) {
  darkModeBtn.textContent = "Dark Mode";
}

async function loadNormo() {
  try {
    const r = await fetch('https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/questions/normo.json');
    if (r.ok) normoCache = await r.json();
  } catch (e) {
    console.error("Could not load norm", e);
  }
}
loadNormo();

function normalizeClient(s) {
  if (s === undefined || s === null) return "";
  let t = String(s);
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");
  t = t.replace(/^[\s"']+|[\s"']+$/g, "");
  return t.toLowerCase().replace(/\s+/g, "");
}
function findNextUnsolved(start, forward = true) {
  let i = start;
  for (let step = 0; step < TOTAL_ITEMS; step++) {
    i = forward ? (i % TOTAL_ITEMS) + 1 : (i - 2 + TOTAL_ITEMS) % TOTAL_ITEMS + 1;
    if (!solved.includes(i)) return i;
  }
  return null;
}

async function loadUserProgress() {
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      console.error("loadUserProgress: failed", await res.text().catch(()=>""));
      statusEl.innerText = "Failed to load user data.";
      return;
    }

    const payload = await res.json().catch(()=>({}));
    const user = payload.user ?? payload;

    if (user?.finished === true) {
      solved = Array.isArray(user.solved_ids) ? user.solved_ids : [];
      attempts = user.attempts ?? attempts;
      updateTopBar();
      return showFinalResults();
    }

    solved = Array.isArray(user?.solved_ids) ? user.solved_ids : [];
    attempts = (user?.attempts ?? TOTAL_ATTEMPTS);
    updateTopBar();

    if (solved.length >= TOTAL_ITEMS || attempts <= 0) {
      await updateDB({ extraUpdate: { finished: true } });
      return showFinalResults();
    }

    loadNextQuestion();
  } catch (err) {
    console.error("loadUserProgress error:", err);
    statusEl.innerText = "Network error loading user.";
  }
}

function loadQuestionByIndex(index) {
  statusEl.innerText = "";
  currentIndex = index;

  const email = encodeURIComponent(localStorage.getItem("email") || "");
  const password = encodeURIComponent(sessionStorage.getItem("password") || "");

  questionImg.src =  `${GET_QUIZ_IMAGE_URL}?bucket=questions_items&index=${index}&email=${email}&password=${password}`;

  answerInput.focus();
}
function loadNextQuestion() {
  const next = findNextUnsolved(currentIndex, true);
  if (!next) return endGame();
  loadQuestionByIndex(next);
}

if (prevBtn) prevBtn.onclick = () => {
  const prev = findNextUnsolved(currentIndex, false);
  if (!prev) return endGame();
  loadQuestionByIndex(prev);
};
if (nextBtn) nextBtn.onclick = () => {
  const next = findNextUnsolved(currentIndex, true);
  if (!next) return endGame();
  loadQuestionByIndex(next);
};

async function updateDB({ extraUpdate = {}, decrementAttempt = false } = {}) {
  let iq = null;
  if (normoCache && solved.length > 0) {
    const maybe = normoCache[solved.length];
    if (!isNaN(maybe)) iq = Number(maybe);
  }

  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) return;

  const solvedNums = Array.isArray(solved)
    ? solved.map(x => Number.isFinite(Number(x)) ? Math.trunc(Number(x)) : x)
    : [];

  const base = {
    score: solvedNums.length,
    iq: iq !== null ? Number(iq) : null,
    ...extraUpdate
  };

  const updateObj = {
    ...(solvedNums.length > 0 ? { solved_ids: solvedNums } : {}),
    ...base
  };

  const payload = { email: cleanEmail, password, update: updateObj };
  if (decrementAttempt) payload.decrement_attempt = true;

  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("update_user failed:", res.status, body);
      statusEl && (statusEl.innerText = "Could not save progress (server).");
      return;
    }

    if (body?.user) {
      const u = body.user;
      solved = Array.isArray(u.solved_ids)
        ? u.solved_ids.map(x => Number.isFinite(Number(x)) ? Number(x) : x)
        : solved;
      attempts = u.attempts ?? attempts;
      updateTopBar();
    }
  } catch (err) {
    console.error("updateDB network error:", err);
    statusEl && (statusEl.innerText = "Network error saving progress.");
  }
}

if (submitBtn) submitBtn.onclick = async () => {
  const rawAns = answerInput.value;
  if (!rawAns || !rawAns.trim()) return;

  try {
    const res = await fetch(GET_ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, question: currentIndex, answer: rawAns })
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=>"");
      console.error("get_answer failed:", txt);
      statusEl.innerText = "Error checking answer";
      return;
    }

    const payload = await res.json().catch(()=>({}));
    const correct = payload?.correct === true;

    if (correct) {
      if (!solved.includes(currentIndex)) solved.push(currentIndex);
      await updateDB({ extraUpdate: {} });
      updateTopBar();
      statusEl.style.color = "#2a7a2a";
      statusEl.innerText = "Correct";
      answerInput.value = "";
      setTimeout(() => {
        statusEl.innerText = "";
        loadNextQuestion();
      }, 1000);
      return;
    }

    statusEl.style.color = "crimson";
    statusEl.innerText = "Incorrect";
    setTimeout(() => statusEl.innerText = "", 2000);

    await updateDB({ extraUpdate: {}, decrementAttempt: true });

    if (attempts <= 0) return endGame();

    answerInput.value = "";
  } catch (err) {
    console.error("Submit error:", err);
    statusEl.innerText = "Network/server error";
  }
};

function updateTopBar() {
  scoreEl.innerText = `Score: ${solved.length}`;
  attemptsEl.innerText = `Attempts left: ${attempts}`;
}

function showFinalResults() {
  const iq = normoCache?.[solved.length] ?? "N/A";
  document.querySelector(".container").innerHTML = `
    <h2>Test Completed</h2>
    <p><strong>Raw score:</strong> ${solved.length} / ${TOTAL_ITEMS}</p>
    <p><strong>Estimated IQ (Wechsler Scale):</strong> ${iq}</p>
   
    <form id="certForm" style="margin-top: 20px;">
      <button type="submit" class="button">Show Certificate</button>
    </form>

    <div id="result" style="margin-top: 20px;"></div>

  `;

  document.getElementById("certForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailField = document.getElementById("email").value;
    const container = document.getElementById("result");

    container.innerHTML = `<p style="font-weight:bold;">Certificate is being generated…</p>`;

    try {
      const res = await fetch(
        "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_certificate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailField }),
        }
      );

      if (!res.ok) {
        container.innerHTML = `<p style="color:red;">Certificate not available.</p>`;
        return;
      }

      const { url } = await res.json();
      container.innerHTML = `
        <iframe src="${url}" style="width:100%;height:600px;border:1px solid #ccc;margin-top:10px;" allowfullscreen></iframe>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color:red;">An error occurred. Please try again later.</p>`;
      console.error(err);
    }
  });

}

async function endGame() {
  attempts = 0;
  await updateDB({ extraUpdate: { finished: true } });
  showFinalResults();
}

finishBtn?.addEventListener("click", async () => {
  const ok = window.confirm(
    "Are you sure you want to finish the test?\nOnce submitted, you won't be able to continue working on it."
  );
  if (!ok) return;
  await updateDB({
    extraUpdate: { finished: true }
  });

  showFinalResults();
});

darkModeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
  darkModeBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
});

loadUserProgress();
