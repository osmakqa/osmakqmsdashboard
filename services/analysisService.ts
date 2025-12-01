import { KPIRecord } from '../types';
import { dataService } from './dataService';

export const analyzeData = (records: KPIRecord[], section: string, kpi: string): string => {
  if (!records || records.length === 0) return "No data available for analysis in the selected range.";

  // 1. Sort Chronologically
  const sorted = [...records].sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  const total = sorted.length;
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];

  const startDate = new Date(first.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const endDate = new Date(latest.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  // 2. Universal Metric: Conformance (Pass/Fail)
  const passed = sorted.filter(r => dataService.isConformant(r)).length;
  const successRate = (passed / total) * 100;

  // 3. Check for Unit Consistency
  // If we are mixing "%" and "Minutes", we cannot calculate an "Average Value".
  const types = new Set(sorted.map(r => r.kpiType));
  const timeUnits = new Set(sorted.filter(r => r.kpiType === 'TIME').map(r => r.timeUnit));
  
  const isMixedTypes = types.size > 1 || (types.has('TIME') && timeUnits.size > 1);

  // Base Summary
  const parts = [];
  parts.push(`Based on the ${total} records displayed from ${startDate} to ${endDate}, the section achieved a ${successRate.toFixed(2)}% conformance rate against targets.`);

  // 4. Detailed Stats (Only if units are consistent)
  if (!isMixedTypes) {
    const isTime = types.has('TIME');
    const unit = isTime ? (latest.timeUnit || '') : '%';

    // Helper to safely get value
    const getValue = (r: KPIRecord) => {
        const val = isTime ? r.actualTime : r.actualPct;
        return (val !== undefined && val !== null && !isNaN(Number(val))) ? Number(val) : null;
    };

    let sumValues = 0;
    let validCount = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    let bestRecord = sorted[0];
    let worstRecord = sorted[0];

    sorted.forEach(r => {
        const val = getValue(r);
        if (val !== null) {
            sumValues += val;
            validCount++;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;

            // Track Best/Worst
            const isLowerBetter = dataService.isLowerBetter(r);
            const bestValSoFar = getValue(bestRecord) ?? (isLowerBetter ? Infinity : -Infinity);
            const worstValSoFar = getValue(worstRecord) ?? (isLowerBetter ? -Infinity : Infinity);

            if (isLowerBetter) {
                if (val < bestValSoFar) bestRecord = r;
                if (val > worstValSoFar) worstRecord = r;
            } else {
                if (val > bestValSoFar) bestRecord = r;
                if (val < worstValSoFar) worstRecord = r;
            }
        }
    });

    if (validCount > 0) {
        const averageVal = sumValues / validCount;
        
        // Format Unit Spacing
        const unitDisplay = unit === '%' ? '%' : ` ${unit}`;

        parts.push(`The data shows an average performance of ${averageVal.toFixed(2)}${unitDisplay}, ranging from a low of ${minVal.toFixed(2)}${unitDisplay} to a high of ${maxVal.toFixed(2)}${unitDisplay}.`);

        // Extremes Analysis
        if (validCount > 1 && bestRecord && worstRecord && bestRecord.id !== worstRecord.id) {
             const bestMonthStr = new Date(bestRecord.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
             const worstMonthStr = new Date(worstRecord.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
             const bestVal = getValue(bestRecord)?.toFixed(2);
             const worstVal = getValue(worstRecord)?.toFixed(2);
             
             const isLowerBetter = dataService.isLowerBetter(latest);
             if (isLowerBetter) {
                 parts.push(`The best performance (lowest value) occurred in ${bestMonthStr} (${bestVal}${unitDisplay}), while the worst was in ${worstMonthStr} (${worstVal}${unitDisplay}).`);
             } else {
                 parts.push(`The highest performance occurred in ${bestMonthStr} (${bestVal}${unitDisplay}), while the lowest was in ${worstMonthStr} (${worstVal}${unitDisplay}).`);
             }
        }

        // Trend Analysis
        if (validCount >= 2) {
             const startVal = getValue(first) || 0;
             const endVal = getValue(latest) || 0;
             const diff = endVal - startVal;
             const isLowerBetter = dataService.isLowerBetter(latest);

             let trendDesc = "stable";
             if (isLowerBetter) {
                if (diff < 0) trendDesc = "improving (value decreasing)";
                else if (diff > 0) trendDesc = "declining (value increasing)";
             } else {
                if (diff > 0) trendDesc = "improving (value increasing)";
                else if (diff < 0) trendDesc = "declining (value decreasing)";
             }

             if (Math.abs(diff) > 0.01) {
                parts.push(`Comparing the start and end of this period, the trend is ${trendDesc}.`);
             }
        }
    }
  } else {
      parts.push("Specific averages are not calculated because the selected records contain mixed measurement units (e.g., Time vs. Percentage). Please filter by a specific KPI to see detailed averages.");
  }

  return parts.join(' ');
};