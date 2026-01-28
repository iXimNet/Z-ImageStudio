# Z-Image Studio

A lightweight web studio for Z-Image Turbo and Z-Image with a modern-style front end.

## Features

- Prompt console with negative prompt, guidance scale, steps, and seed controls.
- Text-to-image generation with Z-Image Turbo or Z-Image (toggle in UI).
- Model-aware defaults: switching models applies recommended steps/guidance.
- Optional automatic model unload on switch to reduce VRAM usage.
- History gallery with preview, metadata, and delete.

## Quick start

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Run the app:

   ```bash
   python app.py
   ```

3. Open the UI:

   ```
   http://localhost:7860
   ```

## Notes

- Width and height must be divisible by 16.
- Z-Image Turbo runs best around 9 steps with low guidance values.
- Z-Image is tuned for 28-50 steps with guidance around 3-5.
- Outputs are saved to `generated_images/`, uploads to `uploads/`, history to `history.json`.

## Configuration

The app reads a `.env` file (not committed) for runtime options:

- `ZIMAGE_DEVICE`: `cuda` or `cpu` (blank = auto).
- `ZIMAGE_CPU_OFFLOAD`: `1` to enable CPU offload on CUDA, `0` to disable.
- `ZIMAGE_KEEP_MODELS`: `1` to keep multiple models loaded, `0` to unload others when switching.
