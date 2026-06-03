export type FieldType =
  | "STRING" | "INT" | "FLOAT" | "PRICE" | "AMT" | "QTY"
  | "BOOLEAN" | "CHAR" | "UTCTIMESTAMP" | "UTCTIMEONLY" | "UTCDATEONLY"
  | "LOCALMKTDATE" | "MONTHYEAR" | "DAYOFMONTH" | "COUNTRY" | "CURRENCY"
  | "EXCHANGE" | "MULTIPLEVALUESTRING" | "MULTIPLECHARVALUE" | "NUMINGROUP" | "SEQNUM"
  | "LENGTH" | "DATA" | "XMLDATA" | "LANGUAGE" | "PATTERN" | "RESERVED100PLUS"
  | "TZTIMEONLY" | "TZTIMESTAMP" | "XIDREF" | "XID" | "PERCENTAGE"
  | "PRICEOFFSET" | "TENOR";

export type FixVersion =
  | "FIX.4.0" | "FIX.4.1" | "FIX.4.2" | "FIX.4.3" | "FIX.4.4"
  | "FIX.5.0" | "FIX.5.0SP1" | "FIX.5.0SP2" | "FIXT.1.1" | "UNKNOWN";

export interface FieldDef {
  name: string;
  type: FieldType;
  values?: Record<string, string>; // enum code -> label
}

export interface DictionaryData {
  fields: Record<number, FieldDef>;
  msgTypes: Record<string, string>; // code -> name
}

export interface Warning {
  type: "BAD_CHECKSUM" | "UNKNOWN_VERSION" | "UNKNOWN_TAG" | "MISSING_TAG";
  detail: string;
}

export interface ParsedField {
  tag: number;
  rawValue: string;
  name?: string;
  enumLabel?: string;
  description?: string;
  type?: FieldType;
}

export interface ParsedMessage {
  index: number;
  lineNumber: number;
  rawText: string;
  fields?: ParsedField[];
  byTag: Map<number, string>;
  version: FixVersion;
  msgType?: string;
  warnings: Warning[];
}
