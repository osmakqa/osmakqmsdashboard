
import { KPIRecord, SectionName, PerformanceStatus, SectionPerformance, KPIDefinition, KPIType } from '../types';
import { MOCK_DATA, KPI_DEFINITIONS } from '../constants';

// UPDATED: Using the specific Google Apps Script Web App URL provided
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxvdH0ZH4jUQ4yoVTFzRrrJfZ_s6g2Pph_Tj9Tfoiniti_x0hWdsbCjGrhk_vhXe9GX/exec"; 

// Helper to check if we have a valid URL (User needs to set this)
const isConfigured = GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.includes("script.google.com");

const CACHE_KEY_RECORDS = 'kpi_records_cache';
const CACHE_KEY_DEFINITIONS = 'kpi_definitions_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// --- NEW: Define percentage-based KPIs where a lower value is better ---
const LOWER_IS_BETTER_PCT_KPIS = ['reattendance rate', 'overstaying', 'overboarding'];

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const fetchWithCache = async <T>(key: string, url: string, fallback: T): Promise<T> => {
  // 1. Check Local Cache
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const entry: CacheEntry<T> = JSON.parse(cached);
      const age = Date.now() - entry.timestamp;
      if (age < CACHE_DURATION) {
        // console.log(`Serving ${key} from cache (${Math.round(age / 1000)}s old)`);
        return entry.data;
      }
    } catch (e) {
      console.warn('Cache parse error', e);
      localStorage.removeItem(key);
    }
  }

  // 2. Fetch from Network
  if (!isConfigured) {
    console.log('Demo Mode: Serving Mock Data (Script URL missing)');
    return fallback;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data || !Array.isArray(data)) return fallback;

    // 3. Update Cache
    const entry: CacheEntry<T> = {
      timestamp: Date.now(),
      data: data as T // Raw data from sheet
    };
    localStorage.setItem(key, JSON.stringify(entry));

    return data as T;
  } catch (err) {
    console.warn('Google Sheet fetch failed:', err);
    return fallback;
  }
};

export const dataService = {
  // --- Records (Monthly Data) ---

  getRecords: async (forceRefresh = false): Promise<KPIRecord[]> => {
    if (forceRefresh) localStorage.removeItem(CACHE_KEY_RECORDS);

    // Fetch raw data using cache wrapper
    const rawData = await fetchWithCache<any[]>(CACHE_KEY_RECORDS, `${GOOGLE_SCRIPT_URL}?tab=Records`, []);
    if (rawData === MOCK_DATA as any) return MOCK_DATA; // fallback

    // Map Raw Data to Typed Objects (Compress/Decompress logic happens here if needed)
    return rawData.map((r: any) => ({
      id: r.id || r.i, // Support short keys if implemented in future
      section: (r.section || r.s) as SectionName,
      kpiName: r.kpiName || r.k,
      department: r.department || r.d,
      kpiType: r.kpiType || r.t,
      month: (r.month || r.m) ? new Date(r.month || r.m).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      census: Number(r.census || r.c) || 0,
      targetTime: (r.targetTime || r.tt) ? Number(r.targetTime || r.tt) : undefined,
      actualTime: (r.actualTime || r.at) ? Number(r.actualTime || r.at) : undefined,
      timeUnit: r.timeUnit || r.u,
      targetPct: Number(r.targetPct || r.tp) || 0,
      actualPct: Number(r.actualPct || r.ap) || 0,
      dueDate: (r.dueDate || r.dd) ? new Date(r.dueDate || r.dd).toISOString().slice(0, 10) : '',
      dateSubmitted: (r.dateSubmitted || r.ds) ? new Date(r.dateSubmitted || r.ds).toISOString().slice(0, 10) : '',
      remarks: r.remarks || r.rem,
      status: r.status || 'APPROVED' // Default to APPROVED if missing
    }));
  },

  addRecord: async (record: Omit<KPIRecord, 'id'>): Promise<KPIRecord> => {
    if (!isConfigured) return { ...record, id: `mock-${Date.now()}` };

    const newId = `gen-${Date.now()}`;
    const payload = {
        action: 'add',
        tab: 'Records',
        data: { ...record, id: newId }
    };

    await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    // Invalidate Cache so next fetch gets new data
    localStorage.removeItem(CACHE_KEY_RECORDS);

    return { ...record, id: newId };
  },

  updateRecord: async (record: KPIRecord): Promise<KPIRecord> => {
    if (!isConfigured) return record;

    const payload = {
        action: 'update',
        tab: 'Records',
        id: record.id,
        data: record
    };

    await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    // Invalidate Cache
    localStorage.removeItem(CACHE_KEY_RECORDS);

    return record;
  },

  deleteRecord: async (id: string): Promise<void> => {
    if (!isConfigured) return;

    const payload = {
        action: 'delete',
        tab: 'Records',
        id: id
    };

    await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    // Invalidate Cache
    localStorage.removeItem(CACHE_KEY_RECORDS);
  },

  // --- KPI Definitions (Configuration) ---

  getKPIDefinitions: async (forceRefresh = false): Promise<KPIDefinition[]> => {
    if (forceRefresh) localStorage.removeItem(CACHE_KEY_DEFINITIONS);

    const rawData = await fetchWithCache<any[]>(CACHE_KEY_DEFINITIONS, `${GOOGLE_SCRIPT_URL}?tab=Definitions`, []);
    if (rawData === KPI_DEFINITIONS as any) return KPI_DEFINITIONS;

    return rawData.map((d: any) => ({
      id: d.id,
      section: d.section as SectionName,
      documentNumber: d.documentNumber,
      qualityObjective: d.qualityObjective,
      kpiName: d.kpiName,
      definition: d.definition,
      formula: d.formula,
      target: d.target,
      
      // Map specific target columns
      targetTime: d.targetTime ? Number(d.targetTime) : undefined,
      targetPct: d.targetPct ? Number(d.targetPct) : undefined,
      timeUnit: d.timeUnit,
      
      // Classification Columns
      department: d.department,
      kpiType: d.kpiType as KPIType,

      responsible: d.responsible,
      schedule: d.schedule
    }));
  },

  // --- Logic Helpers ---

  isLowerBetter: (record: KPIRecord): boolean => {
    if (record.kpiType === 'TIME') return true;
    return LOWER_IS_BETTER_PCT_KPIS.includes(record.kpiName.toLowerCase());
  },

  isConformant: (record: KPIRecord): boolean => {
    if (dataService.isLowerBetter(record)) {
        if (record.kpiType === 'TIME') {
            return (Number(record.actualTime) ?? Infinity) <= (Number(record.targetTime) ?? 0);
        }
        return (Number(record.actualPct) ?? Infinity) <= (Number(record.targetPct) ?? 0);
    }
    // Default case: higher is better for percentage
    return (Number(record.actualPct) || 0) >= (Number(record.targetPct) || 0);
  },

  // Optimized to use passed records if available, otherwise fetch
  getSectionPerformance: async (section: SectionName, providedRecords?: KPIRecord[]): Promise<SectionPerformance> => {
    const allRecords = providedRecords || await dataService.getRecords();
    // IMPORTANT: Only calculate performance based on APPROVED records
    const approvedRecords = allRecords.filter(r => r.status !== 'DRAFT');
    const sectionRecords = approvedRecords.filter(r => r.section === section);

    if (sectionRecords.length === 0) return { section, status: PerformanceStatus.UNDEFINED, failureCount3Months: 0 };

    sectionRecords.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime());

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const nineMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 9, 1);

    let failures3Mo = 0;
    let failures6Mo = 0;
    let failures9Mo = 0;
    let lastFailureDate = undefined;

    for (const record of sectionRecords) {
      const recDate = new Date(record.month);
      const conformant = dataService.isConformant(record);
      
      if (!conformant) {
        if (!lastFailureDate) lastFailureDate = record.month;
        if (recDate >= threeMonthsAgo) failures3Mo++;
        if (recDate >= sixMonthsAgo) failures6Mo++;
        if (recDate >= nineMonthsAgo) failures9Mo++;
      }
    }

    let status = PerformanceStatus.UNDEFINED;
    if (failures3Mo >= 2) status = PerformanceStatus.CRITICAL;
    else if (failures3Mo >= 1) status = PerformanceStatus.NEEDS_IMPROVEMENT;
    else if (failures6Mo === 0 && sectionRecords.length > 0) {
       if (failures9Mo === 0) status = PerformanceStatus.TOP_PERFORMER;
       else status = PerformanceStatus.STABLE;
    } else {
        status = PerformanceStatus.STABLE; 
    }

    return {
      section,
      status,
      lastFailureDate,
      failureCount3Months: failures3Mo
    };
  },

  clearCache: () => {
      localStorage.removeItem(CACHE_KEY_RECORDS);
      localStorage.removeItem(CACHE_KEY_DEFINITIONS);
  }
};