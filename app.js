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

const attackModels = [
  { label: "Online login throttling", rate: 10 },
  { label: "Offline bcrypt-like hash", rate: 100_000 },
  { label: "Offline fast hash", rate: 10_000_000_000 },
  { label: "GPU cracking rig", rate: 1_000_000_000_000 }
];

const passwordInput = document.querySelector("#passwordInput");
const toggleVisibility = document.querySelector("#toggleVisibility");
const clearPassword = document.querySelector("#clearPassword");
const meterFill = document.querySelector("#meterFill");
const scoreLabel = document.querySelector("#scoreLabel");
const scoreText = document.querySelector("#scoreText");
const entropyText = document.querySelector("#entropyText");
const searchSpaceText = document.querySelector("#searchSpaceText");
const penaltyText = document.querySelector("#penaltyText");
const charsetText = document.querySelector("#charsetText");
const lengthText = document.querySelector("#lengthText");
const riskSummary = document.querySelector("#riskSummary");
const attackList = document.querySelector("#attackList");
const signalList = document.querySelector("#signalList");
const recommendationList = document.querySelector("#recommendationList");
const generatedPassword = document.querySelector("#generatedPassword");
const generatePassword = document.querySelector("#generatePassword");
const copyPassword = document.querySelector("#copyPassword");
const copyReport = document.querySelector("#copyReport");
const reportText = document.querySelector("#reportText");
const randomSample = document.querySelector("#randomSample");

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

document.querySelectorAll("[data-sample]").forEach((button) => {
  button.addEventListener("click", () => {
    passwordInput.value = button.dataset.sample;
    renderAnalysis(passwordInput.value);
    passwordInput.focus();
  });
});

randomSample.addEventListener("click", () => {
  const password = createStrongPassword(18);
  passwordInput.value = password;
  renderAnalysis(password);
  passwordInput.focus();
});

generatePassword.addEventListener("click", () => {
  const password = createStrongPassword(18);
  generatedPassword.value = password;
  passwordInput.value = password;
  renderAnalysis(password);
});

copyPassword.addEventListener("click", async () => {
  await copyText(generatedPassword.value, copyPassword, "Copy");
});

copyReport.addEventListener("click", async () => {
  await copyText(reportText.textContent, copyReport, "Copy");
});

function analyzePassword(password) {
  if (!password) {
    const emptyAttacks = attackModels.map((model) => ({
      label: model.label,
      rate: model.rate,
      time: "Instant"
    }));

    return {
      passwordLength: 0,
      score: 0,
      grade: "No password",
      entropy: 0,
      rawEntropy: 0,
      searchSpace: 0,
      penalty: 0,
      facts: {
        charsetCount: 0
      },
      findings: [
        {
          title: "Awaiting sample",
          status: "info",
          detail: "Enter a sample password or choose a demo scenario to start the analysis.",
          penalty: 0
        }
      ],
      attacks: emptyAttacks,
      recommendations: ["Enter a sample password or choose a demo scenario."],
      summary: "Type a sample password to generate an analysis."
    };
  }

  const facts = getPasswordFacts(password);
  const findings = buildFindings(password, facts);
  const penalty = findings.reduce((total, finding) => total + finding.penalty, 0);
  const rawEntropy = facts.poolSize > 0 ? password.length * Math.log2(facts.poolSize) : 0;
  const adjustedEntropy = Math.max(rawEntropy - penalty, 0);
  const score = calculateScore(password, facts, adjustedEntropy, penalty);
  const attacks = attackModels.map((model) => ({
    label: model.label,
    rate: model.rate,
    time: estimateCrackTime(adjustedEntropy, model.rate)
  }));

  return {
    passwordLength: password.length,
    score,
    grade: getStrengthLabel(score, password.length),
    entropy: Math.round(adjustedEntropy),
    rawEntropy: Math.round(rawEntropy),
    searchSpace: adjustedEntropy > 0 ? 2 ** Math.min(adjustedEntropy, 120) : 0,
    penalty,
    facts,
    findings,
    attacks,
    recommendations: buildRecommendations(password, facts, findings, score),
    summary: buildRiskSummary(password, score, findings, attacks)
  };
}

function getPasswordFacts(password) {
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const number = /[0-9]/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  const normalized = password.toLowerCase();
  const leetNormalized = normalizeLeetspeak(normalized);
  const strippedNormalized = normalized.replace(/[^a-z0-9]/g, "");
  const strippedLeetNormalized = normalizeLeetspeak(strippedNormalized);
  const charsetCount = [lower, upper, number, symbol].filter(Boolean).length;
  const poolSize = getPoolSize({ lower, upper, number, symbol });

  return {
    lower,
    upper,
    number,
    symbol,
    normalized,
    leetNormalized,
    strippedNormalized,
    strippedLeetNormalized,
    charsetCount,
    poolSize,
    hasCommonPassword: commonPasswords.has(normalized),
    hasCommonBase: commonPasswords.has(strippedNormalized),
    hasLeetCommonPassword: commonPasswords.has(leetNormalized) || commonPasswords.has(strippedLeetNormalized),
    hasKeyboardPattern: keyboardPatterns.some((pattern) => normalized.includes(pattern)),
    hasRepeat: /(.)\1{2,}/.test(password),
    hasYear: /(19|20)\d{2}/.test(password),
    hasSequence: hasSequentialRun(normalized),
    hasCommonSuffix: /(?:123|1234|202[0-9]|20[0-9]{2})$/.test(strippedNormalized),
    isOnlyLetters: /^[a-z]+$/i.test(password),
    isOnlyNumbers: /^\d+$/.test(password)
  };
}

function buildFindings(password, facts) {
  const findings = [];

  addFinding(findings, {
    title: "Length",
    status: password.length >= 14 ? "good" : password.length >= 10 ? "warn" : "bad",
    detail: password.length >= 14 ? "Strong length for a general-purpose password." : "Longer passwords resist brute-force guessing better.",
    penalty: password.length >= 14 ? 0 : password.length >= 10 ? 8 : 24
  });

  addFinding(findings, {
    title: "Character variety",
    status: facts.charsetCount >= 3 ? "good" : facts.charsetCount === 2 ? "warn" : "bad",
    detail: facts.charsetCount >= 3 ? "Uses a mix of character classes." : "Limited character variety narrows the guessing pool.",
    penalty: facts.charsetCount >= 3 ? 0 : facts.charsetCount === 2 ? 8 : 18
  });

  addFinding(findings, {
    title: "Dictionary risk",
    status: facts.hasCommonPassword || facts.hasCommonBase || facts.hasLeetCommonPassword ? "bad" : "good",
    detail: facts.hasCommonBase && !facts.hasCommonPassword
      ? "The base password is common after removing punctuation."
      : facts.hasLeetCommonPassword && !facts.hasCommonPassword
      ? "Leetspeak substitution still resembles a common password."
      : facts.hasCommonPassword
        ? "This appears in a small common-password list."
        : "No local common-password match detected.",
    penalty: facts.hasCommonPassword ? 40 : facts.hasCommonBase ? 34 : facts.hasLeetCommonPassword ? 28 : 0
  });

  addFinding(findings, {
    title: "Keyboard and sequence patterns",
    status: facts.hasKeyboardPattern || facts.hasSequence ? "bad" : "good",
    detail: facts.hasKeyboardPattern || facts.hasSequence ? "Attackers try sequences like qwerty, abcd, and 1234 early." : "No obvious keyboard sequence detected.",
    penalty: facts.hasKeyboardPattern || facts.hasSequence ? 18 : 0
  });

  addFinding(findings, {
    title: "Personal-date pattern",
    status: facts.hasYear ? "warn" : "good",
    detail: facts.hasYear ? "Years are common in human-created passwords." : "No obvious year pattern detected.",
    penalty: facts.hasYear ? 14 : 0
  });

  addFinding(findings, {
    title: "Repeated characters",
    status: facts.hasRepeat ? "warn" : "good",
    detail: facts.hasRepeat ? "Repeated characters reduce practical complexity." : "No triple repeated characters detected.",
    penalty: facts.hasRepeat ? 8 : 0
  });

  addFinding(findings, {
    title: "Predictable suffix",
    status: facts.hasCommonSuffix ? "warn" : "good",
    detail: facts.hasCommonSuffix ? "Common endings like 123 or a year are easy hybrid guesses." : "No common suffix pattern detected.",
    penalty: facts.hasCommonSuffix ? 12 : 0
  });

  addFinding(findings, {
    title: "Composition balance",
    status: facts.isOnlyLetters || facts.isOnlyNumbers ? "bad" : "good",
    detail: facts.isOnlyLetters || facts.isOnlyNumbers ? "Single-type passwords are easier to brute force." : "Password is not limited to only letters or only numbers.",
    penalty: facts.isOnlyLetters || facts.isOnlyNumbers ? 14 : 0
  });

  return findings;
}

function addFinding(findings, finding) {
  findings.push(finding);
}

function calculateScore(password, facts, adjustedEntropy, penalty) {
  if (!password) return 0;

  const entropyComponent = Math.min(adjustedEntropy, 80);
  const lengthComponent = Math.min(password.length * 1.6, 24);
  const varietyComponent = facts.charsetCount * 5;
  return clamp(Math.round(entropyComponent + lengthComponent + varietyComponent - penalty * 0.35), 0, 100);
}

function buildRecommendations(password, facts, findings, score) {
  if (!password) {
    return ["Enter a sample password or choose a demo scenario."];
  }

  const recommendations = [];
  const weakFindings = findings.filter((finding) => finding.status !== "good");

  if (password.length < 14) {
    recommendations.push("Use at least 14 characters or a 4-word passphrase.");
  }

  if (facts.charsetCount < 3) {
    recommendations.push("Add another character class, such as symbols or uppercase letters.");
  }

  if (facts.hasCommonPassword || facts.hasCommonBase || facts.hasLeetCommonPassword) {
    recommendations.push("Avoid common base words, even with symbols, years, or leetspeak substitutions.");
  }

  if (facts.hasKeyboardPattern || facts.hasSequence || facts.hasCommonSuffix) {
    recommendations.push("Remove predictable sequences and common endings.");
  }

  if (facts.hasYear) {
    recommendations.push("Do not use birthdays, graduation years, or current years.");
  }

  if (score >= 85 && weakFindings.length === 0) {
    recommendations.push("This sample is strong for the demo; use a password manager for real accounts.");
    recommendations.push("Enable MFA so password compromise is not the only control.");
  }

  return recommendations.slice(0, 5);
}

function buildRiskSummary(password, score, findings, attacks) {
  if (!password) {
    return "Type a sample password to generate an analysis.";
  }

  const severeCount = findings.filter((finding) => finding.status === "bad").length;
  const warningCount = findings.filter((finding) => finding.status === "warn").length;
  const fastHash = attacks.find((attack) => attack.label === "Offline fast hash");

  if (score < 45) {
    return `High risk: ${severeCount} major issue(s) detected. In an offline fast-hash scenario, the estimate is ${fastHash.time}.`;
  }

  if (score < 75) {
    return `Moderate risk: ${warningCount + severeCount} issue(s) detected. The password has some complexity, but predictable patterns still lower practical strength.`;
  }

  return "Lower risk: no major pattern issues dominate the analysis. For real accounts, pair strong unique passwords with MFA.";
}

function renderAnalysis(password) {
  const result = analyzePassword(password);
  const color = getStrengthColor(result.score, password.length);

  meterFill.style.width = `${result.score}%`;
  meterFill.style.background = color;
  scoreLabel.textContent = result.grade;
  scoreLabel.className = `score-pill ${getScoreClass(result.score, password.length)}`;
  scoreText.textContent = `Score: ${result.score} / 100`;
  entropyText.textContent = `Entropy: ${result.entropy} bits`;
  searchSpaceText.textContent = formatNumber(result.searchSpace);
  penaltyText.textContent = `${result.penalty} pts`;
  charsetText.textContent = `${result.facts.charsetCount} used`;
  lengthText.textContent = `${password.length} chars`;
  riskSummary.textContent = result.summary;

  renderAttacks(result.attacks);
  renderSignals(result.findings);
  renderRecommendations(result.recommendations);
  reportText.textContent = buildReport(result);
}

function renderAttacks(attacks) {
  attackList.innerHTML = "";
  attacks.forEach((attack) => {
    const row = document.createElement("div");
    row.className = "attack-row";
    row.innerHTML = `
      <span>${attack.label}</span>
      <strong>${attack.time}</strong>
    `;
    attackList.append(row);
  });
}

function renderSignals(findings) {
  signalList.innerHTML = "";
  findings.forEach((finding) => {
    const signal = document.createElement("div");
    signal.className = `signal ${finding.status}`;
    signal.innerHTML = `
      <span class="signal-dot"></span>
      <span>
        <span class="signal-title">${finding.title}</span>
        <p class="signal-detail">${finding.detail}</p>
      </span>
    `;
    signalList.append(signal);
  });
}

function renderRecommendations(recommendations) {
  recommendationList.innerHTML = "";
  recommendations.forEach((recommendation) => {
    const item = document.createElement("li");
    item.textContent = recommendation;
    recommendationList.append(item);
  });
}

function buildReport(result) {
  if (!result.passwordLength) {
    return "No analysis yet.";
  }

  const flagged = result.findings
    .filter((finding) => finding.status !== "good")
    .map((finding) => `- ${finding.title}: ${finding.detail}`)
    .join("\n") || "- No major pattern issues flagged.";

  const attackLines = result.attacks
    .map((attack) => `- ${attack.label}: ${attack.time}`)
    .join("\n");

  return [
    "Password Security Analyzer Report",
    `Score: ${result.score}/100 (${result.grade})`,
    `Adjusted entropy: ${result.entropy} bits`,
    `Length: ${result.passwordLength} characters`,
    "",
    "Attack estimates:",
    attackLines,
    "",
    "Flagged signals:",
    flagged,
    "",
    "Note: Report excludes the password value."
  ].join("\n");
}

function getPoolSize({ lower, upper, number, symbol }) {
  let size = 0;
  if (lower) size += 26;
  if (upper) size += 26;
  if (number) size += 10;
  if (symbol) size += 32;
  return size;
}

function normalizeLeetspeak(value) {
  return value
    .replaceAll("@", "a")
    .replaceAll("4", "a")
    .replaceAll("0", "o")
    .replaceAll("1", "i")
    .replaceAll("!", "i")
    .replaceAll("3", "e")
    .replaceAll("$", "s")
    .replaceAll("5", "s")
    .replaceAll("7", "t");
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

function estimateCrackTime(entropy, guessesPerSecond) {
  if (entropy <= 0) return "Instant";

  const seconds = 2 ** Math.min(entropy - 1, 120) / guessesPerSecond;
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

function formatNumber(value) {
  if (!value) return "0 guesses";
  if (value < 1_000) return `${Math.round(value)} guesses`;
  if (value < 1_000_000) return `${Math.round(value / 1_000)}K guesses`;
  if (value < 1_000_000_000) return `${Math.round(value / 1_000_000)}M guesses`;
  if (value < 1_000_000_000_000) return `${Math.round(value / 1_000_000_000)}B guesses`;
  return `${value.toExponential(2)} guesses`;
}

function getStrengthLabel(score, length) {
  if (!length) return "No password";
  if (score < 45) return "Weak";
  if (score < 75) return "Moderate";
  if (score < 90) return "Strong";
  return "Very strong";
}

function getStrengthColor(score, length) {
  if (!length) return "#b8c2cc";
  if (score < 45) return "#c54040";
  if (score < 75) return "#be7517";
  return "#11875d";
}

function getScoreClass(score, length) {
  if (!length) return "";
  if (score < 45) return "score-weak";
  if (score < 75) return "score-fair";
  return "score-strong";
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

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

async function copyText(text, button, originalLabel) {
  if (!text || text === "No analysis yet.") return;

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Select";
  }

  setTimeout(() => {
    button.textContent = originalLabel;
  }, 1200);
}

renderAnalysis("");
