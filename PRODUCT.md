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
- Remaining pages (how it works, validation, impact, about): Read. Carried over after Home and Scan.

## Impact wall (2026-11-07)
The owner wants Impact to show as much village use as possible: more photos, drawn smaller, so the volume of field work reads at a glance. The school photo sits in the hero beside the numbers; the rest form a tight wall of numbered, captioned tiles that open in the photo viewer and pack themselves as photos are added. Only real field photos go on the wall: no dermatologist or hospital photos, and no repeats or crops of the same shot.

## Motion decision (2026-11-02)
The owner found the site flat and asked for livelier layout, backgrounds and animation with the same theme and copy. The motif comes from the product: the viewfinder corners of the logo mark and the scan line of the demo. Home's hero is the one authored moment (brackets lock onto the result screen, a line sweeps it, the sample readout lands); elsewhere photos uncover top to bottom, figures count up, rules draw in, and heroes and closing rows sit on graph paper that lights up under the pointer. Every effect has a reduced-motion path and nothing waits on an animation. Asset links carry `?v=N`; bump it when the CSS or JS changes so cached copies don't pair new pages with old styles.

## Layout decision (2026-11-01)
The owner asked for a shorter, photo-led site with much less about the AI. Home is the app (real screenshots), then the dermatologist consultations and the field work side by side, each led by its photos. The model is one section on How it works (`#model`), shown as the real training run; `model.html` only forwards there. Keep copy to a line or two per block, and keep the theme as it is.

## Redesign decision (2026-10-23)
Direction chosen with the owner: **clinical instrument**. The previous world (cream paper, Fraunces italic serif, teal and clay, soft cards) is an anti-reference. Kept: all copy and facts, the six-tone scale, the logo files, the page set, the scan state machine in `assets/js/scan.js`.
