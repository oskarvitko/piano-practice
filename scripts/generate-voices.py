"""Generate the bundled degree announcements locally; no TTS is used by the app.

Windows setup (from repository root):
  py -3.11 -m venv qa-output/voice-tools
  qa-output/voice-tools/Scripts/python.exe -m pip install piper-tts==1.8.0
  qa-output/voice-tools/Scripts/python.exe scripts/generate-voices.py --download

Models and the Python environment stay in ignored qa-output/. Only the tiny PCM
clips, manifest, and attribution are shipped. Model downloads use a pinned
upstream revision and are checked against SHA-256 before any inference.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import urllib.request
import wave

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "qa-output" / "voice-models"
OUTPUT = ROOT / "public" / "audio" / "voice"
REVISION = "5ec43b186ef915a195d3ddbcfd9916e76c503c3f"
BASE = f"https://huggingface.co/rhasspy/piper-voices/resolve/{REVISION}"
MODELS = {
    "en": {
        "path": "en/en_US/joe/medium/en_US-joe-medium.onnx",
        "sha256": "abf4b998e34045cbd00eaf050de2de620f81ded6eb8b85a24b022a1c2b3f08d2",
        "config_sha256": "9b91a652090ffa8a49e36569afa9acc8ead2b3a22a950e8e6ca11914f3e85d56",
        "words": ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Flat", "Sharp"],
    },
    "pl": {
        "path": "pl/pl_PL/darkman/medium/pl_PL-darkman-medium.onnx",
        "sha256": "cf757ee307e3a7c23d5d8f69934deab51683d01c1c6be376d3e13146020f1530",
        "config_sha256": "1208a7d257daba8d0a421e9f55ec8210db009d785cd4f7e0b0c9936b3168f1a0",
        "words": ["Jeden", "Dwa", "Trzy", "Cztery", "Pięć", "Sześć", "Siedem", "Bemol", "Krzyżyk"],
    },
}
TOKENS = ["1", "2", "3", "4", "5", "6", "7", "flat", "sharp"]


def checked_file(url: str, path: Path, expected: str, download: bool) -> None:
    if not path.exists():
        if not download:
            raise SystemExit(f"Missing {path}; run with --download to fetch the pinned model.")
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=120) as response:
            path.write_bytes(response.read())
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != expected:
        raise SystemExit(f"SHA-256 mismatch for {path}: {actual}")


def write_wav(path: Path, samples, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(samples.astype("<i2").tobytes())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    import numpy as np
    import onnxruntime
    from piper import PiperVoice, SynthesisConfig

    manifest = {"generator": "Piper 1.8.0", "modelRevision": REVISION, "clips": []}
    for language, model in MODELS.items():
        path = MODEL_DIR / Path(model["path"]).name
        checked_file(f"{BASE}/{model['path']}", path, model["sha256"], args.download)
        checked_file(f"{BASE}/{model['path']}.json", Path(f"{path}.json"), model["config_sha256"], args.download)
        onnxruntime.set_seed(20261125)
        voice = PiperVoice.load(path)
        sample_rate = voice.config.sample_rate
        audition = []
        for token, word in zip(TOKENS, model["words"]):
            chunks = list(voice.synthesize(word + ".", SynthesisConfig(
                length_scale=0.80, noise_scale=0.5, noise_w_scale=0.333,
                normalize_audio=False,
            )))
            audio = np.concatenate([chunk.audio_float_array for chunk in chunks]).astype(np.float64)
            if not np.all(np.isfinite(audio)) or np.max(np.abs(audio)) < 0.01:
                raise SystemExit(f"Silent or invalid synthesis: {language}/{token}")
            # A low threshold and 35 ms margins retain quiet consonants and word endings.
            threshold = max(np.max(np.abs(audio)) * 10 ** (-48 / 20), 0.00015)
            active = np.flatnonzero(np.abs(audio) >= threshold)
            margin = round(sample_rate * 0.035)
            audio = audio[max(0, active[0] - margin):min(len(audio), active[-1] + margin + 1)]
            # Remove DC; set a consistent -2 dBFS peak with short click-free edge fades.
            audio -= np.mean(audio)
            fade = min(round(sample_rate * 0.005), len(audio) // 2)
            audio[:fade] *= np.linspace(0, 1, fade)
            audio[-fade:] *= np.linspace(1, 0, fade)
            audio *= (10 ** (-2 / 20)) / np.max(np.abs(audio))
            pcm = np.rint(audio * 32767).astype("<i2")
            clip = OUTPUT / language / f"{token}.wav"
            write_wav(clip, pcm, sample_rate)
            entry = {
                "path": f"{language}/{token}.wav", "text": word,
                "durationSeconds": round(len(pcm) / sample_rate, 6),
                "sampleRate": sample_rate, "channels": 1, "bitsPerSample": 16,
                "peakDbfs": round(20 * math.log10(np.max(np.abs(pcm.astype(float))) / 32767), 3),
                "rmsDbfs": round(20 * math.log10(np.sqrt(np.mean((pcm.astype(float) / 32767) ** 2))), 3),
                "sha256": hashlib.sha256(clip.read_bytes()).hexdigest(),
            }
            manifest["clips"].append(entry)
            print(json.dumps(entry, ensure_ascii=False))
            audition.extend([pcm, np.zeros(round(sample_rate * 0.35), dtype="<i2")])
        write_wav(ROOT / "qa-output" / f"voice-audition-{language}.wav", np.concatenate(audition), sample_rate)
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
