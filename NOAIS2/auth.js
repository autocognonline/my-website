const LOGIN_URL =  "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_nocis";
const API_URL =  "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/nocis_api";
const CERT_URL =  "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_certificate_noais2";
const FULL_NORM_URL =  "https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/noais2_norm/norm.json";
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

let currentEmail = "";

let passwordStage = false;
let loginInProgress = false;


const QUIZ_URLS = {
  spatial: "quiz_s.html",
  numerical: "quiz_n.html",
  verbal: "quiz_v.html",
  abstract: "quiz_a.html",
  logical: "quiz_l.html"
};

function clearVisiblePassword() {
  if (!passwordInput) return;

  passwordInput.value = "";
}

function lockPasswordField() {
  if (!passwordInput) return;

  passwordStage = false;
  passwordInput.value = "";
  passwordInput.classList.add("hidden");
  passwordInput.setAttribute("readonly", "readonly");
}

function unlockPasswordField() {
  if (!passwordInput) return;

  passwordStage = true;
  passwordInput.value = "";
  passwordInput.classList.remove("hidden");
  passwordInput.removeAttribute("readonly");

  requestAnimationFrame(() => {
    passwordInput.value = "";
    passwordInput.focus();
  });
}

function hideAllQuizButtons() {
  startSpatial?.classList.add("hidden");
  startNumerical?.classList.add("hidden");
  startVerbal?.classList.add("hidden");
  startAbstract?.classList.add("hidden");
  startLogical?.classList.add("hidden");
}

function showAllowedQuizButtons(permissions) {
  hideAllQuizButtons();

  if (!permissions) return;

  if (permissions.allowed_spatial) {
    startSpatial?.classList.remove("hidden");
  }

  if (permissions.allowed_numerical) {
    startNumerical?.classList.remove("hidden");
  }

  if (permissions.allowed_verbal) {
    startVerbal?.classList.remove("hidden");
  }

  if (permissions.allowed_abstract) {
    startAbstract?.classList.remove("hidden");
  }

  if (permissions.allowed_logical) {
    startLogical?.classList.remove("hidden");
  }
}
function finishLogin(payload, authenticatedPassword) {
  const permissions = payload.permissions || {};

  localStorage.setItem("email", currentEmail);
  localStorage.setItem("noais_email", currentEmail);
  localStorage.setItem("nocis_logged_in", "true");
  localStorage.setItem(
    "nocis_permissions",
    JSON.stringify(permissions)
  );

  /*
    Store the authenticated password for API requests during
    this browser-tab session, but do not display it again.
  */
  sessionStorage.setItem(
    "password",
    authenticatedPassword
  );

  window.loggedEmail = currentEmail;

  clearVisiblePassword();

  loginSection?.classList.add("hidden");
  instructionsSection?.classList.remove("hidden");

  showAllowedQuizButtons(permissions);

  loadLeaderboardChoice();
  loadRawScore();
}

function restoreLogin() {
  const savedEmail = localStorage.getItem("email");
  const savedPassword = sessionStorage.getItem("password");
  const loggedIn =
    localStorage.getItem("nocis_logged_in") === "true";

  clearVisiblePassword();

  if (!savedEmail || !savedPassword || !loggedIn) {
    lockPasswordField();
    return;
  }

  currentEmail = savedEmail;
  window.loggedEmail = currentEmail;

  localStorage.setItem("noais_email", currentEmail);

  emailInput.value = savedEmail;
  passwordInput.value = "";

  let permissions = {};

  try {
    permissions = JSON.parse(
      localStorage.getItem("nocis_permissions") || "{}"
    );
  } catch (error) {
    console.error(
      "Could not read saved permissions:",
      error
    );

    permissions = {};
  }

  loginSection?.classList.add("hidden");
  instructionsSection?.classList.remove("hidden");

  showAllowedQuizButtons(permissions);

  loadLeaderboardChoice();
  loadRawScore();
}

function getSessionPassword() {
  return (
    sessionStorage.getItem("password") ||
    passwordInput?.value.trim() ||
    ""
  );
}

async function loadRawScore() {
  const rawScoreEl = document.getElementById("rawScore");
  const iqScoreBox = document.getElementById("iqScoreBox");
  const iqScoreEl = document.getElementById("iqScore");

  if (!rawScoreEl || !currentEmail) return;

  const password = getSessionPassword();

  if (!password) return;

  try {
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

    if (!res.ok) {
      console.error(
        "Could not load user score:",
        res.status
      );
      return;
    }

    const payload = await res
      .json()
      .catch(() => ({}));

    const user = payload.user ?? {};

    const rawScore = Number(user.score ?? 0);

    rawScoreEl.innerText = String(rawScore);

    if (!user.end) {
      iqScoreBox?.classList.add("hidden");
      return;
    }

    const normRes = await fetch(FULL_NORM_URL);

    if (!normRes.ok) {
      console.error(
        "Could not load full norm:",
        normRes.status
      );
      return;
    }

    const norm = await normRes.json();

    let iq =
      norm[String(rawScore)] ??
      norm[rawScore] ??
      "N/A";

    if (iq !== "N/A") {
      iq = Math.round(Number(iq));

      if (rawScore === 0) {
        iq = `${iq} or lower`;
      }
    }

    if (iqScoreEl) {
      iqScoreEl.innerText = String(iq);
    }

    iqScoreBox?.classList.remove("hidden");

  } catch (error) {
    console.error(
      "Error while loading raw score:",
      error
    );
  }
}

async function login() {
  if (loginInProgress) return;

  currentEmail = emailInput.value.trim();

  const password = passwordStage
    ? passwordInput.value.trim()
    : "";

  if (!currentEmail) {
    loginMsg.innerText = "Enter email.";
    emailInput.focus();
    return;
  }

  if (passwordStage && !password) {
    loginMsg.innerText = "Enter your password.";
    passwordInput.focus();
    return;
  }

  loginInProgress = true;
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

        /*
          Send null during the initial email-only step.
        */
        password: passwordStage
          ? password
          : null
      })
    });

    const payload = await res
      .json()
      .catch(() => ({}));

    if (!res.ok || payload?.error) {
      loginMsg.innerText =
        payload?.error || "Login failed.";

      loginBtn.disabled = false;
      loginInProgress = false;
      return;
    }

    if (payload.need_password) {
      unlockPasswordField();

      loginMsg.innerText = payload.emailed
        ? "A password was sent to your email. Enter it below."
        : "Enter your existing password.";

      loginBtn.innerText = "Continue";
      loginBtn.disabled = false;
      loginInProgress = false;
      return;
    }

    if (payload.ok) {

      finishLogin(payload, password);
      loginInProgress = false;
      return;
    }

    loginMsg.innerText =
      "Unexpected login response.";

    loginBtn.disabled = false;
    loginInProgress = false;

  } catch (error) {
    console.error("Login error:", error);

    loginMsg.innerText = "Network error.";
    loginBtn.disabled = false;
    loginInProgress = false;
  }
}

loginBtn?.addEventListener("click", login);


passwordInput?.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      event.preventDefault();
      login();
    }
  }
);


emailInput?.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      event.preventDefault();
      login();
    }
  }
);

emailInput?.addEventListener("input", () => {
  if (!passwordStage) return;

  lockPasswordField();

  loginBtn.innerText = "Login";
  loginMsg.innerText = "";
});


window.addEventListener("pageshow", () => {
  clearVisiblePassword();
});


function getLoggedEmail() {
  return (
    window.loggedEmail ||
    localStorage.getItem("noais_email") ||
    document
      .getElementById("email")
      ?.value
      ?.trim() ||
    ""
  );
}


async function generateCertificate() {
  const btn =
    document.getElementById("generateCertBtn");

  const status =
    document.getElementById("certStatus");

  const loggedEmail = getLoggedEmail();

  if (!btn || !status) return;

  if (!loggedEmail) {
    status.style.color = "crimson";
    status.textContent =
      "Missing email. Please log in again.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Generating...";

  status.style.color = "#333";
  status.textContent =
    "Generating certificate...";

  try {
    const res = await fetch(CERT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: loggedEmail
      })
    });

    const body = await res
      .json()
      .catch(() => ({}));

    if (!res.ok || body.error) {
      status.style.color = "crimson";
      status.textContent =
        body.error ||
        "Could not generate certificate.";

      btn.disabled = false;
      btn.textContent =
        "Generate Certificate";

      return;
    }

    status.style.color = "#2a7a2a";

    status.innerHTML = `
      Certificate generated successfully.<br>
      <a
        href="${body.url}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open certificate PDF
      </a>
    `;

    btn.textContent =
      "Certificate Generated";

  } catch (error) {
    console.error(
      "Certificate generation error:",
      error
    );

    status.style.color = "crimson";
    status.textContent =
      "Network error while generating certificate.";

    btn.disabled = false;
    btn.textContent =
      "Generate Certificate";
  }
}


document
  .getElementById("generateCertBtn")
  ?.addEventListener(
    "click",
    generateCertificate
  );


async function loadLeaderboardChoice() {
  const checkbox =
    document.getElementById(
      "leaderboardCheckbox"
    );

  if (!checkbox || !currentEmail) return;

  const password = getSessionPassword();

  if (!password) return;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "update_user",
        email: currentEmail,
        password,
        subtest: "spatial"
      })
    });

    if (!res.ok) {
      console.error(
        "Could not load leaderboard choice:",
        res.status
      );
      return;
    }

    const payload = await res
      .json()
      .catch(() => ({}));

    checkbox.checked =
      payload?.user?.leaderboard === true;

  } catch (error) {
    console.error(
      "Error while loading leaderboard choice:",
      error
    );
  }
}


document.addEventListener(
  "change",
  async event => {
    if (
      event.target?.id !==
      "leaderboardCheckbox"
    ) {
      return;
    }

    const status =
      document.getElementById(
        "leaderboardStatus"
      );

    const checkbox = event.target;
    const checked = checkbox.checked;
    const password = getSessionPassword();

    if (!password) {
      checkbox.checked = !checked;

      if (status) {
        status.innerText =
          "Login information is missing.";
      }

      return;
    }

    if (status) {
      status.innerText = "Saving…";
    }

    checkbox.disabled = true;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          action: "update_user",
          email: currentEmail,
          password,
          subtest: "spatial",
          update: {
            leaderboard: checked
          }
        })
      });

      if (!res.ok) {
        checkbox.checked = !checked;
      }

      if (status) {
        status.innerText = res.ok
          ? "Saved."
          : "Could not save.";
      }

    } catch (error) {
      console.error(
        "Leaderboard save error:",
        error
      );

      checkbox.checked = !checked;

      if (status) {
        status.innerText =
          "Could not save.";
      }

    } finally {
      checkbox.disabled = false;
    }
  }
);

document.addEventListener(
  "click",
  event => {
    const btn =
      event.target.closest(".tab-btn");

    if (!btn) return;

    const targetId = btn.dataset.tab;

    document
      .querySelectorAll(".tab-btn")
      .forEach(tabButton => {
        tabButton.classList.toggle(
          "active",
          tabButton === btn
        );
      });

    document
      .querySelectorAll(".tab-panel")
      .forEach(panel => {
        panel.classList.toggle(
          "active",
          panel.id === targetId
        );
      });
  }
);

if (startSpatial) {
  startSpatial.onclick = () => {
    location.href = QUIZ_URLS.spatial;
  };
}

if (startNumerical) {
  startNumerical.onclick = () => {
    location.href = QUIZ_URLS.numerical;
  };
}

if (startVerbal) {
  startVerbal.onclick = () => {
    location.href = QUIZ_URLS.verbal;
  };
}

if (startAbstract) {
  startAbstract.onclick = () => {
    location.href = QUIZ_URLS.abstract;
  };
}

if (startLogical) {
  startLogical.onclick = () => {
    location.href = QUIZ_URLS.logical;
  };
}

clearVisiblePassword();
restoreLogin();
