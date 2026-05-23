const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_saito";

const loginMsg = document.getElementById("loginMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

let email = "";

function emailDubiousScore(str) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return 999;

  const local = str.split("@")[0].toLowerCase();
  const letters = local.replace(/[^a-z]/g, "");
  const digits = local.replace(/\D/g, "");

  let score = 0;

  const vowels = (letters.match(/[aeiou]/g) || []).length;
  const vowelRatio = letters.length ? vowels / letters.length : 0;
  const uniqueRatio = letters.length ? new Set(letters).size / letters.length : 0;

  if (letters.length < 3) score += 35;
  if (letters.length > 18) score += 15;

  if (vowelRatio < 0.25 || vowelRatio > 0.65) score += 20;
  if (uniqueRatio > 0.75 && letters.length >= 8) score += 20;

  if (/[bcdfghjklmnpqrstvwxyz]{4,}/.test(letters)) score += 25;
  if (/[aeiou]{4,}/.test(letters)) score += 20;

  if (/(fd|gf|dg|hf|fs|ahr|hfs|gfd|dahf|sahr)/.test(letters)) score += 35;

  if (/(.)\1{3,}/.test(letters)) score += 25;

  if (digits.length >= 5) score += 20;
  if (digits.length > letters.length) score += 35;

  const symbolCount = local.replace(/[a-z0-9]/g, "").length;
  if (symbolCount >= 3) score += 15;

  if (/^[a-z]{2,}([._-][a-z]{2,})+$/.test(local)) score -= 25;
  if (/^[a-z]{3,}\d{0,4}$/.test(local)) score -= 10;

  return Math.max(0, score);
}

function looksLikeEmail(str) {
  return emailDubiousScore(str) < 40;
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


