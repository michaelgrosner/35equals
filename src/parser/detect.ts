import type { FixVersion } from "./types.js";

/**
 * ApplVerID (tag 1128) enum -> effective FIX version.
 * FIXT.1.1 transport messages carry the application version in tag 1128.
 */
const APPL_VER_MAP: Record<string, FixVersion> = {
  "1": "FIX.4.0", // FIX27 per spec, but we map to closest supported
  "4": "FIX.4.0",
  "5": "FIX.4.1",
  "6": "FIX.4.2",
  "7": "FIX.4.3",
  "8": "FIX.4.4",
  "9": "FIX.5.0SP2",
};

/**
 * Detect the effective FIX version from a parsed tag map.
 *
 * @param byTag  Map of tag number -> raw string value (only needs tags 8 and 1128)
 */
export function detectVersion(byTag: Map<number, string>): FixVersion {
  const beginString = byTag.get(8);
  if (beginString === undefined) return "UNKNOWN";

  switch (beginString) {
    case "FIX.4.0":
      return "FIX.4.0";
    case "FIX.4.1":
      return "FIX.4.1";
    case "FIX.4.2":
      return "FIX.4.2";
    case "FIX.4.3":
      return "FIX.4.3";
    case "FIX.4.4":
      return "FIX.4.4";
    case "FIX.5.0":
      return "FIX.5.0";
    case "FIX.5.0SP1":
      return "FIX.5.0SP1";
    case "FIX.5.0SP2":
      return "FIX.5.0SP2";
    case "FIXT.1.1": {
      // Resolve application version from tag 1128 (ApplVerID)
      const applVerID = byTag.get(1128);
      if (applVerID !== undefined) {
        const mapped = APPL_VER_MAP[applVerID];
        if (mapped !== undefined) return mapped;
      }
      // Default for FIXT.1.1 without or unknown ApplVerID
      return "FIX.5.0SP2";
    }
    default:
      return "UNKNOWN";
  }
}
