
export enum SectionName {
  ADMITTING = "Admitting Section",
  CARDIO = "Cardiovascular Diagnostics",
  CASHIER = "Cashier Management",
  CLAIMS = "Claims",
  ER = "Emergency Room Complex",
  DIETARY = "Food and Nutrition Management",
  GENERAL_SERVICES = "General Services Section",
  RECORDS = "Health Records and Documents Management",
  HOUSEKEEPING = "Housekeeping Laundry and Linen",
  INDUSTRIAL = "Industrial Clinic",
  IT = "Information Technology",
  LAB = "Laboratory",
  SOCIAL = "Medical Social Service",
  NURSING = "Nursing Division",
  PATHOLOGY = "Pathology",
  PHARMACY = "Pharmacy",
  PT_OT = "Physical and Occupational Therapy",
  RADIOLOGY = "Radiology",
  REQUISITION = "Requisition Section",
  SUPPLY = "Supply Management Section",
  SURGICAL = "Surgical Care Complex"
}

export type KPIType = 'PERCENTAGE' | 'TIME';

export interface KPIRecord {
  id: string;
  section: SectionName;
  kpiName: string;
  department: string; // Type/Department
  kpiType: KPIType; // New field
  month: string; // ISO Date YYYY-MM-DD (usually 1st of month)
  census: number;
  
  // Time based metrics
  targetTime?: number;
  actualTime?: number;
  timeUnit?: string; // e.g., "Mins", "Hours", "Days"
  
  // Percentage based metrics
  targetPct: number;
  actualPct: number;
  
  // Submission tracking
  dueDate: string; // ISO Date
  dateSubmitted: string; // ISO Date
  
  remarks?: string;
  
  // Status for Draft vs Official
  status?: 'DRAFT' | 'APPROVED';
}

export enum PerformanceStatus {
  TOP_PERFORMER = "Top Performer", // No non-conformance 9 months
  STABLE = "Stable Performer", // No non-conformance 6 months
  NEEDS_IMPROVEMENT = "Needs Improvement", // 1 non-conformance 3 months
  CRITICAL = "Critical", // 2+ non-conformance 3 months
  UNDEFINED = "New / Undefined"
}

export interface SectionPerformance {
  section: SectionName;
  status: PerformanceStatus;
  lastFailureDate?: string;
  failureCount3Months: number;
}

export interface KPIDefinition {
  id: string;
  section: SectionName;
  documentNumber: string; // New field
  qualityObjective: string;
  kpiName: string;
  definition: string;
  formula: string;
  target: string;
  
  // Specific Target Columns
  targetTime?: number;
  targetPct?: number;
  timeUnit?: string;
  
  // Classification Columns
  department?: string;
  kpiType?: KPIType;

  responsible: string; // e.g. "Head Nurse"
  schedule: string; // e.g. "Monthly"
}