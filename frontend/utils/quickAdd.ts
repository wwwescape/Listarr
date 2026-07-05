const UNIT_WORDS = new Set([
  "kg", "g", "mg", "lb", "lbs", "oz",
  "l", "ml",
  "pcs", "pc", "pack", "packs", "box", "boxes", "dozen",
  "bottle", "bottles", "can", "cans", "bag", "bags",
]);

const normalizeUnit = (unit: string) => (unit.toLowerCase() === "l" ? "L" : unit.toLowerCase());

export interface ParsedQuickAdd {
  quantity: number;
  unit: string;
  name: string;
}

// Parses freeform quick-add text into { quantity, unit, name }.
// Handles the patterns from the product vision:
//   "2 milk"        -> { quantity: 2, unit: "",   name: "milk" }
//   "3x eggs"        -> { quantity: 3, unit: "",   name: "eggs" }
//   "5 bananas"       -> { quantity: 5, unit: "",   name: "bananas" }
//   "bread"           -> { quantity: 1, unit: "",   name: "bread" }
//   "2kg potatoes"    -> { quantity: 2, unit: "kg", name: "potatoes" }
//   "1L milk"         -> { quantity: 1, unit: "L",  name: "milk" }
export const parseQuickAdd = (rawText: string): ParsedQuickAdd => {
  const text = (rawText || "").trim().replace(/\s+/g, " ");
  if (!text) return { quantity: 1, unit: "", name: "" };

  const leadMatch = text.match(/^(\d+(?:\.\d+)?)([a-zA-Z]*)(?:\s+(.*))?$/);
  if (!leadMatch) {
    return { quantity: 1, unit: "", name: text };
  }

  const [, qtyStr, gluedSuffix, restAfterSpace] = leadMatch;
  const quantity = parseFloat(qtyStr);

  if (gluedSuffix) {
    const lower = gluedSuffix.toLowerCase();
    const rest = (restAfterSpace || "").trim();
    if (lower === "x") {
      return rest ? { quantity, unit: "", name: rest } : { quantity: 1, unit: "", name: text };
    }
    if (UNIT_WORDS.has(lower)) {
      return rest ? { quantity, unit: normalizeUnit(lower), name: rest } : { quantity: 1, unit: "", name: text };
    }
    // Glued suffix isn't a recognized unit/x marker (e.g. "2lbread" typo) —
    // safer to treat the whole thing as a literal name than to guess.
    return { quantity: 1, unit: "", name: text };
  }

  if (!restAfterSpace) {
    return { quantity: 1, unit: "", name: text };
  }

  const restWords = restAfterSpace.split(" ");
  const firstWord = restWords[0].toLowerCase();
  if (UNIT_WORDS.has(firstWord) && restWords.length > 1) {
    return { quantity, unit: normalizeUnit(firstWord), name: restWords.slice(1).join(" ") };
  }

  return { quantity, unit: "", name: restAfterSpace };
};
