import type { DictionaryData, FieldDef, FixVersion } from "./types.js";

/**
 * Module-level cache: version string -> loaded DictionaryData.
 * Lazy-loaded on first access per version.
 */
const cache = new Map<string, DictionaryData>();

/**
 * Maps a FixVersion to the JSON file that should be loaded.
 * Versions without their own dictionary fall back to FIX.4.2.
 */
function dictionaryFileFor(version: FixVersion): string {
  switch (version) {
    case "FIX.4.4":
      return "FIX44";
    case "FIX.5.0":
    case "FIX.5.0SP1":
    case "FIX.5.0SP2":
    case "FIXT.1.1":
      return "FIX50SP2";
    case "FIX.4.0":
    case "FIX.4.1":
    case "FIX.4.2":
    case "FIX.4.3":
    default:
      return "FIX42";
  }
}

/**
 * Load (and cache) the dictionary for the given FIX version.
 * Uses dynamic import so Vite can code-split the JSON blobs.
 */
export async function loadDictionary(
  version: FixVersion
): Promise<DictionaryData> {
  const file = dictionaryFileFor(version);
  const cached = cache.get(file);
  if (cached !== undefined) return cached;

  // Dynamic import — Vite resolves these at build time.
  // The JSON shape matches DictionaryData exactly after the build step.
  const mod = (await import(`../dictionaries/${file}.json`)) as {
    default: DictionaryData;
  };
  const data = mod.default;
  cache.set(file, data);
  return data;
}

/**
 * Look up a single field definition by tag number.
 */
export function lookupField(
  dict: DictionaryData,
  tag: number
): FieldDef | undefined {
  return dict.fields[tag];
}
