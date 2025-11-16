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

// --- CONSTANTES ET REGEX ---

const HEADER_REGEX = /ARTICLES\s+QT[ÉE]\s+PU\s+TVA\s+TOTAL/i;
const TOTAL_HT_REGEX = /TOTAL\s+HT/i;

// On exige au moins deux nombres décimaux (PU et TOTAL)
const QTY_LINE_INLINE = /^(.*\S)\s+(\d+)\s+(\d+[\d.,]*)\s+(\d+)%\s+(\d+[\d.,]*)\s*$/;
const QTY_LINE_ALONE = /^(\d+)\s+(\d+[\d.,]*)\s+(\d+)%\s+(\d+[\d.,]*)\s*$/;

// --- NORMALISATION DES LIGNES ---

function normalizeLine(line) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Concatène proprement les fragments de description multi-lignes
function joinDescriptionParts(parts) {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, cur) => {
      if (!acc) return cur;
      if (acc.endsWith("-")) {
        return acc + " " + cur;
      }
      return acc + " " + cur;
    }, "")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

// --- CREATION D'UN ARTICLE À PARTIR DES STRINGS ---

function makeItem(description, qtyStr, puStr, tvaStr, totalStr) {
  const toNumber = (s) =>
    parseFloat(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));

  const qty = toNumber(qtyStr);
  const unitPrice = toNumber(puStr);
  const total = toNumber(totalStr);
  const tva = parseFloat(tvaStr);

  // Filtrage des cas aberrants
  if (!description || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(total)) {
    return null;
  }

  return { description, qty, unitPrice, tva, total };
}

// --- PARSEUR PROFIL "AUDACE" ---

export function extractItemsFromAudaceQuote(lines) {
  const normLines = lines.map(normalizeLine);
  const headerIdx = normLines.findIndex((l) => HEADER_REGEX.test(l));
  if (headerIdx === -1) return [];

  const items = [];
  let currentDescParts = [];

  for (let i = headerIdx + 1; i < normLines.length; i++) {
    const line = normLines[i];
    if (!line) continue;

    // Fin du tableau
    if (TOTAL_HT_REGEX.test(line)) break;

    // Cas description + quantités sur UNE ligne
    let m = line.match(QTY_LINE_INLINE);
    if (m) {
      const [_, descTail, qtyStr, puStr, tvaStr, totalStr] = m;
      const fullDesc = joinDescriptionParts([...currentDescParts, descTail]);
      const item = makeItem(fullDesc, qtyStr, puStr, tvaStr, totalStr);
      if (item) items.push(item);
      currentDescParts = [];
      continue;
    }

    // Cas ligne quantités SEULE (description déjà accumulée)
    m = line.match(QTY_LINE_ALONE);
    if (m) {
      const [_, qtyStr, puStr, tvaStr, totalStr] = m;
      const fullDesc = joinDescriptionParts(currentDescParts);
      const item = makeItem(fullDesc, qtyStr, puStr, tvaStr, totalStr);
      if (item) items.push(item);
      currentDescParts = [];
      continue;
    }

    // Sinon : c'est une ligne de description
    currentDescParts.push(line);
  }

  return items;
}

// --- POINT D'ENTRÉE GÉNÉRIQUE POUR L'ANALYSE ---

export function extractItemsFromLines(lines) {
  // Profil principal : Audace
  const itemsAudace = extractItemsFromAudaceQuote(lines);
  if (itemsAudace.length > 0) return itemsAudace;

  // Plus tard : essayer d'autres parseurs (autres fournisseurs)
  // const itemsAutre = extractItemsFromAutreFournisseur(lines);
  // if (itemsAutre.length > 0) return itemsAutre;

  return [];
}
