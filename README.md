# Z-Image Studio

轻量级的 Z-Image / Z-Image Turbo Web 端工作台，提供现代化界面与参数控制。  
A lightweight web studio for Z-Image and Z-Image Turbo with a modern UI and controls.

## 最近更新 / Recent Updates (2026-01-31)

- 历史卡片布局优化，内容顶对齐并保持同列高度一致。  
  History cards keep consistent height per row with top-aligned content.
- 预览占位与历史加载逻辑优化，删除当前预览时清空参数与占位。  
  Preview placeholder updates based on history; clearing on delete resets metadata.
- 预览大图支持 1:1、拖拽查看、边缘圆角提示与滚轮缩放；新增全屏预览。  
  Modal preview adds 1:1 view, drag-to-pan with edge cues, wheel zoom, and fullscreen mode.
- 运行时可配置推理 dtype（`ZIMAGE_DTYPE`），自动选择更兼容的类型。  
  Runtime dtype selection (`ZIMAGE_DTYPE`) to improve hardware compatibility.

## 功能 / Features

- 提示词控制台（负向提示词、引导尺度、步数、随机种子）。  
  Prompt console with negative prompt, guidance scale, steps, and seed controls.
- 文生图：支持 Z-Image Turbo 与 Z-Image，一键切换。  
  Text-to-image with Z-Image Turbo or Z-Image (toggle in UI).
- 切换模型时应用推荐参数默认值。  
  Model-aware defaults apply recommended steps/guidance on switch.
- 可选：切换模型时自动卸载旧模型以降低显存占用。  
  Optional auto-unload of previous models to reduce VRAM usage.
- 生成历史画廊（预览、元数据、删除）。  
  History gallery with preview, metadata, and delete.

## 快速开始 / Quick Start

1. 安装依赖 / Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. 运行应用 / Run the app:

   ```bash
   python app.py
   ```

3. 打开页面 / Open the UI:

   ```
   http://localhost:7860
   ```

4. 可选：从示例生成 `.env` / Optional: create `.env` from example:

   ```bash
   copy .env.example .env
   ```

## 说明 / Notes

- 宽高必须能被 16 整除。  
  Width and height must be divisible by 16.
- Z-Image Turbo 建议 9 步左右、低引导尺度。  
  Z-Image Turbo runs best around 9 steps with low guidance values.
- Z-Image 建议 28-50 步、引导尺度 3-5。  
  Z-Image is tuned for 28-50 steps with guidance around 3-5.
- 输出保存到 `generated_images/`，上传保存到 `uploads/`，历史保存到 `history.json`。  
  Outputs are saved to `generated_images/`, uploads to `uploads/`, history to `history.json`.

## 配置 / Configuration

应用会读取 `.env`（不提交到仓库）作为运行时配置：  
The app reads a `.env` file (not committed) for runtime options:

- `ZIMAGE_DEVICE`: `cuda` / `mps` / `cpu`（留空自动检测）。  
  `cuda` / `mps` / `cpu` (blank = auto).
- `ZIMAGE_DTYPE`: `bf16` / `fp16` / `fp32`（留空自动选择）。  
  `bf16` / `fp16` / `fp32` (blank = auto).
- `ZIMAGE_CPU_OFFLOAD`: CUDA 下启用 CPU Offload（`1` 启用，`0` 关闭）。  
  Enable CPU offload on CUDA (`1` enable, `0` disable).
- `ZIMAGE_KEEP_MODELS`: 是否保留多模型（`1` 保留，`0` 切换时卸载）。  
  Keep multiple models loaded (`1`) or unload others on switch (`0`).

## 模型来源与致谢 / Model Sources & Acknowledgements

本项目使用的 Z-Image 与 Z-Image-Turbo 模型由通义实验室（Tongyi-MAI）在 ModelScope 发布。感谢模型作者与社区的开源贡献与支持。  
Z-Image and Z-Image-Turbo are published by Tongyi-MAI on ModelScope. We respect and appreciate the authors and the community for their open-source contributions.

模型链接 / Model links:
```
https://www.modelscope.cn/models/Tongyi-MAI/Z-Image
https://www.modelscope.cn/models/Tongyi-MAI/Z-Image-Turbo
```
