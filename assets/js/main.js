import * as pdfjsLib from "https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.min.mjs";
import { analyzePdf, buildClipboardContent, buildCsvContent, initializeAnalyzer, resetAnalysis } from "./analyzer.js";
import { elements, setAnalysisState, showFile, showStatus, showToast, updateInventoryView } from "./ui.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs";
initializeAnalyzer(pdfjsLib);
const successBell = new Audio("https://v3b.fal.media/files/b/0aa2035c/Mmdz6Mj-uauJeIcbPGcST_sound_effect.mp3");
successBell.preload = "auto";

async function handleFile(file) {
  if (!file) return;
  if (file.type !== "application/pdf") { showStatus("Choisissez un fichier PDF pour commencer.", "error"); return; }
  try {
    setAnalysisState("loading"); showFile(file); showStatus("Lecture de toutes les pages en cours…");
    const result = await analyzePdf(await file.arrayBuffer());
    if (!result.hasReadableText) { showStatus("Ce PDF ne contient pas de texte sélectionnable. Essayez une version non scannée.", "error"); return; }
    if (result.aggregated.size) {
      successBell.currentTime = 0;
      successBell.play().catch(() => {});
    }
    showStatus(result.aggregated.size ? `${result.pagesAnalyzed} page${result.pagesAnalyzed > 1 ? "s" : ""} contrôlée${result.pagesAnalyzed > 1 ? "s" : ""} · inventaire disponible.` : "Le tableau attendu n’a pas été trouvé.", result.aggregated.size ? "success" : "error");
  } catch (error) { console.error(error); showStatus("Impossible de lire ce PDF. Vérifiez qu’il n’est pas protégé.", "error"); showToast("Erreur de lecture du document.", true); }
  finally { setAnalysisState("idle"); elements.fileInput.value = ""; }
}
function exportCsv() { const content = buildCsvContent(); if (!content) return; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); link.download = `inventaire-devis-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast("Inventaire CSV exporté."); }
async function copyInventory() { try { await navigator.clipboard.writeText(buildClipboardContent()); showToast("Inventaire copié dans le presse-papiers."); } catch { showToast("La copie n’est pas disponible dans ce navigateur.", true); } }
function resetFile() { resetAnalysis(); elements.fileCard.hidden = true; showStatus(""); }

elements.browseButton.addEventListener("click", (event) => { event.preventDefault(); elements.fileInput.click(); });
elements.fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
elements.exportButton.addEventListener("click", exportCsv); elements.copyButton.addEventListener("click", copyInventory); elements.resetButton.addEventListener("click", resetFile);
elements.inventorySearch.addEventListener("input", updateInventoryView); elements.inventorySort.addEventListener("change", updateInventoryView);
elements.dropZone.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); elements.fileInput.click(); } });
["dragenter", "dragover"].forEach((name) => elements.dropZone.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.add("is-drag-over"); }));
["dragleave", "drop"].forEach((name) => elements.dropZone.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.remove("is-drag-over"); }));
elements.dropZone.addEventListener("drop", (event) => handleFile(event.dataTransfer.files[0]));
