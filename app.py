from __future__ import annotations

import json
import os
import secrets
import threading
import time
import uuid
import gc
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from modelscope import ZImagePipeline

ROOT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT_DIR / "public"
OUTPUT_DIR = ROOT_DIR / "generated_images"
UPLOAD_DIR = ROOT_DIR / "uploads"
HISTORY_FILE = ROOT_DIR / "history.json"
LEGACY_HISTORY_FILE = ROOT_DIR / "history.jsonl"
ENV_PATH = ROOT_DIR / ".env"

MAX_HISTORY = 200
DEFAULT_WIDTH = 1024
DEFAULT_HEIGHT = 1024
DEFAULT_TURBO_STEPS = 9
DEFAULT_TURBO_GUIDANCE = 0.0
DEFAULT_STEPS = DEFAULT_TURBO_STEPS
DEFAULT_GUIDANCE = DEFAULT_TURBO_GUIDANCE
DEFAULT_MODEL = "z-image-turbo"
MODEL_SPECS: Dict[str, Dict[str, Any]] = {
    "z-image-turbo": {
        "label": "Z-Image Turbo",
        "repo": "Tongyi-MAI/Z-Image-Turbo",
        "default_steps": DEFAULT_TURBO_STEPS,
        "default_guidance": DEFAULT_TURBO_GUIDANCE,
        "cfg_normalization": None,
    },
    "z-image": {
        "label": "Z-Image",
        "repo": "Tongyi-MAI/Z-Image",
        "default_steps": 50,
        "default_guidance": 4.0,
        "cfg_normalization": False,
    },
}
MODEL_ALIASES = {
    "z-image-turbo": "z-image-turbo",
    "zimage-turbo": "z-image-turbo",
    "turbo": "z-image-turbo",
    "z-image": "z-image",
    "zimage": "z-image",
}


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)


def load_history() -> List[Dict[str, Any]]:
    if not HISTORY_FILE.exists():
        return []
    try:
        with HISTORY_FILE.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def save_history(entries: List[Dict[str, Any]]) -> None:
    try:
        with HISTORY_FILE.open("w", encoding="utf-8") as handle:
            json.dump(entries, handle, ensure_ascii=False, indent=2)
    except Exception:
        pass


def append_history(entry: Dict[str, Any]) -> None:
    history = load_history()
    history.insert(0, entry)
    save_history(history[:MAX_HISTORY])


def parse_legacy_timestamp(value: Optional[str]) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    try:
        parsed = datetime.strptime(value, "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
        return parsed.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def bootstrap_history() -> None:
    if HISTORY_FILE.exists():
        return
    if not LEGACY_HISTORY_FILE.exists():
        save_history([])
        return

    entries: List[Dict[str, Any]] = []
    try:
        with LEGACY_HISTORY_FILE.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except Exception:
                    continue
                if not isinstance(record, dict):
                    continue
                filename = record.get("filename")
                if not filename:
                    continue
                output_path = Path(filename)
                if not output_path.exists():
                    continue
                output_name = output_path.name
                size_bytes = output_path.stat().st_size
                entries.append(
                    build_history_entry(
                        entry_id=uuid.uuid4().hex,
                        mode="t2i",
                        prompt=record.get("prompt", ""),
                        negative_prompt="",
                        width=int(record.get("width", DEFAULT_WIDTH)),
                        height=int(record.get("height", DEFAULT_HEIGHT)),
                        steps=int(record.get("num_steps", DEFAULT_STEPS)),
                        guidance_scale=DEFAULT_GUIDANCE,
                        seed=int(record.get("seed", 0)) if record.get("seed") is not None else 0,
                        strength=None,
                        output_name=output_name,
                        output_format=output_path.suffix.lstrip(".") or "png",
                        output_size_bytes=size_bytes,
                        inputs=None,
                        duration_ms=None,
                        created_at=parse_legacy_timestamp(record.get("timestamp")),
                        provider="legacy",
                    )
                )
    except Exception:
        entries = []

    save_history(entries)


def normalize_seed(seed: Optional[str]) -> int:
    if seed is None:
        return secrets.randbelow(2**32 - 1)
    if isinstance(seed, str) and not seed.strip():
        return secrets.randbelow(2**32 - 1)
    try:
        return int(seed)
    except (TypeError, ValueError):
        return secrets.randbelow(2**32 - 1)


def validate_resolution(width: int, height: int, scale: int) -> Optional[str]:
    if width <= 0 or height <= 0:
        return "Width and height must be positive."
    if width % scale != 0 or height % scale != 0:
        return f"Width and height must be divisible by {scale}."
    return None


def parse_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def has_invalid_value_warning(captured: List[warnings.WarningMessage]) -> bool:
    for warning in captured:
        message = str(warning.message).lower()
        if "invalid value encountered" in message or "nan" in message:
            return True
    return False


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def build_history_entry(
    *,
    entry_id: str,
    mode: str,
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    steps: int,
    guidance_scale: float,
    seed: int,
    strength: Optional[float],
    output_name: str,
    output_format: str,
    output_size_bytes: Optional[int],
    inputs: Optional[List[Dict[str, Any]]],
    duration_ms: Optional[int],
    created_at: Optional[str] = None,
    provider: str = DEFAULT_MODEL,
) -> Dict[str, Any]:
    return {
        "id": entry_id,
        "mode": mode,
        "createdAt": created_at or datetime.now(timezone.utc).isoformat(),
        "prompt": prompt,
        "negativePrompt": negative_prompt,
        "params": {
            "width": width,
            "height": height,
            "steps": steps,
            "guidanceScale": guidance_scale,
            "seed": seed,
            "strength": strength,
        },
        "output": {
            "path": f"/outputs/{output_name}",
            "format": output_format,
            "width": width,
            "height": height,
            "sizeBytes": output_size_bytes,
        },
        "input": inputs[0] if inputs else None,
        "inputs": inputs,
        "durationMs": duration_ms,
        "provider": provider,
    }


def cleanup_entry_files(entry: Dict[str, Any]) -> None:
    output_path = entry.get("output", {}).get("path")
    if output_path:
        delete_file(OUTPUT_DIR / Path(output_path).name)

    input_item = entry.get("input")
    if input_item and isinstance(input_item, dict):
        delete_file(UPLOAD_DIR / Path(input_item.get("path", "")).name)

    inputs = entry.get("inputs")
    if isinstance(inputs, list):
        for item in inputs:
            if not isinstance(item, dict):
                continue
            delete_file(UPLOAD_DIR / Path(item.get("path", "")).name)


def delete_file(path: Path) -> None:
    try:
        if path.is_file():
            path.unlink()
    except Exception:
        pass


class TextRequest(BaseModel):
    prompt: str = ""
    negativePrompt: str = ""
    model: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    steps: Optional[int] = None
    guidanceScale: Optional[float] = None
    seed: Optional[str] = None


ensure_dirs()
bootstrap_history()
load_env_file(ENV_PATH)

DEVICE_SETTING = (os.getenv("ZIMAGE_DEVICE") or "").strip().lower()

def is_mps_available() -> bool:
    return bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())

if torch.cuda.is_available():
    DEVICE = "cuda"
elif is_mps_available():
    DEVICE = "mps"
else:
    DEVICE = "cpu"

if DEVICE_SETTING in {"cuda", "cpu", "mps"}:
    if DEVICE_SETTING == "cuda" and not torch.cuda.is_available():
        DEVICE = "cpu"
    elif DEVICE_SETTING == "mps" and not is_mps_available():
        DEVICE = "cpu"
    else:
        DEVICE = DEVICE_SETTING
DTYPE_SETTING = (os.getenv("ZIMAGE_DTYPE") or "").strip().lower()
def resolve_torch_dtype() -> torch.dtype:
    if DEVICE == "cpu":
        if DTYPE_SETTING in {"fp16", "float16", "half"}:
            print("ZIMAGE_DTYPE=float16 requested on CPU; falling back to float32.")
            return torch.float32
        if DTYPE_SETTING in {"bf16", "bfloat16"}:
            return torch.bfloat16
        if DTYPE_SETTING in {"fp32", "float32"}:
            return torch.float32
        return torch.float32
    if DTYPE_SETTING in {"fp16", "float16", "half"}:
        return torch.float16
    if DTYPE_SETTING in {"bf16", "bfloat16"}:
        return torch.bfloat16
    if DTYPE_SETTING in {"fp32", "float32"}:
        return torch.float32
    if DEVICE == "cuda":
        if hasattr(torch.cuda, "is_bf16_supported") and torch.cuda.is_bf16_supported():
            return torch.bfloat16
        return torch.float16
    if DEVICE == "mps":
        return torch.float16
    return torch.float32

TORCH_DTYPE = resolve_torch_dtype()
print(f"Using device={DEVICE}, torch_dtype={TORCH_DTYPE}")
MPS_FALLBACK = parse_bool(os.getenv("PYTORCH_ENABLE_MPS_FALLBACK"), False)
MPS_UNET_FP32 = parse_bool(
    os.getenv("ZIMAGE_MPS_UNET_FP32"),
    DEVICE == "mps" and TORCH_DTYPE == torch.float16,
)
MPS_NAN_FALLBACK = parse_bool(os.getenv("ZIMAGE_MPS_NAN_FALLBACK"), True)
if DEVICE == "mps" and MPS_FALLBACK:
    print(
        "Warning: PYTORCH_ENABLE_MPS_FALLBACK=1 can trigger CPU fallback and slowdowns."
    )
CPU_OFFLOAD = parse_bool(os.getenv("ZIMAGE_CPU_OFFLOAD"), True)
KEEP_MODELS = parse_bool(os.getenv("ZIMAGE_KEEP_MODELS"), False)
MODEL_LOCK = threading.Lock()
PIPELINE_LOAD_LOCK = threading.Lock()
PIPELINES: Dict[str, ZImagePipeline] = {}
PIPELINE_VAE_SCALES: Dict[str, int] = {}


def resolve_model_id(value: Optional[str]) -> str:
    if not value:
        return DEFAULT_MODEL
    key = value.strip().lower()
    key = MODEL_ALIASES.get(key, key)
    if key not in MODEL_SPECS:
        raise ValueError(f"Unknown model '{value}'.")
    return key


def configure_pipeline_device(pipe: ZImagePipeline) -> None:
    if DEVICE == "cpu":
        pipe.to("cpu")
        return
    if DEVICE == "mps":
        pipe.to("mps")
        return
    if CPU_OFFLOAD and DEVICE == "cuda":
        try:
            pipe.enable_model_cpu_offload()
            return
        except Exception:
            pass
    pipe.to(DEVICE)


def upcast_mps_vae(pipe: ZImagePipeline, note: str) -> None:
    if getattr(pipe, "_mps_vae_fp32", False):
        return
    if not hasattr(pipe, "vae") or pipe.vae is None:
        return
    try:
        pipe.vae.to(device="mps", dtype=torch.float32)
        setattr(pipe, "_mps_vae_fp32", True)
        print(note)
    except Exception:
        pass


def upcast_mps_unet(pipe: ZImagePipeline, note: str) -> bool:
    if getattr(pipe, "_mps_unet_fp32", False):
        return False
    updated = False
    try:
        if hasattr(pipe, "unet") and pipe.unet is not None:
            pipe.unet.to(device="mps", dtype=torch.float32)
            updated = True
        if hasattr(pipe, "transformer") and pipe.transformer is not None:
            pipe.transformer.to(device="mps", dtype=torch.float32)
            updated = True
        if updated:
            setattr(pipe, "_mps_unet_fp32", True)
            print(note)
    except Exception:
        pass
    return updated


def run_pipe_with_warnings(pipe: ZImagePipeline, pipe_args: Dict[str, Any]):
    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always")
        result = pipe(**pipe_args)
    return result, captured


def load_pipeline(model_id: str) -> ZImagePipeline:
    spec = MODEL_SPECS[model_id]
    print(f"Loading {spec['label']} model...")
    load_kwargs = {"low_cpu_mem_usage": False}
    if DEVICE != "cpu" or TORCH_DTYPE != torch.float32:
        load_kwargs["torch_dtype"] = TORCH_DTYPE
    pipe = ZImagePipeline.from_pretrained(spec["repo"], **load_kwargs)
    configure_pipeline_device(pipe)
    if DEVICE == "mps" and TORCH_DTYPE == torch.float16:
        try:
            if hasattr(pipe, "upcast_vae"):
                pipe.upcast_vae()
                setattr(pipe, "_mps_vae_fp32", True)
                print("Upcasted VAE to float32 on MPS to avoid black images.")
            else:
                upcast_mps_vae(pipe, "Upcasted VAE to float32 on MPS to avoid black images.")
        except Exception:
            pass
        if MPS_UNET_FP32:
            upcast_mps_unet(
                pipe, "Upcasted UNet/transformer to float32 on MPS to reduce NaNs/black images."
            )
    PIPELINES[model_id] = pipe
    PIPELINE_VAE_SCALES[model_id] = int(getattr(pipe, "vae_scale_factor", 8) * 2)
    print(f"{spec['label']} model loaded successfully!")
    return pipe


def unload_other_pipelines(target_model_id: str) -> None:
    if KEEP_MODELS:
        return
    with MODEL_LOCK:
        for key in list(PIPELINES.keys()):
            if key == target_model_id:
                continue
            pipe = PIPELINES.pop(key, None)
            if pipe is None:
                continue
            try:
                if DEVICE != "mps" or TORCH_DTYPE != torch.float16:
                    pipe.to("cpu")
            except Exception:
                pass
            try:
                del pipe
            except Exception:
                pass
        if DEVICE == "cuda":
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass
        elif DEVICE == "mps" and hasattr(torch, "mps"):
            try:
                torch.mps.empty_cache()
            except Exception:
                pass
    gc.collect()


def get_pipeline(model_id: str) -> ZImagePipeline:
    with PIPELINE_LOAD_LOCK:
        unload_other_pipelines(model_id)
        pipe = PIPELINES.get(model_id)
        if pipe is not None:
            return pipe
        return load_pipeline(model_id)


def get_vae_scale(model_id: str) -> int:
    if model_id not in PIPELINE_VAE_SCALES:
        get_pipeline(model_id)
    return PIPELINE_VAE_SCALES.get(model_id, 16)


load_pipeline(DEFAULT_MODEL)

app = FastAPI()


@app.get("/api/history")
def api_history(limit: Optional[int] = None):
    history = load_history()
    if limit is not None and limit > 0:
        history = history[:limit]
    return JSONResponse(history)


@app.delete("/api/history/{entry_id}")
def api_history_delete(entry_id: str):
    history = load_history()
    index = next((i for i, entry in enumerate(history) if entry.get("id") == entry_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail="History entry not found.")
    entry = history.pop(index)
    save_history(history)
    cleanup_entry_files(entry)
    return JSONResponse({"ok": True, "entry": entry})


@app.post("/api/generate/text")
def api_generate_text(payload: TextRequest):
    started_at = time.time()
    prompt = (payload.prompt or "").strip()
    negative_prompt = (payload.negativePrompt or "").strip()
    try:
        model_id = resolve_model_id(payload.model)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{exc} Available models: {', '.join(sorted(MODEL_SPECS.keys()))}.",
        )
    model_spec = MODEL_SPECS[model_id]
    width = int(payload.width or DEFAULT_WIDTH)
    height = int(payload.height or DEFAULT_HEIGHT)
    steps = int(payload.steps or model_spec["default_steps"])
    guidance_scale = float(
        payload.guidanceScale
        if payload.guidanceScale is not None
        else model_spec["default_guidance"]
    )

    error = validate_resolution(width, height, get_vae_scale(model_id))
    if error:
        raise HTTPException(status_code=400, detail=error)

    seed = normalize_seed(payload.seed)
    generator = (
        torch.Generator(DEVICE).manual_seed(seed)
        if DEVICE in {"cuda", "mps"}
        else torch.Generator().manual_seed(seed)
    )

    pipe = get_pipeline(model_id)
    pipe_args = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "height": height,
        "width": width,
        "num_inference_steps": steps,
        "guidance_scale": guidance_scale,
        "generator": generator,
    }
    if model_spec["cfg_normalization"] is not None:
        pipe_args["cfg_normalization"] = model_spec["cfg_normalization"]

    with MODEL_LOCK:
        with torch.inference_mode():
            result, captured = run_pipe_with_warnings(pipe, pipe_args)
            if (
                DEVICE == "mps"
                and MPS_NAN_FALLBACK
                and TORCH_DTYPE in {torch.float16, torch.bfloat16}
                and has_invalid_value_warning(captured)
            ):
                print("MPS NaN warning detected; falling back to fp32 and retrying once.")
                upcast_mps_vae(
                    pipe,
                    "Upcasted VAE to float32 on MPS after NaNs/black image warning.",
                )
                if upcast_mps_unet(
                    pipe,
                    "Detected NaNs on MPS; upcasted UNet/transformer to float32 and retrying.",
                ):
                    result, _ = run_pipe_with_warnings(pipe, pipe_args)
            image = result.images[0]

    entry_id = uuid.uuid4().hex
    output_name = f"output-{entry_id}.png"
    output_path = OUTPUT_DIR / output_name
    image.save(output_path)

    duration_ms = int((time.time() - started_at) * 1000)
    size_bytes = output_path.stat().st_size if output_path.exists() else None
    output_format = output_path.suffix.lstrip(".") or "png"

    entry = build_history_entry(
        entry_id=entry_id,
        mode="t2i",
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        steps=steps,
        guidance_scale=guidance_scale,
        seed=seed,
        strength=None,
        output_name=output_name,
        output_format=output_format,
        output_size_bytes=size_bytes,
        inputs=None,
        duration_ms=duration_ms,
        provider=model_id,
    )
    append_history(entry)
    return JSONResponse(entry)


app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7860)
