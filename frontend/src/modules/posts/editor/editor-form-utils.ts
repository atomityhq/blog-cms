
// Compares JSON-compatible values structurally.
// Object key order is ignored, but array order is significant because it can
// change the meaning of rich-text documents and other form values.

export function areValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    for (let index = 0; index < a.length; index += 1) {
      if (!areValuesEqual(a[index], b[index])) {
        return false;
      }
    }

    return true;
  }

  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(bRecord, key) &&
      areValuesEqual(aRecord[key], bRecord[key]),
  );
}
