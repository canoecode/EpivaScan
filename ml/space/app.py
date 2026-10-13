"""EpivaScan Space: takes one photo, answers with the skin conditions it most resembles.

The website's scan page and the phone app both call /predict here.

    python app.py                                              # mock: made-up numbers, no model
    EPIVASCAN_MODEL=<user>/epivascan-skin python app.py        # a trained model on the Hub
    EPIVASCAN_MODEL=../runs/epivascan-skin/model python app.py # a local model folder

Without EPIVASCAN_MODEL every photo gets the same sample values and every response says
so ("mock": true), so the site can be built and tested before training finishes.
"""
import os
from pathlib import Path

import gradio as gr

MODEL = os.environ.get("EPIVASCAN_MODEL", "").strip()
MOCK = not MODEL

# What mock mode answers. The names are the conditions train.py produces with its default
# settings; the scores are invented and add up to 1 like real model output.
MOCK_SCORES = {
    "Eczema (dermatitis)": 0.52,
    "Contact dermatitis": 0.17,
    "Psoriasis": 0.09,
    "Tinea (ringworm)": 0.06,
    "Other / unclear": 0.05,
    "Hives (urticaria)": 0.03,
    "Insect bite": 0.02,
    "Folliculitis": 0.02,
    "Drug rash": 0.01,
    "Pityriasis rosea": 0.01,
    "Acne": 0.01,
    "Impetigo": 0.005,
    "Shingles (herpes zoster)": 0.003,
    "Cold sore (herpes simplex)": 0.002,
}

DISCLAIMER = (
    "**EpivaScan is not a medical device and does not give a diagnosis.** It is a screening aid "
    "in development and is no substitute for an examination by a qualified health professional. "
    "If a skin problem is painful, bleeding, spreading or changing quickly, seek medical care."
)


def load_classifier():
    """Returns photo -> [{"label", "score"}, ...] covering every condition, best match first."""
    if MOCK:
        ranked = [{"label": label, "score": score}
                  for label, score in sorted(MOCK_SCORES.items(), key=lambda item: -item[1])]
        return lambda photo: ranked

    # Imported here so mock mode starts without torch. A model that fails to load stops the
    # app: answering with made-up numbers while claiming to be live would be worse.
    import torch
    from transformers import pipeline

    scan = pipeline("image-classification", model=MODEL, device=0 if torch.cuda.is_available() else -1)
    return lambda photo: scan(photo, top_k=scan.model.config.num_labels)


classify = load_classifier()


def info() -> dict:
    """Which mode the Space is in, so a page can say so before a photo is uploaded."""
    name = "mock" if MOCK else Path(MODEL).name if Path(MODEL).is_dir() else MODEL
    return {"mock": MOCK, "model": name}


def predict(photo) -> dict:
    if photo is None:
        raise gr.Error("Add a photo first.")
    return {**info(), "predictions": classify(photo)}


def top_matches(response: dict) -> dict:
    return {match["label"]: match["score"] for match in response["predictions"]}


# delete_cache: uploaded photos are removed from temporary storage every 10 minutes once
# they are 10 minutes old.
with gr.Blocks(title="EpivaScan", delete_cache=(600, 600)) as demo:
    gr.Markdown("# EpivaScan\nAdd a photo of a skin concern to see which conditions it most resembles.")
    if MOCK:
        gr.Markdown("> **Test mode.** No model is connected. Every photo gets the same sample "
                    "values, which are not an analysis of the photo.")

    with gr.Row():
        with gr.Column():
            photo = gr.Image(type="pil", sources=["upload", "webcam", "clipboard"],
                             label="Photo of the skin area", height=340)
            button = gr.Button("Analyse photo", variant="primary")
        with gr.Column():
            matches = gr.Label(num_top_classes=5, label="Sample values" if MOCK else "Closest matches")
            with gr.Accordion("What the website receives", open=False):
                response = gr.JSON(show_label=False)

    gr.Markdown(DISCLAIMER)

    button.click(predict, photo, response, api_name="predict").success(
        top_matches, response, matches, api_visibility="private")
    gr.api(info, api_name="info")


if __name__ == "__main__":
    demo.queue(max_size=32).launch(
        max_file_size="15mb",
        theme=gr.themes.Soft(primary_hue="teal", neutral_hue="stone",
                             font=[gr.themes.GoogleFont("Instrument Sans"), "system-ui", "sans-serif"]),
    )
