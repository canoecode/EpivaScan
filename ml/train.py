# /// script
# requires-python = ">=3.9"
# dependencies = [
#     "torch==2.8.0",
#     "torchvision==0.23.0",
#     "transformers==4.57.6",
#     "datasets==4.5.0",
#     "accelerate>=1.0",
#     "huggingface_hub>=0.34,<1",
#     "scikit-learn>=1.5",
#     "pandas>=2.0",
#     "numpy>=1.26",
#     "pillow>=10",
#     "matplotlib>=3.8",
# ]
# ///
"""Fine-tune the EpivaScan skin-condition classifier, the Hugging Face way.

The photos come from the Hub (google/scin), the pretrained backbone comes from the Hub,
training uses transformers.Trainer, and the result is a Hub-ready model folder: weights,
preprocessing config and a model card filled in with the evaluation.

    python train.py                                   # train on this machine's GPU
    hf jobs uv run --flavor l4x1 --timeout 4h --secrets HF_TOKEN train.py \
        --push-to-hub --hub-model-id epivascan-skin           # train on Hugging Face

Every SCIN case carries a dermatologist differential: several conditions with weights
that sum to 1. The model is trained on that whole distribution instead of one class, so
what it returns is a ranked list with percentages, which is what the EpivaScan app shows.
"""
from __future__ import annotations

import argparse
import ast
import json
import os
import re
import shutil
import warnings
from collections import Counter
from pathlib import Path

# Without developer mode Windows copies cached files instead of linking them; that works.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
import torchvision.transforms as T
from PIL import ImageOps
from sklearn.model_selection import StratifiedKFold
from transformers import (
    AutoConfig,
    AutoImageProcessor,
    AutoModelForImageClassification,
    BitImageProcessor,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
    default_data_collator,
    pipeline,
    set_seed,
)
from transformers.image_utils import PILImageResampling

IMAGE_COLUMNS = ("image_1_path", "image_2_path", "image_3_path")
OTHER = "Other / unclear"
UNCLEAR = "Photo unclear"

# What the app can name, and the SCIN condition names each entry covers. Anything not
# listed here, and any entry with fewer than --min-cases cases, is reported as OTHER.
# This grouping is a first draft and should be reviewed by a clinician.
CONDITIONS = {
    "Eczema (dermatitis)": [
        "Eczema", "Atopic dermatitis", "Acute dermatitis, NOS", "Chronic dermatitis, NOS",
        "Acute and chronic dermatitis", "Infected eczema",
    ],
    "Contact dermatitis": [
        "Allergic Contact Dermatitis", "Irritant Contact Dermatitis", "CD - Contact dermatitis",
    ],
    "Hives (urticaria)": ["Urticaria"],
    "Insect bite": ["Insect Bite"],
    "Folliculitis": ["Folliculitis"],
    "Psoriasis": ["Psoriasis"],
    "Tinea (ringworm)": ["Tinea"],
    "Cold sore (herpes simplex)": ["Herpes Simplex"],
    "Shingles (herpes zoster)": ["Herpes Zoster"],
    "Acne": ["Acne"],
    "Impetigo": ["Impetigo", "Ecthyma"],
    "Pityriasis rosea": ["Pityriasis rosea"],
    "Drug rash": ["Drug Rash"],
    "Tinea versicolor": ["Tinea Versicolor"],
    "Molluscum contagiosum": ["Molluscum Contagiosum"],
    "Scabies": ["Scabies"],
    "Warts": ["Verruca vulgaris"],
}

FITZPATRICK_GROUPS = {"I-II": (1, 2), "III-IV": (3, 4), "V-VI": (5, 6)}
MONK_GROUPS = {"1-3": (1, 3), "4-6": (4, 6), "7-10": (7, 10)}


# --------------------------------------------------------------------------- labels

def _key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


def parse_weights(text) -> dict:
    """"{'Eczema': 0.67, 'Psoriasis': 0.33}" -> {"Eczema": 0.67, ...}; {} when unlabelled."""
    if not isinstance(text, str) or not text.strip():
        return {}
    try:
        value = ast.literal_eval(text)
    except (ValueError, SyntaxError):
        return {}
    if not isinstance(value, dict):
        return {}
    return {str(name): float(weight) for name, weight in value.items() if float(weight) > 0}


def _digits(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series.astype(str).str.extract(r"(\d+)")[0], errors="coerce")


def skin_tone(meta: pd.DataFrame):
    """Fitzpatrick type (dermatologists' estimate from the photos, else self-reported)
    and Monk skin tone (mean of the two trained raters)."""
    blank = pd.Series(np.nan, index=meta.index)
    estimates = [f"dermatologist_fitzpatrick_skin_type_label_{k}" for k in (1, 2, 3)]
    estimates = [_digits(meta[c]) for c in estimates if c in meta]
    fst = pd.concat(estimates, axis=1).median(axis=1) if estimates else blank
    if "fitzpatrick_skin_type" in meta:
        fst = fst.fillna(_digits(meta["fitzpatrick_skin_type"]))
    raters = [c for c in ("monk_skin_tone_label_us", "monk_skin_tone_label_india") if c in meta]
    mst = meta[raters].apply(pd.to_numeric, errors="coerce").mean(axis=1) if raters else blank
    fst, mst = np.floor(fst + 0.5), np.floor(mst + 0.5)
    return fst.where(fst.between(1, 6)).to_numpy(), mst.where(mst.between(1, 10)).to_numpy()


def build_cases(meta: pd.DataFrame, min_cases: int, ungradable: str = "skip"):
    """One row per usable case, its class weights, the class list, and what OTHER contains."""
    lookup = {_key(alias): name for name, aliases in CONDITIONS.items() for alias in [name, *aliases]}
    rows, mapped, uncovered = [], [], Counter()
    for row, text in enumerate(meta["weighted_skin_condition_label"]):
        raw = parse_weights(text)
        if raw:
            weights: dict = {}
            for condition, weight in raw.items():
                target = lookup.get(_key(condition), OTHER)
                weights[target] = weights.get(target, 0.0) + weight
                if target == OTHER:
                    uncovered[condition] += weight
        elif ungradable == "skip":
            continue
        else:
            weights = {UNCLEAR if ungradable == "separate" else OTHER: 1.0}
        rows.append(row)
        mapped.append(weights)

    # A condition is kept when it leads the differential, alone or tied, in enough cases.
    leads = Counter(name for weights in mapped for name, weight in weights.items()
                    if weight >= max(weights.values()) - 1e-6)
    classes = [name for name in [*CONDITIONS, UNCLEAR] if leads[name] >= min_cases] + [OTHER]
    column = {name: i for i, name in enumerate(classes)}
    soft = np.zeros((len(mapped), len(classes)), np.float32)
    for i, weights in enumerate(mapped):
        for name, weight in weights.items():
            soft[i, column.get(name, column[OTHER])] += weight
            if name not in column:
                uncovered[name] += weight
    soft /= soft.sum(axis=1, keepdims=True)

    # Each case is filed under one leading condition. About one case in six has two tied
    # at the top; those go to the rarer condition, so small classes are not starved, and
    # to a named condition before OTHER.
    tied = soft >= soft.max(axis=1, keepdims=True) - 1e-6
    rarity = np.array([leads[name] for name in classes[:-1]] + [1e12])
    primary = np.where(tied, rarity, np.inf).argmin(axis=1)

    fst, mst = skin_tone(meta)
    cases = pd.DataFrame({
        "row": rows,
        "case_id": meta["case_id"].astype(str).to_numpy()[rows],
        "primary": primary,
        "fst": fst[rows],
        "mst": mst[rows],
    })
    return cases, soft, classes, uncovered


def assign_splits(cases: pd.DataFrame, seed: int) -> np.ndarray:
    """70/15/15 by case, stratified by condition and, where numbers allow, skin-tone group."""
    tone = pd.cut(cases["fst"], [0, 2, 4, 6], labels=["a", "b", "c"]).astype(object).fillna("u")
    condition = cases["primary"].astype(str)
    strata = condition + "/" + tone.astype(str)
    folds = min(20, int(condition.value_counts().max()))
    strata = strata.where(strata.map(strata.value_counts()) >= folds, condition)
    held = max(1, round(0.15 * folds))
    fold = np.zeros(len(cases), int)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # a condition with fewer cases than folds is fine here
        splitter = StratifiedKFold(n_splits=folds, shuffle=True, random_state=seed)
        for i, (_, index) in enumerate(splitter.split(np.zeros(len(cases)), strata)):
            fold[index] = i
    return np.select([fold < held, fold < 2 * held], ["test", "val"], "train")


def image_table(cases: pd.DataFrame, present: dict) -> pd.DataFrame:
    """One row per photo belonging to a usable case."""
    rows = cases["row"].to_numpy()
    parts = []
    for column, mask in present.items():
        keep = np.flatnonzero(mask[rows])
        parts.append(pd.DataFrame({"case": keep, "row": rows[keep], "column": column}))
    table = pd.concat(parts, ignore_index=True)
    for name in ("case_id", "split", "primary", "fst", "mst"):
        table[name] = cases[name].to_numpy()[table["case"]]
    return table


def repeated_photos(raw, table: pd.DataFrame) -> np.ndarray:
    """Photos whose file also appears under another case (SCIN documents a handful).
    They are dropped so the same picture cannot sit in both training and test data."""
    try:
        import pyarrow.compute as pc

        keys = np.empty(len(table), object)
        for column in table["column"].unique():
            blobs = pc.struct_field(raw.data.column(column), "bytes")
            sizes = pc.binary_length(blobs).to_pylist()
            heads = pc.binary_slice(blobs, 0, 2048).to_pylist()
            here = np.flatnonzero(table["column"] == column)
            for i, row in zip(here, table["row"].to_numpy()[here]):
                keys[i] = (sizes[row], heads[row])
        owners = pd.DataFrame({"key": keys, "case": table["case"]}).groupby("key")["case"].nunique()
        return pd.Series(keys).map(owners).to_numpy() > 1
    except Exception as error:  # a different storage layout: carry on without the check
        print(f"Skipped the repeated-photo check ({error}).")
        return np.zeros(len(table), bool)


# ----------------------------------------------------------------------------- data

class Rot90:
    """Quarter-turn rotation. Skin has no upright orientation, so all four are valid."""

    def __call__(self, image):
        turns = int(torch.randint(0, 4, (1,)))
        return image.rotate(90 * turns, expand=True) if turns else image


class Preprocess:
    """The preprocessing saved with the model, so validation matches what gets deployed."""

    def __init__(self, processor):
        self.processor = processor

    def __call__(self, image):
        return self.processor(images=image, return_tensors="pt")["pixel_values"][0]


def train_transform(size: int, mean, std):
    return T.Compose([
        T.RandomResizedCrop(size, scale=(0.4, 1.0), ratio=(3 / 4, 4 / 3),
                            interpolation=T.InterpolationMode.BICUBIC),
        T.RandomHorizontalFlip(),
        T.RandomVerticalFlip(),
        Rot90(),
        # Kept mild on purpose: redness and pigment are part of the diagnosis.
        T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15, hue=0.02),
        T.ToTensor(),
        T.Normalize(mean, std),
    ])


class SkinPhotos(torch.utils.data.Dataset):
    """One example per photo, decoded on access from the Hugging Face dataset."""

    def __init__(self, views: dict, table: pd.DataFrame, soft: np.ndarray, transform):
        self.views = views
        self.rows = table["row"].to_numpy()
        self.columns = table["column"].tolist()
        self.soft = torch.from_numpy(np.ascontiguousarray(soft, dtype=np.float32))
        self.primary = table["primary"].tolist()
        self.transform = transform

    def __len__(self):
        return len(self.rows)

    def image(self, i: int):
        column = self.columns[i]
        image = self.views[column][int(self.rows[i])][column]
        return ImageOps.exif_transpose(image).convert("RGB")

    def __getitem__(self, i: int):
        return {"pixel_values": self.transform(self.image(i)), "labels": self.soft[i],
                "primary": self.primary[i]}


# ---------------------------------------------------------------------------- model

def build_processor(checkpoint: str, size: int):
    """Shorter side to `size`, centre crop, normalise with the backbone's own statistics."""
    base = AutoImageProcessor.from_pretrained(checkpoint, use_fast=False)
    return BitImageProcessor(
        do_resize=True, size={"shortest_edge": size}, resample=PILImageResampling.BICUBIC,
        do_center_crop=True, crop_size={"height": size, "width": size},
        do_rescale=True, rescale_factor=1 / 255,
        do_normalize=True, image_mean=list(base.image_mean), image_std=list(base.image_std),
        do_convert_rgb=True,
    )


def build_model(checkpoint: str, classes: list, drop_path: float):
    config = AutoConfig.from_pretrained(
        checkpoint, num_labels=len(classes),
        id2label=dict(enumerate(classes)), label2id={name: i for i, name in enumerate(classes)},
    )
    if hasattr(config, "drop_path_rate"):
        config.drop_path_rate = drop_path
    return AutoModelForImageClassification.from_pretrained(
        checkpoint, config=config, ignore_mismatched_sizes=True)


_BLOCK = re.compile(r"\.(?:layer|layers|blocks|stages)\.(\d+)\.")


def layer_decay_groups(model, lr: float, head_lr: float, weight_decay: float, decay: float):
    """AdamW groups: the new head learns fastest, and each backbone block a little more
    slowly than the block above it, which protects the pretrained low-level features."""
    named = [(name, p) for name, p in model.named_parameters() if p.requires_grad]
    depth, inside = {}, False
    for name, _ in named:
        match = _BLOCK.search(name)
        if match:
            depth[name], inside = int(match.group(1)) + 1, True
        else:
            depth[name] = None if inside else 0  # before the blocks: 0; after them: top
    top = max((d for d in depth.values() if d), default=0) + 1
    groups: dict = {}
    for name, param in named:
        if name.startswith("classifier"):
            rate = head_lr
        else:
            rate = lr * decay ** (top - (top if depth[name] is None else depth[name]))
        no_decay = param.ndim <= 1 or "position" in name or "token" in name
        groups.setdefault((rate, 0.0 if no_decay else weight_decay), []).append(param)
    return [{"params": params, "lr": rate, "weight_decay": wd} for (rate, wd), params in groups.items()]


class SoftLabelTrainer(Trainer):
    """Trainer for labels that are a probability distribution over conditions."""

    def __init__(self, *args, class_weights, mixup, head_lr, layer_decay, **kwargs):
        super().__init__(*args, **kwargs)
        # compute_loss below averages over the batch itself, so the Trainer must divide by
        # the accumulation steps (it skips that when it thinks the model does it).
        self.model_accepts_loss_kwargs = False
        self.class_weights = class_weights
        self.mixup = mixup
        self.head_lr = head_lr
        self.layer_decay = layer_decay

    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.pop("labels")
        inputs.pop("primary", None)  # carried for the metrics only
        pixels = inputs["pixel_values"]
        if model.training and self.mixup > 0:
            share = float(np.random.beta(self.mixup, self.mixup))
            share = max(share, 1 - share)
            other = torch.randperm(pixels.size(0), device=pixels.device)
            pixels = share * pixels + (1 - share) * pixels[other]
            labels = share * labels + (1 - share) * labels[other]
        outputs = model(pixel_values=pixels)
        weighted = self.class_weights.to(labels.device) * labels
        loss = -(weighted * F.log_softmax(outputs.logits.float(), dim=-1)).sum() / weighted.sum()
        return (loss, outputs) if return_outputs else loss

    def create_optimizer(self):
        if self.optimizer is None:
            self.optimizer = torch.optim.AdamW(layer_decay_groups(
                self.model, self.args.learning_rate, self.head_lr,
                self.args.weight_decay, self.layer_decay))
        return self.optimizer


def output_layer(model):
    head = getattr(model, "classifier", None)
    layers = [m for m in head.modules() if isinstance(m, torch.nn.Linear)] if head is not None else []
    return layers[-1] if layers else None


# -------------------------------------------------------------------------- metrics

def softmax(logits: np.ndarray) -> np.ndarray:
    return torch.from_numpy(np.asarray(logits, dtype=np.float32)).softmax(dim=-1).numpy()


def outcomes(probs: np.ndarray, soft: np.ndarray, k: int = 3):
    """Per photo: the model's top class, whether it is a leading condition, and whether the
    top k contain one. Dermatologists often give two conditions equal weight; matching
    either one counts as right."""
    leading = soft >= soft.max(axis=1, keepdims=True) - 1e-6
    ranked = np.argsort(-probs, axis=1)
    hit1 = leading[np.arange(len(probs)), ranked[:, 0]]
    hitk = np.take_along_axis(leading, ranked[:, :k], axis=1).any(axis=1)
    return ranked[:, 0], hit1, hitk, leading


def summary(probs: np.ndarray, soft: np.ndarray, primary: np.ndarray) -> dict:
    pred, hit1, hit3, leading = outcomes(probs, soft)
    recall, f1 = [], []
    for c in range(probs.shape[1]):
        if not (primary == c).any():
            continue
        r = hit1[primary == c].mean()
        p = leading[pred == c, c].mean() if (pred == c).any() else 0.0
        recall.append(r)
        f1.append(2 * p * r / (p + r) if p + r else 0.0)
    return {"top1": float(hit1.mean()), "top3": float(hit3.mean()),
            "balanced_accuracy": float(np.mean(recall)), "macro_f1": float(np.mean(f1))}


def interval(values: np.ndarray, cases: np.ndarray, draws: int = 1000) -> list:
    """95% interval for a mean of per-photo outcomes, resampling whole cases."""
    _, group = np.unique(cases, return_inverse=True)
    total = np.bincount(group, weights=values.astype(float))
    count = np.bincount(group)
    pick = np.random.default_rng(0).integers(0, len(count), size=(draws, len(count)))
    low, high = np.percentile(total[pick].sum(axis=1) / count[pick].sum(axis=1), [2.5, 97.5])
    return [float(low), float(high)]


def fit_temperature(logits: np.ndarray, soft: np.ndarray, primary: np.ndarray) -> float:
    """One number that rescales the logits so a 60% match is right about 60% of the time."""
    pred, hit1, _, _ = outcomes(softmax(logits), soft)
    target = torch.from_numpy(np.where(hit1, pred, primary))
    logits = torch.from_numpy(np.asarray(logits, dtype=np.float32))
    grid = np.exp(np.linspace(np.log(0.25), np.log(8.0), 200))
    losses = [F.cross_entropy(logits / t, target).item() for t in grid]
    return float(grid[int(np.argmin(losses))])


def reliability(probs: np.ndarray, hit1: np.ndarray, bins: int = 10):
    confidence = probs.max(axis=1)
    index = np.minimum((confidence * bins).astype(int), bins - 1)
    rows, error = [], 0.0
    for b in range(bins):
        mask = index == b
        if mask.any():
            rows.append({"confidence": float(confidence[mask].mean()),
                         "accuracy": float(hit1[mask].mean()), "photos": int(mask.sum())})
            error += mask.mean() * abs(confidence[mask].mean() - hit1[mask].mean())
    return rows, float(error)


def evaluate(probs: np.ndarray, soft: np.ndarray, table: pd.DataFrame, classes: list) -> dict:
    pred, hit1, hit3, leading = outcomes(probs, soft)
    primary = table["primary"].to_numpy()
    cases = table["case"].to_numpy()

    def describe(mask):
        return {"photos": int(mask.sum()), "cases": int(len(np.unique(cases[mask]))),
                "top1": float(hit1[mask].mean()), "top1_ci": interval(hit1[mask], cases[mask]),
                "top3": float(hit3[mask].mean()), "top3_ci": interval(hit3[mask], cases[mask])}

    def by_tone(values, groups):
        rows = []
        for name, (low, high) in groups.items():
            mask = (values >= low) & (values <= high)
            if mask.any():
                rows.append({"group": name, **describe(mask)})
        return rows

    bins, ece = reliability(probs, hit1)
    report = {"overall": {**describe(np.ones(len(probs), bool)), **summary(probs, soft, primary), "ece": ece}}
    report["by_condition"] = [
        {"condition": name, **describe(primary == c),
         "precision": float(leading[pred == c, c].mean()) if (pred == c).any() else None}
        for c, name in enumerate(classes) if (primary == c).any()]
    report["by_fitzpatrick"] = by_tone(table["fst"].to_numpy(), FITZPATRICK_GROUPS)
    report["by_monk"] = by_tone(table["mst"].to_numpy(), MONK_GROUPS)
    # Rows: dermatologists' leading condition. Columns: model's top match, with a match
    # to a tied leading condition counted on the diagonal.
    shown = np.where(hit1, primary, pred)
    report["confusion"] = [[int(((primary == r) & (shown == c)).sum()) for c in range(len(classes))]
                           for r in range(len(classes))]
    report["reliability"] = bins
    return report


# ---------------------------------------------------------------------------- plots

INK, SECONDARY, MUTED = "#0b0b0b", "#52514e", "#898781"
GRID, AXIS, SURFACE, BLUE = "#e1e0d9", "#c3c2b7", "#fcfcfb", "#2a78d6"
BLUE_RAMP = [SURFACE, "#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"]


def _figure(width: float, height: float, **grid):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.rcParams.update({"font.family": "sans-serif", "font.size": 9,
                         "font.sans-serif": ["Segoe UI", "Helvetica Neue", "Arial", "DejaVu Sans"]})
    fig, axes = plt.subplots(figsize=(width, height), facecolor=SURFACE, squeeze=False, **grid)
    for ax in axes.flat:
        ax.set_facecolor(SURFACE)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        ax.spines["bottom"].set_color(AXIS)
        ax.tick_params(colors=MUTED, length=0)
    return fig, axes


def _title(fig, title: str, note: str):
    fig.text(0.02, 0.985, title, ha="left", va="top", fontsize=11.5, fontweight="semibold", color=INK)
    fig.text(0.02, 0.985 - 0.26 / fig.get_figheight(), note, ha="left", va="top", fontsize=8.5,
             color=SECONDARY)


def _percent_bars(ax, labels: list, values: list, spans: list):
    """Thin horizontal bars on a 0-100% axis, value at the tip, 95% interval as a whisker."""
    from matplotlib.patches import FancyBboxPatch, Rectangle

    ys = np.arange(len(labels))[::-1]
    ax.set_xlim(0, 118)
    ax.set_ylim(-0.6, len(labels) - 0.4)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_xticklabels(["0", "25", "50", "75", "100%"])
    ax.set_yticks(ys)
    ax.set_yticklabels(labels, color=INK)
    ax.set_axisbelow(True)
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.figure.canvas.draw()  # fixes the pixel geometry so the 4 px bar-end radius is true
    origin = ax.transData.transform((0, 0))
    per_x, per_y = ax.transData.transform((1, 1)) - origin
    scale = ax.figure.dpi / 100
    thick, radius = 13 * scale / per_y, 4 * scale / per_x
    for y, value, (low, high) in zip(ys, values, spans):
        width = 100 * value
        if width > 2 * radius:
            ax.add_patch(FancyBboxPatch((0, y - thick / 2), width, thick, linewidth=0, facecolor=BLUE,
                                        boxstyle=f"round,pad=0,rounding_size={radius}",
                                        mutation_aspect=per_x / per_y))
        ax.add_patch(Rectangle((0, y - thick / 2), max(width - radius, 0) or width, thick,
                               linewidth=0, facecolor=BLUE))
        ax.plot([100 * low, 100 * high], [y, y], color=INK, linewidth=1, solid_capstyle="butt")
        ax.text(max(width, 100 * high) + 2, y, f"{width:.0f}%", va="center", ha="left", color=INK,
                fontsize=9)


def save_plots(report: dict, classes: list, folder: Path):
    from matplotlib.colors import LinearSegmentedColormap

    rows = sorted(report["by_condition"], key=lambda r: -r["top3"])
    fig, axes = _figure(7.6, 1.15 + 0.36 * len(rows), ncols=2, sharey=True)
    fig.subplots_adjust(left=0.36, right=0.985, bottom=0.42 / fig.get_figheight(),
                        top=1 - 0.95 / fig.get_figheight(), wspace=0.08)
    labels = [f"{r['condition']}  (n={r['cases']})" for r in rows]
    for ax, key, name in ((axes[0, 0], "top1", "Top match is right"),
                          (axes[0, 1], "top3", "Right condition in the top 3")):
        _percent_bars(ax, labels, [r[key] for r in rows], [r[f"{key}_ci"] for r in rows])
        ax.set_title(name, loc="left", fontsize=9, color=SECONDARY, pad=6)
    _title(fig, "How often the model finds each condition",
           "Held-out test photos, grouped by the dermatologists' leading condition. "
           "n = cases. Lines show 95% intervals.")
    fig.savefig(folder / "by_condition.png", dpi=150, facecolor=SURFACE)

    tones = ([("Fitzpatrick " + r["group"], r) for r in report["by_fitzpatrick"]]
             + [("Monk " + r["group"], r) for r in report["by_monk"]])
    if tones:
        fig, axes = _figure(7.6, 1.15 + 0.36 * len(tones), ncols=2, sharey=True)
        fig.subplots_adjust(left=0.30, right=0.985, bottom=0.42 / fig.get_figheight(),
                            top=1 - 0.95 / fig.get_figheight(), wspace=0.08)
        labels = [f"{name}  (n={r['cases']})" for name, r in tones]
        for ax, key, name in ((axes[0, 0], "top1", "Top match is right"),
                              (axes[0, 1], "top3", "Right condition in the top 3")):
            _percent_bars(ax, labels, [r[key] for _, r in tones], [r[f"{key}_ci"] for _, r in tones])
            ax.set_title(name, loc="left", fontsize=9, color=SECONDARY, pad=6)
        _title(fig, "Results by skin tone",
               "Held-out test photos. n = cases. Lines show 95% intervals; "
               "small groups have wide ones.")
        fig.savefig(folder / "by_skin_tone.png", dpi=150, facecolor=SURFACE)

    matrix = np.array(report["confusion"], dtype=float)
    present = matrix.sum(axis=1) > 0
    share = matrix[present] / matrix[present].sum(axis=1, keepdims=True)
    names = [n for n, keep in zip(classes, present) if keep]
    side = 0.46 * len(classes)
    fig, axes = _figure(3.3 + side, 2.2 + 0.46 * len(names))
    ax = axes[0, 0]
    fig.subplots_adjust(left=2.45 / fig.get_figwidth(), right=1 - 0.25 / fig.get_figwidth(),
                        bottom=1.45 / fig.get_figheight(), top=1 - 0.75 / fig.get_figheight())
    ax.imshow(share, cmap=LinearSegmentedColormap.from_list("blue", BLUE_RAMP), vmin=0, vmax=1,
              aspect="auto")
    ax.set_xticks(range(len(classes)))
    ax.set_xticklabels(classes, rotation=40, ha="right", rotation_mode="anchor", color=INK)
    ax.set_yticks(range(len(names)))
    ax.set_yticklabels(names, color=INK)
    ax.set_xticks(np.arange(-0.5, len(classes)), minor=True)
    ax.set_yticks(np.arange(-0.5, len(names)), minor=True)
    ax.grid(which="minor", color=SURFACE, linewidth=2)
    ax.tick_params(which="minor", length=0)
    ax.spines["bottom"].set_visible(False)
    for r in range(share.shape[0]):
        for c in range(share.shape[1]):
            if share[r, c] >= 0.05:
                ax.text(c, r, f"{100 * share[r, c]:.0f}", ha="center", va="center", fontsize=8,
                        color="#ffffff" if share[r, c] > 0.45 else INK)
    ax.set_xlabel("Model's top match", color=SECONDARY, labelpad=8)
    ax.set_ylabel("Dermatologists' leading condition", color=SECONDARY, labelpad=8)
    _title(fig, "Where the top match lands",
           "Percent of each row's test photos. Cells under 5% are left blank.")
    fig.savefig(folder / "confusion.png", dpi=150, facecolor=SURFACE)

    bins = [b for b in report["reliability"] if b["photos"] >= 10]
    fig, axes = _figure(4.6, 4.9)
    ax = axes[0, 0]
    fig.subplots_adjust(left=0.15, right=0.95, bottom=0.12, top=0.84)
    ax.plot([0, 100], [0, 100], color=AXIS, linewidth=1)
    ax.text(97, 92, "perfectly calibrated", ha="right", va="top", color=MUTED, fontsize=8,
            rotation=45, rotation_mode="anchor")
    ax.plot([100 * b["confidence"] for b in bins], [100 * b["accuracy"] for b in bins], color=BLUE,
            linewidth=2, marker="o", markersize=7, markeredgecolor=SURFACE, markeredgewidth=2,
            solid_joinstyle="round", solid_capstyle="round", clip_on=False, zorder=3)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_yticks([0, 25, 50, 75, 100])
    ax.set_yticklabels(["0", "25", "50", "75", "100%"])
    ax.set_xticklabels(["0", "25", "50", "75", "100%"])
    ax.grid(color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xlabel("Percentage shown for the top match", color=SECONDARY, labelpad=6)
    ax.set_ylabel("How often that top match is right", color=SECONDARY, labelpad=6)
    _title(fig, "Do the percentages mean what they say?",
           f"Test photos in ten confidence bands. Average gap: "
           f"{100 * report['overall']['ece']:.1f} points.")
    fig.savefig(folder / "calibration.png", dpi=150, facecolor=SURFACE)

    import matplotlib.pyplot as plt
    plt.close("all")


# ----------------------------------------------------------------------- model card

def _pct(value, span=None) -> str:
    if value is None:
        return "n/a"
    text = f"{100 * value:.0f}%"
    return f"{text} ({100 * span[0]:.0f}-{100 * span[1]:.0f})" if span else text


def model_card(args, classes, table, uncovered, report, val, temperature, adults_only) -> str:
    cases = table.drop_duplicates("case")
    counts = cases.groupby(["primary", "split"]).size().unstack(fill_value=0)
    overall = report["overall"]
    if Path(args.dataset).exists():  # a local folder, e.g. the synthetic test data
        listed = []
        source = f"- **Source:** a local dataset folder in SCIN's format (`{Path(args.dataset).name}`)."
    else:
        listed = ["datasets:", f"- {args.dataset}"]
        source = (f"- **Source:** [`{args.dataset}`](https://huggingface.co/datasets/{args.dataset}), the "
                  "Skin Condition Image Network: photos contributed with consent by internet users in "
                  "the United States, labelled by dermatologists. Released under the SCIN Data Use License.")
    lines = [
        "---", "library_name: transformers", "pipeline_tag: image-classification",
        f"base_model: {args.model}", *listed,
        "tags:", "- dermatology", "- skin", "- medical-imaging", "- epivascan", "---", "",
        "# EpivaScan skin-condition classifier", "",
        "Given one photo of a skin concern, this model returns the conditions the photo most "
        "closely matches, each with a percentage. It is the image classifier behind EpivaScan.",
        "",
        "**This is a screening aid in development. It is not a medical device, it does not "
        "give a diagnosis, and it has not been validated in a clinic or in the field.** A "
        "percentage is how strongly the photo resembles a condition, not the chance that a "
        "person has it.",
        "",
        "## Conditions covered", "",
        "| Condition | Cases: train | val | test |", "|---|---:|---:|---:|",
    ]
    for c, name in enumerate(classes):
        row = counts.loc[c] if c in counts.index else {}
        lines.append(f"| {name} | {row.get('train', 0)} | {row.get('val', 0)} | {row.get('test', 0)} |")
    common = ", ".join(name for name, _ in uncovered.most_common(12))
    ungraded = {"skip": "left out.", "other": f"counted as {OTHER}.",
                "separate": f"a class of their own, {UNCLEAR}."}[args.ungradable]
    lines += [
        "",
        f"**{OTHER}** is everything else. The model can only name the conditions above, so a "
        f"condition it was not trained on lands here or on a look-alike. In the training data "
        f"it is mostly: {common}.",
        "",
        "## Training data", "",
        source,
        f"- **Used here:** {len(cases):,} cases, {len(table):,} photos. Cases the dermatologists "
        f"could not grade are {ungraded}",
        "- **Labels:** each case has a weighted differential, several conditions with weights "
        "that sum to 1. The model is trained on the whole distribution.",
        "- **Split:** 70/15/15 by case, so photos of one person never sit on both sides, "
        "stratified by condition and skin-tone group.",
        "",
        "## Results on the held-out test set", "",
        f"{overall['cases']:,} cases, {overall['photos']:,} photos, never used for training or "
        "tuning. A match counts as right when it is the dermatologists' leading condition, or "
        "one of them when two are tied. Brackets are 95% intervals.",
        "",
        "| Measure | Result |", "|---|---|",
        f"| Top match is right | {_pct(overall['top1'], overall['top1_ci'])} |",
        f"| Right condition in the top 3 | {_pct(overall['top3'], overall['top3_ci'])} |",
        f"| Average over conditions (balanced accuracy) | {_pct(overall['balanced_accuracy'])} |",
        f"| Calibration gap (ECE) | {100 * overall['ece']:.1f} points |",
        "",
        "### Accuracy for each condition", "",
        "![Accuracy for each condition](eval/by_condition.png)", "",
        "| Condition | Test cases | Top match right | In top 3 | When named, how often right |",
        "|---|---:|---|---|---|",
    ]
    for r in report["by_condition"]:
        lines.append(f"| {r['condition']} | {r['cases']} | {_pct(r['top1'], r['top1_ci'])} | "
                     f"{_pct(r['top3'], r['top3_ci'])} | {_pct(r['precision'])} |")
    lines += ["", "![Where the top match lands](eval/confusion.png)", "",
              "### Performance by skin tone", ""]
    if report["by_fitzpatrick"] or report["by_monk"]:
        lines += ["![Results by skin tone](eval/by_skin_tone.png)", "",
                  "| Group | Test cases | Top match right | In top 3 |", "|---|---:|---|---|"]
        for scale, rows in (("Fitzpatrick", report["by_fitzpatrick"]), ("Monk", report["by_monk"])):
            for r in rows:
                lines.append(f"| {scale} {r['group']} | {r['cases']} | {_pct(r['top1'], r['top1_ci'])} | "
                             f"{_pct(r['top3'], r['top3_ci'])} |")
        lines += ["", "Fitzpatrick type is the dermatologists' estimate from the photos (self-reported "
                  "where there is none); Monk tone is the mean of two trained raters."]
    else:
        lines.append("The dataset has no skin-tone labels, so this could not be measured.")
    lines += ["", "### Do the percentages mean what they say?", "",
              "![Calibration](eval/calibration.png)", "",
              f"After training, one temperature ({temperature:.2f}) was fitted on the validation "
              "set and folded into the final layer, so the model's own output is calibrated.",
              "", "## Known limitations", ""]
    limits = [f"It can only name the {len(classes) - 1} conditions listed. Anything else is "
              f"reported as {OTHER} or mistaken for a look-alike."]
    dark = next((r for r in report["by_fitzpatrick"] if r["group"] == "V-VI"), None)
    if dark is None or dark["cases"] < 100:
        limits.append("Darker skin is under-represented: the test set has "
                      f"{dark['cases'] if dark else 0} Fitzpatrick V-VI cases, too few to show the "
                      "model works as well there.")
    thin = [r["condition"] for r in report["by_condition"] if r["cases"] < 30]
    if thin:
        limits.append("These conditions have fewer than 30 test cases, so their numbers are "
                      "rough: " + ", ".join(thin) + ".")
    if adults_only:
        limits.append("All contributors were adults. It is untested on children.")
    limits += ["The photos came from internet users in the United States. Conditions common "
               "elsewhere, and photos taken in other settings, may be handled poorly.",
               "It sees one photo. It cannot feel texture, take a history or look at the rest "
               "of the skin.",
               "The reference labels are dermatologists' opinions from photos, not confirmed "
               "diagnoses."]
    lines += [f"- {text}" for text in limits]
    lines += [
        "", "## Use", "", "```python", "from transformers import pipeline", "",
        f'scan = pipeline("image-classification", model="{args.hub_model_id or "path/to/this/folder"}")',
        'scan("photo.jpg", top_k=3)', "# [{'label': '...', 'score': 0.64}, ...]", "```", "",
        "## Training details", "",
        f"- Base model: [`{args.model}`](https://huggingface.co/{args.model}), fine-tuned end to end",
        f"- Input: {args.image_size} px, shorter side resized then centre-cropped",
        f"- {args.epochs} epochs at most, batch {args.batch_size * args.accumulate}, AdamW, "
        f"learning rate {args.lr:g} (head {args.head_lr:g}), layer decay {args.layer_decay}, "
        f"cosine schedule, mixup {args.mixup}, seed {args.seed}",
        f"- Checkpoint chosen by validation balanced accuracy: {_pct(val['balanced_accuracy'])} "
        f"(top match {_pct(val['top1'])}, top 3 {_pct(val['top3'])})",
        "", "## Licence", "",
        "Not yet chosen. Decide before making this repository public; the SCIN Data Use "
        "License and the base model's licence both apply to what this model was built from.",
        "", "## Citation", "",
        "Ward A, Li J, Wang J, et al. Creating an Empirical Dermatology Dataset Through "
        "Crowdsourcing With Web Search Advertisements. JAMA Network Open. 2024;7(11):e2446615.",
        "",
    ]
    return "\n".join(lines)


# ----------------------------------------------------------------------------- main

def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dataset", default="google/scin", help="Hub dataset id, or a local folder in the same format")
    p.add_argument("--model", default="facebook/dinov2-base", help="pretrained backbone on the Hub")
    p.add_argument("--output-dir", default=str(Path(__file__).parent / "runs" / "epivascan-skin"))
    p.add_argument("--image-size", type=int, default=448,
                   help="input size in pixels; DINOv2 takes any multiple of 14, most others only their native size")
    p.add_argument("--epochs", type=int, default=30)
    p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--accumulate", type=int, default=2, help="gradient accumulation steps")
    p.add_argument("--lr", type=float, default=2e-5, help="peak learning rate of the top backbone block")
    p.add_argument("--head-lr", type=float, default=1e-3)
    p.add_argument("--layer-decay", type=float, default=0.75)
    p.add_argument("--weight-decay", type=float, default=0.05)
    p.add_argument("--warmup", type=float, default=0.1, help="share of training spent warming up")
    p.add_argument("--drop-path", type=float, default=0.1)
    p.add_argument("--mixup", type=float, default=0.2, help="0 turns it off")
    p.add_argument("--balance", type=float, default=0.5,
                   help="0 = every case counts the same, 1 = every condition counts the same")
    p.add_argument("--patience", type=int, default=8, help="stop after this many epochs without improvement")
    p.add_argument("--min-cases", type=int, default=50,
                   help=f"conditions with fewer cases than this are folded into '{OTHER}'")
    p.add_argument("--ungradable", choices=["skip", "other", "separate"], default="skip",
                   help="what to do with cases the dermatologists could not grade")
    p.add_argument("--max-cases", type=int, help="use only the first N cases (for quick tests)")
    p.add_argument("--from-checkpoint",
                   help="skip training: calibrate, test and export this saved checkpoint folder")
    p.add_argument("--workers", type=int, default=min(6, os.cpu_count() or 1))
    p.add_argument("--seed", type=int, default=17)
    p.add_argument("--report-to", default="none", help="e.g. trackio")
    p.add_argument("--push-to-hub", action="store_true")
    p.add_argument("--hub-model-id", help="repo name, e.g. epivascan-skin; add 'org/' in front to use an organisation")
    p.add_argument("--public", action="store_true", help="the Hub repo is created private unless this is set")
    return p.parse_args()


def main():
    args = parse_args()
    set_seed(args.seed)
    if args.push_to_hub:  # create the repo now, so a login problem fails before training, not after
        from huggingface_hub import HfApi
        if not args.hub_model_id:
            raise SystemExit("--push-to-hub needs --hub-model-id <name>")
        repo = HfApi().create_repo(args.hub_model_id, private=not args.public, exist_ok=True)
        args.hub_model_id = repo.repo_id  # now includes the account name
        print("Will publish to", repo)

    final = Path(args.output_dir) / "model"
    (final / "eval").mkdir(parents=True, exist_ok=True)

    from datasets import load_dataset
    raw = load_dataset(args.dataset, split="train")
    if args.max_cases:
        raw = raw.select(range(min(args.max_cases, len(raw))))
    image_columns = [c for c in IMAGE_COLUMNS if c in raw.column_names]
    meta = raw.remove_columns(image_columns).to_pandas()

    cases, case_soft, classes, uncovered = build_cases(meta, args.min_cases, args.ungradable)
    cases["split"] = assign_splits(cases, args.seed)
    table = image_table(cases, {c: raw.data.column(c).is_valid().to_numpy(zero_copy_only=False)
                                for c in image_columns})
    repeated = repeated_photos(raw, table)
    table = table[~repeated].reset_index(drop=True)
    soft = case_soft[table["case"].to_numpy()]
    ages = meta["age_group"].dropna().astype(str) if "age_group" in meta else pd.Series(dtype=str)
    adults_only = len(ages) > 0 and not ages.str.contains(r"UNDER|CHILD|_0_|_1[0-7]_", regex=True).any()

    print(f"\n{len(meta):,} cases in {args.dataset}; {len(cases):,} usable, {len(table):,} photos"
          f" ({int(repeated.sum())} repeated photos dropped)")
    sizes = table.drop_duplicates("case").groupby(["primary", "split"]).size().unstack(fill_value=0)
    for c, name in enumerate(classes):
        row = sizes.loc[c] if c in sizes.index else {}
        print(f"  {name:<30} train {row.get('train', 0):>5}  val {row.get('val', 0):>4}  test {row.get('test', 0):>4}")

    processor = build_processor(args.model, args.image_size)
    processor.save_pretrained(final)
    # Reloaded from disk the way the image-classification pipeline loads it.
    processor = AutoImageProcessor.from_pretrained(final, use_fast=False)
    args.image_size = int(processor.crop_size["height"])
    if args.from_checkpoint:
        model = AutoModelForImageClassification.from_pretrained(args.from_checkpoint)
        saved = [model.config.id2label[i] for i in range(model.config.num_labels)]
        if saved != classes:
            raise SystemExit(f"The checkpoint was trained on different classes: {saved}")
    else:
        model = build_model(args.model, classes, args.drop_path)

    views = {c: raw.select_columns([c]) for c in image_columns}
    index = {name: np.flatnonzero(table["split"] == name) for name in ("train", "val", "test")}
    augment = train_transform(args.image_size, processor.image_mean, processor.image_std)
    data = {name: SkinPhotos(views, table.iloc[rows], soft[rows], augment if name == "train" else Preprocess(processor))
            for name, rows in index.items()}

    frequency = np.bincount(table["primary"].to_numpy()[index["train"]], minlength=len(classes)).clip(min=1)
    class_weights = (frequency.mean() / frequency) ** args.balance
    class_weights = torch.tensor(class_weights / class_weights.mean(), dtype=torch.float32)

    trainer = SoftLabelTrainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(Path(args.output_dir) / "checkpoints"),
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=2 * args.batch_size,
            gradient_accumulation_steps=args.accumulate,
            learning_rate=args.lr,
            weight_decay=args.weight_decay,
            lr_scheduler_type="cosine",
            warmup_ratio=args.warmup,
            max_grad_norm=1.0,
            fp16=torch.cuda.is_available(),
            eval_strategy="epoch",
            save_strategy="epoch",
            logging_strategy="epoch",
            save_total_limit=2,
            save_only_model=True,
            load_best_model_at_end=True,
            metric_for_best_model="balanced_accuracy",
            greater_is_better=True,
            dataloader_num_workers=args.workers,
            # Not persistent: on Windows every kept-alive worker holds several GB of
            # committed memory, and train, validation and test loaders each keep their own.
            dataloader_persistent_workers=False,
            label_names=["labels", "primary"],
            report_to=args.report_to,
            seed=args.seed,
        ),
        train_dataset=data["train"],
        eval_dataset=data["val"],
        data_collator=default_data_collator,
        compute_metrics=lambda p: summary(softmax(p.predictions), *p.label_ids),
        callbacks=[EarlyStoppingCallback(early_stopping_patience=args.patience)],
        class_weights=class_weights,
        mixup=args.mixup,
        head_lr=args.head_lr,
        layer_decay=args.layer_decay,
    )
    if args.from_checkpoint:
        state = Path(args.from_checkpoint) / "trainer_state.json"
        history = json.loads(state.read_text(encoding="utf-8"))["log_history"] if state.exists() else []
    else:
        trainer.train()
        history = trainer.state.log_history

    # Calibrate on validation, fold the temperature into the head, then touch the test set once.
    val_logits = trainer.predict(data["val"]).predictions
    val_soft, val_primary = soft[index["val"]], table["primary"].to_numpy()[index["val"]]
    layer = output_layer(model)
    temperature = fit_temperature(val_logits, val_soft, val_primary) if layer is not None else 1.0
    if layer is not None:
        with torch.no_grad():
            layer.weight.div_(temperature)
            layer.bias.div_(temperature)
    val = summary(softmax(val_logits / temperature), val_soft, val_primary)
    probs = softmax(trainer.predict(data["test"]).predictions)
    report = evaluate(probs, soft[index["test"]], table.iloc[index["test"]], classes)
    report["validation"] = val
    report["temperature"] = temperature
    report["classes"] = classes

    model.config.problem_type = "single_label_classification"  # tells the pipeline to use softmax
    model.save_pretrained(final)
    (final / "eval" / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (final / "eval" / "training_log.json").write_text(json.dumps(history, indent=2), encoding="utf-8")
    save_plots(report, classes, final / "eval")
    (final / "README.md").write_text(
        model_card(args, classes, table, uncovered, report, val, temperature, adults_only), encoding="utf-8")

    # The saved folder must behave like the endpoint the website calls: image in, [{label, score}] out.
    scan = pipeline("image-classification", model=str(final), device=0 if torch.cuda.is_available() else -1)
    sample = scan(data["test"].image(0), top_k=len(classes))
    assert abs(sum(item["score"] for item in sample) - 1) < 1e-3 and set(sample[0]) == {"label", "score"}

    overall = report["overall"]
    print(f"\nValidation (compare runs on this): balanced accuracy {_pct(val['balanced_accuracy'])},"
          f" top match {_pct(val['top1'])}, top 3 {_pct(val['top3'])}")
    print(f"Test ({overall['cases']} cases, {overall['photos']} photos):"
          f" top match {_pct(overall['top1'], overall['top1_ci'])},"
          f" top 3 {_pct(overall['top3'], overall['top3_ci'])},"
          f" balanced accuracy {_pct(overall['balanced_accuracy'])}, calibration gap {100 * overall['ece']:.1f} points")
    print("Example output:", json.dumps(sample[:3]))
    if torch.cuda.is_available():
        print(f"Peak GPU memory: {torch.cuda.max_memory_allocated() / 2**30:.1f} GB")
    if not args.from_checkpoint:
        shutil.rmtree(Path(args.output_dir) / "checkpoints", ignore_errors=True)  # the final model is in model/
    print("Model, model card and charts saved to", final.resolve())

    if args.push_to_hub:
        HfApi().upload_folder(repo_id=args.hub_model_id, folder_path=str(final),
                              commit_message="EpivaScan skin-condition classifier")
        print(f"Pushed to https://huggingface.co/{args.hub_model_id}")


if __name__ == "__main__":
    main()
