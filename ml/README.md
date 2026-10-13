# EpivaScan model

Training code for the image classifier behind EpivaScan. It is built on Hugging Face end to end: the photos come from a dataset on the Hub, the pretrained backbone comes from the Hub, training uses `transformers`, and the result is a Hub model repo with its model card already filled in. The website reaches the model through the Space in `space/`, which answers with made-up numbers until a trained model is plugged in.

| File | What it is |
| --- | --- |
| `train.py` | Loads the data, trains, evaluates, and writes the model folder and model card. Runs on this machine or as a Hugging Face Job |
| `predict.py` | Runs a trained model on one photo and prints what the app would receive |
| `setup_env.ps1`, `requirements.txt` | Local Python environment with GPU PyTorch, in `ml\.venv` |
| `tests/make_synthetic_scin.py` | Fake data in the real format, for checking the pipeline without real photos |
| `space/` | The Gradio app the website and phone app send photos to. Its own `README.md` covers running and publishing it |
| `setup_space_env.ps1` | Local Python environment for the Space, in `ml\.venv-space`, separate from the training one |
| `tests/make_fake_checkpoint.py` | A tiny untrained model in the real format, for running the Space without a trained one |

Commands below are run from the project root (`C:\EpivaScan`).

## The data

Training uses [`google/scin`](https://huggingface.co/datasets/google/scin), the Skin Condition Image Network: 10,408 photos from 5,033 volunteers in the United States, labelled by dermatologists and tagged with skin tone. It is public, needs no sign-up and is 12.6 GB. `train.py` pulls it from the Hub by itself, so nobody has to collect photos into folders.

Dermatologists could grade 3,061 of the cases (6,518 photos). Those are what the model learns from. With the default settings it names 13 conditions: eczema, contact dermatitis, hives, insect bite, folliculitis, psoriasis, tinea, cold sore, shingles, acne, impetigo, pityriasis rosea and drug rash. Everything else is reported as "Other / unclear". The exact counts for a run are in its model card.

## Train

Both routes run the same script and produce the same thing.

### On Hugging Face

Nothing is downloaded to this machine. Hugging Face fetches the data, trains on its GPU and saves the model to a private repo on your account. It needs a Hugging Face account with credit on it. An L4 GPU costs $0.80 an hour and a run should take around two hours, so budget about $2. This route has not been tried yet, so treat the time as an estimate.

```powershell
ml\.venv\Scripts\hf.exe auth login
ml\.venv\Scripts\hf.exe jobs uv run --flavor l4x1 --timeout 4h --secrets HF_TOKEN ml\train.py --push-to-hub --hub-model-id epivascan-skin
```

The second command prints a link where the logs can be followed. The model lands in a private repo called `epivascan-skin` on your account. Without `--timeout` a Job is stopped after 30 minutes.

### On this machine's GPU

Free. The first run downloads the dataset into the Hugging Face cache (`%USERPROFILE%\.cache\huggingface`), which needs about 26 GB of disk: 12.6 GB for the download and the same again once it is unpacked for fast reading.

```powershell
ml\.venv\Scripts\python.exe ml\train.py
```

On the RTX 4070 Ti, expect about an hour after the download: a timing test with stand-in photos ran at roughly 100 seconds an epoch, for at most 30 epochs, using 8 GB of GPU memory. If it stops with `CUDA out of memory`, close other programs that use the GPU or add `--batch-size 8 --accumulate 4`.

To put the finished model on the Hub afterwards (private until you change it):

```powershell
ml\.venv\Scripts\hf.exe auth login
ml\.venv\Scripts\hf.exe upload YOUR-USERNAME/epivascan-skin ml\runs\epivascan-skin\model . --private
```

If `ml\.venv` is missing, `powershell -ExecutionPolicy Bypass -File ml\setup_env.ps1` rebuilds it.

## What a run produces

`ml\runs\epivascan-skin\model\` is a complete Hub model repo:

| File | What it is |
| --- | --- |
| `model.safetensors`, `config.json` | The weights and the list of conditions |
| `preprocessor_config.json` | How a photo is resized and normalised before it reaches the model |
| `README.md` | The model card: conditions covered, data source, accuracy for each condition, results by skin tone, calibration, known limitations |
| `eval/` | The numbers behind the card (`metrics.json`) and its four charts |

The card covers what `model.html` on the website promises to publish.

The run ends by printing two sets of results. **Validation** is for comparing one run with another. **Test** is the honest final figure and should not be used to pick settings, or it stops being honest.

## Try it

```powershell
ml\.venv\Scripts\python.exe ml\predict.py path\to\photo.jpg
```

It prints the same `[{ "label": ..., "score": ... }]` list the website's scan page expects from `modelEndpoint`.

## Changing what the model does

Everything is an option on `train.py`; `--help` lists them. The ones that matter most:

| Option | What it changes |
| --- | --- |
| `--min-cases 50` | A condition needs this many cases to be named; rarer ones fold into "Other / unclear". Raise it for fewer, better-supported conditions |
| `--ungradable skip` | What to do with the 1,972 cases dermatologists could not grade: leave them out, count them as `other`, or teach the model a `separate` "Photo unclear" answer |
| `--image-size 448` | Input size. Smaller is faster and may be less accurate |
| `--model facebook/dinov2-base` | The pretrained backbone. Other Hub models with an image-classification head should work but are untried; most, unlike DINOv2, only accept their own native `--image-size` |
| `--output-dir` | Where the run is written. Give each experiment its own folder |

The grouping of SCIN's condition names into the app's conditions is the `CONDITIONS` table at the top of `train.py`. It is a first draft and should be reviewed by a clinician.

## Check the pipeline without real data

```powershell
ml\.venv\Scripts\python.exe ml\tests\make_synthetic_scin.py $env:TEMP\fake-scin
ml\.venv\Scripts\python.exe ml\train.py --dataset $env:TEMP\fake-scin --output-dir $env:TEMP\fake-scin\run --epochs 3 --image-size 224 --min-cases 12
```

This trains on coloured shapes in about two minutes. It proves the code runs; the accuracy it reports means nothing.

## Keep this folder out of the website upload

`ml\.venv` is several gigabytes, `ml\runs` holds model weights, and `ml\.venv-space` and `ml\.uv` are the Space's environment. When the site is deployed, publish the HTML and `assets` only.
