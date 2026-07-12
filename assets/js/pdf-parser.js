const NBSP_REGEX = /\u00a0/g;
const MULTISPACE_REGEX = /\s+/g;
const HEADER_REGEX = /(?:ARTICLES?|D[ÉE]SIGNATION)\s+(?:QT[ÉE]|QUANTIT[ÉE]).*(?:PU|PRIX).*(?:TVA|T\.V\.A\.).*(?:TOTAL|MONTANT)/i;
const TOTAL_REGEX = /^(?:TOTAL\s+(?:HT|TTC)|NET\s+[ÀA]\s+PAYER|SOUS[- ]TOTAL)/i;
const PAGE_NOISE_REGEX = /^(?:PAGE\s+\d+|DEVIS\s+(?:N[°O]|#)|[A-ZÀ-Ý][A-ZÀ-Ý\s-]{5,})$/;
const NUMBERS_ONLY_REGEX = /^(\d+(?:[,.]\d+)?)\s+(\d[\d .,.]*)\s+(\d+(?:[,.]\d+)?)%?\s+(\d[\d .,.]*)$/;
const INLINE_ITEM_REGEX = /^(.*\S)\s+(\d+(?:[,.]\d+)?)\s+(\d[\d .,.]*)\s+(\d+(?:[,.]\d+)?)%?\s+(\d[\d .,.]*)$/;

export function buildLinesFromTextContent(textContent) {
  const groups = new Map();
  for (const item of textContent.items || []) {
    const text = String(item.str || "").replace(NBSP_REGEX, " ").replace(MULTISPACE_REGEX, " ").trim();
    if (!text) continue;
    const baseline = item.transform ? Math.round(item.transform[5] * 2) / 2 : groups.size;
    const x = item.transform ? item.transform[4] : 0;
    const group = groups.get(baseline) || [];
    group.push({ text, x });
    groups.set(baseline, group);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ").replace(MULTISPACE_REGEX, " ").trim())
    .filter(Boolean);
}

function normalize(line) {
  return line.replace(NBSP_REGEX, " ").replace(MULTISPACE_REGEX, " ").trim();
}

function toNumber(value) {
  const compact = value.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  return Number.parseFloat(compact);
}

function joinDescription(parts) {
  return parts.join(" ").replace(MULTISPACE_REGEX, " ").replace(/\s+-\s+/g, " - ").trim();
}

function makeItem(description, qty, unitPrice, tva, total) {
  const item = {
    description: joinDescription(description.split("\n")),
    qty: toNumber(qty),
    unitPrice: toNumber(unitPrice),
    tva: toNumber(tva),
    total: toNumber(total),
  };
  return item.description && Number.isFinite(item.qty) && item.qty > 0 && Number.isFinite(item.total) ? item : null;
}

/**
 * Parse a page while retaining the table state from preceding pages.
 * This is vital for quotes whose table header appears only on page one.
 */
export function extractItemsFromQuotePage(lines, previous = {}) {
  const context = {
    tableActive: Boolean(previous.tableActive),
    pendingDescription: Array.isArray(previous.pendingDescription) ? [...previous.pendingDescription] : [],
  };
  const items = [];
  let headerFound = false;

  for (const rawLine of lines) {
    const line = normalize(rawLine);
    if (!line) continue;
    if (HEADER_REGEX.test(line)) {
      context.tableActive = true;
      context.pendingDescription = [];
      headerFound = true;
      continue;
    }
    if (!context.tableActive) continue;
    if (TOTAL_REGEX.test(line)) {
      context.tableActive = false;
      context.pendingDescription = [];
      continue;
    }

    const inline = line.match(INLINE_ITEM_REGEX);
    const numeric = line.match(NUMBERS_ONLY_REGEX);
    if (inline) {
      const [, description, qty, unitPrice, tva, total] = inline;
      const item = makeItem([...context.pendingDescription, description].join("\n"), qty, unitPrice, tva, total);
      if (item) items.push(item);
      context.pendingDescription = [];
      continue;
    }
    if (numeric && context.pendingDescription.length) {
      const [, qty, unitPrice, tva, total] = numeric;
      const item = makeItem(context.pendingDescription.join("\n"), qty, unitPrice, tva, total);
      if (item) items.push(item);
      context.pendingDescription = [];
      continue;
    }
    if (!PAGE_NOISE_REGEX.test(line)) context.pendingDescription.push(line);
  }
  return { items, context, headerFound };
}
