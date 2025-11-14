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

  const numericOnlyMatch = trimmed.match(/^(\d+)\s+[\d.,]+\s+\d+%\s+[\d.,]+\s*$/);
  if (numericOnlyMatch) {
    const qty = parseInt(numericOnlyMatch[1], 10);
    if (qty && !Number.isNaN(qty)) {
      return { qty };
    }
    return null;
  }

  const withDescriptionMatch = trimmed.match(
    /^(?<description>.+?)\s+(?<qty>\d+)\s+[\d.,]+\s+\d+%\s+[\d.,]+\s*$/,
  );
  if (!withDescriptionMatch) {
    return null;
  }

  const qty = parseInt(withDescriptionMatch.groups.qty, 10);
  if (!qty || Number.isNaN(qty)) {
    return null;
  }

  const description = withDescriptionMatch.groups.description.replace(/\s+/g, " ").trim();
  if (!description) {
    return null;
  }

  return { qty, description };
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
