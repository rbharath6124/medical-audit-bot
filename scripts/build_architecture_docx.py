from __future__ import annotations

import html
import zipfile
from pathlib import Path


OUT = Path("AI_Medical_Code_Reviewer_Gemini_API_Architecture.docx")

NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def esc(value: str) -> str:
    return html.escape(value, quote=False)


def text_run(text: str, preserve: bool = False, bold: bool = False, italic: bool = False) -> str:
    attrs = ' xml:space="preserve"' if preserve or text.startswith(" ") or text.endswith(" ") else ""
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f"<w:r>{rpr}<w:t{attrs}>{esc(text)}</w:t></w:r>"


def p(text: str = "", style: str | None = None, bold: bool = False, italic: bool = False) -> str:
    ppr = f"<w:pPr><w:pStyle w:val=\"{style}\"/></w:pPr>" if style else ""
    return f"<w:p>{ppr}{text_run(text, bold=bold, italic=italic)}</w:p>"


def code_block(text: str) -> str:
    rows = []
    for line in text.strip("\n").splitlines():
        rows.append(
            "<w:p>"
            "<w:pPr><w:pStyle w:val=\"CodeBlock\"/></w:pPr>"
            f"{text_run(line or ' ', preserve=True)}"
            "</w:p>"
        )
    return "".join(rows)


def callout(title: str, body: str) -> str:
    return (
        '<w:tbl><w:tblPr><w:tblStyle w:val="CalloutTable"/>'
        '<w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="8" w:color="B7C9DD"/>'
        '<w:left w:val="single" w:sz="8" w:color="B7C9DD"/>'
        '<w:bottom w:val="single" w:sz="8" w:color="B7C9DD"/>'
        '<w:right w:val="single" w:sz="8" w:color="B7C9DD"/>'
        '<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
        '<w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/>'
        '<w:bottom w:w="120" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tblCellMar>'
        "</w:tblPr><w:tblGrid><w:gridCol w:w=\"9360\"/></w:tblGrid><w:tr><w:tc>"
        '<w:tcPr><w:tcW w:w="9360" w:type="dxa"/><w:shd w:fill="F4F7FA"/></w:tcPr>'
        f"{p(title, 'CalloutTitle')}{p(body, 'CalloutBody')}"
        "</w:tc></w:tr></w:tbl>"
    )


def simple_table(headers: list[str], rows: list[list[str]], widths: list[int]) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [
        '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="9FB3C8"/>'
        '<w:left w:val="single" w:sz="6" w:color="9FB3C8"/>'
        '<w:bottom w:val="single" w:sz="6" w:color="9FB3C8"/>'
        '<w:right w:val="single" w:sz="6" w:color="9FB3C8"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="D6DEE8"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="D6DEE8"/></w:tblBorders>'
        '<w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>'
        '<w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>'
        f"</w:tblPr><w:tblGrid>{grid}</w:tblGrid>"
    ]

    def row(cells: list[str], header: bool = False) -> str:
        tcs = []
        for cell, width in zip(cells, widths):
            fill = '<w:shd w:fill="E8EEF5"/>' if header else ""
            style = "TableHeader" if header else "TableBody"
            tcs.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{fill}</w:tcPr>'
                f"{p(cell, style)}</w:tc>"
            )
        return "<w:tr>" + "".join(tcs) + "</w:tr>"

    out.append(row(headers, True))
    for r in rows:
        out.append(row(r))
    out.append("</w:tbl>")
    return "".join(out)


def styles_xml() -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles {NS}>
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="111827"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="44"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="220"/></w:pPr><w:rPr><w:sz w:val="22"/><w:color w:val="475569"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1F4D78"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:shd w:fill="F8FAFC"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="17"/><w:color w:val="0F172A"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CalloutTitle"><w:name w:val="Callout Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3A5F"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CalloutBody"><w:name w:val="Callout Body"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:color w:val="334155"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="260" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableBody"><w:name w:val="Table Body"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="260" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="19"/><w:color w:val="111827"/></w:rPr></w:style>
</w:styles>'''


def document_xml() -> str:
    body: list[str] = []
    body.append(p("AI Medical Code Reviewer", "Title"))
    body.append(p("Gemini API Technical Architecture Dump", "Subtitle"))
    body.append(
        callout(
            "Purpose",
            "This document captures the current Gemini request payload, required response schema, active model instructions, and backend lab-code rules so the API integration can be optimized safely.",
        )
    )
    body.append(p("Current Integration Snapshot", "Heading1"))
    body.append(
        simple_table(
            ["Area", "Current implementation"],
            [
                ["Gemini call pattern", "Two calls per chart: draft audit, then independent final QA audit."],
                ["Input mode", "Either inline PDF data or extracted document text, plus a prompt."],
                ["Response mode", "JSON only, constrained by responseSchema."],
                ["Temperature", "0"],
                ["Max output tokens", "24576"],
                ["Gemini 2.5 thinking budget", "24576 for Pro models; 12288 for non-Pro 2.5 models."],
                ["ICD-10 lab mapping", "No hardcoded dictionary. Gemini performs diagnosis extraction from documented findings."],
                ["Suppressed/vendor lab CPT handling", "Deterministic backend cleanup removes qualifying CPT/HCPCS lab procedure codes from final claim output."],
            ],
            [2600, 6760],
        )
    )

    body.append(p("1. Current Gemini API Input Payload", "Heading1"))
    body.append(p("The app does not define a separate JSON input schema for charts. It constructs a generateContent request with either PDF inline data or a text block containing extracted chart text. The request shape is:", "Normal"))
    body.append(code_block(r'''
{
  model: settings.model,
  contents: [
    {
      role: "user",
      parts: [
        // PDF mode
        {
          inlineData: {
            mimeType: input.mimeType || "application/pdf",
            data: input.base64
          }
        },
        { text: prompt }

        // OR text mode
        {
          text: `${prompt}\n\n=== DOCUMENT TEXT ===\n${input.text.slice(0, 200000)}`
        }
      ]
    }
  ],
  config: {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema,
    temperature: 0,
    thinkingConfig: {
      thinkingBudget: 24576 // Gemini 2.5 Pro; 12288 for Gemini 2.5 non-Pro
    },
    maxOutputTokens: 24576
  }
}
'''))
    body.append(p("Internal app input type:", "Heading2"))
    body.append(code_block(r'''
{
  fileName: string,
  isPdf: boolean,
  base64?: string,
  mimeType?: string,
  text?: string
}
'''))
    body.append(p("Call sequence:", "Heading2"))
    body.append(code_block(r'''
1. Draft audit
   systemInstruction = SYSTEM_INSTRUCTION
   prompt = buildDraftPrompt(fileName)

2. Final QA audit
   systemInstruction = VERIFICATION_INSTRUCTION
   prompt = buildVerificationPrompt(fileName, draft.audit)
'''))

    body.append(p("2. Required Gemini Output Schema", "Heading1"))
    body.append(p("The following structure is the expected JSON object Gemini must return. Every top-level field listed here is required by the response schema.", "Normal"))
    body.append(code_block(r'''
{
  patient: string,
  provider: string,
  facility: string,
  dateOfService: string,
  documentedEmLevel: string,
  auditedEmLevel: string,
  emJustification: string,
  problemList: string[],

  originalCodes: {
    icd10: CodeEntry[],
    em: CodeEntry[],
    cpt: CodeEntry[],
    hcpcs: CodeEntry[]
  },

  correctedCodes: {
    icd10: CodeEntry[],
    em: CodeEntry[],
    cpt: CodeEntry[],
    hcpcs: CodeEntry[]
  },

  missingCodes: CodeEntry[],

  discrepancies: {
    category: "CPT" | "ICD-10" | "HCPCS" | "E/M" | "NCCI" | "Documentation",
    type: "added" | "removed" | "modified" | "quantity" | "level" | "documentation",
    billingImpact: "upcoding" | "downcoding" | "overbilling" | "underbilling" | "neutral" | "unknown",
    severity: "low" | "medium" | "high" | "critical",
    code: string,
    description: string,
    recommendation: string
  }[],

  complianceScore: integer,
  aiConfidence: integer,
  documentQuality: string,
  verificationSummary: string,
  auditWarnings: string[],
  summary: string
}
'''))
    body.append(p("CodeEntry:", "Heading2"))
    body.append(code_block(r'''
{
  code: string,
  description: string,
  qty: integer,
  evidence: string
}
'''))

    body.append(p("3. Current System Prompt / Model Instructions", "Heading1"))
    body.append(p("The current core system instruction is:", "Normal"))
    body.append(code_block(r'''
You are a board-certified medical coding auditor (CPC, CCS-P) with 20+ years of outpatient and urgent care chart auditing experience. Every output must be evidence-based, conservative, and auditable.

Read the entire chart before drawing conclusions. Compare billing/charge codes, clinical documentation, orders, medication/vaccine logs, procedure notes, assessment, and plan line by line.

Use the official CPT, ICD-10-CM, HCPCS Level II, AMA E/M, and NCCI rules applicable to the date of service. If the date of service or applicable coding year is unclear, state the assumption in auditWarnings and lower aiConfidence.

Audit process:
1. Extract original billed codes. originalCodes must contain only codes explicitly printed as billed in the chart. Copy each code exactly as printed, with quantity and a short evidence quote/location.
2. Extract documented services. Identify clearly documented diagnoses, E/M service, procedures, medication administrations, vaccines, lab draws, imaging, supplies, panels, and HCPCS items. Do not infer services that are not documented.
3. Audit every billed code. Decide whether each original code is supported, more accurately represented by another code, duplicated, quantity-inaccurate, unbundled, or unsupported.
4. Identify missing supported codes. Add a missing code only when the service is clearly documented and the exact code can be selected from evidence. If exact selection needs missing details, do not guess.
5. Determine E/M using MDM or time only when documented. State problems addressed, data, risk, and evidence. If documentation is insufficient, do not upcode.
6. Build correctedCodes as the final claim: supported original codes, corrected replacements, and clearly supported additions.
7. Classify billing impact for every discrepancy:
   - upcoding: billed code or level is higher/more intensive/more expensive than documentation supports.
   - downcoding: billed code or level is lower/less intensive than documentation supports.
   - overbilling: extra unsupported code, duplicate, unbundled code, or excessive quantity.
   - underbilling: documented supported service/code/quantity is missing or too low.
   - neutral: documentation/compliance issue without clear payment direction.
   - unknown: payment direction cannot be determined from the chart.

High-risk coding rules:
- Vaccine product codes are separate from vaccine administration codes. The product code must match exact vaccine name, formulation, dose, age, route, and date-of-service code set. If the chart only says "flu shot" or lacks product detail, do not guess a product code.
- 96372 is for therapeutic/prophylactic/diagnostic non-vaccine injections. Do not use it for vaccine administration.
- 36415 may apply for routine venipuncture only when a blood draw is documented and payer rules allow separate billing.
- Multiplex molecular panels generally require the applicable panel code when panel criteria are met; do not unbundle component tests.
- Suppressed or outside-vendor labs are not billed on the final claim. If a lab/test/result is marked suppressed, non-billable, external, send-out, referred, routed to an outside laboratory, or sent to a vendor such as Quest, Labcorp/LabCorp, CPL, BioReference, Mayo, ARUP, or Sonic, still extract supported ICD-10 diagnoses from the lab result findings, assessment, and treatment plan, but do not add the lab CPT procedure code to correctedCodes or missingCodes. If the outside-vendor lab CPT was billed in originalCodes, remove it from correctedCodes and create an overbilling/neutral documentation discrepancy explaining that the provider should not bill the vendor/suppressed lab procedure code.
- Never invent diagnoses, procedures, quantities, providers, dates, or codes.
- Check for upcoding and downcoding across all code families: E/M, CPT procedure code selection, CPT/HCPCS quantities, ICD-10 specificity/medical necessity support, HCPCS supply/drug units, NCCI unbundling, duplicate billing, missing documented services, and unsupported removals.
- For every discrepancy, state whether it is upcoding, downcoding, overbilling, underbilling, neutral, or unknown in billingImpact.
- Do not mark a chart clean unless originalCodes, correctedCodes, missingCodes, E/M, quantities, NCCI, and documentation support have all been checked.
- Every code entry must include evidence. Every discrepancy must include concrete chart evidence.
- If unsure, omit the code, lower aiConfidence, and add auditWarnings rather than guessing.
'''))
    body.append(p("Final QA instruction adds:", "Heading2"))
    body.append(code_block(r'''
You are now the independent final QA auditor. Your task is to find mistakes in the draft audit, not to agree with it.

Verification requirements:
1. Re-read the chart/PDF, especially billing/charge sections, medication/vaccine logs, orders, procedure notes, assessment, and plan.
2. Check every original code: it must be explicitly printed in the chart as billed.
3. Check every corrected/missing code: it must be supported by clear chart evidence and correct for the date of service.
4. Remove guessed or unsupported codes. Put unresolved issues in auditWarnings.
5. Re-check quantities, E/M MDM level, vaccine product vs administration, injection administration, venipuncture, panels, and NCCI bundling.
6. Re-check every discrepancy billingImpact. Make sure upcoding/downcoding/overbilling/underbilling labels are present and correct.
7. Return final corrected JSON only. If the draft is wrong, fix it.
'''))

    body.append(p("4. Lab Result to ICD-10 Mapping Logic", "Heading1"))
    body.append(
        callout(
            "Key finding",
            "There is currently no hardcoded backend dictionary that maps lab results such as Strep or Herpes to ICD-10 diagnosis codes. Diagnosis extraction is delegated to Gemini.",
        )
    )
    body.append(p("Current ICD-10 extraction approach:", "Heading2"))
    body.append(code_block(r'''
Gemini is instructed to extract clearly documented diagnoses from:
- lab result findings
- assessment
- treatment plan
- clinical documentation
'''))
    body.append(p("Not currently implemented:", "Heading2"))
    body.append(code_block(r'''
"positive strep" -> "J02.0"
"herpes simplex" -> "B00.9"
"HSV-1" -> specific ICD-10 selection
"HSV-2" -> specific ICD-10 selection
'''))

    body.append(p("5. Existing Backend Lab CPT Suppression Rules", "Heading1"))
    body.append(p("Although there is no lab-result-to-ICD dictionary, the backend does apply deterministic cleanup to suppress lab procedure CPT/HCPCS codes when the lab is suppressed or routed to an outside vendor.", "Normal"))
    body.append(p("Eligible procedure-code ranges:", "Heading2"))
    body.append(code_block(r'''
Likely lab procedure CPT range:
80047 through 89398

PLA-style codes:
0001U through 0051U
'''))
    body.append(p("Suppression/vendor trigger terms:", "Heading2"))
    body.append(code_block(r'''
suppressed
suppression
non-billable
outside lab
outside laboratory
outside vendor
external lab
external laboratory
external vendor
send-out
referred lab
referred test
referred out
routed to
Quest
LabCorp / Lab Corp
CPL
BioReference
Mayo
ARUP
Sonic
'''))
    body.append(p("Backend behavior:", "Heading2"))
    body.append(code_block(r'''
If a corrected or missing CPT/HCPCS lab code looks like a lab procedure code
AND its description/evidence mentions suppression or outside vendor routing:

1. Remove it from correctedCodes.cpt / correctedCodes.hcpcs.
2. Remove it from missingCodes.
3. Keep ICD-10 diagnosis codes untouched.
4. Add an audit warning.
5. Add a discrepancy if one does not already exist.
6. If the code was originally billed, mark billingImpact as overbilling.
7. If it was only suggested, mark billingImpact as neutral documentation.
'''))
    body.append(p("Current architecture summary:", "Heading2"))
    body.append(code_block(r'''
ICD-10 diagnosis extraction: Gemini reasoning only
Lab CPT suppression: deterministic backend cleanup
Lab-to-diagnosis dictionary: not implemented yet
'''))

    body.append(p("Optimization Notes", "Heading1"))
    body.append(
        simple_table(
            ["Opportunity", "Why it matters"],
            [
                ["Add explicit lab diagnosis fields", "Separate result evidence from claim codes, making Gemini output easier to validate."],
                ["Introduce a small curated lab-to-ICD rules layer", "Useful for common urgent-care cases like strep, flu, COVID, HSV, UTI, and pregnancy tests."],
                ["Keep suppression as backend enforcement", "The current deterministic pass protects final claims even when the model over-suggests CPT codes."],
                ["Add test fixtures", "Fixtures for Quest/suppressed Strep and Herpes cases would prevent regressions."],
            ],
            [3100, 6260],
        )
    )

    sect = (
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
        "</w:sectPr>"
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document {NS}><w:body>{''.join(body)}{sect}</w:body></w:document>'''


def write_docx() -> None:
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''
    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''
    doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>'''
    settings = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings {NS}><w:zoom w:percent="100"/></w:settings>'''
    core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>AI Medical Code Reviewer Gemini API Technical Architecture Dump</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
</cp:coreProperties>'''
    app = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>OpenAI Codex</Application>
</Properties>'''

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/_rels/document.xml.rels", doc_rels)
        z.writestr("word/document.xml", document_xml())
        z.writestr("word/styles.xml", styles_xml())
        z.writestr("word/settings.xml", settings)
        z.writestr("docProps/core.xml", core)
        z.writestr("docProps/app.xml", app)


if __name__ == "__main__":
    write_docx()
    print(OUT.resolve())
