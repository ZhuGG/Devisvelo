import { buildLinesFromTextContent, extractItemsFromQuotePage } from "./pdf-parser.js";
import { renderPreview, renderResults, renderStats, resetUi, showToast } from "./ui.js";

const state = { aggregated: new Map(), pages: [], totalRows: 0, pagesAnalyzed: 0, hasReadableText: false };
let pdfjsLib;

export function initializeAnalyzer(pdfLib) { pdfjsLib = pdfLib; }
export function resetAnalysis() { state.aggregated.clear(); state.pages = []; state.totalRows = 0; state.pagesAnalyzed = 0; state.hasReadableText = false; resetUi(); }

export async function analyzePdf(arrayBuffer) {
  if (!pdfjsLib) throw new Error("La bibliothèque PDF n’est pas initialisée.");
  resetAnalysis();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  state.pagesAnalyzed = pdf.numPages;
  await renderPreview(pdf);
  let parserContext = {};
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = buildLinesFromTextContent(textContent);
    state.hasReadableText ||= lines.length > 0;
    const parsed = extractItemsFromQuotePage(lines, parserContext);
    parserContext = parsed.context;
    state.pages.push({ pageNumber, lines: lines.length, found: parsed.items.length, headerFound: parsed.headerFound });
    state.totalRows += parsed.items.length;
    parsed.items.forEach((item) => {
      const key = item.description.toLocaleLowerCase("fr");
      const current = state.aggregated.get(key) || { ...item, pages: [] };
      current.qty += state.aggregated.has(key) ? item.qty : 0;
      current.pages = [...new Set([...current.pages, pageNumber])];
      state.aggregated.set(key, current);
    });
  }
  renderStats({ pagesAnalyzed: state.pagesAnalyzed, totalRows: state.totalRows, uniqueArticles: state.aggregated.size, pages: state.pages });
  renderResults(state.aggregated);
  showToast(state.aggregated.size ? "Analyse terminée : inventaire prêt à contrôler." : "Aucune ligne d’article n’a été détectée.", !state.aggregated.size);
  return { ...state, aggregated: new Map(state.aggregated) };
}

export function buildCsvContent() {
  if (!state.aggregated.size) return null;
  const lines = ["designation,quantite_totale,pages_source"];
  [...state.aggregated.values()].sort((a,b) => a.description.localeCompare(b.description, "fr")).forEach((item) => lines.push(`"${item.description.replace(/"/g, '""')}",${String(item.qty).replace(".", ",")},"${item.pages.join(" · ")}"`));
  return lines.join("\n");
}

export function buildClipboardContent() {
  return [...state.aggregated.values()].sort((a,b) => a.description.localeCompare(b.description, "fr")).map((item) => `${item.description}\t${item.qty}\t${item.pages.join(", ")}`).join("\n");
}
