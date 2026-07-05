const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_nocis";
const API_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/nocis_api";

const loginSection = document.getElementById("loginSection");
const instructionsSection = document.getElementById("instructionsSection");

const loginMsg = document.getElementById("loginMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

const startSpatial = document.getElementById("startSpatial");
const startNumerical = document.getElementById("startNumerical");
const startVerbal = document.getElementById("startVerbal");
const startAbstract = document.getElementById("startAbstract");
const startLogical = document.getElementById("startLogical");
const CERT_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_certificate_noais2";
const FULL_NORM_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/noais2_norm/norm.json";

let currentEmail = "";

const QUIZ_URLS = {
  spatial: "quiz_s.html",
  numerical: "quiz_n.html",
  verbal: "quiz_v.html",
  abstract: "quiz_a.html",
  logical: "quiz_l.html"
};

function hideAllQuizButtons() {
  startSpatial.classList.add("hidden");
  startNumerical.classList.add("hidden");
  startVerbal.classList.add("hidden");
  startAbstract.classList.add("hidden");
  startLogical.classList.add("hidden");
}

function showAllowedQuizButtons(permissions) {
  hideAllQuizButtons();

  if (!permissions) return;

  if (permissions.allowed_spatial) {
    startSpatial.classList.remove("hidden");
  }

  if (permissions.allowed_numerical) {
    startNumerical.classList.remove("hidden");
  }

  if (permissions.allowed_verbal) {
    startVerbal.classList.remove("hidden");
  }

  if (permissions.allowed_abstract) {
    startAbstract.classList.remove("hidden");
  }

  if (permissions.allowed_logical) {
    startLogical.classList.remove("hidden");
  }
}

function finishLogin(payload) {
  const permissions = payload.permissions;

  localStorage.setItem("email", currentEmail);
  localStorage.setItem("noais_email", currentEmail);
  sessionStorage.setItem("password", passwordInput.value.trim());
  localStorage.setItem("nocis_logged_in", "true");
  localStorage.setItem("nocis_permissions", JSON.stringify(permissions || {}));

  window.loggedEmail = currentEmail;

  loginSection.classList.add("hidden");
  instructionsSection.classList.remove("hidden");

  showAllowedQuizButtons(permissions);
  loadLeaderboardChoice();
  loadRawScore();
}

function restoreLogin() {
  const savedEmail = localStorage.getItem("email");
  const savedPassword = sessionStorage.getItem("password");
  const loggedIn = localStorage.getItem("nocis_logged_in") === "true";

  if (!savedEmail || !savedPassword || !loggedIn) return;

  currentEmail = savedEmail;
  window.loggedEmail = currentEmail;
  localStorage.setItem("noais_email", currentEmail);

  emailInput.value = savedEmail;
  passwordInput.value = savedPassword;

  let permissions = {};

  try {
    permissions = JSON.parse(localStorage.getItem("nocis_permissions") || "{}");
  } catch {
    permissions = {};
  }

  loginSection.classList.add("hidden");
  instructionsSection.classList.remove("hidden");

  showAllowedQuizButtons(permissions);
  loadLeaderboardChoice();
  loadRawScore();
}

async function loadRawScore() {
  const rawScoreEl = document.getElementById("rawScore");
  const iqScoreBox = document.getElementById("iqScoreBox");
  const iqScoreEl = document.getElementById("iqScore");

  if (!rawScoreEl) return;

  const password =
    sessionStorage.getItem("password") ||
    passwordInput.value.trim();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "get_user",
      email: currentEmail,
      password
    })
  });

  if (!res.ok) return;

  const payload = await res.json().catch(() => ({}));
  const user = payload.user ?? {};

  const rawScore = Number(user.score ?? 0);
  rawScoreEl.innerText = rawScore;

  if (!user.end) {
    iqScoreBox?.classList.add("hidden");
    return;
  }

  const normRes = await fetch(FULL_NORM_URL);

  if (!normRes.ok) return;

  const norm = await normRes.json();

  let iq = norm[String(rawScore)] ?? norm[rawScore] ?? "N/A";

  if (iq !== "N/A") {
    iq = Math.round(Number(iq));

    if (rawScore === 0) {
      iq += " or lower";
    }
  }

  iqScoreEl.innerText = iq;
  iqScoreBox?.classList.remove("hidden");
}

async function login() {
  currentEmail = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!currentEmail) {
    loginMsg.innerText = "Enter email.";
    return;
  }

  loginBtn.disabled = true;
  loginMsg.innerText = "Checking…";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: currentEmail,
        password: password || null
      })
    });

    const payload = await res.json();

    if (!res.ok || payload?.error) {
      loginMsg.innerText = payload?.error || "Login failed.";
      loginBtn.disabled = false;
      return;
    }

    if (payload.need_password) {
      passwordInput.classList.remove("hidden");
      passwordInput.focus();

      loginMsg.innerText = payload.emailed
        ? "A password was sent to your email. Enter it below."
        : "Enter your existing password.";

      loginBtn.innerText = "Continue";
      loginBtn.disabled = false;
      return;
    }

    if (payload.ok) {
      finishLogin(payload);
      return;
    }

    loginMsg.innerText = "Unexpected login response.";
    loginBtn.disabled = false;

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    loginBtn.disabled = false;
  }
}

loginBtn.onclick = login;

passwordInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    login();
  }
});

emailInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    login();
  }
});

function getLoggedEmail() {
  return window.loggedEmail || localStorage.getItem("noais_email") || document.getElementById("email")?.value?.trim();
}

async function generateCertificate() {
  const btn = document.getElementById("generateCertBtn");
  const status = document.getElementById("certStatus");
  const loggedEmail = getLoggedEmail();

  if (!loggedEmail) {
    status.style.color = "crimson";
    status.textContent = "Missing email. Please log in again.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Generating...";
  status.style.color = "#333";
  status.textContent = "Generating certificate...";

  try {
    const res = await fetch(CERT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loggedEmail })
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok || body.error) {
      status.style.color = "crimson";
      status.textContent = body.error || "Could not generate certificate.";
      btn.disabled = false;
      btn.textContent = "Generate Certificate";
      return;
    }

    status.style.color = "#2a7a2a";
    status.innerHTML = `
      Certificate generated successfully.<br>
      <a href="${body.url}" target="_blank" rel="noopener noreferrer">
        Open certificate PDF
      </a>
    `;

    btn.textContent = "Certificate Generated";
  } catch {
    status.style.color = "crimson";
    status.textContent = "Network error while generating certificate.";
    btn.disabled = false;
    btn.textContent = "Generate Certificate";
  }
}

document.getElementById("generateCertBtn")?.addEventListener("click", generateCertificate);


async function loadLeaderboardChoice() {
  const checkbox = document.getElementById("leaderboardCheckbox");
  
  if (!checkbox) return;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "update_user",
      email: currentEmail,
      password: sessionStorage.getItem("password") || passwordInput.value.trim(),
      subtest: "spatial"
    })
  });

  if (!res.ok) return;
  
  const payload = await res.json().catch(() => ({}));
  checkbox.checked = payload?.user?.leaderboard === true;
}

document.addEventListener("change", async event => {
  if (event.target?.id !== "leaderboardCheckbox") return;

  const status = document.getElementById("leaderboardStatus");
  const checked = event.target.checked;

  if (status) status.innerText = "Saving…";

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "update_user",
      email: currentEmail,
      password: passwordInput.value.trim(),
      subtest: "spatial",
      update: {
        leaderboard: checked
      }
    })
  });

  if (status) {
    status.innerText = res.ok ? "Saved." : "Could not save.";
  }
});

document.addEventListener("click", event => {
  const btn = event.target.closest(".tab-btn");
  if (!btn) return;

  const targetId = btn.dataset.tab;

  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b === btn);
  });

  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === targetId);
  });
});

restoreLogin();

startSpatial.onclick = () => location.href = QUIZ_URLS.spatial;
startNumerical.onclick = () => location.href = QUIZ_URLS.numerical;
startVerbal.onclick = () => location.href = QUIZ_URLS.verbal;
startAbstract.onclick = () => location.href = QUIZ_URLS.abstract;
startLogical.onclick = () => location.href = QUIZ_URLS.logical;
