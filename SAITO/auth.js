const LOGIN_URL =
  "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_saito";

const loginMsg = document.getElementById("loginMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const forgotPwdBtn = document.getElementById("forgotPwdBtn");
const loginSection = document.getElementById("loginSection");
const instructionsSection = document.getElementById("instructionsSection");
const startTestBtn = document.getElementById("startTestBtn");

let email = "";

function looksLikeEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

function showPasswordField() {
  passwordInput.value = "";
  passwordInput.disabled = false;
  passwordInput.classList.remove("hidden");
}

function hidePasswordField() {
  passwordInput.value = "";
  passwordInput.disabled = true;
  passwordInput.classList.add("hidden");
}

function finishLogin(user, showInstructions = false) {
  if (!user) {
    loginMsg.innerText = "Login succeeded but user data missing.";
    loginBtn.disabled = false;
    return;
  }

  localStorage.setItem("email", email);
  localStorage.setItem("saito_user", JSON.stringify(user));

  if (showInstructions) {
    loginSection.classList.add("hidden");
    instructionsSection.classList.remove("hidden");
  } else {
    location.replace("quiz.html");
  }
}

startTestBtn.onclick = async () => {
  const password = passwordInput.value;

  startTestBtn.disabled = true;
  loginMsg.innerText = "Starting test…";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        start_test: true
      })
    });

    const payload = await res.json();

    if (!res.ok || payload?.error) {
      loginMsg.innerText = payload?.error || "Could not start test.";
      startTestBtn.disabled = false;
      return;
    }

    localStorage.setItem("saito_user", JSON.stringify(payload.user));
    location.replace("quiz.html");

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    startTestBtn.disabled = false;
  }
};

async function login() {
  email = emailInput.value.trim();

  const password =
    passwordInput.disabled ||
    passwordInput.classList.contains("hidden")
      ? null
      : passwordInput.value;

  if (!email) {
    loginMsg.innerText = "Enter email.";
    return;
  }

  if (!looksLikeEmail(email)) {
    loginMsg.innerText = "Please enter a valid email address.";
    return;
  }

  loginBtn.disabled = true;
  forgotPwdBtn.disabled = true;
  loginMsg.innerText = "Checking…";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const payload = await res.json();

    if (!res.ok || payload?.error) {
      if (payload?.clear_fields) {
        emailInput.value = "";
        hidePasswordField();
        forgotPwdBtn.classList.add("hidden");
      }

      loginMsg.innerText = payload?.error || "Login failed.";
      loginBtn.disabled = false;
      forgotPwdBtn.disabled = false;
      return;
    }

    if (payload.need_password) {
      showPasswordField();

      if (payload.can_reset_password) {
        forgotPwdBtn.classList.remove("hidden");
      } else {
        forgotPwdBtn.classList.add("hidden");
      }

      loginMsg.innerText = payload.emailed
        ? "A password was sent to your email. Enter it above."
        : "Enter your password.";

      loginBtn.disabled = false;
      forgotPwdBtn.disabled = false;
      return;
    }

    finishLogin(payload.user, payload.show_instructions);

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    loginBtn.disabled = false;
    forgotPwdBtn.disabled = false;
  }
}

async function resetPassword() {
  email = emailInput.value.trim();

  if (!email) {
    loginMsg.innerText = "Enter email.";
    return;
  }

  if (!looksLikeEmail(email)) {
    loginMsg.innerText = "Please enter a valid email address.";
    return;
  }

  loginBtn.disabled = true;
  forgotPwdBtn.disabled = true;
  loginMsg.innerText = "Sending new password…";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        reset_password: true
      })
    });

    const payload = await res.json();

    if (!res.ok || payload?.error) {
      loginMsg.innerText =
        payload?.error || "Could not send new password.";

      loginBtn.disabled = false;
      forgotPwdBtn.disabled = false;
      return;
    }

    showPasswordField();
    forgotPwdBtn.classList.remove("hidden");

    loginMsg.innerText =
      "A new password was sent to your email.";

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
  }

  loginBtn.disabled = false;
  forgotPwdBtn.disabled = false;
}

loginBtn.onclick = login;
forgotPwdBtn.onclick = resetPassword;
