/**
 * Build script: converts QuickFIX XML dictionaries to compact JSON.
 *
 * Usage: tsx scripts/build-dictionaries.ts
 *
 * Input:  dictionaries/FIX42.xml, FIX44.xml, FIX50SP2.xml, FIXT11.xml
 * Output: src/dictionaries/FIX42.json, FIX44.json, FIX50SP2.json, FIXT11.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Output types (mirror DictionaryData from src/parser/types.ts)
// ---------------------------------------------------------------------------

interface FieldDef {
  name: string;
  type: string;
  values?: Record<string, string>;
}

interface DictionaryOutput {
  fields: Record<string, FieldDef>;
  msgTypes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// SCREAMING_SNAKE → Title Case converter
// ---------------------------------------------------------------------------

function toTitleCase(screaming: string): string {
  return screaming
    .split("_")
    .map((word) => {
      if (word.length === 0) return word;
      const first = word[0];
      if (first === undefined) return word;
      return first.toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Minimal XML attribute extractor (no external deps, handles single + double
// quote attribute values as produced by QuickFIX spec files).
// ---------------------------------------------------------------------------

/**
 * Extract the value of a named attribute from a raw XML tag string.
 * e.g. extractAttr(`number='35' name='MsgType'`, 'name') → 'MsgType'
 */
function extractAttr(tag: string, attr: string): string | undefined {
  const needle = attr + "=";
  const idx = tag.indexOf(needle);
  if (idx === -1) return undefined;
  const afterEq = idx + needle.length;
  const quote = tag[afterEq];
  if (quote !== "'" && quote !== '"') return undefined;
  const valueStart = afterEq + 1;
  const valueEnd = tag.indexOf(quote, valueStart);
  if (valueEnd === -1) return undefined;
  return tag.slice(valueStart, valueEnd);
}

// ---------------------------------------------------------------------------
// XML parser
// ---------------------------------------------------------------------------

/**
 * Very fast line-oriented XML scanner for the QuickFIX spec format.
 * We exploit the known structure: each meaningful element is on its own line.
 */
function parseQuickFixXml(xml: string): DictionaryOutput {
  const fields: Record<string, FieldDef> = {};
  const msgTypes: Record<string, string> = {};

  const lines = xml.split("\n");
  let currentField: (FieldDef & { number: string }) | null = null;
  let inFieldsDef = false; // true while inside the top-level <fields> block

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line === undefined) continue;
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Track whether we're inside the <fields> definition block
    // (as opposed to component/message field references which also use <field>)
    if (trimmed.startsWith("<fields>") || trimmed.startsWith("<fields ")) {
      inFieldsDef = true;
      continue;
    }
    if (trimmed.startsWith("</fields>")) {
      inFieldsDef = false;
      currentField = null;
      continue;
    }

    // -----------------------------------------------------------------------
    // <message name='...' msgtype='...' .../>
    // -----------------------------------------------------------------------
    if (trimmed.startsWith("<message ")) {
      const name = extractAttr(trimmed, "name");
      const msgtype = extractAttr(trimmed, "msgtype");
      if (name !== undefined && msgtype !== undefined) {
        msgTypes[msgtype] = name;
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // <field number='N' name='...' type='...'> or .../> — definition form
    // Only process when inside the <fields> block.
    // -----------------------------------------------------------------------
    if (inFieldsDef && trimmed.startsWith("<field ") && trimmed.includes("number=")) {
      const number = extractAttr(trimmed, "number");
      const name = extractAttr(trimmed, "name");
      const type = extractAttr(trimmed, "type");

      if (number !== undefined && name !== undefined && type !== undefined) {
        const def: FieldDef = { name, type };
        fields[number] = def;

        if (trimmed.endsWith("/>") || trimmed.endsWith(">") === false) {
          // Self-closing — no enum values
          currentField = null;
        } else {
          // Has a body (enum values follow)
          currentField = { ...def, number };
        }
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // <value enum='...' description='...'/>  — enum values for current field
    // -----------------------------------------------------------------------
    if (inFieldsDef && currentField !== null && trimmed.startsWith("<value ")) {
      const enumVal = extractAttr(trimmed, "enum");
      const description = extractAttr(trimmed, "description");

      if (enumVal !== undefined && description !== undefined) {
        const label = toTitleCase(description);
        const fieldEntry = fields[currentField.number];
        if (fieldEntry !== undefined) {
          if (fieldEntry.values === undefined) {
            fieldEntry.values = {};
          }
          fieldEntry.values[enumVal] = label;
        }
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // </field>  — close current field definition
    // -----------------------------------------------------------------------
    if (inFieldsDef && trimmed === "</field>") {
      currentField = null;
      continue;
    }
  }

  return { fields, msgTypes };
}

// ---------------------------------------------------------------------------
// File processing
// ---------------------------------------------------------------------------

const FILES: Array<{ xml: string; json: string }> = [
  { xml: "FIX42.xml", json: "FIX42.json" },
  { xml: "FIX44.xml", json: "FIX44.json" },
  { xml: "FIX50SP2.xml", json: "FIX50SP2.json" },
  { xml: "FIXT11.xml", json: "FIXT11.json" },
];

const outDir = join(root, "src", "dictionaries");
mkdirSync(outDir, { recursive: true });

for (const { xml, json } of FILES) {
  const xmlPath = join(root, "dictionaries", xml);
  const jsonPath = join(outDir, json);

  console.log(`Processing ${xml}...`);
  const xmlContent = readFileSync(xmlPath, "utf8");
  const output = parseQuickFixXml(xmlContent);

  const fieldCount = Object.keys(output.fields).length;
  const msgCount = Object.keys(output.msgTypes).length;
  console.log(`  → ${fieldCount} fields, ${msgCount} message types`);

  writeFileSync(jsonPath, JSON.stringify(output), "utf8");
  console.log(`  → Written ${jsonPath}`);
}

console.log("Done.");
