# EpivaScan website

Static site for the EpivaScan app. No build step: open `index.html` in a browser, or serve the folder with `python -m http.server 5173` and visit http://localhost:5173.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Home |
| `how-it-works.html` | The four steps beside two app screens, and one short section on the model (`#model`) |
| `validation.html` | The dermatologist consultations: a large photo and three more for each, with a "+N photos" tile that opens all of them in the photo viewer |
| `impact.html` | Impact: the numbers beside the school photo, then a wall of numbered field photos that open in the photo viewer |
| `about.html` | Mission, principles, FAQ, contact (the team section is hidden until it has names and portraits) |
| `model.html` | Forwards to `how-it-works.html#model`, so old links keep working |
| `scan.html` | Web demo: add a photo, get the ranked list of conditions it resembles |

Shared styles are in `assets/css/styles.css`. The header, footer and placeholder logic are in `assets/js/site.js`. The demo flow is in `assets/js/scan.js`.

## The scan page and the model

The scan page does not run the model itself. It sends the photo to the EpivaScan Space, a small Gradio app in `ml/space/`, using [`@gradio/client`](https://www.npmjs.com/package/@gradio/client) (loaded from a CDN, so there is still no build step). The Space answers with a score for each condition and the page draws the result.

Which Space the page talks to:

| Where the site is opened | `modelSpace` in `site.js` | What happens |
| --- | --- | --- |
| Anywhere | Set, for example `user/epivascan` | Photos go to that Space on Hugging Face |
| This machine (`localhost`) or a phone on the same Wi-Fi | Empty | Photos go to the Space running on this machine, port 7860 |
| A public address | Empty | The page answers with built-in sample values, labelled "Test mode". Nothing is uploaded and no server is needed |

The published site uses [`CanoeBoat/epivascan`](https://huggingface.co/spaces/CanoeBoat/epivascan). It runs on ZeroGPU, the one kind of Gradio Space a free Hugging Face account can host (two at most; plain CPU Spaces need PRO, checked November 2026). Emptying `modelSpace` switches the page back to the rules above with no other change.

Until a trained model is plugged in, the Space runs in **mock mode**: it answers every photo with the same made-up numbers and flags its answer as a mock. The page then shows a "Test mode" notice before any upload and labels the result "Sample data". Both disappear by themselves once the Space has a real model. See `ml/space/README.md`.

To try the whole flow on this machine, start both servers from the project root and open http://localhost:5173/scan.html:

```powershell
powershell -ExecutionPolicy Bypass -File ml\setup_space_env.ps1   # once
ml\.venv-space\Scripts\python.exe ml\space\app.py                 # the Space, port 7860
python -m http.server 5173                                        # the site, in a second terminal
```

To try it on a phone, connect the phone to the same Wi-Fi, set `$env:GRADIO_SERVER_NAME = "0.0.0.0"` before starting the Space, and open `http://THIS-PC-ADDRESS:5173/scan.html` on the phone (`ipconfig` shows the address). Windows may ask whether to let Python through the firewall.

## Logo files

All in `assets/img/`. The wordmark is drawn as outlines (Fraunces), so it looks the same without the font installed.

| File | Use |
| --- | --- |
| `logo.svg`, `logo.png` | Mark with "EpivaScan" beside it, for light backgrounds (PNG is 1600 px wide, transparent) |
| `logo-on-dark.svg`, `logo-on-dark.png` | The same on dark backgrounds, in the footer's colours |
| `logo-v2.svg`, `logo-v2.png`, `logo-v2-on-dark.svg`, `logo-v2-on-dark.png` | The chosen logo: a ring of six skin tones around a clay dot, upright wordmark. Not yet used on the site, which still shows the first mark |
| `logo-mark.svg` | The first mark alone, still the browser-tab icon |

## Adding photos

Every dashed placeholder box shows the file it is waiting for. Save an image at that path and the box fills itself; no HTML edits needed. `.jpg`, `.jpeg`, `.png` and `.webp` all work.

| Folder | Files | Used on |
| --- | --- | --- |
| `assets/img/team/` | `01` to `03` | Portraits (About, once the team section is shown) |

These are plain images, linked straight from the HTML rather than through a placeholder box:

| File | Used on |
| --- | --- |
| `assets/img/app/home.png`, `results.png` | Home and How it works. Screenshots of the app at phone size (390 x 844 at 2x). The result is a saved scan with the built-in sample values and a heavily blurred eczema photo, so it is labelled "Sample data" |
| `assets/img/model/training-terminal.png` | How it works, `#model`. The first full training run (13 October 2026); its test numbers match `ml/runs/epivascan-skin/model/README.md` |
| `assets/img/validation/session-N-NN.jpg`, `-sm.jpg` | Validation (full size in the viewer, `-sm` as thumbnails) and Home. To change which photos are drawn, move links between the visible grid and the hidden list under it in `validation.html` |
| `assets/img/impact/NN.jpg`, `-sm.jpg` | Impact (full size in the viewer, `-sm` at 900 px on the long side on the page) and Home (`01`, `02`, `06`). `06` is the hero photo; the rest are tiles on the wall. To add a photo, save both sizes, copy a tile in `impact.html` and change its number, alt text and caption. `tile--tall` suits a portrait photo, `tile--big` a lead photo, and a plain tile a landscape one; the wall fills gaps by itself |

To caption a photo, add `data-caption="..."` to its `<figure>` in the HTML.

Until a file exists, the browser console logs a 404 for each empty box. That is expected.

## Wiring up real links

Edit the `CONFIG` block at the top of `assets/js/site.js`:

- `huggingFaceUrl`: enables the "View on Hugging Face" button
- `modelSpace`: the Hugging Face Space the scan page sends photos to, as `user/space-name`. Set to `CanoeBoat/epivascan`
- `phoneAppUrl`: enables "Get the phone app"
- `contactEmail`: turns the contact button on the About page into a mail link

Empty values show as "Soon".

## Still placeholder text

- Impact page numbers and their labels
- Team names and roles
- The example percentages (eczema 64% and so on) are sample values, labelled as such wherever they appear
- The numbers the Space answers with in mock mode (`MOCK_SCORES` in `ml/space/app.py`)
- The cut-offs the scan page uses to call a result "One clear leader" or "Several close together" (`CLEAR_SCORE` and `CLEAR_LEAD` in `assets/js/scan.js`). They are guesses until the trained model's accuracy is known
