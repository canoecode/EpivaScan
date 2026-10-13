---
title: EpivaScan
emoji: 🩺
colorFrom: green
colorTo: yellow
sdk: gradio
sdk_version: 6.17.3
python_version: "3.12"
app_file: app.py
pinned: false
short_description: Likely skin conditions from one photo. Not a diagnosis.
---

# EpivaScan Space

The service the EpivaScan website and phone app send photos to. It takes one photo and answers with the skin conditions the photo most resembles, each with a score.

**EpivaScan is not a medical device and does not give a diagnosis.** It is a screening aid in development.

This folder is the whole Space: `app.py`, `requirements.txt` and this file. Nothing else needs uploading.

## Mock mode

Until a trained model is plugged in, the app runs in mock mode: every photo gets the same made-up numbers, and every response says so with `"mock": true`. The website reads that flag and labels the result as sample data. This is the default, so the Space can be built and tested before training finishes.

## Plugging in the trained model

Set one variable in the Space's settings (Settings, then Variables and secrets):

| Name | Value |
| --- | --- |
| `EPIVASCAN_MODEL` | The model repo on the Hub, for example `YOUR-USERNAME/epivascan-skin` |
| `HF_TOKEN` (secret) | A read token, only while the model repo is private |

With `EPIVASCAN_MODEL` set, `"mock"` becomes `false` and the scores come from the model. If the model cannot be loaded the Space fails to start. It never falls back to the made-up numbers.

## What it answers

Two endpoints, both called with [`@gradio/client`](https://www.gradio.app/guides/getting-started-with-the-js-client).

`/predict` takes `photo` (an image) and returns every condition the model knows, best match first:

```json
{
  "mock": true,
  "model": "mock",
  "predictions": [
    { "label": "Eczema (dermatitis)", "score": 0.52 },
    { "label": "Contact dermatitis", "score": 0.17 }
  ]
}
```

`/info` takes nothing and returns the same `mock` and `model` fields, so a page can say which mode it is in before anyone uploads a photo.

```js
import { Client } from "@gradio/client";

const client = await Client.connect("YOUR-USERNAME/epivascan");
const result = await client.predict("/predict", { photo: file });
console.log(result.data[0].predictions);
```

## Photos

Uploaded photos are held in the Space's temporary storage while they are analysed and deleted within about twenty minutes. They are not written anywhere else.

## Run it on this machine

From the project root (`C:\EpivaScan`). The first command builds `ml\.venv-space` and only needs running once.

```powershell
powershell -ExecutionPolicy Bypass -File ml\setup_space_env.ps1
ml\.venv-space\Scripts\python.exe ml\space\app.py
```

It serves on http://127.0.0.1:7860. The website's scan page looks there by itself when the site is opened on `localhost`.

To run it against a model folder instead of the mock:

```powershell
$env:EPIVASCAN_MODEL = "ml\runs\epivascan-skin\model"
ml\.venv-space\Scripts\python.exe ml\space\app.py
```

Before a trained model exists, a tiny untrained one in the same format exercises that path. Its scores are noise:

```powershell
ml\.venv-space\Scripts\python.exe ml\tests\make_fake_checkpoint.py $env:TEMP\fake-checkpoint
$env:EPIVASCAN_MODEL = "$env:TEMP\fake-checkpoint"
ml\.venv-space\Scripts\python.exe ml\space\app.py
```

Clear the variable again with `Remove-Item Env:EPIVASCAN_MODEL` to go back to mock mode.

## Put it on Hugging Face

```powershell
ml\.venv\Scripts\hf.exe auth login
ml\.venv\Scripts\hf.exe upload YOUR-USERNAME/epivascan ml\space . --repo-type space
```

Then set `modelSpace` in the website's `assets/js/site.js` to `YOUR-USERNAME/epivascan`.
