export interface CodeEntry {
  code: string;
  description: string;
  qty: number;
  evidence?: string;
  sourceType?: "in-house" | "outside-facility" | "referred-lab" | "unknown";
  billableByProvider?: "yes" | "no" | "verify";
}

export interface CodeSet {
  icd10: CodeEntry[];
  em: CodeEntry[];
  cpt: CodeEntry[];
  hcpcs: CodeEntry[];
}

export type DiscrepancyType = "added" | "removed" | "modified" | "quantity" | "level" | "documentation";
export type Severity = "low" | "medium" | "high" | "critical";
export type BillingImpact = "upcoding" | "downcoding" | "overbilling" | "underbilling" | "neutral" | "unknown";

export interface Discrepancy {
  category: "CPT" | "ICD-10" | "HCPCS" | "E/M" | "NCCI" | "Documentation";
  type: DiscrepancyType;
  billingImpact: BillingImpact;
  severity: Severity;
  code: string;
  description: string;
  recommendation: string;
}

export interface MdmAssessment {
  problemsLevel: string;
  problemsEvidence: string;
  dataLevel: string;
  dataEvidence: string;
  riskLevel: string;
  riskEvidence: string;
  finalMdmLevel: string;
  twoOfThreeJustification: string;
}

export interface AuditResult {
  id: string;
  fileName: string;
  patient: string;
  patientId?: string;
  provider: string;
  facility: string;
  dateOfService: string;
  encounterNumber?: string;
  insurancePayer?: string;
  clinicLocation?: string;
  documentedEmLevel: string;
  auditedEmLevel: string;
  emJustification: string;
  mdm: MdmAssessment;
  problemList: string[];
  originalCodes: CodeSet;
  correctedCodes: CodeSet;
  missingCodes: CodeEntry[];
  discrepancies: Discrepancy[];
  complianceScore: number;
  aiConfidence: number;
  documentQuality?: string;
  verificationSummary?: string;
  auditWarnings?: string[];
  modelUsed?: string;
  apiCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  costUsd?: number;
  summary: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  error?: string;
  processingMs?: number;
  createdAt: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  base64: string;
  mimeType: string;
  isPdf: boolean;
  text?: string;
  status: "pending" | "parsing" | "ready" | "error";
  error?: string;
}

export interface Settings {
  apiKey: string;
  model: string;
  concurrency: number;
  baaAcknowledged: boolean;
  encryptPhi: boolean;
  storageFolder: string;
}
