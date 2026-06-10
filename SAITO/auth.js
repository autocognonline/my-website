const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_saito";

const loginMsg = document.getElementById("loginMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const forgotPwdBtn = document.getElementById("forgotPwdBtn");

let email = "";

function looksLikeEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

function finishLogin(user) {
  if (!user) {
    loginMsg.innerText = "Login succeeded but user data missing.";
    loginBtn.disabled = false;
    return;
  }

  localStorage.setItem("email", email);
  localStorage.setItem("saito_user", JSON.stringify(user));
  location.replace("quiz.html");
}

async function login() {
  email = emailInput.value.trim();
  const password = passwordInput.value;

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const payload = await res.json();

    if (!res.ok || payload?.error) {
      if (payload?.clear_fields) {
        emailInput.value = "";
        passwordInput.value = "";
        forgotPwdBtn.classList.add("hidden");
      }

      loginMsg.innerText = payload?.error || "Login failed.";
      loginBtn.disabled = false;
      forgotPwdBtn.disabled = false;
      return;
    }

    if (payload.need_password) {
      passwordInput.classList.remove("hidden");
      forgotPwdBtn.classList.remove("hidden");
      passwordInput.value = "";

      loginMsg.innerText = payload.emailed
        ? "A password was sent to your email. Enter it above."
        : "Enter your password.";

      loginBtn.disabled = false;
      forgotPwdBtn.disabled = false;
      return;
    }

    finishLogin(payload.user);

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reset_password: true })
    });

    const payload = await res.json();

    if (!res.ok || payload?.error) {
      loginMsg.innerText = payload?.error || "Could not send new password.";
      loginBtn.disabled = false;
      forgotPwdBtn.disabled = false;
      return;
    }

    passwordInput.classList.remove("hidden");
    passwordInput.value = "";
    forgotPwdBtn.classList.remove("hidden");

    loginMsg.innerText = "A new password was sent to your email.";

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
  }

  loginBtn.disabled = false;
  forgotPwdBtn.disabled = false;
}

loginBtn.onclick = login;
forgotPwdBtn.onclick = resetPassword;
