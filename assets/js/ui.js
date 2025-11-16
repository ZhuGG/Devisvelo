const elements = {
  dropZone: document.getElementById("dropZone"),
  browseButton: document.getElementById("browseButton"),
  fileInput: document.getElementById("fileInput"),
  previewCanvas: document.getElementById("previewCanvas"),
  exportButton: document.getElementById("exportButton"),
  statsRow: document.getElementById("statsRow"),
  statPages: document.getElementById("statPages"),
  statRows: document.getElementById("statRows"),
  statItems: document.getElementById("statItems"),
  statsNote: document.getElementById("statsNote"),
  emptyState: document.getElementById("emptyState"),
  resultsState: document.getElementById("resultsState"),
  resultsContext: document.getElementById("resultsContext"),
  resultsWrapper: document.getElementById("resultsWrapper"),
  resultsBody: document.getElementById("resultsBody"),
  dropStatus: document.getElementById("dropStatus"),
  toastEl: document.getElementById("toast"),
};

export { elements };

const STATUS_ICONS = {
  info: "ℹ️",
  error: "⚠️",
  success: "✅",
};

const ANALYSIS_STATES = ["idle", "loading", "success", "error"];
const EMPTY_STATS_NOTE = "Aucun article trouvé.";

export function showToast(message, isError = false) {
  const { toastEl } = elements;
  toastEl.textContent = message;
  toastEl.classList.toggle("toast-danger", isError);
  toastEl.classList.add("show");
  window.setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2800);
}

export function showStatus(type, message) {
  const { dropStatus } = elements;
  if (!type || !message) {
    dropStatus.textContent = "";
    dropStatus.className = "drop-status";
    dropStatus.setAttribute("aria-hidden", "true");
    return;
  }

  const icon = STATUS_ICONS[type] || STATUS_ICONS.info;
  dropStatus.innerHTML = `
    <span class="status-icon" aria-hidden="true">${icon}</span>
    <span>${message}</span>
  `;
  dropStatus.className = `drop-status status--${type}`;
  dropStatus.removeAttribute("aria-hidden");
}

export function setAnalysisState(state) {
  const { dropZone, browseButton } = elements;
  const normalizedState = ANALYSIS_STATES.includes(state) ? state : "idle";
  ANALYSIS_STATES.forEach((key) => {
    document.body.classList.toggle(`analysis-${key}`, key === normalizedState);
  });
  dropZone.classList.toggle("is-loading", normalizedState === "loading");
  dropZone.setAttribute("aria-busy", normalizedState === "loading" ? "true" : "false");
  browseButton.disabled = normalizedState === "loading";
}

export function resetUi() {
  const {
    statPages,
    statRows,
    statItems,
    statsRow,
    statsNote,
    emptyState,
    resultsState,
    resultsContext,
    resultsWrapper,
    resultsBody,
    exportButton,
    previewCanvas,
  } = elements;

  document.body.classList.remove("has-results");
  statPages.textContent = "0";
  statRows.textContent = "0";
  statItems.textContent = "0";
  statsRow.style.display = "none";
  statsNote.classList.remove("is-visible");
  statsNote.textContent = EMPTY_STATS_NOTE;
  emptyState.style.display = "flex";
  resultsState.style.display = "none";
  resultsState.classList.remove("is-visible");
  resultsContext.style.display = "none";
  resultsWrapper.style.display = "none";
  resultsBody.innerHTML = "";
  exportButton.disabled = true;

  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0, 0, previewCanvas.width || 0, previewCanvas.height || 0);
  previewCanvas.width = 0;
  previewCanvas.height = 0;
  previewCanvas.style.height = "";
  previewCanvas.style.width = "";
}

export function renderStats({ pagesAnalyzed = 0, totalRows = 0, uniqueArticles = 0 }) {
  const { statsRow, statPages, statRows, statItems, statsNote } = elements;
  if (!pagesAnalyzed) {
    statsRow.style.display = "none";
    statsNote.classList.remove("is-visible");
    statsNote.textContent = EMPTY_STATS_NOTE;
    return;
  }
  statsRow.style.display = "flex";
  statPages.textContent = String(pagesAnalyzed);
  statRows.textContent = String(totalRows);
  statItems.textContent = String(uniqueArticles);

  if (uniqueArticles === 0) {
    statsNote.textContent = EMPTY_STATS_NOTE;
    statsNote.classList.add("is-visible");
  } else {
    statsNote.textContent = "";
    statsNote.classList.remove("is-visible");
  }
}

export function renderResults(aggregated) {
  const {
    emptyState,
    resultsWrapper,
    resultsState,
    resultsContext,
    resultsBody,
    exportButton,
  } = elements;
  const hasResults = Boolean(aggregated && aggregated.size > 0);

  document.body.classList.toggle("has-results", hasResults);

  if (!hasResults) {
    emptyState.style.display = "flex";
    resultsState.style.display = "none";
    resultsState.classList.remove("is-visible");
    resultsContext.style.display = "none";
    resultsWrapper.style.display = "none";
    resultsBody.innerHTML = "";
    exportButton.disabled = true;
    return;
  }

  emptyState.style.display = "none";
  resultsState.style.display = "flex";
  resultsState.classList.add("is-visible");
  resultsContext.style.display = "flex";
  resultsWrapper.style.display = "block";
  exportButton.disabled = false;

  const entries = Array.from(aggregated.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0], "fr");
  });

  resultsBody.innerHTML = "";
  for (const [article, qty] of entries) {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdQty = document.createElement("td");
    tdName.textContent = article;
    tdQty.textContent = qty.toLocaleString("fr-FR");
    tdQty.className = "qty-cell";
    tr.appendChild(tdName);
    tr.appendChild(tdQty);
    resultsBody.appendChild(tr);
  }
}

export async function renderPreview(pdf) {
  const { previewCanvas } = elements;
  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0, 0, previewCanvas.width || 0, previewCanvas.height || 0);

  if (!pdf || pdf.numPages === 0) {
    return;
  }

  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.2 });
    const ratio = window.devicePixelRatio || 1;
    previewCanvas.width = viewport.width * ratio;
    previewCanvas.height = viewport.height * ratio;
    previewCanvas.style.height = "260px";
    previewCanvas.style.width = "100%";

    const scale = (previewCanvas.height / ratio) / viewport.height;
    const scaledViewport = page.getViewport({ scale });
    const renderContext = {
      canvasContext: ctx,
      viewport: scaledViewport,
    };

    await page.render(renderContext).promise;
  } catch (error) {
    console.error(error);
  }
}
