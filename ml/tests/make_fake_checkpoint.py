"""Write a tiny untrained model in the same format train.py produces.

It lets ml/space/app.py be run down its real path (load a checkpoint, classify a photo)
before a trained model exists. The scores it gives are noise.

    python make_fake_checkpoint.py out_dir
    EPIVASCAN_MODEL=out_dir python ../space/app.py
"""
import argparse
import os
import sys
from pathlib import Path

from transformers import BitImageProcessor, Dinov2Config, Dinov2ForImageClassification

# The condition names come from the Space's mock answer. Importing app.py would load
# whatever EPIVASCAN_MODEL names, possibly the folder about to be written, so clear it first.
os.environ.pop("EPIVASCAN_MODEL", None)
sys.path.insert(0, str(Path(__file__).parent.parent / "space"))
from app import MOCK_SCORES  # noqa: E402

SIZE = 56  # four 14-pixel patches a side: small enough to run instantly on a CPU


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out_dir", help="folder to write the model into")
    args = parser.parse_args()

    classes = list(MOCK_SCORES)
    config = Dinov2Config(
        hidden_size=32, num_hidden_layers=2, num_attention_heads=2, image_size=SIZE, patch_size=14,
        id2label=dict(enumerate(classes)), label2id={name: i for i, name in enumerate(classes)},
    )
    Dinov2ForImageClassification(config).save_pretrained(args.out_dir)
    BitImageProcessor(
        size={"shortest_edge": SIZE}, crop_size={"height": SIZE, "width": SIZE},
    ).save_pretrained(args.out_dir)
    print(f"Wrote an untrained {len(classes)}-class model to {args.out_dir}")


if __name__ == "__main__":
    main()
