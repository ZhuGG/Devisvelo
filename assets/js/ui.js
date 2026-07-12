import { filterAndSortInventory } from "./inventory-controls.js";

export const elements = Object.fromEntries(["dropZone", "browseButton", "fileInput", "resetButton", "fileCard", "fileName", "fileMeta", "previewCanvas", "previewFrame", "exportButton", "copyButton", "statsRow", "statPages", "statRows", "statItems", "inventoryControls", "inventorySearch", "inventorySort", "visibleCount", "diagnostics", "emptyState", "resultsState", "resultsBody", "dropStatus", "toast"].map((id) => [id, document.getElementById(id)]));

let inventoryEntries = [];

export function showToast(message, isError = false) { const { toast } = elements; toast.textContent = message; toast.style.background = isError ? "#a83223" : "#11251f"; toast.classList.add("show"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3500); }
export function showStatus(message = "", type = "") { const { dropStatus } = elements; dropStatus.textContent = message; dropStatus.className = `status ${type}`; }
export function setAnalysisState(state) { elements.dropZone.classList.toggle("is-loading", state === "loading"); elements.browseButton.disabled = state === "loading"; }
export function showFile(file) { elements.fileCard.hidden = false; elements.fileName.textContent = file.name; elements.fileMeta.textContent = `${(file.size / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo · PDF`; }
export function resetUi() { inventoryEntries = []; elements.statsRow.hidden = true; elements.inventoryControls.hidden = true; elements.inventorySearch.value = ""; elements.inventorySort.value = "source"; elements.visibleCount.textContent = ""; elements.diagnostics.hidden = true; elements.emptyState.hidden = false; elements.resultsState.hidden = true; elements.resultsBody.innerHTML = ""; elements.exportButton.disabled = true; elements.copyButton.disabled = true; elements.previewFrame.hidden = true; elements.previewCanvas.width = 0; elements.previewCanvas.height = 0; }

export function renderStats({ pagesAnalyzed, totalRows, uniqueArticles, pages }) {
  elements.statsRow.hidden = false; elements.statPages.textContent = pagesAnalyzed; elements.statRows.textContent = totalRows; elements.statItems.textContent = uniqueArticles;
  const emptyPages = pages.filter((page) => page.lines && !page.found).map((page) => page.pageNumber);
  elements.diagnostics.hidden = false;
  if (emptyPages.length) { elements.diagnostics.className = "diagnostics warn"; elements.diagnostics.textContent = `Contrôle conseillé : aucune ligne retenue sur la page ${emptyPages.join(", ")}. Les autres pages ont bien été lues dans la même continuité de tableau.`; }
  else { elements.diagnostics.className = "diagnostics"; elements.diagnostics.textContent = `Lecture continue confirmée sur ${pagesAnalyzed} page${pagesAnalyzed > 1 ? "s" : ""} : ${totalRows} ligne${totalRows > 1 ? "s" : ""} ont été rattachées au devis.`; }
}

export function renderResults(aggregated) {
  inventoryEntries = [...(aggregated?.values() || [])].map((item, index) => ({ item, index }));
  const hasResults = inventoryEntries.length > 0; elements.inventoryControls.hidden = !hasResults; elements.exportButton.disabled = !hasResults; elements.copyButton.disabled = !hasResults;
  updateInventoryView();
}

export function updateInventoryView() {
  const visibleEntries = filterAndSortInventory(inventoryEntries, elements.inventorySearch.value, elements.inventorySort.value);
  const hasResults = inventoryEntries.length > 0; const hasVisibleEntries = visibleEntries.length > 0;
  elements.resultsState.hidden = !hasVisibleEntries; elements.emptyState.hidden = hasVisibleEntries;
  elements.emptyState.classList.toggle("is-filter-empty", hasResults && !hasVisibleEntries);
  if (hasResults && !hasVisibleEntries) { elements.emptyState.querySelector("h3").textContent = "Aucune pièce ne correspond à cette recherche."; elements.emptyState.querySelector("p").textContent = "Modifiez ou effacez le filtre pour retrouver l’inventaire complet."; }
  else if (!hasResults) { elements.emptyState.querySelector("h3").textContent = "Votre inventaire apparaîtra ici."; elements.emptyState.querySelector("p").textContent = "Le contrôle de lecture vous indique aussi les pages qui demandent votre attention."; }
  elements.visibleCount.textContent = elements.inventorySearch.value.trim() ? `${visibleEntries.length} / ${inventoryEntries.length} référence${visibleEntries.length > 1 ? "s" : ""} visible${visibleEntries.length > 1 ? "s" : ""}` : `${inventoryEntries.length} référence${inventoryEntries.length > 1 ? "s" : ""}`;
  elements.resultsBody.innerHTML = "";
  visibleEntries.forEach(({ item }) => { const tr = document.createElement("tr"); tr.innerHTML = `<td></td><td>${item.qty.toLocaleString("fr-FR")}</td><td><span class="page-tag">${item.pages.map((page) => `p.${page}`).join(" · ")}</span></td>`; tr.firstElementChild.textContent = item.description; elements.resultsBody.appendChild(tr); });
}
export async function renderPreview(pdf) { try { const page = await pdf.getPage(1); const viewport = page.getViewport({ scale: 1 }); const canvas = elements.previewCanvas; const ratio = window.devicePixelRatio || 1; canvas.width = viewport.width * ratio; canvas.height = viewport.height * ratio; await page.render({ canvasContext: canvas.getContext("2d"), viewport: page.getViewport({ scale: ratio }) }).promise; elements.previewFrame.hidden = false; } catch { elements.previewFrame.hidden = true; } }
