import * as pdfjsLib from "https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.min.mjs";
import { analyzePdf, buildCsvContent, initializeAnalyzer } from "./analyzer.js";
import { elements, showToast } from "./ui.js";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs";

initializeAnalyzer(pdfjsLib);

const { dropZone, browseButton, fileInput, exportButton } = elements;

async function handleFile(file) {
  if (!file) {
    return;
  }

  if (file.type !== "application/pdf") {
    showToast("Merci de sélectionner un PDF.", true);
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    await analyzePdf(arrayBuffer);
  } catch (error) {
    console.error(error);
    showToast("Erreur lors de la lecture du PDF.", true);
  } finally {
    fileInput.value = "";
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
      dropZone.classList.add("is-dragover");
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
      dropZone.classList.remove("is-dragover");
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
