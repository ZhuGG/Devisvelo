import * as pdfjsLib from "https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.min.mjs";
import { analyzePdf, buildCsvContent, initializeAnalyzer } from "./analyzer.js";
import { elements, setAnalysisState, showStatus, showToast } from "./ui.js";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs";

initializeAnalyzer(pdfjsLib);

const { dropZone, browseButton, fileInput, exportButton } = elements;

setAnalysisState("idle");

async function handleFile(file) {
  if (!file) {
    return;
  }

  showStatus();

  if (file.type !== "application/pdf") {
    showStatus("error", "Ce fichier n’est pas un PDF. Choisis un devis au format PDF.");
    showToast("Merci de sélectionner un PDF.", true);
    setAnalysisState("error");
    return;
  }

  try {
    setAnalysisState("loading");
    const arrayBuffer = await file.arrayBuffer();
    const analysisResult = await analyzePdf(arrayBuffer);
    const hasText = analysisResult.hasReadableText;
    const hasLines = analysisResult.aggregated && analysisResult.aggregated.size > 0;

    if (!hasText) {
      showStatus(
        "error",
        "Je ne trouve pas de texte dans ce PDF (scanné ou protégé).",
      );
      setAnalysisState("error");
      return;
    }

    if (!hasLines) {
      showStatus(
        "error",
        "Je ne trouve pas le tableau ARTICLES / QTÉ / PU / TVA / TOTAL dans ce devis.",
      );
      setAnalysisState("error");
      return;
    }

    const count = analysisResult.aggregated.size;
    const suffix = count > 1 ? "s" : "";
    showStatus("success", `Analyse réussie : ${count} article${suffix} détecté${suffix}.`);
    setAnalysisState("success");
  } catch (error) {
    console.error(error);
    showStatus("error", "Impossible de lire ce PDF. Réessaie avec un devis valide.");
    showToast("Erreur lors de la lecture du PDF.", true);
    setAnalysisState("error");
  } finally {
    fileInput.value = "";
    if (document.body.classList.contains("analysis-loading")) {
      setAnalysisState("idle");
    }
  }
}

function exportCsv() {
  const csvContent = buildCsvContent();
  if (!csvContent) {
    return;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pieces_devis_agregees_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV exporté.");
}

browseButton.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  handleFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(
    eventName,
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.add("is-drag-over");
    },
    false,
  );
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(
    eventName,
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove("is-drag-over");
    },
    false,
  );
});

dropZone.addEventListener("drop", (event) => {
  const { files } = event.dataTransfer;
  if (!files || files.length === 0) {
    return;
  }
  if (files.length > 1) {
    showToast("Un seul PDF à la fois, je prends le premier.");
  }
  handleFile(files[0]);
});

exportButton.addEventListener("click", exportCsv);
