const commonPasswords = new Set([
  "password",
  "password1",
  "password123",
  "123456",
  "12345678",
  "qwerty",
  "admin",
  "letmein",
  "welcome",
  "iloveyou",
  "abc123",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "summer2026",
  "winter2026",
  "spring2026",
  "fall2026"
]);

const keyboardPatterns = [
  "qwerty",
  "asdf",
  "zxcv",
  "1234",
  "abcd",
  "password",
  "admin",
  "welcome",
  "letmein"
];

const passwordInput = document.querySelector("#passwordInput");
const toggleVisibility = document.querySelector("#toggleVisibility");
const clearPassword = document.querySelector("#clearPassword");
const meterFill = document.querySelector("#meterFill");
const scoreLabel = document.querySelector("#scoreLabel");
const scoreText = document.querySelector("#scoreText");
const entropyText = document.querySelector("#entropyText");
const crackTimeText = document.querySelector("#crackTimeText");
const lengthText = document.querySelector("#lengthText");
const charsetText = document.querySelector("#charsetText");
const signalList = document.querySelector("#signalList");
const recommendationList = document.querySelector("#recommendationList");
const generatedPassword = document.querySelector("#generatedPassword");
const generatePassword = document.querySelector("#generatePassword");
const copyPassword = document.querySelector("#copyPassword");

passwordInput.addEventListener("input", () => {
  renderAnalysis(passwordInput.value);
});

toggleVisibility.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  toggleVisibility.textContent = isPassword ? "Hide" : "Show";
  passwordInput.focus();
});

clearPassword.addEventListener("click", () => {
  passwordInput.value = "";
  renderAnalysis("");
  passwordInput.focus();
});

generatePassword.addEventListener("click", () => {
  const password = createStrongPassword(18);
  generatedPassword.value = password;
  passwordInput.value = password;
  renderAnalysis(password);
});

copyPassword.addEventListener("click", async () => {
  if (!generatedPassword.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(generatedPassword.value);
    copyPassword.textContent = "Copied";
    setTimeout(() => {
      copyPassword.textContent = "Copy";
    }, 1200);
  } catch {
    generatedPassword.select();
    copyPassword.textContent = "Select";
  }
});

function analyzePassword(password) {
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const number = /[0-9]/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  const normalized = password.toLowerCase();
  const charsetCount = [lower, upper, number, symbol].filter(Boolean).length;
  const poolSize = getPoolSize({ lower, upper, number, symbol });
  const baseEntropy = password.length && poolSize ? password.length * Math.log2(poolSize) : 0;

  const hasCommonPassword = commonPasswords.has(normalized);
  const hasKeyboardPattern = keyboardPatterns.some((pattern) => normalized.includes(pattern));
  const hasRepeat = /(.)\1{2,}/.test(password);
  const hasDate = /(19|20)\d{2}/.test(password);
  const hasSequence = hasSequentialRun(normalized);

  let penalty = 0;
  if (hasCommonPassword) penalty += 45;
  if (hasKeyboardPattern) penalty += 20;
  if (hasRepeat) penalty += 12;
  if (hasDate) penalty += 10;
  if (hasSequence) penalty += 12;
  if (password.length < 8) penalty += 25;
  if (password.length < 12) penalty += 10;

  const varietyBonus = charsetCount * 4;
  const lengthBonus = Math.min(password.length * 2, 28);
  const entropyScore = Math.min(baseEntropy, 80);
  const score = clamp(Math.round(entropyScore + varietyBonus + lengthBonus - penalty), 0, 100);
  const adjustedEntropy = Math.max(baseEntropy - penalty, 0);

  return {
    score,
    entropy: Math.round(adjustedEntropy),
    charsetCount,
    checks: [
      {
        title: "Length",
        passed: password.length >= 12,
        detail: password.length >= 12 ? "Meets the 12 character target." : "Use at least 12 characters."
      },
      {
        title: "Character variety",
        passed: charsetCount >= 3,
        detail: charsetCount >= 3 ? "Uses multiple character sets." : "Mix uppercase, lowercase, numbers, and symbols."
      },
      {
        title: "Common password",
        passed: password.length > 0 && !hasCommonPassword,
        detail: hasCommonPassword ? "This appears in a small common-password list." : "Not found in the local common-password list."
      },
      {
        title: "Keyboard pattern",
        passed: !hasKeyboardPattern && !hasSequence,
        detail: hasKeyboardPattern || hasSequence ? "Avoid sequences such as qwerty, abcd, or 1234." : "No obvious keyboard sequence detected."
      },
      {
        title: "Repeated characters",
        passed: !hasRepeat,
        detail: hasRepeat ? "Repeated characters make guessing easier." : "No triple repeated characters detected."
      },
      {
        title: "Date pattern",
        passed: !hasDate,
        detail: hasDate ? "Years and dates are common guessing targets." : "No obvious year pattern detected."
      }
    ],
    recommendations: buildRecommendations({
      password,
      charsetCount,
      hasCommonPassword,
      hasKeyboardPattern,
      hasRepeat,
      hasDate,
      hasSequence
    })
  };
}

function renderAnalysis(password) {
  const result = analyzePassword(password);
  const label = getStrengthLabel(result.score, password.length);
  const color = getStrengthColor(result.score, password.length);

  meterFill.style.width = `${result.score}%`;
  meterFill.style.background = color;
  scoreLabel.textContent = label;
  scoreLabel.className = `score-pill ${getScoreClass(result.score, password.length)}`;
  scoreText.textContent = `Score: ${result.score} / 100`;
  entropyText.textContent = `Entropy: ${result.entropy} bits`;
  crackTimeText.textContent = estimateCrackTime(result.entropy);
  lengthText.textContent = `${password.length} chars`;
  charsetText.textContent = `${result.charsetCount} used`;

  signalList.innerHTML = "";
  result.checks.forEach((check) => {
    const signal = document.createElement("div");
    signal.className = `signal ${check.passed ? "good" : "bad"}`;
    signal.innerHTML = `
      <span class="signal-dot"></span>
      <span>
        <span class="signal-title">${check.title}</span>
        <p class="signal-detail">${check.detail}</p>
      </span>
    `;
    signalList.append(signal);
  });

  recommendationList.innerHTML = "";
  result.recommendations.forEach((recommendation) => {
    const item = document.createElement("li");
    item.textContent = recommendation;
    recommendationList.append(item);
  });
}

function getPoolSize({ lower, upper, number, symbol }) {
  let size = 0;
  if (lower) size += 26;
  if (upper) size += 26;
  if (number) size += 10;
  if (symbol) size += 32;
  return size;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function hasSequentialRun(value) {
  const sequences = ["abcdefghijklmnopqrstuvwxyz", "0123456789"];
  return sequences.some((sequence) => {
    for (let index = 0; index <= sequence.length - 4; index += 1) {
      const chunk = sequence.slice(index, index + 4);
      const reversed = chunk.split("").reverse().join("");
      if (value.includes(chunk) || value.includes(reversed)) {
        return true;
      }
    }
    return false;
  });
}

function buildRecommendations(details) {
  const recommendations = [];

  if (!details.password) {
    return ["Type a sample password to review its risk profile."];
  }

  if (details.password.length < 12) {
    recommendations.push("Increase the password to at least 12 characters.");
  }

  if (details.charsetCount < 3) {
    recommendations.push("Use at least three character types.");
  }

  if (details.hasCommonPassword) {
    recommendations.push("Avoid common words, names, and predictable phrases.");
  }

  if (details.hasKeyboardPattern || details.hasSequence) {
    recommendations.push("Remove keyboard patterns and simple sequences.");
  }

  if (details.hasRepeat) {
    recommendations.push("Replace repeated characters with less predictable characters.");
  }

  if (details.hasDate) {
    recommendations.push("Avoid years, birthdays, and other personal dates.");
  }

  if (!recommendations.length) {
    recommendations.push("This sample looks strong for a portfolio demo.");
    recommendations.push("Use a password manager for real accounts.");
  }

  return recommendations.slice(0, 4);
}

function getStrengthLabel(score, length) {
  if (!length) return "No password";
  if (score < 40) return "Weak";
  if (score < 70) return "Fair";
  if (score < 90) return "Strong";
  return "Very strong";
}

function getStrengthColor(score, length) {
  if (!length) return "#b8c2cc";
  if (score < 40) return "#c84646";
  if (score < 70) return "#c77a14";
  return "#178f65";
}

function getScoreClass(score, length) {
  if (!length) return "";
  if (score < 40) return "score-weak";
  if (score < 70) return "score-fair";
  return "score-strong";
}

function estimateCrackTime(entropy) {
  if (entropy <= 20) return "Instant";

  const guessesPerSecond = 10_000_000_000;
  const seconds = 2 ** Math.min(entropy, 120) / guessesPerSecond;
  return formatDuration(seconds);
}

function formatDuration(seconds) {
  if (seconds < 1) return "Instant";
  if (seconds < 60) return `${Math.round(seconds)} seconds`;

  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} minutes`;

  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} hours`;

  const days = hours / 24;
  if (days < 365) return `${Math.round(days)} days`;

  const years = days / 365;
  if (years < 100) return `${Math.round(years)} years`;
  if (years < 1000) return `${Math.round(years / 100) * 100} years`;
  return "Centuries";
}

function createStrongPassword(length) {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*?"
  ];
  const allCharacters = groups.join("");
  const password = groups.map((group) => randomCharacter(group));

  while (password.length < length) {
    password.push(randomCharacter(allCharacters));
  }

  return shuffle(password).join("");
}

function randomCharacter(characters) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return characters[array[0] % characters.length];
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const swapIndex = array[0] % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

renderAnalysis("");
