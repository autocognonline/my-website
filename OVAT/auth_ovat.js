const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_ovat";
const loginMsg     = document.getElementById("loginMsg");
const emailInput   = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn      = document.getElementById("loginBtn");

let email = "";
let password = ""; // keep password in scope so finishLogin can use it

function finishLogin(user) {
  if (!user) {
    loginMsg.innerText = "Login succeeded but user data missing.";
    loginBtn.disabled = false;
    return;
  }
  localStorage.setItem("email", email);
  // SECURITY: storing plaintext passwords is risky. Consider using a session token instead.
  sessionStorage.setItem("password", password || "");
  location.replace("quiz_ovat.html");
}

async function login() {
  email = emailInput.value.trim();
  const pwRaw = passwordInput.value;
  // send null when empty to let backend know no password was provided this request
  const pwToSend = pwRaw && pwRaw.length ? pwRaw : null;

  // save for finishLogin (but avoid storing long-term)
  password = pwToSend;

  if (!email) {
    loginMsg.innerText = "Enter email.";
    return;
  }
  loginBtn.disabled = true;
  loginMsg.innerText = "Checking…";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pwToSend })
    });
    const payload = await res.json();
    if (!res.ok || payload?.error) {
      loginMsg.innerText = payload?.error || "Login failed.";
      loginBtn.disabled = false;
      return;
    }
    if (payload.need_password) {
      // make sure password is masked
      passwordInput.type = "password";
      passwordInput.classList.remove("hidden");
      passwordInput.value = "";

      loginMsg.innerText =
        payload.emailed
          ? "A password was sent to your email. Enter it below."
          : "Enter your password.";

      loginBtn.disabled = false;
      return;
    }
    finishLogin(payload.user);
  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    loginBtn.disabled = false;
  }
}

loginBtn.onclick = login;
