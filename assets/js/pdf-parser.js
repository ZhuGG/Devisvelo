export function normalizeText(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isTableHeaderLine(line) {
  const norm = normalizeText(line);
  return norm.includes("articles") && norm.includes("qte") && norm.includes("total");
}

export function isTableEndLine(line) {
  const norm = normalizeText(line);
  return (
    norm.includes("total ht") ||
    norm.includes("solde total") ||
    norm.includes("taux de tva")
  );
}

export function parseQuantityLine(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^(\d+)\s+([\d.,]+)\s+(\d+%)\s+([\d.,]+)\s*$/);
  if (!match) {
    return null;
  }
  const qty = parseInt(match[1], 10);
  if (!qty || Number.isNaN(qty)) {
    return null;
  }
  return { qty };
}

export function buildLinesFromTextContent(textContent) {
  const lines = [];
  let currentLine = "";
  for (const item of textContent.items) {
    if (!item.str) {
      continue;
    }
    const text = item.str;
    currentLine += (currentLine ? " " : "") + text;
    if (item.hasEOL) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  return lines;
}
