import { GoogleGenAI, Type } from "@google/genai";
import { getCost } from "./pricing";
import type { AuditResult, Settings } from "../types";

const codeEntrySchema = {
  type: Type.OBJECT,
  properties: {
    code: { type: Type.STRING, description: "Exact CPT, ICD-10-CM, HCPCS, or E/M code." },
    description: { type: Type.STRING, description: "Brief code description." },
    qty: { type: Type.INTEGER, description: "Quantity / units. Default 1 if not specified." },
    evidence: {
      type: Type.STRING,
      description: "Short chart quote or location supporting this code, or 'Not directly documented' when unsupported.",
    },
    sourceType: {
      type: Type.STRING,
      enum: ["in-house", "outside-facility", "referred-lab", "unknown"],
      description: "Where the service was performed or routed.",
    },
    billableByProvider: {
      type: Type.STRING,
      enum: ["yes", "no", "verify"],
      description: "Whether the provider should bill this code, or verify when billing responsibility is unclear.",
    },
  },
  required: ["code", "description", "qty", "evidence", "sourceType", "billableByProvider"],
};

const codeSetSchema = {
  type: Type.OBJECT,
  properties: {
    icd10: { type: Type.ARRAY, items: codeEntrySchema },
    em: { type: Type.ARRAY, items: codeEntrySchema },
    cpt: { type: Type.ARRAY, items: codeEntrySchema },
    hcpcs: { type: Type.ARRAY, items: codeEntrySchema },
  },
  required: ["icd10", "em", "cpt", "hcpcs"],
};

const mdmSchema = {
  type: Type.OBJECT,
  properties: {
    problemsLevel: { type: Type.STRING, description: "MDM problems addressed level: minimal, low, moderate, high, or unclear." },
    problemsEvidence: { type: Type.STRING, description: "Chart evidence supporting the problems addressed level." },
    dataLevel: { type: Type.STRING, description: "MDM data reviewed/analyzed level: minimal, low, moderate, high, or unclear." },
    dataEvidence: { type: Type.STRING, description: "Chart evidence supporting the data level." },
    riskLevel: { type: Type.STRING, description: "MDM risk level: minimal, low, moderate, high, or unclear." },
    riskEvidence: { type: Type.STRING, description: "Chart evidence supporting the risk level." },
    finalMdmLevel: { type: Type.STRING, description: "Final MDM level after applying the 2-of-3 pillar rule." },
    twoOfThreeJustification: { type: Type.STRING, description: "Short explanation of which two MDM pillars support the final E/M level." },
  },
  required: [
    "problemsLevel",
    "problemsEvidence",
    "dataLevel",
    "dataEvidence",
    "riskLevel",
    "riskEvidence",
    "finalMdmLevel",
    "twoOfThreeJustification",
  ],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    patient: { type: Type.STRING, description: "Patient name as documented, or 'Not documented'." },
    patientId: { type: Type.STRING, description: "Patient ID, MRN, account number, or 'Not documented'." },
    provider: { type: Type.STRING, description: "Provider name as documented, or 'Not documented'." },
    facility: { type: Type.STRING, description: "Facility name as documented, or 'Not documented'." },
    dateOfService: { type: Type.STRING, description: "Date of service as documented, or 'Not documented'." },
    encounterNumber: { type: Type.STRING, description: "Encounter, visit, accession, or claim number as documented, or 'Not documented'." },
    insurancePayer: { type: Type.STRING, description: "Insurance payer or plan as documented, or 'Not documented'." },
    clinicLocation: { type: Type.STRING, description: "Clinic location, site, department, or office location as documented, or 'Not documented'." },
    documentedEmLevel: { type: Type.STRING, description: "E/M code billed, or '-' if none found." },
    auditedEmLevel: { type: Type.STRING, description: "Correct E/M code per documented MDM/time, or '-' if not supported." },
    emJustification: { type: Type.STRING, description: "MDM/time justification with chart evidence." },
    mdm: mdmSchema,
    problemList: { type: Type.ARRAY, items: { type: Type.STRING } },
    originalCodes: codeSetSchema,
    correctedCodes: codeSetSchema,
    missingCodes: {
      type: Type.ARRAY,
      items: codeEntrySchema,
      description: "Codes supported by documentation but missing from billed/original codes.",
    },
    discrepancies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ["CPT", "ICD-10", "HCPCS", "E/M", "NCCI", "Documentation"] },
          type: { type: Type.STRING, enum: ["added", "removed", "modified", "quantity", "level", "documentation"] },
          billingImpact: { type: Type.STRING, enum: ["upcoding", "downcoding", "overbilling", "underbilling", "neutral", "unknown"] },
          severity: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
          code: { type: Type.STRING },
          description: { type: Type.STRING, description: "Issue and chart evidence." },
          recommendation: { type: Type.STRING, description: "Conservative coding recommendation." },
        },
        required: ["category", "type", "billingImpact", "severity", "code", "description", "recommendation"],
      },
    },
    complianceScore: { type: Type.INTEGER },
    aiConfidence: { type: Type.INTEGER },
    documentQuality: { type: Type.STRING },
    verificationSummary: { type: Type.STRING },
    auditWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING },
  },
  required: [
    "patient",
    "patientId",
    "provider",
    "facility",
    "dateOfService",
    "encounterNumber",
    "insurancePayer",
    "clinicLocation",
    "documentedEmLevel",
    "auditedEmLevel",
    "emJustification",
    "mdm",
    "problemList",
    "originalCodes",
    "correctedCodes",
    "missingCodes",
    "discrepancies",
    "complianceScore",
    "aiConfidence",
    "documentQuality",
    "verificationSummary",
    "auditWarnings",
    "summary",
  ],
};

const SYSTEM_INSTRUCTION = `You are the master intelligence core of an enterprise-grade medical code audit platform. Operate as a senior board-certified medical coding auditor (CPC, CCS-P, CPMA) with 20+ years of outpatient, urgent care, compliance, and audit experience. Your task is to audit clinical documentation against official AMA, CMS, ICD-10-CM, CPT, HCPCS Level II, and NCCI coding guidelines. Your objective is to protect provider revenue by capturing valid unbilled clinical services while aggressively mitigating audit risk by flagging unsupported codes, upcoding, duplicate billing, unbundling, and overbilling.

Read the entire chart before drawing conclusions. Compare billing/charge codes, clinical documentation, orders, medication/vaccine logs, procedure notes, assessment, and plan line by line.

Use the official CPT, ICD-10-CM, HCPCS Level II, AMA E/M, and NCCI rules applicable to the date of service. If the date of service or applicable coding year is unclear, state the assumption in auditWarnings and lower aiConfidence.

Execution architecture:
- PASS 1 (DRAFT AUDIT): Read the raw text/PDF data and execute the complete audit logic matrix to build the initial claim mapping.
- PASS 2 (FINAL QA VERIFICATION): Read the chart text alongside the generated draft audit dataset. Execute an adversarial quality control review to eliminate mistakes, correct generic code selections, fix typos, and output the final claim.

Audit process:
1. Extract patient and encounter metadata, including patient ID/MRN, encounter number, insurance payer, clinic location, provider, facility, and date of service when present. Use "Not documented" when absent.
2. Extract original documented codes from the PDF/chart. originalCodes must contain all codes documented in the chart, including codes not billed by the provider. Copy each code exactly as printed, with quantity and a short evidence quote/location. For codes documented as outside facility or referred lab services, set sourceType to outside-facility or referred-lab and billableByProvider to verify.
3. Read the clinical narrative chronologically: Chief Complaint -> HPI -> ROS -> Physical Exam -> Objective Labs/Imaging -> Assessment -> Plan & Prescriptions. Every final claim code must be backed by explicit, distinct textual evidence in the clinical narrative. If a service or diagnosis is not documented, it cannot be billed.
4. Extract documented services. Identify clearly documented diagnoses, E/M service, procedures, medication administrations, vaccines, lab draws, imaging, supplies, panels, and HCPCS items. Do not infer services that are not documented.
5. Audit every billed code. Decide whether each original code is supported, more accurately represented by another code, duplicated, quantity-inaccurate, unbundled, or unsupported.
6. Identify missing supported codes. Add a missing code only when the service is clearly documented and the exact code can be selected from evidence. If exact selection needs missing details, do not guess.
7. Determine E/M using official AMA/CMS MDM or documented total time only. State problems addressed, data reviewed/analyzed, risk, and evidence. If documentation is insufficient, do not upcode.
8. Populate the mdm object with separate problems, data, risk, final MDM level, and 2-of-3 pillar justification. Do not bury MDM reasoning only in prose.
9. Build correctedCodes as the final claim: supported original codes, corrected replacements, clearly supported additions, and valid documented outside/referred facility codes. For every code entry, set sourceType to in-house, outside-facility, referred-lab, or unknown, and set billableByProvider to yes, no, or verify.
10. Strict array replacement rule: correctedCodes represents the final clean insurance claim ready for submission. It must contain only valid codes that should be paid. Retain documented outside/referred facility codes in correctedCodes when they are clinically supported and not wrong; remove them only if they are clinically incorrect, unsupported, or a clear billing error. If a billed code from originalCodes is incorrect, clinically unsupported, unspecified, or replaced by a more accurate code, completely remove the old invalid code from correctedCodes. Do not allow old codes to remain beside their replacements, such as keeping 15854 when 15853 is correct, or keeping J02.9 when J02.8 is the supported corrected diagnosis.
11. Classify billing impact for every discrepancy:
   - upcoding: billed code or level is higher/more intensive/more expensive than documentation supports.
   - downcoding: billed code or level is lower/less intensive than documentation supports.
   - overbilling: extra unsupported code, duplicate, unbundled code, or excessive quantity.
   - underbilling: documented supported service/code/quantity is missing or too low.
   - neutral: documentation/compliance issue without clear payment direction.
   - unknown: payment direction cannot be determined from the chart.

High-risk coding rules:
- Granular specificity protocol: always match the highest level of clinical specificity documented in the record. Never assign or retain an unspecified or generic (.9) code if documentation specifies a precise pathogen, bacterial strain, viral genotype, anatomical site, laterality, or other specific clinical entity. If laboratory results or clinical findings name a specific entity and an exact ICD-10-CM code can be selected from evidence, upgrade the code to match that entity.
- Multi-component CPT/HCPCS textual adherence: when an official code definition requires multiple components to be performed concurrently, such as "component A AND component B", verify that all listed components are documented as completed. If documentation shows only one component or a subset was performed, flag the multi-component code as overbilling and replace it with the exact lower-tier single-component code supported by the text.
- Suture/staple removal anti-hallucination guardrail: apply absolute textual adherence to the precise CPT descriptions for non-anesthetized removal of closure materials.
- CPT 15853 is removal of sutures OR staples, not requiring anesthesia. Use 15853 when only sutures or only staples were handled.
- CPT 15854 is removal of sutures AND staples, not requiring anesthesia. Do not allow 15854 unless clinical documentation explicitly states both sutures and staples were removed during the encounter. If the note mentions only one category, such as "2 sutures removed; no staples", flag 15854 as overbilling/upcoding and replace it with 15853.
- Pathogen specificity: when interpreting laboratory diagnostic result data, do not use general or unspecified (.9) diagnosis codes if specific clinical findings, cultured pathogens, bacterial strains, viral genotypes, or anatomical conditions are documented and an exact ICD-10-CM code can be selected from evidence.
- Example: a positive throat culture showing growth of Beta-hemolytic Streptococcus (non-Group A) should map to J02.8 (acute pharyngitis due to other specified organisms), not generic pharyngitis J02.9, when the chart evidence supports that specificity.
- Abnormal findings and positive serology results requiring active clinical management must be captured when supported by evidence, including abnormal urine/lab findings and HSV serology linked to antiviral management. Select the most specific valid ICD-10-CM code supported by the chart and date-of-service rules; if specificity is uncertain, omit or warn rather than guessing.
- Universal E/M leveling: classify MDM using the three pillars: Problems Addressed, Data Reviewed/Analyzed, and Risk of Complications/Morbidity, or documented total time when validly documented.
- E/M level selection requires at least 2 of the 3 MDM pillars to meet or exceed the selected tier's threshold. Do not assign a higher E/M level from one strong pillar alone.
- Routine, scheduled, uncomplicated post-operative suture check or removal is a minimal/minor/self-limiting problem aligned to the E/M level 2 framework, such as 99212. It does not qualify as an active acute condition unless a complication such as severe infection or complete dehiscence is actively managed.
- Routine mechanical removal of closure materials without complication is minimal risk.
- Managing multiple acute conditions simultaneously, such as acute bronchitis plus positive HSV plus strep, may elevate complexity when each condition is supported and actively managed.
- Reviewing or ordering unique lab panels or diagnostic reports counts as distinct data when the chart supports it.
- Prescription drug management with standard outpatient medications, including common antibiotics, oral steroids such as prednisone, and routine antivirals such as valacyclovir/Valtrex, generally supports moderate risk and may support 99214/99204 when the other MDM elements support that tier.
- Routine mechanical checks or non-invasive procedures without medication changes are minimal risk and generally support level 2 E/M when the rest of the MDM is also minimal.
- Do not elevate an encounter to high risk/level 5 (99215/99205) based on standard prescription drug management alone. Level 5 requires explicit documentation such as highly complex life-threatening decisions, urgent major surgery decision-making, acute emergency hospitalization, or an immediate life-threatening threat to bodily function. If risk is driven strictly by standard prescription management, cap the E/M level at 99214/99204.
- Vaccine product codes are separate from vaccine administration codes. The product code must match exact vaccine name, formulation, dose, age, route, and date-of-service code set. If the chart only says "flu shot" or lacks product detail, do not guess a product code.
- 96372 is for therapeutic/prophylactic/diagnostic non-vaccine injections. Do not use it for vaccine administration.
- 36415 may apply for routine venipuncture only when an in-house blood draw/venipuncture is documented and payer rules allow separate billing. Retain or add 36415 when the physical venous blood collection occurred in the clinic, even if the analytical lab was routed to an outside vendor.
- Multiplex molecular panels generally require the applicable panel code when panel criteria are met; do not unbundle component tests.
- Outside facility/reference lab routing: scan all orders, procedures, diagnostic tracking fields, and results for external vendor routing tags, metadata, or labels such as suppressed, non-billable, Quest, Labcorp/LabCorp, send-out, referred, Practice Bills, external vendor, outside lab, outside facility, third-party laboratory, or routed to an outside laboratory.
- Do not completely delete or wipe out a valid documented procedure code simply because it was executed by an outside vendor or outside facility. Instead, retain the code in the system and explicitly label its metadata, description, evidence, flags, or notes as "Outside Facility" or "Referred Lab" for front-end and Excel export tracking.
- Wrong-code exception: completely remove an outside facility procedure code only when the code itself is clinically wrong, unsupported by the medical record, or a clear billing error. If the code is correct but just done outside, keep it and flag it as an outside service.
- Retained diagnostic data: always extract the underlying diagnostic lab results from vendor/outside-facility labs into supported ICD-10 diagnosis arrays when chart evidence supports the diagnosis.
- Never invent diagnoses, procedures, quantities, providers, dates, or codes.
- Check for upcoding and downcoding across all code families: E/M, CPT procedure code selection, CPT/HCPCS quantities, ICD-10 specificity/medical necessity support, HCPCS supply/drug units, NCCI unbundling, duplicate billing, missing documented services, and unsupported removals.
- For every discrepancy, state whether it is upcoding, downcoding, overbilling, underbilling, neutral, or unknown in billingImpact.
- Do not mark a chart clean unless originalCodes, correctedCodes, missingCodes, E/M, quantities, NCCI, and documentation support have all been checked.
- Every code entry must include evidence. Keep evidence quotes concise, preferably one short chart phrase or location. Every discrepancy must include concrete chart evidence without long narrative restatement.
- Keep summary, verificationSummary, descriptions, and recommendations concise. Do not repeat the same chart facts in multiple long prose fields when the code arrays and discrepancies already capture them.
- Ensure exact output spelling for schema keys and code sections. Use "cpt" for the CPT array key and "CPT Procedures" for human-facing CPT section labels when referenced.
- Return one syntactically valid JSON object matching the required responseSchema exactly. Do not output conversational prose, prefaces, introductions, markdown wrappers, or code fences.
- If unsure, omit the code, lower aiConfidence, and add auditWarnings rather than guessing.`;

const VERIFICATION_INSTRUCTION = `${SYSTEM_INSTRUCTION}

You are now the independent final QA auditor. Your task is to find mistakes in the draft audit, not to agree with it.

Verification requirements:
1. Re-read the chart/PDF, especially billing/charge sections, medication/vaccine logs, orders, procedure notes, assessment, and plan.
2. Check every original code: it must be explicitly printed in the chart as billed.
3. Check every corrected/missing code: it must be supported by clear chart evidence and correct for the date of service.
4. Remove guessed or unsupported codes. Put unresolved issues in auditWarnings.
5. Re-check quantities, E/M MDM level, vaccine product vs administration, injection administration, venipuncture, panels, and NCCI bundling.
6. Re-check every discrepancy billingImpact. Make sure upcoding/downcoding/overbilling/underbilling labels are present and correct.
7. Return final corrected JSON only. If the draft is wrong, fix it.`;

export interface AuditInput {
  fileName: string;
  isPdf: boolean;
  base64?: string;
  mimeType?: string;
  text?: string;
}

export interface AuditUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  model: string;
  apiCalls: number;
  costUsd: number;
}

export interface AuditResultWithUsage {
  audit: Omit<AuditResult, "id" | "fileName" | "status" | "createdAt">;
  usage: AuditUsage;
}

const CACHE_TTL_SECONDS = 60 * 60;
const instructionCachePromises = new Map<string, Promise<string | null>>();
const disabledInstructionCaches = new Set<string>();

export async function auditChart(
  input: AuditInput,
  settings: Settings,
): Promise<AuditResultWithUsage> {
  const draftModel = selectDraftModel(settings.model);
  const verificationModel = selectVerificationModel(settings.model);
  const draft = await generateAudit(input, settings, SYSTEM_INSTRUCTION, buildDraftPrompt(input.fileName), draftModel, "draft");
  const draftAudit = addConsistencyWarnings(draft.audit);

  if (!shouldRunVerification(draftAudit, input)) {
    draftAudit.verificationSummary = appendSentence(
      draftAudit.verificationSummary || "",
      "Final QA verification was skipped because no high-risk review triggers were detected.",
    );
    return {
      audit: draftAudit,
      usage: draft.usage,
    };
  }

  const final = await generateAudit(
    input,
    settings,
    VERIFICATION_INSTRUCTION,
    buildVerificationPrompt(input.fileName, draftAudit),
    verificationModel,
    "verification",
  );

  const audit = addConsistencyWarnings(final.audit);
  return {
    audit,
    usage: {
      inputTokens: draft.usage.inputTokens + final.usage.inputTokens,
      cachedInputTokens: draft.usage.cachedInputTokens + final.usage.cachedInputTokens,
      outputTokens: draft.usage.outputTokens + final.usage.outputTokens,
      thinkingTokens: draft.usage.thinkingTokens + final.usage.thinkingTokens,
      model: draft.usage.model === final.usage.model ? final.usage.model : `${draft.usage.model} -> ${final.usage.model}`,
      apiCalls: draft.usage.apiCalls + final.usage.apiCalls,
      costUsd: +(draft.usage.costUsd + final.usage.costUsd).toFixed(6),
    },
  };
}

async function generateAudit(
  input: AuditInput,
  settings: Settings,
  systemInstruction: string,
  prompt: string,
  modelOverride?: string,
  phase: "draft" | "verification" = "draft",
): Promise<AuditResultWithUsage> {
  const ai = new GoogleGenAI({ apiKey: settings.apiKey });
  const model = modelOverride || settings.model;
  const is25 = model.includes("2.5");
  const thinkingBudget = selectThinkingBudget(model, phase, input);
  const cachedContent = is25
    ? await getInstructionCacheName(ai, settings.apiKey, model, phase, systemInstruction)
    : null;
  const parts = buildContentParts(input, prompt);

  const res = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      ...(cachedContent ? { cachedContent } : { systemInstruction }),
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0,
      ...(is25 ? { thinkingConfig: { thinkingBudget } } : {}),
      maxOutputTokens: selectMaxOutputTokens(input),
    },
  });

  const parsed = parseJsonResponse(res.text);
  const audit = normalizeAudit({
    patient: parsed.patient || "Not documented",
    patientId: parsed.patientId || "Not documented",
    provider: parsed.provider || "Not documented",
    facility: parsed.facility || "Not documented",
    dateOfService: parsed.dateOfService || "Not documented",
    encounterNumber: parsed.encounterNumber || "Not documented",
    insurancePayer: parsed.insurancePayer || "Not documented",
    clinicLocation: parsed.clinicLocation || "Not documented",
    documentedEmLevel: parsed.documentedEmLevel || "-",
    auditedEmLevel: parsed.auditedEmLevel || "-",
    emJustification: parsed.emJustification || "",
    mdm: cleanMdm(parsed.mdm),
    problemList: Array.isArray(parsed.problemList) ? parsed.problemList : [],
    originalCodes: cleanCodeSet(parsed.originalCodes),
    correctedCodes: cleanCodeSet(parsed.correctedCodes),
    missingCodes: cleanCodeArray(parsed.missingCodes),
    discrepancies: cleanDiscrepancies(parsed.discrepancies),
    complianceScore: clamp(parsed.complianceScore, 0, 100),
    aiConfidence: clamp(parsed.aiConfidence, 0, 100),
    documentQuality: parsed.documentQuality || "Not assessed",
    verificationSummary: parsed.verificationSummary || "Not verified",
    auditWarnings: cleanStringArray(parsed.auditWarnings),
    summary: parsed.summary || "",
  });

  const usage = res.usageMetadata || {};
  const inputTokens = typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : 0;
  const outputTokens = typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : 0;
  const thinkingTokens =
    typeof (usage as any).thoughtsTokenCount === "number"
      ? (usage as any).thoughtsTokenCount
      : 0;
  const cachedInputTokens =
    typeof (usage as any).cachedContentTokenCount === "number"
      ? (usage as any).cachedContentTokenCount
      : 0;

  return {
    audit,
    usage: {
      inputTokens,
      cachedInputTokens,
      outputTokens,
      thinkingTokens,
      model,
      apiCalls: 1,
      costUsd: getCost(
        model,
        inputTokens,
        outputTokens,
        thinkingTokens,
        cachedInputTokens,
      ),
    },
  };
}

async function getInstructionCacheName(
  ai: GoogleGenAI,
  apiKey: string,
  model: string,
  phase: "draft" | "verification",
  systemInstruction: string,
): Promise<string | null> {
  const key = `${hashText(apiKey)}:${model}:${phase}:${hashText(systemInstruction)}`;
  if (disabledInstructionCaches.has(key)) return null;

  const existing = instructionCachePromises.get(key);
  if (existing) return existing;

  const promise = ai.caches.create({
    model,
    config: {
      displayName: `medaudit-${phase}-${hashText(systemInstruction)}`,
      systemInstruction,
      ttl: `${CACHE_TTL_SECONDS}s`,
    },
  }).then((cache) => cache.name || null).catch(() => {
    disabledInstructionCaches.add(key);
    instructionCachePromises.delete(key);
    return null;
  });

  instructionCachePromises.set(key, promise);
  return promise;
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildDraftPrompt(fileName: string) {
  return `Audit this medical chart: "${fileName}".

Return only JSON matching the schema. Be conservative: if the exact supported code cannot be determined from chart evidence, do not guess. Add auditWarnings instead.

For every original, corrected, or missing code, include a brief evidence quote or location from the chart. Keep prose compact while preserving all coding decisions, evidence, and warnings.

${buildImpactReminder()}`;
}

function buildImpactReminder() {
  return `For every discrepancy, classify billingImpact:
- upcoding: billed higher than supported.
- downcoding: billed lower than supported.
- overbilling: unsupported extra code, duplicate, unbundled code, or excessive quantity.
- underbilling: missing supported service/code or quantity too low.
- neutral: documentation issue without clear payment direction.
- unknown: impact cannot be determined.`;
}

function buildVerificationPrompt(fileName: string, draft: Omit<AuditResult, "id" | "fileName" | "status" | "createdAt">) {
  return `Verify and correct this draft audit for "${fileName}".

Draft audit JSON:
${JSON.stringify(draft)}

${buildImpactReminder()}

Return only the final corrected JSON matching the schema. Remove unsupported or guessed codes. Add auditWarnings for unresolved uncertainty.`;
}

function buildContentParts(input: AuditInput, prompt: string): any[] {
  if (input.isPdf && input.base64) {
    return [
      {
        inlineData: {
          mimeType: input.mimeType || "application/pdf",
          data: input.base64,
        },
      },
      { text: prompt },
    ];
  }

  return [
    {
      text: `${prompt}\n\n=== DOCUMENT TEXT ===\n${(input.text || "").slice(0, 200000)}`,
    },
  ];
}

function selectDraftModel(model: string) {
  if (model.includes("2.5")) return "gemini-2.5-flash";
  return model;
}

function selectVerificationModel(model: string) {
  if (model === "gemini-2.5-flash" || model === "gemini-2.5-flash-lite") return model;
  if (model.includes("2.5")) return "gemini-2.5-pro";
  return model;
}

function selectThinkingBudget(model: string, phase: "draft" | "verification", input: AuditInput) {
  const complex = isComplexInput(input);

  if (model.includes("flash-lite")) return phase === "verification" ? 2048 : 1024;
  if (model.includes("flash")) return phase === "verification" ? (complex ? 6144 : 4096) : 2048;
  if (model.includes("pro")) return phase === "verification" ? (complex ? 12288 : 8192) : 4096;
  return phase === "verification" ? 4096 : 2048;
}

function selectMaxOutputTokens(input: AuditInput) {
  return isComplexInput(input) ? 16384 : 12288;
}

function isComplexInput(input: AuditInput) {
  const textLength = input.text?.length || 0;
  const approxPdfBytes = input.base64 ? Math.floor((input.base64.length * 3) / 4) : 0;
  return textLength > 60000 || approxPdfBytes > 2_500_000;
}

function shouldRunVerification(audit: Omit<AuditResult, "id" | "fileName" | "status" | "createdAt">, input: AuditInput) {
  if (audit.aiConfidence < 90) return true;
  if (audit.discrepancies.length > 0) return true;
  if ((audit.auditWarnings || []).length > 0) return true;
  if (isLongOrComplexInput(input, audit)) return true;
  if (hasHighRiskReviewPattern(audit)) return true;
  return false;
}

function isLongOrComplexInput(input: AuditInput, audit: Omit<AuditResult, "id" | "fileName" | "status" | "createdAt">) {
  const textLength = input.text?.length || 0;
  const approxPdfBytes = input.base64 ? Math.floor((input.base64.length * 3) / 4) : 0;
  const codeCount = flatCodes(audit.originalCodes).length + flatCodes(audit.correctedCodes).length + audit.missingCodes.length;
  return textLength > 60000 || approxPdfBytes > 2_500_000 || codeCount > 14;
}

function hasHighRiskReviewPattern(audit: Omit<AuditResult, "id" | "fileName" | "status" | "createdAt">) {
  const allCodes = flatCodes(audit.originalCodes).concat(flatCodes(audit.correctedCodes), audit.missingCodes);
  const codeSet = new Set(allCodes.map((entry) => normalizeCode(entry.code)));
  if (codeSet.has("99215") || codeSet.has("99205") || normalizeCode(audit.auditedEmLevel) === "99215" || normalizeCode(audit.auditedEmLevel) === "99205") return true;
  if (codeSet.has("15854") || codeSet.has("15853")) return true;
  if (allCodes.some((entry) => isLikelyLabProcedureCode(entry.code) || entry.sourceType === "outside-facility" || entry.sourceType === "referred-lab")) return true;

  const text = [
    audit.emJustification,
    audit.mdm?.riskEvidence,
    audit.summary,
    ...(audit.auditWarnings || []),
  ].join(" ").toLowerCase();
  return text.includes("outside facility")
    || text.includes("referred lab")
    || text.includes("quest")
    || text.includes("labcorp")
    || text.includes("ncci")
    || text.includes("unbundl")
    || text.includes("level 5");
}

function parseJsonResponse(rawText?: string) {
  let raw = rawText;
  if (!raw) {
    throw new Error(
      "Gemini returned an empty response. Possible causes: scanned PDF without readable content, model access issue, or API rate limit.",
    );
  }

  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    const recovered = tryRecoverJson(raw);
    if (!recovered) {
      throw new Error(`Could not parse Gemini output as JSON. First 250 chars: ${raw.slice(0, 250)}`);
    }
    return recovered;
  }
}

function normalizeAudit(result: Omit<AuditResult, "id" | "fileName" | "status" | "createdAt">) {
  result.originalCodes = dedupeCodeSet(result.originalCodes);
  result.correctedCodes = dedupeCodeSet(result.correctedCodes);
  result.missingCodes = dedupeCodeArray(result.missingCodes);
  result.discrepancies = Array.isArray(result.discrepancies) ? result.discrepancies : [];
  result.auditWarnings = cleanStringArray(result.auditWarnings);
  labelOutsideFacilityLabProcedures(result);
  result.complianceScore = clamp(result.complianceScore, 0, 100);
  result.aiConfidence = clamp(result.aiConfidence, 0, 100);
  return result;
}

function labelOutsideFacilityLabProcedures(result: Omit<AuditResult, "id" | "fileName" | "status" | "createdAt">) {
  const warnings = new Set(result.auditWarnings || []);
  const labeled = [
    ...labelOutsideFacilityEntries(result.originalCodes.icd10),
    ...labelOutsideFacilityEntries(result.originalCodes.em),
    ...labelOutsideFacilityEntries(result.originalCodes.cpt),
    ...labelOutsideFacilityEntries(result.originalCodes.hcpcs),
    ...labelOutsideFacilityEntries(result.correctedCodes.icd10),
    ...labelOutsideFacilityEntries(result.correctedCodes.em),
    ...labelOutsideFacilityEntries(result.correctedCodes.cpt),
    ...labelOutsideFacilityEntries(result.correctedCodes.hcpcs),
    ...labelOutsideFacilityEntries(result.missingCodes),
  ];

  for (const entry of labeled) {
    const normalizedCode = normalizeCode(entry.code);
    warnings.add(
      `Outside facility/referred lab procedure code ${entry.code} was retained for tracking and labeled; verify billing responsibility before claim submission.`,
    );

    if (!result.discrepancies.some((d) => normalizeCode(d.code) === normalizedCode && mentionsOutsideVendorSuppression(d))) {
      result.discrepancies.push({
        category: "CPT",
        type: "documentation",
        billingImpact: "neutral",
        severity: "low",
        code: entry.code,
        description: `Procedure code appears associated with an outside facility or referred lab and was retained with tracking metadata. Evidence: ${entry.evidence || "outside facility/referred lab documentation"}`,
        recommendation: "Keep the code visible for front-end and export tracking, verify billing responsibility, and remove only if the code is clinically wrong, unsupported, or a clear billing error.",
      });
    }
  }

  result.auditWarnings = Array.from(warnings);
}

function labelOutsideFacilityEntries(entries: any[]): Array<{ code: string; evidence?: string }> {
  const labeled: Array<{ code: string; evidence?: string }> = [];
  for (const entry of entries || []) {
    if (!isOutsideFacilityLabCode(entry)) continue;
    const label = outsideFacilityLabel(entry);
    entry.description = appendLabel(entry.description, label);
    entry.evidence = appendLabel(entry.evidence, label);
    entry.sourceType = label === "Referred Lab" ? "referred-lab" : "outside-facility";
    entry.billableByProvider = "verify";
    labeled.push({ code: entry.code, evidence: entry.evidence || entry.description });
  }
  return labeled;
}

function addConsistencyWarnings(result: Omit<AuditResult, "id" | "fileName" | "status" | "createdAt">) {
  const warnings = new Set(result.auditWarnings || []);
  const corrected = new Set(flatCodes(result.correctedCodes).map((c) => c.code));

  for (const missing of result.missingCodes) {
    if (!corrected.has(missing.code)) {
      warnings.add(`Missing code ${missing.code} was not present in correctedCodes; verify before billing.`);
    }
  }

  for (const entry of flatCodes(result.correctedCodes)) {
    if (!entry.evidence || entry.evidence === "Not directly documented") {
      warnings.add(`Corrected code ${entry.code} lacks direct supporting evidence; manual review required.`);
    }
  }

  if (warnings.size > 0) {
    result.auditWarnings = Array.from(warnings);
    result.aiConfidence = Math.min(result.aiConfidence, 85);
    result.summary = appendSentence(result.summary, "Manual coder review is required for unresolved warnings.");
  }

  return result;
}

function tryRecoverJson(raw: string): any | null {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;

  let candidate = raw.slice(firstBrace, lastBrace + 1);
  while (candidate.length > 10) {
    try {
      return JSON.parse(candidate);
    } catch {
      const lastComma = candidate.lastIndexOf(",");
      const lastColon = candidate.lastIndexOf(":");
      if (lastColon > lastComma) {
        candidate = candidate.slice(0, lastComma > 0 ? lastComma : candidate.length - 1).trimEnd();
        if (candidate.endsWith(",")) candidate = candidate.slice(0, -1).trimEnd();
      } else {
        candidate = candidate.slice(0, -1).trimEnd();
      }
      if (candidate.startsWith("{") && !candidate.endsWith("}")) candidate += "}";
    }
  }
  return null;
}

function clamp(v: any, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

function cleanCodeSet(cs: any): { icd10: any[]; em: any[]; cpt: any[]; hcpcs: any[] } {
  if (!cs || typeof cs !== "object") return { icd10: [], em: [], cpt: [], hcpcs: [] };
  return {
    icd10: cleanCodeArray(cs.icd10),
    em: cleanCodeArray(cs.em),
    cpt: cleanCodeArray(cs.cpt),
    hcpcs: cleanCodeArray(cs.hcpcs),
  };
}

function cleanMdm(mdm: any) {
  const value = mdm && typeof mdm === "object" ? mdm : {};
  return {
    problemsLevel: cleanText(value.problemsLevel),
    problemsEvidence: cleanText(value.problemsEvidence),
    dataLevel: cleanText(value.dataLevel),
    dataEvidence: cleanText(value.dataEvidence),
    riskLevel: cleanText(value.riskLevel),
    riskEvidence: cleanText(value.riskEvidence),
    finalMdmLevel: cleanText(value.finalMdmLevel),
    twoOfThreeJustification: cleanText(value.twoOfThreeJustification),
  };
}

function cleanCodeArray(arr: any): any[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((e: any) => e && typeof e.code === "string" && e.code.trim() !== "")
    .map((e: any) => ({
      code: e.code.trim(),
      description: typeof e.description === "string" ? e.description.trim() : "",
      qty: typeof e.qty === "number" && e.qty >= 1 ? Math.round(e.qty) : 1,
      evidence: typeof e.evidence === "string" ? e.evidence.trim() : "",
      sourceType: cleanSourceType(e.sourceType),
      billableByProvider: cleanBillableByProvider(e.billableByProvider),
    }));
}

function cleanSourceType(value: any): "in-house" | "outside-facility" | "referred-lab" | "unknown" {
  return value === "in-house" || value === "outside-facility" || value === "referred-lab" || value === "unknown"
    ? value
    : "unknown";
}

function cleanBillableByProvider(value: any): "yes" | "no" | "verify" {
  return value === "yes" || value === "no" || value === "verify" ? value : "verify";
}

function cleanText(value: any) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDiscrepancies(arr: any): any[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((d: any) => d && typeof d.code === "string")
    .map((d: any) => ({
      category: d.category || "Documentation",
      type: d.type || "documentation",
      billingImpact: d.billingImpact || inferBillingImpact(d),
      severity: d.severity || "medium",
      code: d.code || "-",
      description: d.description || "",
      recommendation: d.recommendation || "",
    }));
}

function isOutsideFacilityLabCode(entry: any): boolean {
  if (!entry || typeof entry.code !== "string") return false;
  if (!isLikelyLabProcedureCode(entry.code)) return false;

  const text = `${entry.description || ""} ${entry.evidence || ""}`.toLowerCase();
  return /\bsuppress(?:ed|ion)?\b/.test(text)
    || /\bnon[-\s]?billable\b/.test(text)
    || /\boutside\s+(?:lab|laboratory|vendor)\b/.test(text)
    || /\bexternal\s+(?:lab|laboratory|vendor)\b/.test(text)
    || /\bsend[-\s]?out\b/.test(text)
    || /\breferred\s+(?:lab|test|out)\b/.test(text)
    || /\brouted\s+to\b/.test(text)
    || /\bquest\b/.test(text)
    || /\blab\s*corp\b/.test(text)
    || /\blabcorp\b/.test(text)
    || /\bcpl\b/.test(text)
    || /\bbioreference\b/.test(text)
    || /\bmayo\b/.test(text)
    || /\barup\b/.test(text)
    || /\bsonic\b/.test(text);
}

function outsideFacilityLabel(entry: any): string {
  const text = `${entry.description || ""} ${entry.evidence || ""}`.toLowerCase();
  if (/\breferred\b/.test(text) || /\bsend[-\s]?out\b/.test(text) || /\bquest\b/.test(text) || /\blab\s*corp\b/.test(text) || /\blabcorp\b/.test(text)) {
    return "Referred Lab";
  }
  return "Outside Facility";
}

function appendLabel(value: any, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  const suffix = `[${label}]`;
  if (!text) return suffix;
  if (text.toLowerCase().includes(label.toLowerCase())) return text;
  return `${text} ${suffix}`;
}

function isLikelyLabProcedureCode(code: string): boolean {
  const numeric = Number(normalizeCode(code).match(/\d{5}/)?.[0]);
  if (!Number.isFinite(numeric)) return false;

  return (numeric >= 80047 && numeric <= 89398)
    || (numeric >= 1 && numeric <= 51 && /[uU]$/.test(code.trim()));
}

function mentionsOutsideVendorSuppression(value: any): boolean {
  const text = `${value?.description || ""} ${value?.recommendation || ""}`.toLowerCase();
  return text.includes("suppressed")
    || text.includes("outside vendor")
    || text.includes("outside lab")
    || text.includes("quest")
    || text.includes("labcorp")
    || text.includes("send-out");
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function inferBillingImpact(d: any) {
  const text = `${d?.type || ""} ${d?.description || ""} ${d?.recommendation || ""}`.toLowerCase();
  if (text.includes("upcod")) return "upcoding";
  if (text.includes("downcod")) return "downcoding";
  if (text.includes("overbill") || text.includes("unsupported") || text.includes("duplicate") || text.includes("unbundl") || text.includes("excess")) return "overbilling";
  if (text.includes("underbill") || text.includes("missing") || text.includes("add ")) return "underbilling";
  if (d?.type === "added") return "underbilling";
  if (d?.type === "removed") return "overbilling";
  return "unknown";
}

function cleanStringArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
}

function dedupeCodeSet(cs: { icd10: any[]; em: any[]; cpt: any[]; hcpcs: any[] }) {
  return {
    icd10: dedupeCodeArray(cs.icd10),
    em: dedupeCodeArray(cs.em),
    cpt: dedupeCodeArray(cs.cpt),
    hcpcs: dedupeCodeArray(cs.hcpcs),
  };
}

function dedupeCodeArray(arr: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of arr || []) {
    const key = `${item.code}:${item.qty}:${item.evidence || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function flatCodes(set: { icd10: any[]; em: any[]; cpt: any[]; hcpcs: any[] }) {
  return [...set.icd10, ...set.em, ...set.cpt, ...set.hcpcs];
}

function appendSentence(text: string, sentence: string) {
  const trimmed = text.trim();
  if (!trimmed) return sentence;
  if (trimmed.includes(sentence)) return trimmed;
  return `${trimmed} ${sentence}`;
}

export async function testConnection(settings: Settings): Promise<boolean> {
  try {
    const ai = new GoogleGenAI({ apiKey: settings.apiKey });
    const res = await ai.models.generateContent({
      model: settings.model,
      contents: "Reply with: ok",
    });
    return !!res.text;
  } catch {
    return false;
  }
}
