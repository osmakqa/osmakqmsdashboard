import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { KPIRecord, SectionName } from '../types';
import { dataService } from '../services/dataService';
import { analyzeData } from '../services/analysisService';
import { TrendingUp, TrendingDown, Users, Activity, Sparkles, Calendar, ArrowUpRight, ArrowDownRight, AlertCircle, X, ChevronRight, Download, FileImage, Loader } from 'lucide-react';
import { toPng } from 'html-to-image';

interface KPITrendProps {
  records: KPIRecord[];
}

// Helper to aggregate records by quarter
const aggregateRecordsByQuarter = (records: KPIRecord[]): KPIRecord[] => {
  const grouped: { [key: string]: KPIRecord[] } = {};

  records.forEach(record => {
    const date = new Date(record.month);
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1; // 1 to 4
    const quarterKey = `${year}-Q${quarter}`;

    if (!grouped[quarterKey]) {
      grouped[quarterKey] = [];
    }
    grouped[quarterKey].push(record);
  });

  return Object.keys(grouped).map(quarterKey => {
    const quarterRecords = grouped[quarterKey];
    
    // Use the first record as a template for non-numerical fields
    const templateRecord = quarterRecords[0];
    const dateParts = quarterKey.split('-Q'); // ["YYYY", "Q"]
    const year = parseInt(dateParts[0]);
    const quarterNum = parseInt(dateParts[1]);
    const firstMonthOfQuarter = new Date(year, (quarterNum - 1) * 3, 1).toISOString().slice(0, 10);

    // Aggregate numerical values
    let totalCensus = 0;
    let sumTargetTime = 0;
    let sumActualTime = 0;
    let sumTargetPct = 0;
    let sumActualPct = 0;
    let countTime = 0;
    let countPct = 0;

    quarterRecords.forEach(r => {
      totalCensus += r.census || 0;
      if (r.kpiType === 'TIME') {
        sumTargetTime += r.targetTime || 0;
        sumActualTime += r.actualTime || 0;
        countTime++;
      } else { // PERCENTAGE
        sumTargetPct += r.targetPct || 0;
        sumActualPct += r.actualPct || 0;
        countPct++;
      }
    });

    // Determine conformance based on the average
    const aggregatedRecord: KPIRecord = {
      ...templateRecord,
      id: `agg-${quarterKey}-${templateRecord.section}-${templateRecord.kpiName}-${templateRecord.department || 'na'}`,
      month: firstMonthOfQuarter,
      census: totalCensus,
      targetTime: countTime > 0 ? sumTargetTime / countTime : undefined,
      actualTime: countTime > 0 ? sumActualTime / countTime : undefined,
      targetPct: countPct > 0 ? sumTargetPct / countPct : 0, 
      actualPct: countPct > 0 ? sumActualPct / countPct : 0, 
      remarks: `Aggregated for ${quarterKey}`,
      status: 'APPROVED', 
    };
    return aggregatedRecord;
  }).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
};


const KPITrend: React.FC<KPITrendProps> = ({ records }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [selectedSection, setSelectedSection] = useState<string>(SectionName.ER);
  const [selectedKPI, setSelectedKPI] = useState<string>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [showCensus, setShowCensus] = useState(true);
  const [viewMode, setViewMode] = useState<'percent' | 'time'>('percent');
  const [aggregationPeriod, setAggregationPeriod] = useState<'monthly' | 'quarterly'>('monthly'); 
  
  // Date Filters
  const [dateFrom, setDateFrom] = useState('2023-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Analysis
  const [analysis, setAnalysis] = useState<string | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<'success' | 'census' | 'streak' | 'trend' | null>(null);

  const availableKPIs = useMemo(() => {
    const sectionRecords = records.filter(r => r.section === selectedSection);
    const kpis = Array.from(new Set(sectionRecords.map(r => r.kpiName)));
    return ['All', ...kpis.sort()];
  }, [records, selectedSection]);

  const availableDepts = useMemo(() => {
    const sectionRecords = records.filter(r => 
        r.section === selectedSection && 
        (selectedKPI === 'All' || r.kpiName === selectedKPI)
    );
    const depts = Array.from(new Set(sectionRecords.map(r => r.department)));
    return ['All', ...depts.sort()];
  }, [records, selectedSection, selectedKPI]);

  // Reset filters when parent filter changes
  useEffect(() => {
    setSelectedKPI('All');
    setSelectedDept('All');
  }, [selectedSection]);

  useEffect(() => {
    setSelectedDept('All');
  }, [selectedKPI]);

  const filteredMonthlyData = useMemo(() => {
    return records
      .filter(r => 
        r.section === selectedSection &&
        (selectedKPI === 'All' || r.kpiName === selectedKPI) &&
        (selectedDept === 'All' || r.department === selectedDept) &&
        r.month >= dateFrom &&
        r.month <= dateTo
      )
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [records, selectedSection, selectedKPI, selectedDept, dateFrom, dateTo]);

  const displayedData = useMemo(() => {
      if (aggregationPeriod === 'quarterly') {
          return aggregateRecordsByQuarter(filteredMonthlyData);
      }
      return filteredMonthlyData;
  }, [filteredMonthlyData, aggregationPeriod]);


  // Update analysis when filtered data changes
  useEffect(() => {
    const kpiLabel = selectedKPI !== 'All' ? selectedKPI : "General Operational KPI";
    const result = analyzeData(displayedData, selectedSection, kpiLabel);
    setAnalysis(result);
  }, [displayedData, selectedSection, selectedKPI]);

  // Calculate Card Metrics
  const metrics = useMemo(() => {
    if (displayedData.length === 0) return null;

    const totalCensus = displayedData.reduce((acc, curr) => acc + (curr.census || 0), 0);
    const avgCensus = Math.round(totalCensus / displayedData.length);
    
    const successCount = displayedData.filter(r => dataService.isConformant(r)).length;
    const successRate = (successCount / displayedData.length) * 100;

    let failureStreak = 0;
    const streakRecords: KPIRecord[] = [];
    
    for (let i = displayedData.length - 1; i >= 0; i--) {
      if (!dataService.isConformant(displayedData[i])) {
        failureStreak++;
        streakRecords.push(displayedData[i]);
      } else {
        break;
      }
    }

    const isLowerBetterForTrend = displayedData.length > 0 && selectedKPI !== 'All' ? dataService.isLowerBetter(displayedData[0]) : false;
    let trend = 0;
    let lastValue = 0;
    let prevValue = 0;
    
    if (displayedData.length >= 2) {
      const last = displayedData[displayedData.length-1];
      const prev = displayedData[displayedData.length-2];
      lastValue = (viewMode === 'percent' ? (last.actualPct || 0) : (last.actualTime || 0));
      prevValue = (viewMode === 'percent' ? (prev.actualPct || 0) : (prev.actualTime || 0));
      trend = lastValue - prevValue;
    }
    
    return { 
        totalCensus, 
        avgCensus, 
        successRate, 
        failureStreak, 
        streakRecords, 
        trend, 
        isLowerBetterForTrend,
        lastValue,
        prevValue,
        successCount,
        failCount: displayedData.length - successCount
    };
  }, [displayedData, selectedKPI, viewMode]);

  const downloadReportAsPNG = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          padding: '20px',
        }
      });
      const link = document.createElement('a');
      link.download = `OsMak_KPI_Analysis_${selectedSection.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to download image:', error);
      alert('Could not generate PNG. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isConformant = dataService.isConformant(data);
      let varianceText = '';

      if (viewMode === 'percent') {
        const actual = Number(data.actualPct) || 0;
        const target = Number(data.targetPct) || 0;
        const variance = actual - target;
        varianceText = `${variance > 0 ? '+' : ''}${variance.toFixed(2)}%`;
      } else {
        const actual = Number(data.actualTime) || 0;
        const target = Number(data.targetTime) || 0;
        const variance = actual - target;
        const absVariance = Math.abs(variance).toFixed(2);
        if(variance > 0) varianceText = `+${absVariance} ${data.timeUnit} slower`;
        else varianceText = `-${absVariance} ${data.timeUnit} faster`;
      }

      const formattedLabel = aggregationPeriod === 'quarterly' 
        ? `${new Date(label).getFullYear()}-Q${Math.floor(new Date(label).getMonth() / 3) + 1}`
        : new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50">
          <p className="font-bold text-gray-700 mb-2">{formattedLabel}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-gray-500">Actual:</span>
              <span className="font-bold text-gray-800">
                {payload.find((p:any) => p.name === 'Actual')?.value?.toFixed(2)}
                {viewMode === 'percent' ? '%' : ` ${data.timeUnit}`}
              </span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-gray-500">Target:</span>
              <span className="font-medium text-gray-600">
                {payload.find((p:any) => p.name === 'Target')?.value?.toFixed(2)}
                {viewMode === 'percent' ? '%' : ` ${data.timeUnit}`}
              </span>
            </p>
            <div className={`mt-2 pt-2 border-t border-gray-100 flex justify-between gap-4 font-bold ${isConformant ? 'text-green-600' : 'text-red-600'}`}>
              <span>Variance:</span>
              <span>{varianceText} {isConformant ? '(Pass)' : '(Fail)'}</span>
            </div>
             {showCensus && (
                 <p className="flex justify-between gap-4 text-indigo-500 mt-1">
                 <span>Census:</span>
                 <span>{data.census}</span>
               </p>
             )}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderModalContent = () => {
      if (!metrics) return null;

      if (activeModal === 'success') {
          const data = [
              { name: 'Conformant', value: metrics.successCount, color: '#22c55e' },
              { name: 'Non-Conformant', value: metrics.failCount, color: '#ef4444' },
          ];
          return (
              <>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Conformance Breakdown</h3>
                <p className="text-sm text-gray-500 mb-6">Distribution of Pass vs. Fail records in the selected period.</p>
                <div className="flex flex-col md:flex-row items-center justify-around gap-6">
                    <div className="w-48 h-48 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={data} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xl font-bold text-gray-800">{metrics.successRate.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded bg-green-500"></div>
                            <div>
                                <p className="font-bold text-gray-800">{metrics.successCount} Records</p>
                                <p className="text-xs text-gray-500">Met Targets (Conformant)</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded bg-red-500"></div>
                            <div>
                                <p className="font-bold text-gray-800">{metrics.failCount} Records</p>
                                <p className="text-xs text-gray-500">Missed Targets (Non-Conformant)</p>
                            </div>
                        </div>
                    </div>
                </div>
              </>
          );
      }

      if (activeModal === 'census') {
          // Always show MONTHLY census breakdown in the modal based on date range
          const monthlyBreakdown = [...filteredMonthlyData].sort((a,b) => new Date(b.month).getTime() - new Date(a.month).getTime());
          const maxVal = monthlyBreakdown.length > 0 ? Math.max(...monthlyBreakdown.map(r => r.census || 0)) : 0;
          const minVal = monthlyBreakdown.length > 0 ? Math.min(...monthlyBreakdown.map(r => r.census || 0)) : 0;

          return (
              <>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Census Analysis</h3>
                <p className="text-sm text-gray-500 mb-6">Monthly patient volume distribution for the selected date range.</p>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-indigo-50 p-3 rounded-lg text-center">
                        <p className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider">Total Range Vol</p>
                        <p className="text-xl font-bold text-indigo-900">{filteredMonthlyData.reduce((acc, c) => acc + (c.census || 0), 0)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Min Monthly</p>
                        <p className="text-xl font-bold text-gray-700">{minVal}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Max Monthly</p>
                        <p className="text-xl font-bold text-gray-700">{maxVal}</p>
                    </div>
                </div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">Monthly Census History</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {monthlyBreakdown.map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50 group transition-all">
                            <span className="text-sm font-medium text-gray-600">
                                {new Date(r.month).toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-indigo-600 group-hover:scale-110 transition-transform">{r.census}</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Patients</span>
                            </div>
                        </div>
                    ))}
                    {monthlyBreakdown.length === 0 && (
                        <div className="text-center py-10 text-gray-400 text-sm italic">No monthly data available in this range.</div>
                    )}
                </div>
              </>
          );
      }

      if (activeModal === 'streak') {
          return (
              <>
                 <h3 className="text-lg font-bold text-gray-800 mb-1">Failure Streak Details</h3>
                 <p className="text-sm text-gray-500 mb-6">Breakdown of the current consecutive non-conformance streak.</p>
                 {metrics.failureStreak > 0 ? (
                     <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {metrics.streakRecords.map((r, idx) => (
                             <div key={idx} className="bg-red-50 border border-red-100 p-3 rounded-lg">
                                 <div className="flex justify-between items-center mb-1">
                                     <span className="font-bold text-red-800">
                                        {aggregationPeriod === 'quarterly' 
                                            ? `${new Date(r.month).getFullYear()}-Q${Math.floor(new Date(r.month).getMonth() / 3) + 1}`
                                            : new Date(r.month).toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}
                                     </span>
                                     <span className="text-xs bg-white px-2 py-0.5 rounded text-red-600 border border-red-200">{r.kpiName}</span>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                                     <div>
                                         <span className="text-gray-500 text-xs block">Target</span>
                                         <span className="font-medium text-gray-700">
                                            {r.kpiType === 'TIME' ? `${r.targetTime} ${r.timeUnit}` : `${r.targetPct}%`}
                                         </span>
                                     </div>
                                     <div>
                                         <span className="text-gray-500 text-xs block">Actual</span>
                                         <span className="font-bold text-red-700">
                                            {r.kpiType === 'TIME' ? `${Number(r.actualTime).toFixed(2)} ${r.timeUnit}` : `${Number(r.actualPct).toFixed(2)}%`}
                                         </span>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-center py-10 bg-green-50 rounded-lg border border-green-100">
                         <TrendingUp className="w-12 h-12 text-green-500 mx-auto mb-2" />
                         <p className="text-green-800 font-bold">No Active Failure Streak!</p>
                         <p className="text-green-600 text-sm">The most recent records are meeting targets.</p>
                     </div>
                 )}
              </>
          );
      }

      if (activeModal === 'trend') {
          const isTrendGood = metrics.isLowerBetterForTrend ? metrics.trend < 0 : metrics.trend > 0;
          return (
              <>
                 <h3 className="text-lg font-bold text-gray-800 mb-1">{aggregationPeriod === 'quarterly' ? 'Quarter' : 'Month'}-over-{aggregationPeriod === 'quarterly' ? 'Quarter' : 'Month'} Trend</h3>
                 <p className="text-sm text-gray-500 mb-6">Comparison of the two most recent data points.</p>
                 <div className="flex items-center justify-between bg-gray-50 p-6 rounded-xl border border-gray-100 mb-6">
                     <div className="text-center">
                         <p className="text-xs text-gray-500 uppercase font-bold mb-1">Previous</p>
                         <p className="text-2xl font-bold text-gray-400">{metrics.prevValue.toFixed(2)}</p>
                     </div>
                     <div className="flex flex-col items-center">
                         <div className={`p-2 rounded-full mb-1 ${isTrendGood ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isTrendGood ? <ArrowUpRight className="text-green-600 w-6 h-6"/> : <ArrowDownRight className="text-red-600 w-6 h-6"/>}
                         </div>
                         <span className={`font-bold text-lg ${isTrendGood ? 'text-green-600' : 'text-red-600'}`}>
                             {metrics.trend > 0 ? '+' : ''}{metrics.trend.toFixed(2)}
                         </span>
                     </div>
                     <div className="text-center">
                         <p className="text-xs text-gray-500 uppercase font-bold mb-1">Current</p>
                         <p className="text-2xl font-bold text-gray-800">{metrics.lastValue.toFixed(2)}</p>
                     </div>
                 </div>
                 <p className="text-sm text-gray-600 italic border-l-4 border-osmak-400 pl-3">
                     {isTrendGood 
                        ? "Performance is trending in the right direction compared to the previous period." 
                        : "Performance has declined compared to the previous period. Investigation may be required."}
                 </p>
              </>
          );
      }
      return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls & Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-6 items-end relative overflow-hidden">
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="block w-full pl-3 pr-10 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white font-medium"
          >
            {Object.values(SectionName).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">KPI Name</label>
          <select
            value={selectedKPI}
            onChange={(e) => setSelectedKPI(e.target.value)}
            className="block w-full pl-3 pr-10 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white font-medium"
          >
            {availableKPIs.map(kpi => (
              <option key={kpi} value={kpi}>{kpi}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type / Department</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="block w-full pl-3 pr-10 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white font-medium"
          >
            {availableDepts.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 flex-[1.2] min-w-[280px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3 h-3"/> Analysis Period
            </label>
            <div className="flex gap-2">
                <input 
                    type="date" 
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="block w-full px-2 py-2 text-xs border-gray-300 focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <input 
                    type="date" 
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="block w-full px-2 py-2 text-xs border-gray-300 focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
            </div>
        </div>

        {/* VIEW OPTIONS, AGGREGATION - LEFT ALIGNED */}
        <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">VIEW OPTIONS</label>
            <div className="flex items-center gap-4 h-10">
                    <div className="flex bg-gray-100 rounded-lg p-1 shadow-inner border border-gray-200">
                    <button
                    onClick={() => setViewMode('percent')}
                    className={`px-4 py-1 text-[11px] font-bold rounded-md transition-all ${viewMode === 'percent' ? 'bg-white shadow-sm text-osmak-700' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                    % Perf
                    </button>
                    <button
                    onClick={() => setViewMode('time')}
                    className={`px-4 py-1 text-[11px] font-bold rounded-md transition-all ${viewMode === 'time' ? 'bg-white shadow-sm text-osmak-700' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                    Time/Day
                    </button>
                </div>
                <label className="inline-flex items-center cursor-pointer whitespace-nowrap group">
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            checked={showCensus} 
                            onChange={(e) => setShowCensus(e.target.checked)} 
                            className="sr-only peer" 
                        />
                        <div className="w-5 h-5 bg-white border-2 border-gray-300 rounded peer-checked:bg-osmak-600 peer-checked:border-osmak-600 flex items-center justify-center transition-all group-hover:border-osmak-400">
                            <div className={`w-1.5 h-3 border-r-2 border-b-2 border-white rotate-45 mb-0.5 ${showCensus ? 'block' : 'hidden'}`}></div>
                        </div>
                    </div>
                    <span className="ml-2 text-[11px] text-gray-600 font-bold uppercase tracking-wider">Census</span>
                </label>
            </div>
        </div>
        
        <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">AGGREGATION</label>
            <div className="flex bg-gray-100 rounded-lg p-1 h-10 shadow-inner border border-gray-200">
                <button
                    onClick={() => setAggregationPeriod('monthly')}
                    className={`px-4 py-1 text-[11px] font-bold rounded-md transition-all ${aggregationPeriod === 'monthly' ? 'bg-white shadow-sm text-osmak-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Monthly
                </button>
                <button
                    onClick={() => setAggregationPeriod('quarterly')}
                    className={`px-4 py-1 text-[11px] font-bold rounded-md transition-all ${aggregationPeriod === 'quarterly' ? 'bg-white shadow-sm text-osmak-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Quarterly
                </button>
            </div>
        </div>

        {/* DOWNLOAD BUTTON - RIGHT ALIGNED */}
        <div className="h-10 ml-auto">
            <button 
                onClick={downloadReportAsPNG}
                disabled={isExporting}
                className="flex items-center gap-2 px-6 py-0 h-full bg-osmak-700 text-white rounded-lg text-sm font-bold hover:bg-osmak-800 transition-all disabled:opacity-50 shadow-md active:scale-95 group"
            >
                {isExporting ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
                {isExporting ? 'Exporting...' : 'Download Report'}
            </button>
        </div>
      </div>

      {/* Executive Summary Widgets */}
      {metrics && (() => {
          const isTrendGood = metrics.isLowerBetterForTrend ? metrics.trend < 0 : metrics.trend > 0;
          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveModal('success')}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Success Rate</p>
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{metrics.successRate.toFixed(1)}%</h3>
                  <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-wide">Conformance</p>
                </div>
                <CircularGauge value={metrics.successRate} color={metrics.successRate >= 90 ? '#22c55e' : metrics.successRate >= 75 ? '#eab308' : '#ef4444'} />
              </div>
    
              <div 
                onClick={() => setActiveModal('census')}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group"
              >
                 <div className="flex justify-between items-start">
                   <div>
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Avg Census</p>
                        <ChevronRight className="w-3 h-3 text-gray-300" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{metrics.avgCensus}</h3>
                   </div>
                   <div className="bg-indigo-50 p-2 rounded-lg group-hover:bg-indigo-100 transition-colors">
                     <Users className="w-5 h-5 text-indigo-600" />
                   </div>
                 </div>
                 <div className="mt-3">
                   <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-wider">
                     <span>Total Volume</span>
                     <span className="text-indigo-600">{metrics.totalCensus}</span>
                   </div>
                   <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 rounded-full" style={{ width: '65%' }}></div>
                   </div>
                 </div>
              </div>
    
              <div 
                onClick={() => setActiveModal('streak')}
                className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${metrics.failureStreak > 0 ? 'border-red-500' : 'border-green-500'} flex flex-col justify-between cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5`}
              >
                 <div className="flex justify-between items-start">
                   <div>
                     <div className="flex items-center gap-1 mb-1">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Failure Streak</p>
                        <ChevronRight className="w-3 h-3 text-gray-300" />
                      </div>
                     <div className="flex items-baseline gap-1">
                        <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{metrics.failureStreak}</h3>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{aggregationPeriod === 'quarterly' ? 'Qtrs' : 'Mos'}</span>
                     </div>
                   </div>
                   {metrics.failureStreak > 0 ? (
                     <AlertCircle className="w-6 h-6 text-red-500" />
                   ) : (
                     <div className="bg-green-100 text-green-700 px-2 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider">
                       Stable
                     </div>
                   )}
                </div>
                 <p className="text-[10px] text-gray-400 mt-2 font-medium">Consecutive non-conformances</p>
              </div>
    
              <div 
                onClick={() => setActiveModal('trend')}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                 <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{aggregationPeriod === 'quarterly' ? 'QoQ' : 'MoM'} Trend</p>
                        <ChevronRight className="w-3 h-3 text-gray-300" />
                      </div>
                      <h3 className={`text-2xl font-bold tracking-tight ${isTrendGood ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.trend > 0 ? '+' : ''}{metrics.trend.toFixed(2)}%
                      </h3>
                    </div>
                    <div className={`p-2 rounded-full ${isTrendGood ? 'bg-green-50' : 'bg-red-50'}`}>
                       {isTrendGood ? (
                         <ArrowUpRight className="w-5 h-5 text-green-600" />
                       ) : (
                         <ArrowDownRight className="text-red-600 w-5 h-5" />
                       )}
                    </div>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">vs. Previous {aggregationPeriod === 'quarterly' ? 'Quarter' : 'Month'}</p>
              </div>
            </div>
          )
      })()}

      {/* Main Card with Exportable Content */}
      <div ref={reportRef} className="bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-8">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-osmak-800 leading-tight">
              {selectedSection} {selectedKPI !== 'All' ? `- ${selectedKPI}` : ''} {selectedDept !== 'All' ? `(${selectedDept})` : ''} 
              <span className="block text-sm text-gray-400 font-medium mt-0.5 uppercase tracking-widest">
                Performance Trend Visualization ({aggregationPeriod})
              </span>
            </h3>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-osmak-50 rounded-md border border-osmak-100 text-osmak-700 text-xs font-bold">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(dateFrom).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(dateTo).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        <div className="h-[420px] mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayedData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
              <XAxis 
                dataKey="month" 
                tick={{fontSize: 11, fontWeight: 600, fill: '#64748b'}}
                axisLine={{stroke: '#e2e8f0'}}
                tickFormatter={(value) => aggregationPeriod === 'quarterly' 
                    ? `${new Date(value).getFullYear()}-Q${Math.floor(new Date(value).getMonth() / 3) + 1}`
                    : new Date(value).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} 
              />
              <YAxis yAxisId="left" orientation="left" stroke="#15803d" tick={{fontSize: 11}} axisLine={false} tickLine={false} label={{ value: viewMode === 'percent' ? '% Performance' : 'Time', angle: -90, position: 'insideLeft', style: {textAnchor: 'middle', fill: '#15803d', fontWeight: 700, fontSize: 10} }} />
              <YAxis yAxisId="right" orientation="right" stroke="#6366f1" hide={!showCensus} tick={{fontSize: 11}} axisLine={false} tickLine={false} label={{ value: 'Census', angle: 90, position: 'insideRight', style: {textAnchor: 'middle', fill: '#6366f1', fontWeight: 700, fontSize: 10} }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '11px', fontWeight: 700}}/>
              <Bar 
                yAxisId="left" 
                dataKey={viewMode === 'percent' ? 'actualPct' : 'actualTime'} 
                name="Actual Performance" 
                fill="#22c55e" 
                barSize={32} 
                radius={[6, 6, 0, 0]}
              />
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey={viewMode === 'percent' ? 'targetPct' : 'targetTime'} 
                name="Performance Target" 
                stroke="#ef4444" 
                strokeWidth={3} 
                dot={false}
                strokeDasharray="6 6"
              />
              {showCensus && (
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="census" 
                  name="Patient Census" 
                  stroke="#6366f1" 
                  strokeWidth={2.5} 
                  dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Interpretation Section inside the card */}
        <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100 bg-gray-50/30 -mx-8 px-8 rounded-b-xl">
          <div className="flex items-center justify-between mb-4">
             <h4 className="font-bold text-gray-700 flex items-center gap-2 uppercase tracking-widest text-xs">
               <Sparkles className="w-4 h-4 text-amber-500" />
               Automated Operational Analysis
             </h4>
          </div>
          <div className="bg-white rounded-xl p-5 text-sm text-gray-700 leading-relaxed border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-osmak-500"></div>
            {analysis ? (
              <p className="relative z-10 font-medium italic">{analysis}</p>
            ) : (
              <p className="text-gray-400 italic">No data available for analysis in the selected range.</p>
            )}
          </div>
        </div>
      </div>

      {/* METRIC DETAIL MODAL */}
      {activeModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                  <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-2.5">
                          <div className="bg-osmak-100 p-2 rounded-lg">
                             <Activity className="w-5 h-5 text-osmak-700" />
                          </div>
                          <h2 className="text-lg font-bold text-gray-800 tracking-tight">Data Intelligence Breakdown</h2>
                      </div>
                      <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-gray-200 rounded-full transition-all text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-8">
                      {renderModalContent()}
                  </div>
                  <div className="bg-gray-50 p-4 px-6 text-right border-t border-gray-100 flex justify-end">
                      <button 
                        onClick={() => setActiveModal(null)}
                        className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
                      >
                          Dismiss
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const CircularGauge = ({ value, color }: { value: number; color: string }) => {
    const radius = 30;
    const stroke = 5;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;
  
    return (
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle
            stroke="#e5e7eb"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            fill="transparent"
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
      </div>
    );
};

export default KPITrend;