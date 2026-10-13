"""Run the EpivaScan model on one photo and print what the app would receive.

    python predict.py photo.jpg                                 # the last local training run
    python predict.py photo.jpg --model <user>/epivascan-skin   # a model on the Hub
"""
import argparse
import json
from pathlib import Path

import torch
from transformers import pipeline

LOCAL = Path(__file__).parent / "runs" / "epivascan-skin" / "model"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("photo", help="path or URL of an image")
    parser.add_argument("--model", default=str(LOCAL), help="local model folder or Hub id")
    parser.add_argument("--top", type=int, default=5, help="how many matches to show")
    args = parser.parse_args()

    scan = pipeline("image-classification", model=args.model, device=0 if torch.cuda.is_available() else -1)
    print(json.dumps(scan(args.photo, top_k=args.top), indent=2))


if __name__ == "__main__":
    main()
