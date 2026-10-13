# EpivaScan website

Static site for the EpivaScan app. No build step: open `index.html` in a browser, or serve the folder with `python -m http.server 5173` and visit http://localhost:5173.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Home |
| `how-it-works.html` | The four steps, how to read the percentages, photo tips, limits |
| `model.html` | The AI model: pipeline, model card, conditions, what will be published |
| `impact.html` | Impact: numbers, field photos, stories (mostly empty for now) |
| `about.html` | Mission, principles, team, FAQ, contact |
| `scan.html` | Web demo: add a photo, get the ranked list of conditions it resembles |

Shared styles are in `assets/css/styles.css`. The header, footer and placeholder logic are in `assets/js/site.js`. The demo flow is in `assets/js/scan.js`.

## The scan page and the model

The scan page does not run the model itself. It sends the photo to the EpivaScan Space, a small Gradio app in `ml/space/`, using [`@gradio/client`](https://www.npmjs.com/package/@gradio/client) (loaded from a CDN, so there is still no build step). The Space answers with a score for each condition and the page draws the result.

Which Space the page talks to:

| Where the site is opened | `modelSpace` in `site.js` | What happens |
| --- | --- | --- |
| Anywhere | Set, for example `user/epivascan` | Photos go to that Space on Hugging Face |
| This machine (`localhost`) or a phone on the same Wi-Fi | Empty | Photos go to the Space running on this machine, port 7860 |
| A public address | Empty | Nothing is uploaded. The page says the model isn't connected |

Until a trained model is plugged in, the Space runs in **mock mode**: it answers every photo with the same made-up numbers and flags its answer as a mock. The page then shows a "Test mode" notice before any upload and labels the result "Sample data". Both disappear by themselves once the Space has a real model. See `ml/space/README.md`.

To try the whole flow on this machine, start both servers from the project root and open http://localhost:5173/scan.html:

```powershell
powershell -ExecutionPolicy Bypass -File ml\setup_space_env.ps1   # once
ml\.venv-space\Scripts\python.exe ml\space\app.py                 # the Space, port 7860
python -m http.server 5173                                        # the site, in a second terminal
```

To try it on a phone, connect the phone to the same Wi-Fi, set `$env:GRADIO_SERVER_NAME = "0.0.0.0"` before starting the Space, and open `http://THIS-PC-ADDRESS:5173/scan.html` on the phone (`ipconfig` shows the address). Windows may ask whether to let Python through the firewall.

## Adding photos

Every dashed placeholder box shows the file it is waiting for. Save an image at that path and the box fills itself; no HTML edits needed. `.jpg`, `.jpeg`, `.png` and `.webp` all work.

| Folder | Files | Used on |
| --- | --- | --- |
| `assets/img/impact/` | `01` to `06` | Impact page gallery (`01` to `03` also appear on Home) |
| `assets/img/app/` | `home`, `capture`, `analyse`, `results`, `next-step`, `web` | App screens from Figma (Home, How it works) |
| `assets/img/model/` | `model-card` | Hugging Face screenshot (The model) |
| `assets/img/team/` | `01` to `03` | Portraits (About) |

To caption a photo, add `data-caption="..."` to its `<figure>` in the HTML.

Until a file exists, the browser console logs a 404 for each empty box. That is expected.

## Wiring up real links

Edit the `CONFIG` block at the top of `assets/js/site.js`:

- `huggingFaceUrl`: enables the "View on Hugging Face" button
- `modelSpace`: the Hugging Face Space the scan page sends photos to, as `user/space-name`. Leave it empty until the Space is published
- `phoneAppUrl`: enables "Get the phone app"
- `contactEmail`: turns the contact button on the About page into a mail link

Empty values show as "Soon".

## Still placeholder text

- Impact page numbers and their labels
- Team names and roles
- Model card values and the condition list on `model.html`
- The example percentages (eczema 64% and so on) are sample values, labelled as such wherever they appear
- The numbers the Space answers with in mock mode (`MOCK_SCORES` in `ml/space/app.py`)
- The cut-offs the scan page uses to call a result "One clear leader" or "Several close together" (`CLEAR_SCORE` and `CLEAR_LEAD` in `assets/js/scan.js`). They are guesses until the trained model's accuracy is known
