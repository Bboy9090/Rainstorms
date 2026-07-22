# Rainstorms Fan-Favorite Vertical Slice

## Product promise

Rainstorms helps a parent and child turn a small idea into a coherent, joyful story while keeping age suitability, privacy, revisions, and export under clear human control.

## Current maturity

Rainstorms is an active prototype monorepo with an Expo/React Native frontend and FastAPI/Python backend. It contains useful generation, storage, and export foundations, but it has not yet earned a general production, child-safety, privacy, mobile-release, or complete-book claim.

The previous root commands used formatting tools under `lint` names. Formatting and verification are now separate contracts:

- formatting commands may rewrite files
- verification commands never intentionally rewrite source
- frontend and backend gates retain their own logs and outcomes

## Signature journey

The first fan-favorite vertical slice must prove:

1. A parent selects age range, reading level, privacy choices, and creation mode.
2. A child supplies an idea through a guided prompt.
3. The app creates a structured outline before full generation.
4. Parent and child review characters, tone, and safety choices.
5. The app generates a complete draft with consistent names and scenes.
6. One page can be revised without regenerating the whole book.
7. The project can be reopened and exported as a readable book package.

Issue [#34](https://github.com/Bboy9090/Rainstorms/issues/34) owns this journey.

## Foundation commands

Install the JavaScript workspace from the repository root:

```bash
npm ci
```

Verify the frontend without rewriting it:

```bash
npm run check:frontend
```

Install backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

Verify the backend without rewriting it:

```bash
npm run check:backend
```

Run formatters intentionally:

```bash
npm run format:js
npm run format:py
```

## Safety and privacy gates

Before release promotion, Rainstorms must document and test:

- parental consent and child-account boundaries
- personal information collected from parent and child
- model and image providers receiving content
- storage location, retention, export, and deletion
- unsafe-output handling and parent review
- age and reading-level limits
- provider outage and partial-generation recovery
- project ownership and sharing
- accessibility for children and caregivers

A cheerful interface does not replace these controls. Children remain users, not unbounded prompt inputs with smaller keyboards.

## Evidence limits

A passing foundation workflow proves only:

- locked JavaScript installation
- formatting checks
- Expo lint
- TypeScript checking
- web export
- Python dependency installation
- Black verification
- flake8
- current pytest suite

It does not prove mobile-store readiness, child safety, content quality, privacy compliance, continuity across generated pages, complete-book usability, or production deployment.

## Promotion rule

Rainstorms may be called polished when a new family can complete the signature journey without private guidance, recover from generation and network failures, preserve the project across sessions, understand how content is processed, and export the same sample book shown in public media.
