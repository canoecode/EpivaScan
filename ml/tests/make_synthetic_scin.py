"""Write a small fake dataset in google/scin's exact format, to test train.py end to end.

    python tests/make_synthetic_scin.py <folder> [cases] [scale]
    python train.py --dataset <folder> --output-dir <folder>/run --epochs 3 --min-cases 12

The pictures are coloured shapes on a flat background, not skin. A model that learns them
shows the pipeline works; it says nothing about how the real model will perform. Pass a
scale such as 2.5 to get photo-sized files when measuring training speed.
"""
import random
import sys
from pathlib import Path

from datasets import Dataset, Features, Image, Value
from PIL import Image as PILImage
from PIL import ImageDraw, ImageFilter

TONES = [(244, 220, 200), (232, 196, 168), (212, 168, 132), (176, 128, 92), (128, 86, 58), (84, 56, 40)]
MIX = {"Eczema": 22, "Allergic Contact Dermatitis": 18, "Urticaria": 12, "Insect Bite": 12,
       "Psoriasis": 10, "Tinea": 10, "Folliculitis": 8, "Scabies": 3, "Granuloma annulare": 3,
       "Lichen planus/lichenoid eruption": 2}


def draw(condition: str, tone: tuple, rng: random.Random, scale: float = 1.0) -> PILImage.Image:
    w, h = rng.randint(300, 420), rng.randint(300, 420)
    image = PILImage.new("RGB", (w, h), tone)
    pen = ImageDraw.Draw(image)

    def spot(radius, colour, outline=None, width=0):
        x, y = rng.randint(radius, w - radius), rng.randint(radius, h - radius)
        pen.ellipse([x - radius, y - radius, x + radius, y + radius], fill=colour, outline=outline, width=width)

    red = (190 + rng.randint(-20, 20), 70, 70)
    if condition == "Eczema":
        for _ in range(rng.randint(25, 45)):
            spot(rng.randint(8, 26), (red[0], 110, 105))
    elif condition == "Allergic Contact Dermatitis":
        x, y = rng.randint(20, w // 2), rng.randint(20, h // 2)
        pen.rectangle([x, y, x + rng.randint(90, 160), y + rng.randint(40, 90)], fill=red)
    elif condition == "Urticaria":
        for _ in range(rng.randint(2, 4)):
            spot(rng.randint(40, 70), (236, 170, 170), outline=(210, 120, 120), width=5)
    elif condition == "Insect Bite":
        for _ in range(rng.randint(2, 5)):
            spot(rng.randint(7, 11), red, outline=(110, 30, 30), width=3)
    elif condition == "Psoriasis":
        for _ in range(rng.randint(1, 3)):
            spot(rng.randint(45, 75), (238, 238, 232), outline=red, width=9)
    elif condition == "Tinea":
        for _ in range(rng.randint(1, 3)):
            spot(rng.randint(35, 65), tone, outline=red, width=7)
    elif condition == "Folliculitis":
        for _ in range(rng.randint(30, 60)):
            spot(rng.randint(2, 4), (250, 244, 200), outline=red, width=1)
    elif condition == "Scabies":
        for _ in range(rng.randint(12, 24)):
            x, y = rng.randint(10, w - 30), rng.randint(10, h - 30)
            pen.line([x, y, x + rng.randint(8, 20), y + rng.randint(-8, 8)], fill=(90, 50, 40), width=2)
    else:
        for _ in range(rng.randint(6, 12)):
            spot(rng.randint(10, 18), (150, 90, 160))
    image = image.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.4)))
    if scale != 1:
        image = image.resize((int(w * scale), int(h * scale)), PILImage.BICUBIC)
    grain = PILImage.effect_noise(image.size, 40).convert("RGB")  # so files compress like photos
    return PILImage.blend(image, grain, 0.08)


def main():
    out = Path(sys.argv[1])
    cases = int(sys.argv[2]) if len(sys.argv) > 2 else 360
    scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    rng = random.Random(7)
    names, odds = list(MIX), list(MIX.values())
    columns = {name: [] for name in (
        "case_id", "age_group", "fitzpatrick_skin_type",
        "image_1_path", "image_2_path", "image_3_path",
        "image_1_shot_type", "image_2_shot_type", "image_3_shot_type",
        "dermatologist_gradable_for_skin_condition_1", "dermatologist_skin_condition_on_label_name",
        "dermatologist_skin_condition_confidence", "weighted_skin_condition_label",
        "dermatologist_fitzpatrick_skin_type_label_1", "dermatologist_fitzpatrick_skin_type_label_2",
        "dermatologist_fitzpatrick_skin_type_label_3",
        "monk_skin_tone_label_india", "monk_skin_tone_label_us")}

    for n in range(cases):
        leading = rng.choices(names, odds)[0]
        fst = rng.choices(range(1, 7), [8, 30, 28, 16, 12, 6])[0]
        labelled = rng.random() > 0.2
        style = rng.random()
        if not labelled:
            differential = {}
        elif style < 0.45:
            differential = {leading: 1.0}
        elif style < 0.70:
            differential = {leading: 0.5, rng.choice([c for c in names if c != leading]): 0.5}
        else:
            second, third = rng.sample([c for c in names if c != leading], 2)
            differential = {leading: 0.55, second: 0.27, third: 0.18}
        photos = rng.choices([1, 2, 3], [4, 3, 3])[0]
        shots = rng.sample(["CLOSE_UP", "AT_AN_ANGLE", "AT_DISTANCE"], 3)
        for k in (1, 2, 3):
            columns[f"image_{k}_path"].append(draw(leading, TONES[fst - 1], rng, scale) if k <= photos else None)
            columns[f"image_{k}_shot_type"].append(shots[k - 1] if k <= photos else None)
        columns["case_id"].append(str(-1000000000000000000 - n))
        columns["age_group"].append(rng.choice(["AGE_18_TO_29", "AGE_30_TO_39", "AGE_UNKNOWN"]))
        columns["fitzpatrick_skin_type"].append(rng.choice([f"FST{fst}", None, "NONE_IDENTIFIED"]))
        columns["dermatologist_gradable_for_skin_condition_1"].append(
            "DEFAULT_YES_IMAGE_QUALITY_SUFFICIENT" if labelled else "NO_IMAGE_QUALITY_INSUFFICIENT")
        columns["dermatologist_skin_condition_on_label_name"].append(str(list(differential)))
        columns["dermatologist_skin_condition_confidence"].append(str([4] * len(differential)))
        columns["weighted_skin_condition_label"].append(str(differential))
        columns["dermatologist_fitzpatrick_skin_type_label_1"].append(f"FST{fst}" if rng.random() > 0.1 else None)
        columns["dermatologist_fitzpatrick_skin_type_label_2"].append(
            f"FST{min(6, fst + 1)}" if rng.random() < 0.2 else None)
        columns["dermatologist_fitzpatrick_skin_type_label_3"].append(None)
        columns["monk_skin_tone_label_india"].append(float(min(10, max(1, round(1.6 * fst + rng.uniform(-1, 1))))))
        columns["monk_skin_tone_label_us"].append(float(min(10, max(1, round(1.6 * fst + rng.uniform(-1, 1))))))

    # SCIN documents a few photos that were submitted under more than one case.
    columns["image_1_path"][1] = columns["image_1_path"][0]

    features = Features({name: Image() if name.endswith("_path") else Value("float64") if name.startswith("monk")
                         else Value("string") for name in columns})
    target = out / "data" / "train-00000-of-00001.parquet"
    target.parent.mkdir(parents=True, exist_ok=True)
    Dataset.from_dict(columns, features=features).to_parquet(str(target))
    print(f"Wrote {cases} synthetic cases to {target}")


if __name__ == "__main__":
    main()
