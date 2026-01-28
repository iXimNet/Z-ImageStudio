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
const modalDelete = document.getElementById("modalDelete");

const placeholderSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#dbeeff"/>` +
    `<stop offset="100%" stop-color="#ffe4d6"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="800" height="520" fill="url(#bg)"/>` +
    `<text x="60" y="280" font-family="Unbounded, Arial" font-size="34" fill="#0f172a">Awaiting your first Z-Image render</text>` +
  `</svg>`
);

outputPreview.src = `data:image/svg+xml;utf8,${placeholderSvg}`;

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
  model: modelInput?.value || "z-image-turbo"
};

let statusTimer = null;
let statusStart = null;
let modalScaleMode = "fit";
let modalResizeHandler = null;

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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
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
  outputPreview.src = entry.output?.path || outputPreview.src;
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
    img.src = entry.output?.path || outputPreview.src;
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
  if (modalImage) {
    modalImage.style.width = "";
    modalImage.style.height = "";
  }
  if (modalToggleScale) {
    modalToggleScale.textContent = "1:1";
  }
  if (modalImage) {
    const scheduleUpdate = () => requestAnimationFrame(() => updateModalScale());
    if (modalImage.complete) {
      scheduleUpdate();
    } else {
      modalImage.onload = scheduleUpdate;
    }
  }
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
}

function toggleModalScale() {
  if (!modalImage) return;
  const naturalWidth = modalImage.naturalWidth;
  const naturalHeight = modalImage.naturalHeight;
  if (!naturalWidth || !naturalHeight) return;
  const dpr = window.devicePixelRatio || 1;

  if (modalScaleMode === "fit") {
    modalScaleMode = "pixel";
    modalImage.style.width = `${naturalWidth / dpr}px`;
    modalImage.style.height = `${naturalHeight / dpr}px`;
    if (modalToggleScale) {
      modalToggleScale.textContent = "Fit";
    }
  } else {
    modalScaleMode = "fit";
    modalImage.style.width = "";
    modalImage.style.height = "";
    if (modalToggleScale) {
      modalToggleScale.textContent = "1:1";
    }
  }
  updateModalScale();
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
  state.activeEntry = entry;
  modalImage.src = entry.output?.path || outputPreview.src;
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
  requestAnimationFrame(() => updateModalScale());

  if (!modalResizeHandler) {
    modalResizeHandler = () => updateModalScale();
    window.addEventListener("resize", modalResizeHandler);
  }
}

function closeModal() {
  if (!previewModal) return;
  previewModal.classList.remove("open");
  previewModal.setAttribute("aria-hidden", "true");
  state.activeEntry = null;
  resetModalScale();
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
  state.history = state.history.filter((entry) => entry.id !== id);
  renderHistory(state.history);
  setStatus("idle", "History entry deleted.");
}

async function loadHistory() {
  try {
    const response = await fetch("/api/history");
    const data = await response.json();
    state.history = Array.isArray(data) ? data : [];
    renderHistory(state.history);
  } catch (error) {
    setStatus("error", "Unable to load history.");
  }
}

loadHistory();
