# backend/verify_audio.py
# Offline sanity check for Patch 010 Studio Finish. Runs the script-parse,
# synthesize (silent fallback OK), export, and share-payload paths without
# needing the model provider or the TTS voice models. Run inside the backend
# container:  python verify_audio.py
import os
import tempfile

from app.services.audio.service import AudioOverviewService
from app.services.audio import script_gen, export as audio_export


def main():
    os.environ.setdefault("AUDIO_DIR", tempfile.mkdtemp())

    # [1] script parse
    lines = script_gen.parse_script(
        "Maya: ARR grew 23 percent. [S2]\nTheo: NPS fell to 31. [S3]", "deep_dive")
    assert lines and lines[0].cite == 2, "script parse failed"
    print(f"[1] script parsed: {len(lines)} lines, first cite={lines[0].cite}")

    # [2] synthesize (offline engine, silent fallback if no models)
    svc = AudioOverviewService()  # no gen/retriever -> grounded stub path
    ov = svc.generate(None, "ws-test", title="Verify", style="deep_dive")
    assert ov.duration > 0 and os.path.exists(ov.audio_path), "synth failed"
    print(f"[2] synthesized: {ov.duration}s -> {ov.audio_path}")

    # [3] exports
    md = audio_export.to_markdown(ov.title, ov.transcript())
    pdf = audio_export.to_pdf(ov.title, ov.transcript())
    assert md.startswith("# Verify") and pdf[:4] == b"%PDF", "export failed"
    print(f"[3] exports OK: md {len(md)} chars, pdf {len(pdf)} bytes")

    # [4] punctuation guard on spoken text (T10)
    bad = [c for ln in ov.lines for c in ln.text if c in "\u2013\u2014\u2026"]
    assert not bad, "forbidden punctuation in spoken text"
    print("[4] punctuation clean (no em/en dash, no ellipsis)")

    print("[OK] Studio Finish (Audio Overview) module imports and runs.")


if __name__ == "__main__":
    main()
