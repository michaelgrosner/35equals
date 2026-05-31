import { bench, describe } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "../../src/parser/tokenize.js";
import { parseMessages } from "../../src/parser/parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../fixtures/100k-messages.log");

// Gracefully skip if fixture hasn't been generated yet.
const fixtureExists = existsSync(fixturePath);

describe("parser performance", () => {
  if (!fixtureExists) {
    bench("(fixture missing — run pnpm gen:fixture)", () => {
      // no-op placeholder so vitest bench doesn't complain about empty suite
    });
    return;
  }

  // Read once at module load — file I/O is not part of what we're measuring.
  const input = readFileSync(fixturePath, "utf8");

  bench("tokenize 100k messages", () => {
    tokenize(input);
  });

  bench("tokenize + parse 100k messages (no dictionary)", () => {
    const tokens = tokenize(input);
    parseMessages(tokens, undefined);
  });
});
