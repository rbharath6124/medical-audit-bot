import type { AuditResult, CodeEntry, CodeSet, Discrepancy } from "../types";

const recommendedHeaders = [
  "Status",
  "Patient Name",
  "Patient ID / MRN",
  "Date of Service",
  "Encounter Number",
  "Insurance Payer",
  "Clinic Location",
  "Chart File Name",
  "Provider",
  "Facility",
  "Original ICD-10 Diagnoses",
  "Original CPT Procedures",
  "Original E/M Codes",
  "Original HCPCS Codes",
  "Original HCPCS Quantities",
  "Original Code Quantities",
  "Code Summary",
  "Original MDM Level",
  "E&M Level Detail",
  "Problem List",
  "Missing / Suggested Codes",
  "Change Category",
  "Target Code",
  "HCPCS Quantity",
  "Code Quantity",
  "Severity",
  "What Change (Description)",
  "Why the Change (Rationale)",
  "Action Item Required",
  "Chart Compliance Score",
];

const summaryHeaders = [
  "Status",
  "Chart File",
  "Patient Name",
  "Patient ID",
  "Date of Service",
  "Encounter Number",
  "Insurance Payer",
  "Clinic Location",
  "Original ICD-10 Diagnoses",
  "Original E/M Codes",
  "Original CPT Procedures",
  "Original HCPCS Codes",
  "Original HCPCS Quantities",
  "Original Code Quantities",
  "Code Summary",
  "Original MDM Level",
  "E&M Level Detail",
  "Problem List",
  "Missing / Suggested Codes",
  "Discrepancies Found",
  "Compliance Score",
  "AI Confidence",
  "AI Executive Summary",
];

export function exportAuditsExcel(audits: AuditResult[], filename = `MedAudit-RecommendedChanges-${Date.now()}.xlsx`) {
  const recommendedRows = [recommendedHeaders, ...audits.flatMap(buildRecommendedRows)];
  const summaryRows = [summaryHeaders, ...audits.map(buildSummaryRow)];
  const workbook = buildXlsx([
    { name: "Recommended Changes", rows: recommendedRows },
    { name: "Chart Level Summary", rows: summaryRows },
  ]);
  downloadBlob(workbook, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

export function exportAuditsCsv(audits: AuditResult[], filename = `MedAudit-RecommendedChanges-${Date.now()}.xlsx`) {
  exportAuditsExcel(audits, filename.endsWith(".xlsx") ? filename : filename.replace(/\.csv$/i, ".xlsx"));
}

function buildRecommendedRows(audit: AuditResult): string[][] {
  const rows: string[][] = [];

  for (const missing of audit.missingCodes || []) {
    rows.push([
      "FALSE",
      patient(audit),
      metadata(audit.patientId),
      metadata(audit.dateOfService),
      metadata(audit.encounterNumber),
      metadata(audit.insurancePayer),
      metadata(audit.clinicLocation),
      audit.fileName,
      metadata(audit.provider),
      metadata(audit.facility),
      formatCodes(audit.originalCodes.icd10),
      formatCodes(audit.originalCodes.cpt),
      formatCodes(audit.originalCodes.em),
      formatCodes(audit.originalCodes.hcpcs),
      formatQuantities(audit.originalCodes.hcpcs),
      formatQuantities(flatCodes(audit.originalCodes)),
      codeSummary(audit.originalCodes),
      mdmLevel(audit),
      emLevelDetail(audit),
      problemList(audit),
      missing.code,
      "ADD MISSING CODE",
      missing.code,
      isHcpcsCode(audit, missing.code) ? String(missing.qty || 1) : "-",
      String(missing.qty || 1),
      "MEDIUM",
      `${missing.code} is supported by documentation but missing from the billed/original codes.`,
      missing.evidence || missing.description || "Chart documentation supports this suggested code.",
      `Add code ${missing.code} if payer and billing rules support submission.`,
      String(audit.complianceScore),
    ]);
  }

  for (const discrepancy of audit.discrepancies || []) {
    rows.push(recommendedDiscrepancyRow(audit, discrepancy));
  }

  if (rows.length === 0) {
    rows.push([
      "TRUE",
      patient(audit),
      metadata(audit.patientId),
      metadata(audit.dateOfService),
      metadata(audit.encounterNumber),
      metadata(audit.insurancePayer),
      metadata(audit.clinicLocation),
      audit.fileName,
      metadata(audit.provider),
      metadata(audit.facility),
      formatCodes(audit.originalCodes.icd10),
      formatCodes(audit.originalCodes.cpt),
      formatCodes(audit.originalCodes.em),
      formatCodes(audit.originalCodes.hcpcs),
      formatQuantities(audit.originalCodes.hcpcs),
      formatQuantities(flatCodes(audit.originalCodes)),
      codeSummary(audit.originalCodes),
      mdmLevel(audit),
      emLevelDetail(audit),
      problemList(audit),
      "None",
      "COMPLIANT (NO CHANGE)",
      "-",
      "-",
      "-",
      "LOW",
      "Chart text reviewed. Coding matches documented clinical indicators.",
      "No unsupported billed codes or missing supported codes were identified by the audit.",
      "Ready for compliant billing submission.",
      String(audit.complianceScore),
    ]);
  }

  return rows;
}

function recommendedDiscrepancyRow(audit: AuditResult, discrepancy: Discrepancy): string[] {
  return [
    "FALSE",
    patient(audit),
    metadata(audit.patientId),
    metadata(audit.dateOfService),
    metadata(audit.encounterNumber),
    metadata(audit.insurancePayer),
    metadata(audit.clinicLocation),
    audit.fileName,
    metadata(audit.provider),
    metadata(audit.facility),
    formatCodes(audit.originalCodes.icd10),
    formatCodes(audit.originalCodes.cpt),
    formatCodes(audit.originalCodes.em),
    formatCodes(audit.originalCodes.hcpcs),
    formatQuantities(audit.originalCodes.hcpcs),
    formatQuantities(flatCodes(audit.originalCodes)),
    codeSummary(audit.originalCodes),
    mdmLevel(audit),
    emLevelDetail(audit),
    problemList(audit),
    formatCodes(audit.missingCodes),
    changeCategory(discrepancy),
    discrepancy.code || "-",
    discrepancy.category === "HCPCS" ? quantityForCode(audit, discrepancy.code) : "-",
    quantityForCode(audit, discrepancy.code),
    discrepancy.severity.toUpperCase(),
    discrepancy.description || `${discrepancy.code} requires coding review.`,
    discrepancy.recommendation || audit.verificationSummary || "Review the code against chart documentation.",
    actionItem(discrepancy),
    String(audit.complianceScore),
  ];
}

function buildSummaryRow(audit: AuditResult): string[] {
  const clean = (audit.discrepancies?.length || 0) === 0 && (audit.missingCodes?.length || 0) === 0;
  return [
    clean ? "TRUE" : "FALSE",
    audit.fileName,
    patient(audit),
    metadata(audit.patientId),
    metadata(audit.dateOfService),
    metadata(audit.encounterNumber),
    metadata(audit.insurancePayer),
    metadata(audit.clinicLocation),
    formatCodes(audit.originalCodes.icd10),
    formatCodes(audit.originalCodes.em),
    formatCodes(audit.originalCodes.cpt),
    formatCodes(audit.originalCodes.hcpcs),
    formatQuantities(audit.originalCodes.hcpcs),
    formatQuantities(flatCodes(audit.originalCodes)),
    codeSummary(audit.originalCodes),
    mdmLevel(audit),
    emLevelDetail(audit),
    problemList(audit),
    formatCodes(audit.missingCodes),
    String((audit.discrepancies?.length || 0) + (audit.missingCodes?.length || 0)),
    String(audit.complianceScore),
    `${audit.aiConfidence}%`,
    audit.summary || audit.verificationSummary || emLevelDetail(audit),
  ];
}

function patient(audit: AuditResult) {
  return metadata(audit.patient);
}

function metadata(value?: string) {
  const text = (value || "").trim();
  return text && text !== "-" ? text : "Not documented";
}

function formatCodes(entries: CodeEntry[]) {
  return entries.length
    ? entries.map((entry) => `${entry.code}${entry.qty > 1 ? ` (Qty: ${entry.qty})` : " (Qty: 1)"}`).join(", ")
    : "None";
}

function formatQuantities(entries: CodeEntry[]) {
  return entries.length
    ? entries.map((entry) => `${entry.code}: ${entry.qty || 1}`).sort().join(", ")
    : "None";
}

function codeSummary(set: CodeSet) {
  const sections = [
    ["ICD-10", set.icd10],
    ["E/M", set.em],
    ["CPT", set.cpt],
    ["HCPCS", set.hcpcs],
  ] as const;

  return sections
    .filter(([, entries]) => entries.length > 0)
    .map(([label, entries]) => `${label}: ${formatCodes(entries)}`)
    .join(" | ") || "None";
}

function mdmLevel(audit: AuditResult) {
  const mdm = audit.mdm;
  return [
    `Problems Addressed: ${upperOrUnknown(mdm.problemsLevel)}`,
    `Data Analyzed: ${upperOrUnknown(mdm.dataLevel)}`,
    `Risk & Management: ${upperOrUnknown(mdm.riskLevel)}`,
    `Overall: ${upperOrUnknown(mdm.finalMdmLevel)}`,
  ].join(" | ");
}

function emLevelDetail(audit: AuditResult) {
  const mdm = audit.mdm;
  return [
    mdm.problemsEvidence,
    mdm.dataEvidence,
    mdm.riskEvidence,
    audit.emJustification,
  ].filter(Boolean).join(" ");
}

function problemList(audit: AuditResult) {
  return audit.problemList.length ? audit.problemList.join("; ") : "None";
}

function flatCodes(set: CodeSet) {
  return [...set.icd10, ...set.em, ...set.cpt, ...set.hcpcs];
}

function upperOrUnknown(value: string) {
  return value ? value.toUpperCase() : "UNKNOWN";
}

function changeCategory(discrepancy: Discrepancy) {
  if (discrepancy.type === "added") return "ADD MISSING CODE";
  if (discrepancy.type === "removed") return "REMOVE UNSUPPORTED CODE";
  if (discrepancy.type === "modified") return "MODIFY CODE";
  if (discrepancy.type === "quantity") return "QUANTITY CHANGE";
  if (discrepancy.type === "level") return "E/M LEVEL CHANGE";
  return `${discrepancy.category} ${discrepancy.billingImpact}`.toUpperCase();
}

function actionItem(discrepancy: Discrepancy) {
  if (discrepancy.recommendation) return discrepancy.recommendation;
  if (discrepancy.type === "removed") return `Remove unsupported code ${discrepancy.code}.`;
  if (discrepancy.type === "added") return `Add supported code ${discrepancy.code}.`;
  return `Review ${discrepancy.code} before billing.`;
}

function quantityForCode(audit: AuditResult, code: string) {
  const found = flatCodes(audit.originalCodes).concat(flatCodes(audit.correctedCodes), audit.missingCodes)
    .find((entry) => normalizeCode(entry.code) === normalizeCode(code));
  return found ? String(found.qty || 1) : "-";
}

function isHcpcsCode(audit: AuditResult, code: string) {
  return audit.originalCodes.hcpcs.concat(audit.correctedCodes.hcpcs)
    .some((entry) => normalizeCode(entry.code) === normalizeCode(code));
}

function normalizeCode(code: string) {
  return (code || "").trim().toUpperCase();
}

function downloadBlob(blob: Blob, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([blob], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface SheetData {
  name: string;
  rows: string[][];
}

function buildXlsx(sheets: SheetData[]) {
  const files: Record<string, string | Uint8Array> = {
    "[Content_Types].xml": contentTypesXml(sheets.length),
    "_rels/.rels": rootRelsXml(),
    "docProps/app.xml": appXml(),
    "docProps/core.xml": coreXml(),
    "xl/workbook.xml": workbookXml(sheets),
    "xl/_rels/workbook.xml.rels": workbookRelsXml(sheets.length),
    "xl/styles.xml": stylesXml(),
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = sheetXml(sheet.rows);
  });

  return zipFiles(files);
}

function sheetXml(rows: string[][]) {
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex + 1)}${rowIndex + 1}`;
      const style = rowIndex === 0 ? 1 : 2;
      return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");

  const widths = rows[0].map((header, index) => {
    const width = Math.min(42, Math.max(12, header.length + 2));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${columnName(rows[0].length)}${rows.length}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${widths}</cols>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="A1:${columnName(rows[0].length)}${rows.length}"/>
</worksheet>`;
}

function workbookXml(sheets: SheetData[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetCount: number) {
  const sheetRels = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function contentTypesXml(sheetCount: number) {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${sheetOverrides}
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>AI Medical Code Reviewer</Application>
</Properties>`;
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>AI Medical Code Reviewer</dc:creator>
  <cp:lastModifiedBy>AI Medical Code Reviewer</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function columnName(index: number) {
  let name = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function escapeXml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function zipFiles(files: Record<string, string | Uint8Array>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(data);
    const local = zipHeader(0x04034b50, nameBytes, data.length, crc, offset);
    chunks.push(local, nameBytes, data);
    central.push(zipHeader(0x02014b50, nameBytes, data.length, crc, offset));
    offset += local.length + nameBytes.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = endOfCentralDirectory(Object.keys(files).length, centralSize, centralOffset);
  return new Blob([...chunks, ...central, end] as BlobPart[]);
}

function zipHeader(signature: number, name: Uint8Array, size: number, crc: number, offset: number) {
  const central = signature === 0x02014b50;
  const bytes = new Uint8Array(central ? 46 : 30);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, signature, true);
  if (central) {
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, dosTime(), true);
    view.setUint16(14, dosDate(), true);
    view.setUint32(16, crc, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, name.length, true);
    view.setUint32(42, offset, true);
  } else {
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, dosTime(), true);
    view.setUint16(12, dosDate(), true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, name.length, true);
  }
  return central ? concatBytes(bytes, name) : bytes;
}

function endOfCentralDirectory(count: number, centralSize: number, centralOffset: number) {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return bytes;
}

function concatBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function dosTime() {
  const d = new Date();
  return (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
}

function dosDate() {
  const d = new Date();
  return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
