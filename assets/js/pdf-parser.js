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

function sanitizeNumber(rawValue) {
  if (!rawValue) {
    return NaN;
  }
  return Number.parseFloat(
    rawValue
      .replace(/€/g, "")
      .replace(/\s+/g, "")
      .replace(/,/g, "."),
  );
}

function extractLineSegments(line) {
  let rest = line.replace(/\u00a0/g, " ").trim();

  if (!rest) {
    return null;
  }

  const totalMatch = rest.match(/(?<total>(?:\d[\d\s.,]*\d|\d)(?:\s?€)?)$/);
  if (!totalMatch) {
    return null;
  }
  rest = rest.slice(0, -totalMatch[0].length).trim();

  const tvaMatch = rest.match(/(?<tva>\d[\d\s.,]*\s*%|-|exon[ée]r[ée])$/i);
  if (!tvaMatch) {
    return null;
  }
  rest = rest.slice(0, -tvaMatch[0].length).trim();

  const unitMatch = rest.match(/(?<unit>(?:\d[\d\s.,]*\d|\d)(?:\s?€)?)$/);
  if (!unitMatch) {
    return null;
  }
  rest = rest.slice(0, -unitMatch[0].length).trim();

  const qtyMatch = rest.match(/(?<qty>\d[\d\s.,]*)$/);
  if (!qtyMatch) {
    return null;
  }
  rest = rest.slice(0, -qtyMatch[0].length).trim();

  return {
    qty: sanitizeNumber(qtyMatch[0]),
    description: rest || null,
  };
}

export function parseQuantityLine(line) {
  const segments = extractLineSegments(line);
  if (!segments) {
    return null;
  }

  if (!Number.isFinite(segments.qty) || segments.qty <= 0) {
    return null;
  }

  if (segments.description) {
    const description = segments.description.replace(/\s+/g, " ").trim();
    if (!description) {
      return null;
    }
    return { qty: segments.qty, description };
  }

  return { qty: segments.qty };
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
