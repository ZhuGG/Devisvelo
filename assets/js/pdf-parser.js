const NBSP_REGEX = /\u00a0/g;
const MULTISPACE_REGEX = /\s+/g;

function pushLine(lines, parts) {
  if (!parts || parts.length === 0) {
    return;
  }
  const joined = parts.join(" ").replace(MULTISPACE_REGEX, " ").trim();
  if (joined) {
    lines.push(joined);
  }
  parts.length = 0;
}

export function buildLinesFromTextContent(textContent) {
  const lines = [];
  let currentParts = [];
  let currentBaseline = null;

  for (const item of textContent.items) {
    if (!item.str) {
      continue;
    }

    const text = item.str.replace(NBSP_REGEX, " ").replace(MULTISPACE_REGEX, " ").trim();
    if (!text) {
      continue;
    }

    const baseline = item.transform ? item.transform[5] : null;
    const height = item.height || (item.transform ? Math.abs(item.transform[3]) : 0);
    const tolerance = Math.max(2, (height || 9) * 0.6);

    if (currentBaseline === null && baseline !== null) {
      currentBaseline = baseline;
    }

    if (
      currentParts.length > 0 &&
      baseline !== null &&
      currentBaseline !== null &&
      Math.abs(baseline - currentBaseline) > tolerance
    ) {
      pushLine(lines, currentParts);
      currentBaseline = baseline;
    }

    currentParts.push(text);

    if (item.hasEOL) {
      pushLine(lines, currentParts);
      currentBaseline = null;
    }
  }

  pushLine(lines, currentParts);
  return lines;
}

const HEADER_REGEX = /ARTICLES\s+QT[ÉE]\s+PU\s+TVA\s+TOTAL/i;
const TOTAL_HT_REGEX = /TOTAL\s+HT/i;

const QTY_LINE_INLINE = /^(.*\S)\s+(\d+)\s+([\d.,]+)\s+(\d+)%\s+([\d.,]+)\s*$/;
const QTY_LINE_ALONE = /^(\d+)\s+([\d.,]+)\s+(\d+)%\s+([\d.,]+)\s*$/;

export function extractItemsFromAudaceQuote(lines) {
  const normLines = lines.map(normalizeLine);
  const headerIdx = normLines.findIndex((l) => HEADER_REGEX.test(l));
  if (headerIdx === -1) return [];

  const items = [];
  let currentDescParts = [];

  for (let i = headerIdx + 1; i < normLines.length; i++) {
    const line = normLines[i];
    if (!line) continue;

    if (TOTAL_HT_REGEX.test(line)) break;

    let m = line.match(QTY_LINE_INLINE);
    if (m) {
      const [_, descTail, qtyStr, puStr, tvaStr, totalStr] = m;
      const fullDesc = [...currentDescParts, descTail].join(" ").trim();
      if (fullDesc) items.push(makeItem(fullDesc, qtyStr, puStr, tvaStr, totalStr));
      currentDescParts = [];
      continue;
    }

    m = line.match(QTY_LINE_ALONE);
    if (m) {
      const [_, qtyStr, puStr, tvaStr, totalStr] = m;
      const fullDesc = currentDescParts.join(" ").trim();
      if (fullDesc) items.push(makeItem(fullDesc, qtyStr, puStr, tvaStr, totalStr));
      currentDescParts = [];
      continue;
    }

    currentDescParts.push(line);
  }

  return items;
}

function normalizeLine(line) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function makeItem(description, qtyStr, puStr, tvaStr, totalStr) {
  const toNumber = (s) => parseFloat(s.replace(/\./g, "").replace(",", "."));
  return {
    description,
    qty: toNumber(qtyStr),
    unitPrice: toNumber(puStr),
    tva: parseFloat(tvaStr),
    total: toNumber(totalStr),
  };
}
