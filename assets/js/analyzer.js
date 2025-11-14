import {
  buildLinesFromTextContent,
  isTableEndLine,
  isTableHeaderLine,
  parseQuantityLine,
} from "./pdf-parser.js";
import { renderPreview, renderResults, renderStats, resetUi, showToast } from "./ui.js";

const state = {
  aggregated: new Map(),
  totalRows: 0,
  pagesAnalyzed: 0,
};

let pdfjsLib;

export function initializeAnalyzer(pdfLib) {
  pdfjsLib = pdfLib;
}

export function resetAnalysis() {
  state.aggregated.clear();
  state.totalRows = 0;
  state.pagesAnalyzed = 0;
  resetUi();
}

export async function analyzePdf(arrayBuffer) {
  if (!pdfjsLib) {
    throw new Error("La librairie PDF.js n'est pas initialisée.");
  }

  resetAnalysis();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  state.pagesAnalyzed = pdf.numPages;

  await renderPreview(pdf);

  const MAX_BUFFERED_LINES = 4;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lines = buildLinesFromTextContent(textContent);

    let inTable = false;
    let descBuffer = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const qtyInfo = parseQuantityLine(line);
      if (qtyInfo) {
        if (!inTable) {
          inTable = true;
        }

        let description = descBuffer.join(" ").replace(/\s+/g, " ").trim();
        descBuffer = [];

        if (qtyInfo.description) {
          description = qtyInfo.description;
        }

        if (!description) {
          continue;
        }

        const previousValue = state.aggregated.get(description) || 0;
        state.aggregated.set(description, previousValue + qtyInfo.qty);
        state.totalRows += 1;
        continue;
      }

      if (!inTable) {
        if (isTableHeaderLine(line)) {
          inTable = true;
          descBuffer = [];
        }

        if (!inTable) {
          if (descBuffer.length >= MAX_BUFFERED_LINES) {
            descBuffer.shift();
          }
          descBuffer.push(line);
        }
        continue;
      }

      if (isTableEndLine(line)) {
        inTable = false;
        descBuffer = [];
        continue;
      }

      if (descBuffer.length >= MAX_BUFFERED_LINES) {
        descBuffer.shift();
      }
      descBuffer.push(line);
    }
  }

  renderStats({
    pagesAnalyzed: state.pagesAnalyzed,
    totalRows: state.totalRows,
    uniqueArticles: state.aggregated.size,
  });
  renderResults(state.aggregated);

  if (state.aggregated.size === 0) {
    showToast("Aucune ligne d’articles détectée. Vérifie le format du devis.", true);
  } else {
    showToast("Analyse PDF terminée.");
  }

  return {
    pagesAnalyzed: state.pagesAnalyzed,
    totalRows: state.totalRows,
    aggregated: new Map(state.aggregated),
  };
}

export function buildCsvContent() {
  if (state.aggregated.size === 0) {
    return null;
  }

  const entries = Array.from(state.aggregated.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0], "fr");
  });

  const lines = ["designation,quantite_totale"];
  for (const [article, qty] of entries) {
    const safeArticle = '"' + article.replace(/"/g, '""') + '"';
    lines.push(`${safeArticle},${qty.toString().replace(".", ",")}`);
  }
  return lines.join("\n");
}
