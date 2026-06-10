# Password Security Analyzer

A browser-based cybersecurity portfolio project that analyzes password strength, explains risky patterns, and estimates cracking risk across multiple attack models.

## Live Demo

After GitHub Pages is enabled, the live demo is available at:

```text
https://luzmysterious23-sketch.github.io/password-security-analyzer/
```

## What It Does

The analyzer runs entirely in the browser and updates as a sample password is entered. It does not send passwords over the network.

It evaluates:

- Password length
- Character set variety
- Estimated entropy
- Estimated search space
- Common-password matches
- Leetspeak-style substitutions
- Keyboard and sequence patterns
- Date and year patterns
- Repeated characters
- Predictable suffixes
- Offline and online attack-model estimates

## Demo Scenarios

Use the built-in demo buttons:

```text
Weak        password123
Patterned   Summer2026!
Passphrase  river-cobalt-lantern-94
Random      generated secure sample
```

The dashboard shows a score, risk summary, attack estimates, security findings, recommendations, and a sanitized report that excludes the password value.

## Features

- Live password risk score
- Entropy and search-space estimates
- Online and offline crack-time estimates
- Pattern detection for common human password habits
- Strong password generator
- Copyable sanitized report
- Responsive dashboard layout
- No backend required

## Tech Stack

- HTML
- CSS
- JavaScript

## Cybersecurity Concepts Demonstrated

- Password entropy
- Brute-force attack modeling
- Dictionary attack risk
- Hybrid guessing patterns
- Client-side privacy design
- Security-focused UX

## Important Security Note

This is an educational portfolio project. Users should not test real passwords in a public demo.
