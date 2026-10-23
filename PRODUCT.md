# EpivaScan: product context

## What it is
EpivaScan reads one photo of a skin concern and returns the conditions it most closely matches, each with a percentage. It runs as a phone app and in a browser. It is a screening aid in development, never a diagnosis. The AI model is not always connected; the site must say so plainly and show sample values only when labelled as samples.

## Who it is for
Primary visitor: the general public. Someone worried about a patch of skin, often on a phone, often with little access to a dermatologist. Secondary: community health workers and clinics who might use it on someone else's behalf. Funders and partners read the same pages but are not the design target.

## Voice
Plain, calm, specific. No fear, no hype, no medical jargon without a gloss. Say what the tool does and what it does not do. Percentages are "how closely the photo matches", not probability of disease.

## Non-negotiables
- Every result screen carries the "not a diagnosis, see a clinician" framing and an urgent-care line (painful, bleeding, spreading, changing fast).
- Photos stay in the browser in the demo; the privacy line stays visible next to the upload.
- Skin tones across the whole Fitzpatrick range are shown as a deliberate part of the identity, because the model is meant to work across them.
- Works on a low-end phone: fast, readable in daylight, large touch targets, no motion that blocks the task.

## Surfaces and modes
- Home (Persuade): explain the tool and get the visitor into the demo.
- Scan demo (Operate): add a photo, analyse, read results. Task first, brand in the details.
- Remaining pages (how it works, model, impact, about): Read. Carried over after Home and Scan.

## Redesign decision (2026-10-23)
Direction chosen with the owner: **clinical instrument**. The previous world (cream paper, Fraunces italic serif, teal and clay, soft cards) is an anti-reference. Kept: all copy and facts, the six-tone scale, the logo files, the page set, the scan state machine in `assets/js/scan.js`.
