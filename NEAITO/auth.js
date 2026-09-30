const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_neaito";
const UPDATE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user_neaito";
const loginSection = document.getElementById("loginSection");
const instructionsSection = document.getElementById("instructionsSection");
const loginMsg = document.getElementById("loginMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const startTestBtn = document.getElementById("startTestBtn");
let email = "";
let password = sessionStorage.getItem("password") || "";

function showInstructions() {
  loginSection.classList.add("hidden");
  instructionsSection.classList.remove("hidden");
}

function finishLogin(user) {
  if (!user) {
    loginMsg.innerText = "Login succeeded but user data missing. Try again.";
    loginBtn.disabled = false;
    return;
  }

  if (user.start) {
    location.replace("quiz.html");
  } else {
    showInstructions();
  }
}

async function login() {
  email = emailInput.value.trim();
  const pw = passwordInput.value;

  if (!email) {
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
        email,
        password: pw
      })
    });

    const payload = await res.json();

    if (!res.ok || payload?.error) {
      loginMsg.innerText =
        payload?.error || "Login failed.";

      loginBtn.disabled = false;
      return;
    }
    if (payload.user === null) {
      await register();
      return;
    }
    if (payload.need_password) {
      passwordInput.type = "text";
      passwordInput.classList.remove("hidden");
      passwordInput.value = "";

      if (payload.emailed) {
        loginMsg.innerText =
          "A password has been sent to your email. Check your spam folder if necessary.";
      } else {
        loginMsg.innerText =
          "Enter your password.";
      }

      loginBtn.disabled = false;
      return;
    }

    password = pw;
    sessionStorage.setItem(
      "password",
      pw
    );

    localStorage.setItem(
      "email",
      email
    );

    finishLogin(payload.user);

  } catch (err) {
    console.error(err);

    loginMsg.innerText =
      "Network error.";

    loginBtn.disabled = false;
  }
}
async function register() {
  loginBtn.disabled = true;
  loginMsg.innerText =
    "Creating account…";
  try {
    const res = await fetch(UPDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        update: {}
      })
    });

    const payload =
      await res.json().catch(() => ({}));
    if (!res.ok || payload?.error) {
      loginMsg.innerText =
        payload?.error || "Failed to register.";

      loginBtn.disabled = false;
      return;
    }

    try {
      localStorage.setItem(
        "pwd_ack_" + email,
        "true"
      );
    } catch (e) {}

    localStorage.setItem(
      "email",
      email
    );
    loginMsg.innerText =
      "A password has been sent to your email. Check your spam folder if necessary.";
    passwordInput.type = "text";
    passwordInput.classList.remove("hidden");
    passwordInput.value = "";
    loginBtn.onclick = login;
    loginBtn.disabled = false;

  } catch (err) {
    console.error(err);

    loginMsg.innerText =
      "Network error.";

    loginBtn.disabled = false;
  }
}

startTestBtn?.addEventListener(
  "click",
  async () => {

    startTestBtn.disabled = true;
    startTestBtn.innerText = "Starting…";

    try {
      const pw =
        sessionStorage.getItem("password") ||
        password ||
        "";

      if (!email || !pw) {
        loginMsg.innerText =
          "Email and password required.";

        startTestBtn.disabled = false;
        startTestBtn.innerText =
          "Start Test";

        return;
      }

      const res = await fetch(UPDATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password: pw,
          update: {
            started: true
          }
        })
      });

      const payload =
        await res.json().catch(() => ({}));

      if (!res.ok || payload?.error) {
        loginMsg.innerText =
          payload?.error ||
          "Failed to start test.";

        startTestBtn.disabled = false;
        startTestBtn.innerText =
          "Start Test";

        return;
      }

      password = pw;

      sessionStorage.setItem(
        "password",
        pw
      );

      localStorage.setItem(
        "email",
        email
      );

      location.replace("quiz.html");

    } catch (err) {
      console.error(
        "Start Test error:",
        err
      );

      loginMsg.innerText =
        "Network error.";

      startTestBtn.disabled = false;
      startTestBtn.innerText =
        "Start Test";
    }
  }
);

loginBtn.onclick = login;
