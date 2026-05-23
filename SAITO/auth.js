const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_saito";

const loginMsg = document.getElementById("loginMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

let email = "";

function emailDubiousScore(str) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return 999;
  }

  const local = str.split("@")[0].toLowerCase();
  const letters = local.replace(/[^a-z]/g, "");
  const digits = local.replace(/\D/g, "");

  let score = 0;

  if (letters.length < 3) score += 35;
  if (letters.length > 24) score += 20;

  if (!/[aeiou]/.test(letters)) score += 35;
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/.test(letters)) score += 30;

  if (/(.)\1{3,}/.test(letters)) score += 25;

  if (digits.length >= 5) score += 20;
  if (digits.length > letters.length) score += 35;

  const symbolCount = local.replace(/[a-z0-9]/g, "").length;
  if (symbolCount >= 3) score += 15;

  if (/^[a-z]{2,}([._-][a-z]{2,})+$/.test(local)) score -= 25; // john.smith
  if (/^[a-z]{3,}\d{0,4}$/.test(local)) score -= 15; // alice92

  return Math.max(0, score);
}

function looksLikeEmail(str) {
  return emailDubiousScore(str) < 70;
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
      }
    
      loginMsg.innerText = payload?.error || "Login failed.";
      loginBtn.disabled = false;
      return;
    }

    if (payload.need_password) {
      passwordInput.classList.remove("hidden");
      passwordInput.value = "";

      loginMsg.innerText = payload.emailed
        ? "A password was sent to your email. Enter it above."
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


