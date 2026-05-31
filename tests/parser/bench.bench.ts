import { bench, describe } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "../../src/parser/tokenize.js";
import { parseMessages } from "../../src/parser/parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../fixtures/100k-messages.log");

const fixtureExists = existsSync(fixturePath);

describe("parser performance", () => {
  if (!fixtureExists) {
    bench("(fixture missing — run pnpm gen:fixture)", () => {});
    return;
  }

  // Slice to first 10k messages at module load — I/O is not measured.
  const fullInput = readFileSync(fixturePath, "utf8");
  const allTokens = tokenize(fullInput);
  const slice = allTokens.slice(0, 10_000);
  const input10k = slice.map((t) => t.rawText).join("");

  bench("tokenize 10k messages", () => {
    tokenize(input10k);
  });

  bench("tokenize + parse 10k messages (no dictionary)", () => {
    const tokens = tokenize(input10k);
    parseMessages(tokens, undefined);
  });

  bench("tokenize only — no parse", () => {
    tokenize(input10k);
  });

  bench("parse only (pre-tokenized, no dictionary)", () => {
    // Re-tokenize into a stable array each time so the bench measures only parse
    parseMessages(slice, undefined);
  });
});
