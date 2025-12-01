import { KPIRecord, SectionName, KPIDefinition } from './types';

// Ospital ng Makati specific branding
export const APP_NAME = "Ospital ng Makati KPI Dashboard";

// Updated Logo URL
export const LOGO_URL = "https://maxterrenal-hash.github.io/justculture/osmak-logo.png";

// Specific Data Lists
export const KPI_NAMES = [
  "12L ECG", "ACM Mammography", "Admission", "Ambulatory Surgery", "Building Facilities", "CT-scan", "CTC", 
  "Certificate of Live Birth", "Clinical Abstract - HIMS", "Clinical Abstract - Non-HIMS", "Consultation", 
  "Corrective Maintenance - Hardware", "Corrective Maintenance - Network", "Corrective Maintenance - Software", 
  "Cytology", "Database Backup", "ER", "Eligibility Assessment", "Filing of Hard Copy", "HIMS Training", 
  "Infectious", "Inpatient", "Insurance", "Issuance of Official Receipt", "MRI", "Medical Certificate", 
  "Medical Equipment and Hospital Facilities", "Medical Supplies", "Non-Infectious", "Non-Medical Supplies", 
  "Notification", "Occupational Therapy", "Outpatient", "Outpatient Basic", "Overall", "Overboarding", 
  "Overstaying", "Patient Counseling", "Physical Therapy", "Portion Size", "Presentation", 
  "Preventive Maintenance - Desktop Computers", "Preventive Maintenance - Server", "Preventive Maintenance Plan", 
  "Printing of Clinical Coversheet", "Processing of PhilHealth Claims", "Provisional Medical Certificate", 
  "Reattendance Rate", "Referred DPRM", "Requested Corrective Maintenance", "Requisition", "SSS", 
  "Surgical Pathology", "System Development - Corrective Major", "System Development - Corrective Minor", 
  "System Development - Major Project", "System Development - Minor Project", "Take Home Medication Form", 
  "Taste", "Timeliness", "Triage Response Time", "Ultrasound", "X-ray"
];

export const DEPARTMENTS = [
  "Benign (days)", "Client Satisfaction", "Collection (minutes)", "Emergency Medicine", "Family Medicine", 
  "General (minutes)", "General Surgery", "Gynecological (days)", "ICU", "Internal Medicine", "LEVEL 1", 
  "LEVEL 2", "LEVEL 3", "LEVEL 4", "LEVEL 5", "Log Inventory (minutes)", "Malignant (days)", "Medicine Ward", 
  "Non-Gynecological (days)", "Non-Residential (days)", "Obstetrics & Gynecology", "Ophthalmology", 
  "Otorhinolaryngology", "Overall", "Pedia", "Pedia Ward", "Pediatrics", "Phase 1 - TAT (days)", 
  "Phase 2 - TAT (days)", "Residential (days)", "Segregation (minutes)", "Surgery Ward", "TAT in days", 
  "TAT in minutes", "Schedule Compliance"
];

// Helper to generate mock data
const generateMockData = (): KPIRecord[] => {
  const records: KPIRecord[] = [];
  const sections = Object.values(SectionName);
  
  const today = new Date();
  
  // Generate data for the last 12 months
  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = date.toISOString().split('T')[0];
    
    // Due date is usually 5th of the next month
    const dueDate = new Date(date.getFullYear(), date.getMonth() + 1, 5).toISOString().split('T')[0];

    sections.forEach(section => {
      // Create 2-3 records per section per month for variety
      const numRecords = 2; 

      for(let j=0; j<numRecords; j++) {
        const isGoodSection = [SectionName.ER, SectionName.LAB, SectionName.NURSING].includes(section);
        
        // Pick random KPI and Department from the lists
        const kpiName = KPI_NAMES[Math.floor(Math.random() * KPI_NAMES.length)];
        const department = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];

        // Simulate submission dates (some late)
        const isLate = Math.random() > 0.85; // 15% late chance
        const lateDays = isLate ? Math.floor(Math.random() * 10) + 1 : 0;
        
        const due = new Date(dueDate);
        const submittedDate = new Date(due);
        if (isLate) {
          submittedDate.setDate(due.getDate() + lateDays);
        } else {
          submittedDate.setDate(due.getDate() - Math.floor(Math.random() * 3));
        }
        
        const dateSubmitted = submittedDate.toISOString().split('T')[0];

        // Randomly assign type (Time based or Percentage based primarily)
        const isTimeBased = department.toLowerCase().includes('minutes') || department.toLowerCase().includes('days') || Math.random() > 0.6;
        
        // If Time Based, determine if it's "Time" (Mins/Hours) or "Day" (Days)
        const isDayUnit = department.toLowerCase().includes('days') || (!department.toLowerCase().includes('minutes') && Math.random() > 0.5);
        const timeUnit = isDayUnit ? "Days" : "Mins";

        records.push({
          id: `${section}-${i}-${j}-${Math.random()}`,
          section: section,
          kpiName: kpiName,
          department: department,
          kpiType: isTimeBased ? 'TIME' : 'PERCENTAGE',
          month: monthStr,
          census: Math.floor(Math.random() * 500) + 100,
          
          targetTime: isDayUnit ? 3 : 30, // 3 days or 30 mins
          actualTime: isGoodSection 
              ? (isDayUnit ? 2 + Math.random() : 25 + Math.random() * 10) 
              : (isDayUnit ? 4 + Math.random() : 35 + Math.random() * 20),
          timeUnit: timeUnit,
          
          targetPct: 90,
          actualPct: isGoodSection ? 92 + (Math.random() * 5) : 85 + (Math.random() * 10), // Higher is better
          
          dueDate,
          dateSubmitted
        });
      }
    });
  }
  return records;
};

export const MOCK_DATA = generateMockData();

// Mock KPI Definitions
export const KPI_DEFINITIONS: KPIDefinition[] = Object.values(SectionName).flatMap((section, index) => {
  // Generate slightly different KPIs based on section index to add variety
  const definitions = [];

  // Common KPI
  definitions.push({
    id: `kpi-${section}-eff`,
    section: section,
    documentNumber: `QAD-${section.substring(0,3).toUpperCase()}-001`,
    qualityObjective: "To ensure timely provision of services to patients and stakeholders.",
    kpiName: "Turnaround Time (TAT) Compliance",
    definition: "The percentage of transactions or services completed within the standard allocated time.",
    formula: "(Total number of transactions within TAT / Total number of transactions) x 100",
    target: "95% of transactions within TAT",
    responsible: "Section Head / Supervisor",
    schedule: "Monthly"
  });

  // Second KPI based on type
  if ([SectionName.NURSING, SectionName.ER, SectionName.SURGICAL].includes(section)) {
    definitions.push({
      id: `kpi-${section}-safety`,
      section: section,
      documentNumber: `QAD-${section.substring(0,3).toUpperCase()}-002`,
      qualityObjective: "To ensure patient safety and minimize adverse events.",
      kpiName: "Patient Safety Incident Rate",
      definition: "Number of reported patient safety incidents (falls, medication errors) per 1000 patient days.",
      formula: "(Total number of incidents / Total patient days) x 1000",
      target: "Zero (0) Sentinel Events; < 2 incidents per 1000 days",
      responsible: "Nurse Manager / Quality Officer",
      schedule: "Monthly"
    });
    // Add another KPI to same objective to demonstrate grouping
    definitions.push({
        id: `kpi-${section}-safety-2`,
        section: section,
        documentNumber: `QAD-${section.substring(0,3).toUpperCase()}-003`,
        qualityObjective: "To ensure patient safety and minimize adverse events.",
        kpiName: "Hospital Acquired Infection Rate",
        definition: "Percentage of patients who acquire an infection while admitted.",
        formula: "(Total HAI / Total Admissions) x 100",
        target: "< 1%",
        responsible: "Infection Control Committee",
        schedule: "Monthly"
      });
  } else if ([SectionName.RECORDS, SectionName.ADMITTING, SectionName.CASHIER].includes(section)) {
    definitions.push({
      id: `kpi-${section}-accuracy`,
      section: section,
      documentNumber: `QAD-${section.substring(0,3).toUpperCase()}-004`,
      qualityObjective: "To maintain accuracy and integrity of patient records and transactions.",
      kpiName: "Data Accuracy Rate",
      definition: "Percentage of records/transactions free from clerical or data entry errors.",
      formula: "((Total Transactions - Total Errors) / Total Transactions) x 100",
      target: "99% Accuracy",
      responsible: "Admin Officer",
      schedule: "Monthly"
    });
  } else {
    definitions.push({
      id: `kpi-${section}-sat`,
      section: section,
      documentNumber: `QAD-${section.substring(0,3).toUpperCase()}-005`,
      qualityObjective: "To provide satisfactory customer service.",
      kpiName: "Customer Satisfaction Rating",
      definition: "Average rating received from customer feedback forms.",
      formula: "Total Score / Total Number of Respondents",
      target: "Average Rating of 4.5/5 (Very Satisfactory)",
      responsible: "Section Head",
      schedule: "Monthly"
    });
  }

  return definitions;
});