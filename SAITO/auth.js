const LOGIN_URL =  "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_saito";
const loginMsg = document.getElementById("loginMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const forgotPwdBtn = document.getElementById("forgotPwdBtn");
const loginSection = document.getElementById("loginSection");
const instructionsSection =  document.getElementById("instructionsSection");
const startTestBtn = document.getElementById("startTestBtn");

let email = "";
let verifiedPassword = null;

let loginRequestInProgress = false;
let resetRequestInProgress = false;
let startRequestInProgress = false;

function looksLikeEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

function setMessage(message) {
  loginMsg.innerText = message;
}

function showPasswordField({ clear = false, focus = true } = {}) {
  if (clear) {
    passwordInput.value = "";
  }

  passwordInput.disabled = false;
  passwordInput.classList.remove("hidden");

  if (focus) {
    window.setTimeout(() => {
      passwordInput.focus();
    }, 0);
  }
}

function hidePasswordField({ clear = true } = {}) {
  if (clear) {
    passwordInput.value = "";
  }
  passwordInput.disabled = true;
  passwordInput.classList.add("hidden");
}

function clearVerifiedPassword() {
  verifiedPassword = null;
}

function resetLoginButtons() {
  loginBtn.disabled = false;
  forgotPwdBtn.disabled = false;
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Invalid JSON response:", text);

    throw new Error(
      `The server returned an invalid response (${response.status}).`
    );
  }
}

async function postLoginRequest(body) {
  const response = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await readJsonResponse(response);

  return {
    response,
    payload
  };
}

function finishLogin(user, showInstructions = false) {
  if (!user) {
    setMessage("Login succeeded but user data is missing.");
    loginBtn.disabled = false;
    return;
  }

  localStorage.setItem("email", email);
  localStorage.setItem("saito_user", JSON.stringify(user));

  if (showInstructions) {
    loginSection.classList.add("hidden");
    instructionsSection.classList.remove("hidden");
  } else {
    clearVerifiedPassword();
    passwordInput.value = "";
    location.replace("quiz.html");
  }
}

async function login() {
  if (loginRequestInProgress) {
    return;
  }

  const enteredEmail = emailInput.value.trim();

  const passwordFieldIsAvailable =
    !passwordInput.disabled &&
    !passwordInput.classList.contains("hidden");

  const enteredPassword = passwordFieldIsAvailable
    ? passwordInput.value
    : null;

  if (!enteredEmail) {
    setMessage("Enter email.");
    emailInput.focus();
    return;
  }

  if (!looksLikeEmail(enteredEmail)) {
    setMessage("Please enter a valid email address.");
    emailInput.focus();
    return;
  }

  if (
    passwordFieldIsAvailable &&
    !enteredPassword
  ) {
    setMessage("Enter your password.");
    passwordInput.focus();
    return;
  }

  email = enteredEmail;

  loginRequestInProgress = true;
  loginBtn.disabled = true;
  forgotPwdBtn.disabled = true;
  setMessage("Checking…");

  try {
    const { response, payload } = await postLoginRequest({
      email,
      password: enteredPassword
    });

    if (!response.ok || payload?.error) {
      clearVerifiedPassword();

      if (payload?.clear_fields) {
        email = "";
        emailInput.value = "";
        hidePasswordField({ clear: true });
        forgotPwdBtn.classList.add("hidden");
        emailInput.focus();
      }

      setMessage(payload?.error || "Login failed.");
      return;
    }

    if (payload.need_password) {
      clearVerifiedPassword();

      showPasswordField({
        clear: true,
        focus: true
      });

      if (payload.can_reset_password) {
        forgotPwdBtn.classList.remove("hidden");
      } else {
        forgotPwdBtn.classList.add("hidden");
      }

      setMessage(
        payload.emailed
          ? "A password was sent to your email. Enter it above."
          : "Enter your password."
      );

      return;
    }
    
    verifiedPassword =
      typeof enteredPassword === "string"
        ? enteredPassword
        : null;

    finishLogin(
      payload.user,
      payload.show_instructions === true
    );

  } catch (error) {
    console.error(error);

    if (
      error instanceof Error &&
      error.message.startsWith(
        "The server returned an invalid response"
      )
    ) {
      setMessage(error.message);
    } else {
      setMessage("Network error.");
    }
  } finally {
    loginRequestInProgress = false;
    resetLoginButtons();
  }
}

async function startTest() {
  if (startRequestInProgress) {
    return;
  }

  if (!email || !verifiedPassword) {
    clearVerifiedPassword();

    instructionsSection.classList.add("hidden");
    loginSection.classList.remove("hidden");

    showPasswordField({
      clear: true,
      focus: true
    });

    forgotPwdBtn.classList.remove("hidden");

    setMessage(
      "Your login session was lost. Enter your password again."
    );

    return;
  }

  startRequestInProgress = true;
  startTestBtn.disabled = true;
  setMessage("Starting test…");

  try {
    const { response, payload } = await postLoginRequest({
      email,
      password: verifiedPassword,
      start_test: true
    });

    if (!response.ok || payload?.error) {
      setMessage(payload?.error || "Could not start test.");

      if (response.status === 401 || response.status === 403) {
        clearVerifiedPassword();

        instructionsSection.classList.add("hidden");
        loginSection.classList.remove("hidden");

        showPasswordField({
          clear: true,
          focus: true
        });

        forgotPwdBtn.classList.remove("hidden");
      }

      return;
    }

    clearVerifiedPassword();
    passwordInput.value = "";

    localStorage.setItem(
      "saito_user",
      JSON.stringify(payload.user)
    );

    location.replace("quiz.html");

  } catch (error) {
    console.error(error);

    if (
      error instanceof Error &&
      error.message.startsWith(
        "The server returned an invalid response"
      )
    ) {
      setMessage(error.message);
    } else {
      setMessage("Network error.");
    }
  } finally {
    startRequestInProgress = false;
    startTestBtn.disabled = false;
  }
}

async function resetPassword() {
  if (resetRequestInProgress) {
    return;
  }

  const enteredEmail = emailInput.value.trim();

  if (!enteredEmail) {
    setMessage("Enter email.");
    emailInput.focus();
    return;
  }

  if (!looksLikeEmail(enteredEmail)) {
    setMessage("Please enter a valid email address.");
    emailInput.focus();
    return;
  }

  email = enteredEmail;
  clearVerifiedPassword();

  resetRequestInProgress = true;
  loginBtn.disabled = true;
  forgotPwdBtn.disabled = true;
  setMessage("Sending new password…");

  try {
    const { response, payload } = await postLoginRequest({
      email,
      reset_password: true
    });

    if (!response.ok || payload?.error) {
      setMessage(
        payload?.error ||
        "Could not send a new password."
      );

      return;
    }

    showPasswordField({
      clear: true,
      focus: true
    });

    forgotPwdBtn.classList.remove("hidden");

    setMessage(
      "A new password was sent to your email."
    );

  } catch (error) {
    console.error(error);

    if (
      error instanceof Error &&
      error.message.startsWith(
        "The server returned an invalid response"
      )
    ) {
      setMessage(error.message);
    } else {
      setMessage("Network error.");
    }
  } finally {
    resetRequestInProgress = false;
    resetLoginButtons();
  }
}

loginBtn.addEventListener("click", login);
forgotPwdBtn.addEventListener("click", resetPassword);
startTestBtn.addEventListener("click", startTest);

emailInput.addEventListener("input", () => {
  const currentEmail = emailInput.value.trim();

  if (email && currentEmail !== email) {
    clearVerifiedPassword();
  }
});

emailInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    login();
  }
});

passwordInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    login();
  }
});

window.addEventListener("pagehide", () => {
  clearVerifiedPassword();
  passwordInput.value = "";
});
