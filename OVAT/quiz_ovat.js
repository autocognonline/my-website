const GET_ANSWER_URL  = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_answer_ovat";

const TOTAL_ITEMS = 33;

const scoreEl    = document.getElementById("scoreEl");
const attemptsEl = document.getElementById("attemptsEl");
const statusEl   = document.getElementById("status");
const submitBtn  = document.getElementById("submitBtn");

let email = localStorage.getItem("email");
let password = sessionStorage.getItem("password");

if (!email || !password) {
  window.location.href = "login_ovat.html";
}

let solved = [];
let attempts = 3;
let finished = false;

function collectAnswers() {
  const answers = [];
  for (let i = 1; i <= TOTAL_ITEMS; i++) {
    const input = document.getElementById("ans" + i);
    if (input) {
      answers.push({
        id: i,
        answer: input.value
      });
    }
  }
  return answers;
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

  box.style.background = isError ? "#d93025" : "#0b5cff";

  overlay.classList.add("show");

  setTimeout(() => {
    overlay.classList.remove("show");
  }, 5000);
}

function hideSolvedItems() {
  solved.forEach(id => {
    const row = document.getElementById("ans" + id)?.closest(".item-row");
    if (row) row.style.display = "none";
  });
}

function updateTopBar(standardScore = null) {
  scoreEl.textContent = `Score: ${solved.length}`;
  attemptsEl.textContent = `Attempts left: ${attempts}`;
}

function endQuiz(standardScore, rawScore) {
  finished = true;
  document.querySelector(".container").innerHTML = `
    <h2 style="text-align:center">OVAT33 Completed</h2>
    <p style="text-align:center"><strong>Raw score:</strong> ${rawScore} / ${TOTAL_ITEMS}</p>
    <p style="text-align:center"><strong>Standard score (Wechsler Scale):</strong> ${standardScore}</p>

    <div class="section"; margin-top:20px;">
      <p>You can only see your NOAIS - Form 1 certificate if you have also completed NOFRAT !</p>
    </div>
    <form id="certForm" style="margin-top: 20px;">
      <label>Email:</label>
      <input type="email" id="email" value="${email}" readonly />
      <button type="submit" class="button" style="margin-top: 10px;">Show NOAIS - Form 1 Certificate</button>
    </form>

    <div id="result" style="margin-top: 20px;"></div>
  `;

  document.getElementById("certForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const container = document.getElementById("result");

    container.innerHTML = `<p style="font-weight:bold;">Certificate is being generated…</p>`;

    try {
      const res = await fetch(
        "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_certificate_noais",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
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

async function loadProgress() {
  try {
    const res = await fetch(GET_ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password,load: true })
    });

    if (!res.ok) return;

    const data = await res.json();

    solved = Array.isArray(data.solved_ids) ? data.solved_ids : [];
    attempts = data.attempts ?? 3;
    finished = data.finished ?? false;

    hideSolvedItems();
    updateTopBar(data.standard_score ?? null);

    if (finished || solved.length >= TOTAL_ITEMS) {
      endQuiz(data.standard_score ?? 0, data.score ?? solved.length);
    }

  } catch (err) {
    console.error("Load progress error:", err);
  }
}

async function submitAll() {
  if (finished) return;

  const payload = {
    email,
    password,
    answers: collectAnswers()
  };

  try {
    const res = await fetch(GET_ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error("Server error");
    }

    const data = await res.json();

    showBigPopup("Answers sent");

    solved = Array.isArray(data.solved_ids) ? data.solved_ids : solved;
    attempts = data.attempts ?? attempts;
    finished = data.finished ?? false;

    hideSolvedItems();
    updateTopBar(data.standard_score ?? null);

    if (finished || solved.length >= TOTAL_ITEMS) {
      endQuiz(data.standard_score ?? 0, data.score ?? solved.length);
      return;
    }

  } catch (err) {
    console.error("Submit error:", err);
    showBigPopup("Failed to send answers", true);
  }
}

if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    const ok = confirm(
      "Submit all answers?"
    );
    if (ok) submitAll();
  });
}
loadProgress();
updateTopBar();
