import React, { useState, useMemo } from 'react';
import { SectionName, PerformanceStatus, KPIRecord } from '../types';
import { dataService } from '../services/dataService';
import { Medal, ShieldCheck, AlertTriangle, Siren, Calendar, ArrowLeft, TrendingUp, TrendingDown, ChevronsRight, HelpCircle } from 'lucide-react';

interface LocalSectionPerformance {
  section: string;
  status: PerformanceStatus;
  failureCount: number;
}

interface TopPerformersProps {
  records: KPIRecord[];
}

// --- New Detail View Component ---
const SectionDetailView = ({ section, onBack, records, dateFrom, dateTo }: { section: string, onBack: () => void, records: KPIRecord[], dateFrom: string, dateTo: string }) => {
    const sectionRecords = useMemo(() => {
        return records.filter(r => r.section === section && r.month >= dateFrom && r.month <= dateTo);
    }, [section, records, dateFrom, dateTo]);

    const performanceByKpi = useMemo(() => {
        const kpiGroups: Record<string, { total: number, conformant: number }> = {};
        sectionRecords.forEach(r => {
            if (!kpiGroups[r.kpiName]) kpiGroups[r.kpiName] = { total: 0, conformant: 0 };
            kpiGroups[r.kpiName].total++;
            if (dataService.isConformant(r)) kpiGroups[r.kpiName].conformant++;
        });

        return Object.entries(kpiGroups).map(([kpiName, data]) => ({
            kpiName,
            conformanceRate: (data.conformant / data.total) * 100
        })).sort((a, b) => b.conformanceRate - a.conformanceRate);
    }, [sectionRecords]);

    const bestKpi = performanceByKpi[0];
    const worstKpi = performanceByKpi[performanceByKpi.length - 1];

    const heatmapData = useMemo(() => {
        // Explicitly typed as string[] to avoid 'unknown' index type error
        const months: string[] = Array.from<string>(new Set(sectionRecords.map(r => r.month.slice(0, 7)))).sort();
        
        // Determine rows: KPIs or Departments if a KPI has multiple
        const rowLabels = new Set<string>();
        const kpiToDepts = new Map<string, Set<string>>();
        sectionRecords.forEach(r => {
            if (!kpiToDepts.has(r.kpiName)) kpiToDepts.set(r.kpiName, new Set());
            kpiToDepts.get(r.kpiName)!.add(r.department);
        });

        kpiToDepts.forEach((depts, kpi) => {
            if (depts.size > 1) {
                depts.forEach(dept => rowLabels.add(`${kpi} (${dept})`));
            } else {
                rowLabels.add(kpi);
            }
        });

        // Explicitly typed as string[]
        const rows: string[] = Array.from<string>(rowLabels).sort();
        const grid: Record<string, Record<string, number | null>> = {};

        rows.forEach(row => {
            grid[row] = {};
            months.forEach(month => {
                grid[row][month] = null;
            });
        });
        
        sectionRecords.forEach(r => {
            const month = r.month.slice(0, 7);
            const kpiHasMultipleDepts = (kpiToDepts.get(r.kpiName)?.size ?? 0) > 1;
            const rowLabel = kpiHasMultipleDepts ? `${r.kpiName} (${r.department})` : r.kpiName;
            
            if (grid[rowLabel]) {
                 const isConformant = dataService.isConformant(r);
                 // 1 for pass, 0 for fail
                 grid[rowLabel][month] = isConformant ? 1 : 0;
            }
        });

        return { months, rows, grid };

    }, [sectionRecords]);

    const getCellColor = (value: number | null) => {
        if (value === 1) return 'bg-green-200 border-green-300 text-green-900'; // Pass
        if (value === 0) return 'bg-red-200 border-red-300 text-red-900'; // Fail
        return 'bg-gray-100 border-gray-200'; // No data
    };

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-osmak-700 hover:text-osmak-800 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to All Sections
            </button>

            <h2 className="text-2xl font-bold text-osmak-800">Performance Detail: <span className="text-osmak-600">{section}</span></h2>
            
            {sectionRecords.length > 0 ? (
                <>
                    {/* Best / Worst KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                            <h3 className="font-bold text-green-800 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Best Performing KPI</h3>
                            <p className="text-lg font-semibold text-gray-800 mt-2">{bestKpi?.kpiName || 'N/A'}</p>
                            <p className="text-sm text-green-700">{bestKpi ? `${bestKpi.conformanceRate.toFixed(1)}% Conformant` : 'No data'}</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                            <h3 className="font-bold text-red-800 flex items-center gap-2"><TrendingDown className="w-5 h-5"/> Worst Performing KPI</h3>
                            <p className="text-lg font-semibold text-gray-800 mt-2">{worstKpi?.kpiName || 'N/A'}</p>
                            <p className="text-sm text-red-700">{worstKpi ? `${worstKpi.conformanceRate.toFixed(1)}% Conformant` : 'No data'}</p>
                        </div>
                    </div>

                    {/* Heatmap */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Performance Heatmap</h3>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="min-w-full border-collapse text-xs">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="p-2 border border-gray-200 text-left font-semibold text-gray-600 sticky left-0 bg-gray-100 z-10">KPI / Department</th>
                                        {heatmapData.months.map(month => (
                                            <th key={month} className="p-2 border border-gray-200 font-semibold text-gray-600 min-w-[80px]">
                                                {new Date(month + '-01').toLocaleDateString('default', { month: 'short', year: '2-digit' })}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {heatmapData.rows.map(row => (
                                        <tr key={row}>
                                            <td className="p-2 border border-gray-200 font-medium text-gray-700 sticky left-0 bg-white z-10">{row}</td>
                                            {heatmapData.months.map(month => (
                                                <td key={`${row}-${month}`} className={`p-2 border text-center font-bold ${getCellColor(heatmapData.grid[row][month])}`}>
                                                    {heatmapData.grid[row][month] === 1 ? '✓' : heatmapData.grid[row][month] === 0 ? '✗' : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end gap-4 mt-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-200 border border-green-300 rounded-sm"></div>Conformant</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-200 border border-red-300 rounded-sm"></div>Non-Conformant</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded-sm"></div>No Data</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="p-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p>No performance data available for this section in the selected date range.</p>
                </div>
            )}
        </div>
    );
};

const TopPerformers: React.FC<TopPerformersProps> = ({ records }) => {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const categorizedPerformance = useMemo(() => {
    const results: LocalSectionPerformance[] = [];
    const filteredRecords = records.filter(r => r.month >= dateFrom && r.month <= dateTo);
    const sections = Object.values(SectionName);
    
    sections.forEach(section => {
        const sectionRecords = filteredRecords.filter(r => r.section === section);
        
        let failures = 0;
        sectionRecords.forEach(r => {
            if (!dataService.isConformant(r)) failures++;
        });

        let status = PerformanceStatus.STABLE;
        if (sectionRecords.length === 0) {
            status = PerformanceStatus.UNDEFINED;
        } else if (failures === 0) {
            status = PerformanceStatus.TOP_PERFORMER;
        } else if (failures === 1) {
            status = PerformanceStatus.NEEDS_IMPROVEMENT;
        } else if (failures >= 2) {
            status = PerformanceStatus.CRITICAL;
        }

        results.push({ section, status, failureCount: failures });
    });

    return results;

  }, [records, dateFrom, dateTo]);

  const getStatusIcon = (status: PerformanceStatus) => {
    switch (status) {
      case PerformanceStatus.TOP_PERFORMER: return <Medal className="w-6 h-6 text-yellow-500" />;
      case PerformanceStatus.STABLE: return <ShieldCheck className="w-6 h-6 text-green-500" />;
      case PerformanceStatus.NEEDS_IMPROVEMENT: return <AlertTriangle className="w-6 h-6 text-orange-500" />;
      case PerformanceStatus.CRITICAL: return <Siren className="w-6 h-6 text-red-500" />;
      default: return <HelpCircle className="w-6 h-6 text-gray-400" />;
    }
  };

  const renderCategory = (title: string, status: PerformanceStatus, description: string) => {
    const items = categorizedPerformance.filter(p => p.status === status);
    
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
            {getStatusIcon(status)}
            <h3 className="text-xl font-bold text-gray-800">{title}</h3>
            <span className="text-sm text-gray-400 font-normal ml-2">({description})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.length > 0 ? (
            items.map((perf) => (
              <button 
                key={perf.section} 
                onClick={() => setSelectedSection(perf.section)}
                className={`p-4 rounded-lg border-l-4 shadow-sm bg-white text-left w-full transition-all hover:shadow-md hover:-translate-y-1 border-l-${
                  status === PerformanceStatus.TOP_PERFORMER ? 'yellow-400' :
                  status === PerformanceStatus.STABLE ? 'green-500' :
                  status === PerformanceStatus.NEEDS_IMPROVEMENT ? 'orange-500' : 
                  status === PerformanceStatus.CRITICAL ? 'red-500' : 'gray-400'
                }`}
              >
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-700">{perf.section}</h4>
                    <ChevronsRight className="w-5 h-5 text-gray-300" />
                </div>
                {perf.status !== PerformanceStatus.UNDEFINED && perf.failureCount > 0 ? (
                   <p className="text-xs text-red-500 font-medium mt-1">{perf.failureCount} non-conformances in range</p>
                ) : perf.status !== PerformanceStatus.UNDEFINED ? (
                    <p className="text-xs text-green-600 font-medium mt-1">Perfect in selected range</p>
                ) : (
                    <p className="text-xs text-gray-400 font-medium mt-1">No data in selected range</p>
                )}
              </button>
            ))
          ) : (
            <div className="col-span-full py-6 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              No sections currently in this category for the selected date range.
            </div>
          )}
        </div>
      </div>
    );
  };

  if (selectedSection) {
      return <SectionDetailView section={selectedSection} onBack={() => setSelectedSection(null)} records={records} dateFrom={dateFrom} dateTo={dateTo} />;
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header Container */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap justify-between items-end gap-4">
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-2xl font-bold text-osmak-800 mb-2">Performance Classification</h2>
            <p className="text-gray-500 text-sm">Click a section to drill down into its performance details.</p>
          </div>
          
          <div className="space-y-1 w-full md:w-auto min-w-[300px]">
            <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <Calendar className="w-3 h-3"/> Analysis Period
            </label>
            <div className="flex gap-2">
                <input 
                    type="date" 
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="block w-full pl-2 py-2 text-sm border-gray-300 focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <input 
                    type="date" 
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="block w-full pl-2 py-2 text-sm border-gray-300 focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
            </div>
        </div>
      </div>

      {renderCategory("Top Performers", PerformanceStatus.TOP_PERFORMER, "No non-conformances in range")}
      {renderCategory("Stable Performers", PerformanceStatus.STABLE, "Awaiting more data for classification")}
      {renderCategory("Needs Improvement", PerformanceStatus.NEEDS_IMPROVEMENT, "1 non-conformance in range")}
      {renderCategory("Critical Attention", PerformanceStatus.CRITICAL, "2+ non-conformances in range")}
      {renderCategory("Others", PerformanceStatus.UNDEFINED, "No data submitted in this period")}
    </div>
  );
};

export default TopPerformers;