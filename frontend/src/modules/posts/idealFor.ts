/** Split and deduplicate the display-only audience labels without changing tag behavior. */
export function uniqueIdealForEntries(value: string): string[] {
  const seen = new Set<string>();
  const entries: string[] = [];

  for (const rawEntry of value.split(",")) {
    const entry = rawEntry.trim();
    if (!entry) continue;

    const key = entry.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;

    seen.add(key);
    entries.push(entry);
  }

  return entries;
}
