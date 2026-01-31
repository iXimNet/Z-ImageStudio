const form = document.getElementById("generationForm");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const statusElapsed = document.getElementById("statusElapsed");
const generateBtn = document.getElementById("generateBtn");
const modelInput = document.getElementById("model");
const modelButtons = Array.from(document.querySelectorAll(".mode-btn"));
const modelToggle = document.querySelector(".mode-toggle");
const modelIndicator = modelToggle ? modelToggle.querySelector(".mode-indicator") : null;
const modelHint = document.getElementById("modelHint");
const guidanceScale = document.getElementById("guidanceScale");
const guidanceValue = document.getElementById("guidanceValue");
const outputPreview = document.getElementById("outputPreview");
const previewSteps = document.getElementById("previewSteps");
const previewGuidance = document.getElementById("previewGuidance");
const previewSeed = document.getElementById("previewSeed");
const previewDuration = document.getElementById("previewDuration");
const previewMode = document.getElementById("previewMode");
const previewModel = document.getElementById("previewModel");
const previewSize = document.getElementById("previewSize");
const historyGrid = document.getElementById("historyGrid");
const historyEmpty = document.getElementById("historyEmpty");
const historyCount = document.getElementById("historyCount");
const randomSeed = document.getElementById("randomSeed");
const widthInput = document.getElementById("width");
const heightInput = document.getElementById("height");
const previewModal = document.getElementById("previewModal");
const modalImage = document.getElementById("modalImage");
const modalImageWrap = document.getElementById("modalImageWrap");
const modalDialog = previewModal ? previewModal.querySelector(".modal-dialog") : null;
const modalBody = previewModal ? previewModal.querySelector(".modal-body") : null;
const modalDetailsPanel = previewModal ? previewModal.querySelector(".modal-details") : null;
const modalPrompt = document.getElementById("modalPrompt");
const modalNegative = document.getElementById("modalNegative");
const modalModel = document.getElementById("modalModel");
const modalMode = document.getElementById("modalMode");
const modalSize = document.getElementById("modalSize");
const modalSteps = document.getElementById("modalSteps");
const modalGuidance = document.getElementById("modalGuidance");
const modalSeed = document.getElementById("modalSeed");
const modalDuration = document.getElementById("modalDuration");
const modalFileName = document.getElementById("modalFileName");
const modalFileSize = document.getElementById("modalFileSize");
const modalStrengthWrap = document.getElementById("modalStrengthWrap");
const modalStrength = document.getElementById("modalStrength");
const modalInputsWrap = document.getElementById("modalInputsWrap");
const modalInputs = document.getElementById("modalInputs");
const modalScale = document.getElementById("modalScale");
const modalToggleScale = document.getElementById("modalToggleScale");
const modalToggleFullscreen = document.getElementById("modalToggleFullscreen");
const modalDelete = document.getElementById("modalDelete");

const placeholderEmptySvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#dbeeff"/>` +
    `<stop offset="100%" stop-color="#ffe4d6"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="800" height="520" fill="url(#bg)"/>` +
    `<text x="60" y="280" font-family="Unbounded, Arial" font-size="34" fill="#0f172a">Waiting for your first Z-Image render</text>` +
  `</svg>`
);

const placeholderNextSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#dbeeff"/>` +
    `<stop offset="100%" stop-color="#ffe4d6"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="800" height="520" fill="url(#bg)"/>` +
    `<text x="60" y="280" font-family="Unbounded, Arial" font-size="34" fill="#0f172a">Waiting for your next Z-Image render</text>` +
  `</svg>`
);

const previewPlaceholders = {
  empty: `data:image/svg+xml;utf8,${placeholderEmptySvg}`,
  next: `data:image/svg+xml;utf8,${placeholderNextSvg}`
};

function getPreviewPlaceholder(hasHistory) {
  return hasHistory ? previewPlaceholders.next : previewPlaceholders.empty;
}

function clearPreviewDetails() {
  previewSteps.textContent = "-";
  previewGuidance.textContent = "-";
  previewSeed.textContent = "-";
  previewDuration.textContent = "-";
  previewMode.textContent = "-";
  if (previewModel) {
    previewModel.textContent = "-";
  }
  previewSize.textContent = "-";
}

function setPreviewPlaceholder(hasHistory) {
  if (!outputPreview) return;
  outputPreview.src = getPreviewPlaceholder(hasHistory);
  state.previewEntryId = null;
  clearPreviewDetails();
}

const MODEL_PRESETS = {
  "z-image-turbo": {
    label: "Z-Image Turbo",
    hint: "Turbo runs best around 9 steps with low guidance.",
    steps: 9,
    guidance: 0.0
  },
  "z-image": {
    label: "Z-Image",
    hint: "Recommended: 512-2048 px, steps 28-50, guidance 3-5.",
    steps: 50,
    guidance: 4.0
  }
};

const MODEL_LABELS = {
  "z-image-turbo": "Z-Image Turbo",
  "z-image": "Z-Image",
  legacy: "Legacy"
};

const state = {
  history: [],
  activeEntry: null,
  previewEntryId: null,
  model: modelInput?.value || "z-image-turbo"
};

setPreviewPlaceholder(false);

let statusTimer = null;
let statusStart = null;
let modalScaleMode = "fit";
let modalResizeHandler = null;
let modalDragActive = false;
let modalDragStartX = 0;
let modalDragStartY = 0;
let modalDragScrollLeft = 0;
let modalDragScrollTop = 0;
let modalLastFocused = null;
let modalZoom = 1;

setStatus("idle", "Idle. Ready to render.");

function getModelPreset(modelId) {
  return MODEL_PRESETS[modelId] || MODEL_PRESETS["z-image-turbo"];
}

function getModelLabel(entry) {
  const provider = entry?.provider;
  if (!provider) {
    return MODEL_LABELS["z-image-turbo"];
  }
  return MODEL_LABELS[provider] || provider;
}

function applyModelPreset(modelId) {
  const preset = getModelPreset(modelId);
  state.model = modelId;
  if (modelInput) {
    modelInput.value = modelId;
  }
  if (modelButtons.length) {
    modelButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.model === modelId);
      button.setAttribute(
        "aria-pressed",
        button.dataset.model === modelId ? "true" : "false"
      );
    });
  }
  if (modelHint) {
    modelHint.textContent = preset.hint;
  }
  const stepsInput = document.getElementById("steps");
  if (stepsInput) {
    stepsInput.value = preset.steps;
  }
  if (guidanceScale) {
    guidanceScale.value = preset.guidance;
  }
  if (guidanceValue) {
    guidanceValue.textContent = Number.parseFloat(preset.guidance).toFixed(1);
  }
  if (previewModel) {
    previewModel.textContent = preset.label;
  }
  updateModelIndicator();
}

if (modelButtons.length) {
  modelButtons.forEach((button) => {
    button.addEventListener("click", () => applyModelPreset(button.dataset.model));
  });
}
applyModelPreset(state.model);

function updateModelIndicator() {
  if (!modelToggle || !modelIndicator || !modelButtons.length) return;
  const activeButton =
    modelButtons.find((button) => button.classList.contains("active")) ||
    modelButtons[0];
  const toggleRect = modelToggle.getBoundingClientRect();
  const buttonRect = activeButton.getBoundingClientRect();
  const left = Math.max(0, buttonRect.left - toggleRect.left);
  modelIndicator.style.width = `${buttonRect.width}px`;
  modelIndicator.style.transform = `translateX(${left}px)`;
}

window.addEventListener("resize", () => {
  updateModelIndicator();
});

function setStatus(stateName, message) {
  statusEl.dataset.state = stateName;
  statusText.textContent = message;
  if (stateName === "busy") {
    startStatusTimer();
  } else {
    stopStatusTimer();
  }
}

if (guidanceScale && guidanceValue) {
  guidanceScale.addEventListener("input", () => {
    guidanceValue.textContent = Number.parseFloat(guidanceScale.value).toFixed(1);
  });
}

if (randomSeed) {
  randomSeed.addEventListener("click", () => {
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const seedInput = document.getElementById("seed");
    if (seedInput) {
      seedInput.value = seed;
    }
  });
}

Array.from(document.querySelectorAll("[data-size]")).forEach((button) => {
  button.addEventListener("click", () => {
    const size = Number.parseInt(button.dataset.size, 10);
    widthInput.value = size;
    heightInput.value = size;
    previewSize.textContent = `${size} x ${size}`;
  });
});

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (generateBtn) {
      generateBtn.disabled = true;
    }
    setStatus("busy", "Rendering image. This may take a moment.");

    const payload = collectFormData();
    if (!payload) {
      setStatus("error", "Check resolution and required fields.");
      if (generateBtn) {
        generateBtn.disabled = false;
      }
      return;
    }

    try {
      const result = await submitGeneration(payload);
      if (result?.error) {
        throw new Error(result.error);
      }
      if (result) {
        applyPreview(result);
        prependHistory(result);
        setStatus("idle", "Render complete. Stored in history.");
      }
    } catch (error) {
      setStatus("error", error.message || "Generation failed.");
    } finally {
      if (generateBtn) {
        generateBtn.disabled = false;
      }
    }
  });
}

if (previewModal) {
  previewModal.setAttribute("inert", "");
  previewModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close]")) {
      closeModal();
    }
  });
}

if (modalDelete) {
  modalDelete.addEventListener("click", async () => {
    if (!state.activeEntry) return;
    const confirmDelete = window.confirm("Delete this history item?");
    if (!confirmDelete) return;
    try {
      await deleteHistoryEntry(state.activeEntry.id);
      closeModal();
    } catch (error) {
      setStatus("error", error.message || "Delete failed.");
    }
  });
}

if (modalToggleScale) {
  modalToggleScale.addEventListener("click", () => {
    toggleModalScale();
  });
}

if (modalToggleFullscreen) {
  modalToggleFullscreen.addEventListener("click", () => {
    toggleModalFullscreen();
  });
}

if (modalImageWrap) {
  modalImageWrap.addEventListener(
    "wheel",
    (event) => {
      if (!modalImage || !modalImageWrap || !previewModal) return;
      if (!previewModal.classList.contains("fullscreen")) return;
      const delta = event.deltaY;
      if (!Number.isFinite(delta)) return;
      const zoomFactor = Math.exp(-delta * 0.0015);
      const nextZoom = Math.max(0.2, Math.min(8, modalZoom * zoomFactor));
      if (nextZoom === modalZoom) return;
      const rect = modalImageWrap.getBoundingClientRect();
      const anchorX = event.clientX - rect.left + modalImageWrap.scrollLeft;
      const anchorY = event.clientY - rect.top + modalImageWrap.scrollTop;
      const scaleFactor = nextZoom / modalZoom;
      modalZoom = nextZoom;
      applyModalImageSizing();
      updateModalScale();
      const nextScrollLeft = anchorX * scaleFactor - (event.clientX - rect.left);
      const nextScrollTop = anchorY * scaleFactor - (event.clientY - rect.top);
      modalImageWrap.scrollLeft = nextScrollLeft;
      modalImageWrap.scrollTop = nextScrollTop;
      updateModalEdgeState();
      event.preventDefault();
    },
    { passive: false }
  );

  modalImageWrap.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!isModalPannable()) return;
    modalDragActive = true;
    modalDragStartX = event.clientX;
    modalDragStartY = event.clientY;
    modalDragScrollLeft = modalImageWrap.scrollLeft;
    modalDragScrollTop = modalImageWrap.scrollTop;
    modalImageWrap.classList.add("is-panning");
    modalImageWrap.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  modalImageWrap.addEventListener("pointermove", (event) => {
    if (!modalDragActive) return;
    const dx = event.clientX - modalDragStartX;
    const dy = event.clientY - modalDragStartY;
    modalImageWrap.scrollLeft = modalDragScrollLeft - dx;
    modalImageWrap.scrollTop = modalDragScrollTop - dy;
    updateModalEdgeState();
    event.preventDefault();
  });

  const endDrag = (event) => {
    if (!modalDragActive) return;
    modalDragActive = false;
    modalImageWrap.classList.remove("is-panning");
    if (event?.pointerId !== undefined) {
      modalImageWrap.releasePointerCapture(event.pointerId);
    }
  };

  modalImageWrap.addEventListener("pointerup", endDrag);
  modalImageWrap.addEventListener("pointercancel", endDrag);
  modalImageWrap.addEventListener("pointerleave", endDrag);
  modalImageWrap.addEventListener("scroll", () => {
    updateModalEdgeState();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!previewModal) return;
  const isFullscreen = document.fullscreenElement === previewModal;
  previewModal.classList.toggle("fullscreen", isFullscreen);
  if (modalToggleFullscreen) {
    modalToggleFullscreen.textContent = isFullscreen ? "Exit" : "Full";
  }
  if (!isFullscreen) {
    modalScaleMode = "fit";
    modalZoom = 1;
    if (modalToggleScale) {
      modalToggleScale.textContent = "1:1";
    }
  }
  applyModalImageSizing();
  updateModalScale();
  updateModalDialogSize();
  updateModalEdgeState();
});

function collectFormData() {
  const prompt = document.getElementById("prompt").value.trim();
  const negativePrompt = document.getElementById("negativePrompt").value.trim();
  const model = modelInput ? modelInput.value : state.model;
  const width = Number.parseInt(widthInput.value, 10);
  const height = Number.parseInt(heightInput.value, 10);
  const steps = Number.parseInt(document.getElementById("steps").value, 10);
  const guidanceScaleValue = Number.parseFloat(guidanceScale.value);
  const seed = document.getElementById("seed").value.trim();

  if (!width || !height || width % 16 !== 0 || height % 16 !== 0) {
    return null;
  }

  return {
    model,
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    guidanceScale: guidanceScaleValue,
    seed
  };
}

async function submitGeneration(payload) {
  return fetchJson("/api/generate/text", payload);
}

async function fetchJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return readApiResponse(response);
}

async function readApiResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return { error: text };
  }
}

function applyPreview(entry) {
  outputPreview.src = entry.output?.path || getPreviewPlaceholder(true);
  state.previewEntryId = entry?.id ?? null;
  previewSteps.textContent = entry.params?.steps ?? "-";
  previewGuidance.textContent = entry.params?.guidanceScale ?? "-";
  previewSeed.textContent = entry.params?.seed ?? "-";
  previewDuration.textContent = formatDuration(entry.durationMs);
  previewMode.textContent = entry.mode === "t2i" ? "Text to Image" : "Image to Image";
  if (previewModel) {
    previewModel.textContent = getModelLabel(entry);
  }
  previewSize.textContent = `${entry.params?.width ?? "-"} x ${entry.params?.height ?? "-"}`;
}

function prependHistory(entry) {
  state.history.unshift(entry);
  renderHistory(state.history);
}

function renderHistory(entries) {
  historyGrid.innerHTML = "";
  historyCount.textContent = `${entries.length} items`;
  if (!entries.length) {
    historyEmpty.style.display = "block";
    return;
  }
  historyEmpty.style.display = "none";

  entries.forEach((entry, index) => {
    const card = document.createElement("article");
    card.className = "history-card";
    card.style.setProperty("--delay", `${Math.min(index, 8) * 0.05}s`);

    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = entry.output?.path || getPreviewPlaceholder(state.history.length > 0);
    img.alt = "Generated image";
    thumb.appendChild(img);
    thumb.addEventListener("click", () => openModal(entry));
    card.appendChild(thumb);

    const body = document.createElement("div");
    body.className = "history-body";

    const prompt = document.createElement("p");
    prompt.className = "history-prompt";
    prompt.textContent = entry.prompt || "Untitled prompt";

    const chipRow = document.createElement("div");
    chipRow.className = "chip-row";

    chipRow.appendChild(buildChip(`${entry.params?.width}×${entry.params?.height}`, "Resolution"));
    chipRow.appendChild(buildChip(`S: ${entry.params?.steps}`, "Steps"));
    chipRow.appendChild(buildChip(`G: ${entry.params?.guidanceScale}`, "Guidance Scale"));
    chipRow.appendChild(buildChip(`Sd: ${entry.params?.seed}`, "Seed"));
    if (entry.params?.strength !== null && entry.params?.strength !== undefined) {
      chipRow.appendChild(buildChip(`St: ${entry.params?.strength}`, "Strength"));
    }
    const actions = document.createElement("div");
    actions.className = "history-actions";
    const meta = document.createElement("div");
    meta.className = "history-meta";
    const modeLabel = entry.mode === "t2i" ? "Text to Image" : "Image to Image";
    const modelLabel = getModelLabel(entry);
    meta.textContent = `${modeLabel} - ${modelLabel} - ${formatDate(entry.createdAt)} - ${formatDuration(entry.durationMs)}`;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "history-delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
    const confirmDelete = window.confirm("Delete this history item?");
      if (!confirmDelete) return;
      try {
        await deleteHistoryEntry(entry.id);
      } catch (error) {
        setStatus("error", error.message || "Delete failed.");
      }
    });

    actions.appendChild(meta);
    actions.appendChild(deleteButton);

    body.appendChild(prompt);
    body.appendChild(chipRow);
    body.appendChild(actions);

    card.appendChild(body);
    historyGrid.appendChild(card);
  });
}

function buildChip(text, title) {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = text;
  if (title) {
    chip.title = title;
  }
  return chip;
}

function formatBytes(value) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDuration(value) {
  if (!value && value !== 0) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function renderModalInputs(entry) {
  if (!modalInputs || !modalInputsWrap) return;
  const inputs = entry?.inputs || (entry?.input ? [entry.input] : []);
  modalInputs.innerHTML = "";
  if (!inputs.length) {
    modalInputsWrap.style.display = "none";
    return;
  }
  modalInputsWrap.style.display = "grid";
  inputs.forEach((item) => {
    const thumb = document.createElement("div");
    thumb.className = "modal-input-thumb";
    const img = document.createElement("img");
    img.alt = "Input thumbnail";
    img.src = item.path;
    thumb.appendChild(img);
    modalInputs.appendChild(thumb);
  });
}

function getFileName(path) {
  if (!path) return "";
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function resetModalScale() {
  modalScaleMode = "fit";
  modalZoom = 1;
  applyModalImageSizing();
  if (modalToggleScale) {
    modalToggleScale.textContent = "1:1";
  }
  if (modalImage) {
    const scheduleUpdate = () =>
      requestAnimationFrame(() => {
        applyModalImageSizing();
        updateModalScale();
        updateModalDialogSize();
        updateModalEdgeState();
      });
    if (modalImage.complete) {
      scheduleUpdate();
    } else {
      modalImage.onload = scheduleUpdate;
    }
  }
}

function getModalBaseSize() {
  if (!modalImage || !modalImageWrap) return null;
  const naturalWidth = modalImage.naturalWidth;
  const naturalHeight = modalImage.naturalHeight;
  if (!naturalWidth || !naturalHeight) return null;
  if (modalScaleMode === "pixel") {
    const dpr = window.devicePixelRatio || 1;
    return {
      width: naturalWidth / dpr,
      height: naturalHeight / dpr
    };
  }
  const wrapWidth = modalImageWrap.clientWidth;
  const wrapHeight = modalImageWrap.clientHeight;
  if (!wrapWidth || !wrapHeight) {
    return { width: naturalWidth, height: naturalHeight };
  }
  const scale = Math.min(wrapWidth / naturalWidth, wrapHeight / naturalHeight);
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale
  };
}

function applyModalImageSizing() {
  if (!modalImage) return;
  if (previewModal) {
    previewModal.classList.toggle("scale-pixel", modalScaleMode === "pixel");
    if (modalScaleMode !== "pixel") {
      previewModal.classList.remove("modal-wide");
    }
  }
  const isFullscreen = previewModal?.classList.contains("fullscreen");
  if (modalScaleMode === "fit" && !isFullscreen && modalZoom === 1) {
    modalImage.style.width = "";
    modalImage.style.height = "";
    modalImage.style.maxWidth = "";
    modalImage.style.maxHeight = "";
    if (modalDialog) {
      modalDialog.style.width = "";
      modalDialog.style.maxWidth = "";
      modalDialog.style.maxHeight = "";
    }
    return;
  }
  const base = getModalBaseSize();
  if (!base) return;
  modalImage.style.width = `${base.width * modalZoom}px`;
  modalImage.style.height = `${base.height * modalZoom}px`;
  modalImage.style.maxWidth = "none";
  modalImage.style.maxHeight = "none";
  if (modalDialog) {
    modalDialog.style.width = "";
    modalDialog.style.maxWidth = "";
    modalDialog.style.maxHeight = "";
  }
}

function centerModalImage() {
  if (!modalImageWrap || !modalImage) return;
  if (modalScaleMode !== "pixel") return;
  const maxScrollLeft = modalImageWrap.scrollWidth - modalImageWrap.clientWidth;
  const maxScrollTop = modalImageWrap.scrollHeight - modalImageWrap.clientHeight;
  if (maxScrollLeft > 0) {
    modalImageWrap.scrollLeft = maxScrollLeft / 2;
  }
  if (maxScrollTop > 0) {
    modalImageWrap.scrollTop = maxScrollTop / 2;
  }
}

function updateModalDialogSize() {
  if (!previewModal || !modalDialog || !modalImageWrap || !modalImage || !modalBody) return;
  if (modalScaleMode !== "pixel") return;
  if (previewModal.classList.contains("fullscreen")) {
    modalDialog.style.width = "";
    modalDialog.style.maxWidth = "";
    modalDialog.style.maxHeight = "";
    previewModal.classList.remove("modal-wide");
    return;
  }
  const naturalWidth = modalImage.naturalWidth;
  const naturalHeight = modalImage.naturalHeight;
  if (!naturalWidth || !naturalHeight) return;
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = naturalWidth / dpr;
  const displayHeight = naturalHeight / dpr;
  const dialogRect = modalDialog.getBoundingClientRect();
  const bodyRect = modalBody.getBoundingClientRect();
  const detailsRect = modalDetailsPanel ? modalDetailsPanel.getBoundingClientRect() : null;
  const imageRect = modalImageWrap.getBoundingClientRect();
  const gap = detailsRect ? bodyRect.width - imageRect.width - detailsRect.width : 0;
  const chromeWidth = dialogRect.width - bodyRect.width;
  const chromeHeight = dialogRect.height - bodyRect.height;
  const targetBodyWidth = displayWidth + (detailsRect ? detailsRect.width : 0) + gap;
  const targetDialogWidth = targetBodyWidth + chromeWidth;
  const maxDialogWidth = window.innerWidth * 0.98;
  const desiredDialogWidth = Math.min(maxDialogWidth, Math.max(dialogRect.width, targetDialogWidth));
  const needsWidth = displayWidth > imageRect.width + 1 && desiredDialogWidth > dialogRect.width + 1;
  previewModal.classList.toggle("modal-wide", needsWidth);
  if (needsWidth) {
    modalDialog.style.width = `${Math.floor(desiredDialogWidth)}px`;
    modalDialog.style.maxWidth = "98vw";
  } else {
    modalDialog.style.width = "";
    modalDialog.style.maxWidth = "";
  }

  const maxDialogHeight = window.innerHeight * 0.96;
  const targetDialogHeight = displayHeight + chromeHeight;
  const desiredDialogHeight = Math.min(maxDialogHeight, Math.max(dialogRect.height, targetDialogHeight));
  const needsHeight = displayHeight > modalImageWrap.clientHeight + 1 && desiredDialogHeight > dialogRect.height + 1;
  modalDialog.style.maxHeight = needsHeight ? "96vh" : "";
}

function updateModalEdgeState() {
  if (!modalImageWrap) return;
  if (!isModalPannable()) {
    modalImageWrap.classList.add("edge-left", "edge-right", "edge-top", "edge-bottom");
    return;
  }
  const maxScrollLeft = modalImageWrap.scrollWidth - modalImageWrap.clientWidth;
  const maxScrollTop = modalImageWrap.scrollHeight - modalImageWrap.clientHeight;
  const atLeft = modalImageWrap.scrollLeft <= 1;
  const atRight = modalImageWrap.scrollLeft >= maxScrollLeft - 1;
  const atTop = modalImageWrap.scrollTop <= 1;
  const atBottom = modalImageWrap.scrollTop >= maxScrollTop - 1;
  modalImageWrap.classList.toggle("edge-left", atLeft);
  modalImageWrap.classList.toggle("edge-right", atRight);
  modalImageWrap.classList.toggle("edge-top", atTop);
  modalImageWrap.classList.toggle("edge-bottom", atBottom);
}

function updateModalDragState() {
  if (!modalImageWrap) return;
  const canDrag = isModalPannable();
  modalImageWrap.classList.toggle("is-pannable", canDrag);
  if (!canDrag) {
    modalImageWrap.classList.remove("is-panning");
  }
  updateModalEdgeState();
}

function isModalPannable() {
  if (!modalImageWrap || !modalImage) return false;
  return (
    modalImageWrap.scrollWidth > modalImageWrap.clientWidth + 1 ||
    modalImageWrap.scrollHeight > modalImageWrap.clientHeight + 1
  );
}

function updateModalScale() {
  if (!modalImage || !modalScale) return;
  const naturalWidth = modalImage.naturalWidth;
  const naturalHeight = modalImage.naturalHeight;
  if (!naturalWidth || !naturalHeight) {
    modalScale.textContent = "-";
    return;
  }
  const rect = modalImage.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    modalScale.textContent = "-";
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const scaleWidth = (rect.width * dpr) / naturalWidth;
  const scaleHeight = (rect.height * dpr) / naturalHeight;
  const scale = Math.min(scaleWidth, scaleHeight);
  modalScale.textContent = `${scale.toFixed(2)}x`;
  updateModalDragState();
  updateModalDialogSize();
}

function toggleModalScale() {
  if (!modalImage) return;
  const naturalWidth = modalImage.naturalWidth;
  const naturalHeight = modalImage.naturalHeight;
  if (!naturalWidth || !naturalHeight) return;

  if (modalScaleMode === "fit") {
    modalScaleMode = "pixel";
    modalZoom = 1;
    if (modalToggleScale) {
      modalToggleScale.textContent = "Fit";
    }
  } else {
    modalScaleMode = "fit";
    modalZoom = 1;
    if (modalToggleScale) {
      modalToggleScale.textContent = "1:1";
    }
  }
  applyModalImageSizing();
  updateModalScale();
  if (modalScaleMode === "pixel") {
    if (modalImage && !modalImage.complete) {
      modalImage.addEventListener(
        "load",
        () => {
          applyModalImageSizing();
          updateModalScale();
          updateModalDialogSize();
          centerModalImage();
          updateModalEdgeState();
        },
        { once: true }
      );
    }
    requestAnimationFrame(() => centerModalImage());
    requestAnimationFrame(() => updateModalEdgeState());
  }
}

function toggleModalFullscreen() {
  if (!previewModal) return;
  if (document.fullscreenElement === previewModal) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else {
      previewModal.classList.remove("fullscreen");
      if (modalToggleFullscreen) {
        modalToggleFullscreen.textContent = "Full";
      }
      applyModalImageSizing();
      updateModalScale();
      updateModalDialogSize();
      updateModalEdgeState();
    }
    return;
  }
  if (previewModal.requestFullscreen) {
    previewModal.requestFullscreen().catch(() => {
      previewModal.classList.add("fullscreen");
      if (modalToggleFullscreen) {
        modalToggleFullscreen.textContent = "Exit";
      }
      applyModalImageSizing();
      updateModalScale();
      updateModalDialogSize();
      updateModalEdgeState();
    });
  } else {
    previewModal.classList.add("fullscreen");
    if (modalToggleFullscreen) {
      modalToggleFullscreen.textContent = "Exit";
    }
    applyModalImageSizing();
    updateModalScale();
    updateModalDialogSize();
    updateModalEdgeState();
  }
}

function startStatusTimer() {
  statusStart = Date.now();
  updateStatusElapsed();
  if (statusTimer) {
    clearInterval(statusTimer);
  }
  statusTimer = setInterval(updateStatusElapsed, 1000);
}

function stopStatusTimer() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  statusStart = null;
  if (statusElapsed) {
    statusElapsed.textContent = "00:00";
  }
}

function updateStatusElapsed() {
  if (!statusElapsed || !statusStart) return;
  const elapsed = Date.now() - statusStart;
  statusElapsed.textContent = formatElapsed(elapsed);
}

function formatElapsed(value) {
  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function openModal(entry) {
  if (!previewModal) return;
  modalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  state.activeEntry = entry;
  if (modalToggleFullscreen) {
    modalToggleFullscreen.textContent = document.fullscreenElement === previewModal ? "Exit" : "Full";
  }
  modalImage.src = entry.output?.path || getPreviewPlaceholder(state.history.length > 0);
  modalPrompt.textContent = entry.prompt || "Untitled prompt";
  modalNegative.textContent = entry.negativePrompt || "-";
  if (modalModel) {
    modalModel.textContent = getModelLabel(entry);
  }
  modalMode.textContent = entry.mode === "t2i" ? "Text to Image" : "Image to Image";
  modalSize.textContent = `${entry.params?.width ?? "-"} x ${entry.params?.height ?? "-"}`;
  modalSteps.textContent = entry.params?.steps ?? "-";
  modalGuidance.textContent = entry.params?.guidanceScale ?? "-";
  modalSeed.textContent = entry.params?.seed ?? "-";
  modalDuration.textContent = formatDuration(entry.durationMs);
  if (modalFileName) {
    modalFileName.textContent = getFileName(entry.output?.path) || "-";
  }
  modalFileSize.textContent = entry.output?.sizeBytes ? formatBytes(entry.output.sizeBytes) : "-";

  if (entry.params?.strength !== null && entry.params?.strength !== undefined) {
    modalStrength.textContent = entry.params.strength;
    modalStrengthWrap.style.display = "block";
  } else {
    modalStrengthWrap.style.display = "none";
  }

  renderModalInputs(entry);
  resetModalScale();

  previewModal.classList.add("open");
  previewModal.setAttribute("aria-hidden", "false");
  previewModal.removeAttribute("inert");
  const closeButton = previewModal.querySelector("[data-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
  requestAnimationFrame(() => updateModalScale());

  if (!modalResizeHandler) {
    modalResizeHandler = () => {
      applyModalImageSizing();
      updateModalScale();
      updateModalDialogSize();
      updateModalEdgeState();
    };
    window.addEventListener("resize", modalResizeHandler);
  }
}

function closeModal() {
  if (!previewModal) return;
  if (document.fullscreenElement === previewModal && document.exitFullscreen) {
    document.exitFullscreen();
  }
  previewModal.classList.remove("fullscreen");
  if (modalToggleFullscreen) {
    modalToggleFullscreen.textContent = "Full";
  }
  const activeEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (activeEl && previewModal.contains(activeEl)) {
    activeEl.blur();
  }
  previewModal.classList.remove("open");
  previewModal.setAttribute("aria-hidden", "true");
  previewModal.setAttribute("inert", "");
  if (modalLastFocused) {
    modalLastFocused.focus();
  }
  modalLastFocused = null;
  state.activeEntry = null;
  resetModalScale();
  modalDragActive = false;
  if (modalImageWrap) {
    modalImageWrap.classList.remove("is-panning");
  }
  if (modalResizeHandler) {
    window.removeEventListener("resize", modalResizeHandler);
    modalResizeHandler = null;
  }
}

async function deleteHistoryEntry(id) {
  const response = await fetch(`/api/history/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Delete failed.");
  }
  const wasPreview = state.previewEntryId === id;
  state.history = state.history.filter((entry) => entry.id !== id);
  renderHistory(state.history);
  if (wasPreview || state.previewEntryId === null) {
    setPreviewPlaceholder(state.history.length > 0);
  }
}

async function loadHistory() {
  try {
    const response = await fetch("/api/history");
    const data = await response.json();
    state.history = Array.isArray(data) ? data : [];
    renderHistory(state.history);
    setPreviewPlaceholder(state.history.length > 0);
  } catch (error) {
    setStatus("error", "Unable to load history.");
  }
}

loadHistory();
