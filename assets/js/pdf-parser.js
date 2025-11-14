export function normalizeText(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isTableHeaderLine(line) {
  const norm = normalizeText(line);
  const tokens = norm.split(/\s+/).filter(Boolean);

  const hasArticleColumn = tokens.some((token) =>
    [
      "article",
      "articles",
      "designation",
      "designations",
      "descriptif",
      "description",
      "libelle",
      "libelles",
      "libell",
      "reference",
      "references",
    ].some((keyword) => token.startsWith(keyword))
  );

  const hasQuantityColumn = tokens.some((token) =>
    ["qte", "qté", "quantite", "quantité", "quant", "nb", "nombre"].some(
      (keyword) => token.startsWith(keyword)
    )
  );

  const hasPriceColumn = tokens.some((token) =>
    ["pu", "prix", "p.u", "p.u.", "unitaire"].some((keyword) =>
      token.includes(keyword)
    )
  );

  const hasTotalColumn = tokens.some((token) =>
    ["total", "montant", "ttc", "ht"].some((keyword) =>
      token.includes(keyword)
    )
  );

  const detectedColumns = [
    hasArticleColumn,
    hasQuantityColumn,
    hasPriceColumn,
    hasTotalColumn,
  ].filter(Boolean).length;

  if (detectedColumns >= 3) {
    return true;
  }

  return (
    hasQuantityColumn &&
    (hasPriceColumn || hasTotalColumn) &&
    (hasArticleColumn || hasPriceColumn || hasTotalColumn)
  );
}

export function isTableEndLine(line) {
  const norm = normalizeText(line);
  return (
    norm.includes("total ht") ||
    norm.includes("total ttc") ||
    norm.includes("solde total") ||
    norm.includes("taux de tva") ||
    norm.includes("net a payer") ||
    norm.includes("net a regler") ||
    norm.includes("acompte") ||
    norm.includes("total general")
  );
}

const NBSP_REGEX = /\u00a0/g;
const MULTISPACE_REGEX = /\s+/g;
const MONEY_SEGMENT_REGEX =
  /(?<value>(?:\d[\d\s.,]*\d|\d)(?:\s?(?:€|eur|euros?|€\s*ttc|€\s*ht|€ttc|€ht|ttc|ht|t\.t\.c\.?|h\.t\.?))?)$/i;
const MONEY_WITH_MARKER_REGEX =
  /(?<value>(?:\d[\d\s.,]*\d|\d)(?:\s?(?:€|eur|euros?|€\s*ttc|€\s*ht|€ttc|€ht|ttc|ht|t\.t\.c\.?|h\.t\.?)))$/i;
const PERCENT_SEGMENT_REGEX =
  /(?<value>(?:\d[\d\s.,]*\s*%?)|-|np|nr|neant|néant|exon[ée]r[ée]|autoliquidation)$/i;
const UNIT_LABEL_REGEX =
  /(?<label>(?:p(?:i[eè]ce|cs|ce|ces)|pcs|piece|pieces|u|unite|unité|lot|lots|set|sets?|kit|kits?)s?)$/i;
const QTY_REGEX = /(?<qty>\d[\d\s.,]*)$/;
const PERCENT_KEYWORDS = new Set(["-", "np", "nr", "neant", "néant", "autoliquidation"]);

function sanitizeNumber(rawValue) {
  if (!rawValue) {
    return NaN;
  }
  const cleaned = rawValue
    .toString()
    .replace(/[€]/gi, "")
    .replace(/\b(?:eur|euros?|ttc|ht|t\.t\.c\.?|h\.t\.?)\b/gi, "")
    .replace(NBSP_REGEX, " ")
    .replace(MULTISPACE_REGEX, "")
    .replace(/,/g, ".");
  return Number.parseFloat(cleaned);
}

function popTrailingSegment(source, regex) {
  const match = source.match(regex);
  if (!match) {
    return [null, source];
  }
  const consumed = (match.groups && (match.groups.value || match.groups.label)) || match[0];
  const next = source.slice(0, -match[0].length).trim();
  return [consumed.trim(), next];
}

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

function tryParseQuantityLine(cleanLine, removeExtraTotals) {
  let rest = cleanLine;

  const [total, afterTotal] = popTrailingSegment(rest, MONEY_SEGMENT_REGEX);
  if (!total) {
    return null;
  }
  rest = afterTotal;

  if (removeExtraTotals) {
    for (let i = 0; i < 2; i += 1) {
      const [candidate, nextRest] = popTrailingSegment(rest, MONEY_WITH_MARKER_REGEX);
      if (!candidate) {
        break;
      }
      rest = nextRest;
    }
  }

  let percentCount = 0;
  while (percentCount < 2) {
    const match = rest.match(PERCENT_SEGMENT_REGEX);
    if (!match) {
      break;
    }
    const candidate = (match.groups && match.groups.value ? match.groups.value : match[0]).trim();
    const lowerCandidate = candidate.toLowerCase();
    let keep = false;
    if (lowerCandidate.includes("%") || lowerCandidate.startsWith("exon")) {
      keep = true;
    } else if (PERCENT_KEYWORDS.has(lowerCandidate)) {
      keep = true;
    } else if (/^\d[\d\s.,]*$/.test(candidate)) {
      const numericValue = Number.parseFloat(candidate.replace(/\s+/g, "").replace(/,/g, "."));
      if (Number.isFinite(numericValue) && numericValue <= 100) {
        keep = true;
      }
    }

    if (!keep) {
      break;
    }

    rest = rest.slice(0, -match[0].length).trim();
    percentCount += 1;
  }

  const [unitCandidate, afterUnit] = popTrailingSegment(rest, MONEY_SEGMENT_REGEX);
  if (!unitCandidate) {
    return null;
  }
  rest = afterUnit;

  const [unitLabel, afterLabel] = popTrailingSegment(rest, UNIT_LABEL_REGEX);
  if (unitLabel) {
    rest = afterLabel;
  }

  if (/([xX])$/.test(rest)) {
    rest = rest.slice(0, -1).trim();
  }

  const qtyMatch = rest.match(QTY_REGEX);
  if (!qtyMatch) {
    return null;
  }
  rest = rest.slice(0, -qtyMatch[0].length).trim();

  const qty = sanitizeNumber(qtyMatch.groups.qty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return null;
  }

  const description = rest.replace(MULTISPACE_REGEX, " ").trim();
  if (description) {
    return { qty, description };
  }

  return { qty };
}

export function parseQuantityLine(line) {
  const cleanLine = line.replace(NBSP_REGEX, " ").replace(MULTISPACE_REGEX, " ").trim();
  if (!cleanLine) {
    return null;
  }

  return tryParseQuantityLine(cleanLine, true) ?? tryParseQuantityLine(cleanLine, false);
}
