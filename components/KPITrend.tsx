import React, { useState, useMemo, useEffect } from 'react';
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
import { TrendingUp, TrendingDown, Users, Activity, Sparkles, Calendar, ArrowUpRight, ArrowDownRight, AlertCircle, X, ChevronRight } from 'lucide-react';

interface KPITrendProps {
  records: KPIRecord[];
}

// Simple Circular Gauge Component
const CircularGauge = ({ value, color }: { value: number; color: string }) => {
  const radius = 30;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
        <circle
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
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
      <span className="absolute text-xs font-bold text-gray-700">{Math.round(value)}%</span>
    </div>
  );
};

const KPITrend: React.FC<KPITrendProps> = ({ records }) => {
  // Filters
  const [selectedSection, setSelectedSection] = useState<string>(SectionName.ER);
  const [selectedKPI, setSelectedKPI] = useState<string>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [showCensus, setShowCensus] = useState(true);
  const [viewMode, setViewMode] = useState<'percent' | 'time'>('percent');
  
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

  const filteredData = useMemo(() => {
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

  // Update analysis when filtered data changes
  useEffect(() => {
    const kpiLabel = selectedKPI !== 'All' ? selectedKPI : "General Operational KPI";
    const result = analyzeData(filteredData, selectedSection, kpiLabel);
    setAnalysis(result);
  }, [filteredData, selectedSection, selectedKPI]);

  // Calculate Card Metrics
  const metrics = useMemo(() => {
    if (filteredData.length === 0) return null;

    const totalCensus = filteredData.reduce((acc, curr) => acc + (curr.census || 0), 0);
    const avgCensus = Math.round(totalCensus / filteredData.length);
    
    const successCount = filteredData.filter(r => dataService.isConformant(r)).length;
    const successRate = (successCount / filteredData.length) * 100;

    let failureStreak = 0;
    // Streak records for modal details
    const streakRecords: KPIRecord[] = [];
    
    for (let i = filteredData.length - 1; i >= 0; i--) {
      if (!dataService.isConformant(filteredData[i])) {
        failureStreak++;
        streakRecords.push(filteredData[i]);
      } else {
        break;
      }
    }

    const isLowerBetterForTrend = filteredData.length > 0 && selectedKPI !== 'All' ? dataService.isLowerBetter(filteredData[0]) : false;
    let trend = 0;
    let lastValue = 0;
    let prevValue = 0;
    
    if (filteredData.length >= 2) {
      const last = filteredData[filteredData.length-1];
      const prev = filteredData[filteredData.length-2];
      lastValue = isLowerBetterForTrend ? (last.actualPct || 0) : (last.actualPct || 0);
      prevValue = isLowerBetterForTrend ? (prev.actualPct || 0) : (prev.actualPct || 0);
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
        failCount: filteredData.length - successCount
    };
  }, [filteredData, selectedKPI]);

  // Custom Tooltip for Variance
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

      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50">
          <p className="font-bold text-gray-700 mb-2">{new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</p>
          
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

  // Detail Modal
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
          // Find Highs and Lows
          const sortedByCensus = [...filteredData].sort((a,b) => (b.census || 0) - (a.census || 0));
          const top3 = sortedByCensus.slice(0, 3);
          const minCensus = sortedByCensus[sortedByCensus.length - 1]?.census || 0;
          const maxCensus = sortedByCensus[0]?.census || 0;

          return (
              <>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Census Analysis</h3>
                <p className="text-sm text-gray-500 mb-6">Patient volume distribution and peak periods.</p>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-indigo-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-indigo-600 uppercase font-bold">Total Volume</p>
                        <p className="text-xl font-bold text-indigo-900">{metrics.totalCensus}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-gray-500 uppercase font-bold">Min Daily/Mo</p>
                        <p className="text-xl font-bold text-gray-700">{minCensus}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-gray-500 uppercase font-bold">Max Daily/Mo</p>
                        <p className="text-xl font-bold text-gray-700">{maxCensus}</p>
                    </div>
                </div>

                <h4 className="text-sm font-bold text-gray-700 mb-2">Busiest Recorded Months</h4>
                <div className="space-y-2">
                    {top3.map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                            <span className="text-sm font-medium text-gray-600">{new Date(r.month).toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-indigo-600">{r.census}</span>
                                <span className="text-xs text-gray-400">patients</span>
                            </div>
                        </div>
                    ))}
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
                                     <span className="font-bold text-red-800">{new Date(r.month).toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}</span>
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
                 <h3 className="text-lg font-bold text-gray-800 mb-1">Month-over-Month Trend</h3>
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
                        ? "Performance is trending in the right direction compared to the previous month." 
                        : "Performance has declined compared to the previous month. Investigation may be required."}
                 </p>
              </>
          );
      }
      return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls & Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-gray-500 uppercase">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-osmak-500 focus:border-osmak-500 sm:text-sm rounded-md border text-gray-900 bg-white"
          >
            {Object.values(SectionName).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-gray-500 uppercase">KPI</label>
          <select
            value={selectedKPI}
            onChange={(e) => setSelectedKPI(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-osmak-500 focus:border-osmak-500 sm:text-sm rounded-md border text-gray-900 bg-white"
          >
            {availableKPIs.map(kpi => (
              <option key={kpi} value={kpi}>{kpi}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-gray-500 uppercase">Type / Department</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-osmak-500 focus:border-osmak-500 sm:text-sm rounded-md border text-gray-900 bg-white"
          >
            {availableDepts.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 flex-[1.5] min-w-[300px]">
            <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <Calendar className="w-3 h-3"/> Date Range
            </label>
            <div className="flex gap-2">
                <input 
                    type="date" 
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="block w-full pl-2 py-2 text-xs border-gray-300 focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <input 
                    type="date" 
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="block w-full pl-2 py-2 text-xs border-gray-300 focus:ring-osmak-500 focus:border-osmak-500 rounded-md border text-gray-900 bg-white [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
            </div>
        </div>

        <div className="space-y-1 flex-1 min-w-[250px]">
            <label className="text-xs font-semibold text-gray-500 uppercase">View Options</label>
            <div className="flex items-center gap-4 h-10">
                 <div className="flex bg-gray-100 rounded-md p-1">
                    <button
                    onClick={() => setViewMode('percent')}
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${viewMode === 'percent' ? 'bg-white shadow text-osmak-700 font-bold' : 'text-gray-500'}`}
                    >
                    % Perf
                    </button>
                    <button
                    onClick={() => setViewMode('time')}
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${viewMode === 'time' ? 'bg-white shadow text-osmak-700 font-bold' : 'text-gray-500'}`}
                    >
                    Time/Day
                    </button>
                </div>
                <label className="inline-flex items-center cursor-pointer whitespace-nowrap">
                    <input type="checkbox" checked={showCensus} onChange={(e) => setShowCensus(e.target.checked)} className="form-checkbox h-4 w-4 text-osmak-600 rounded" />
                    <span className="ml-2 text-xs text-gray-700 font-medium">Census</span>
                </label>
            </div>
        </div>
      </div>

      {/* Executive Summary Widgets */}
      {metrics && (() => {
          const isTrendGood = metrics.isLowerBetterForTrend ? metrics.trend < 0 : metrics.trend > 0;
          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Success Rate Widget */}
              <div 
                onClick={() => setActiveModal('success')}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Success Rate</p>
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">{metrics.successRate.toFixed(1)}%</h3>
                  <p className="text-xs text-gray-500 mt-1">Conformance</p>
                </div>
                <CircularGauge value={metrics.successRate} color={metrics.successRate >= 90 ? '#22c55e' : metrics.successRate >= 75 ? '#eab308' : '#ef4444'} />
              </div>
    
              {/* Census Widget */}
              <div 
                onClick={() => setActiveModal('census')}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                 <div className="flex justify-between items-start">
                   <div>
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Avg Census</p>
                        <ChevronRight className="w-3 h-3 text-gray-300" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800">{metrics.avgCensus}</h3>
                   </div>
                   <div className="bg-indigo-50 p-2 rounded-lg">
                     <Users className="w-5 h-5 text-indigo-600" />
                   </div>
                 </div>
                 <div className="mt-3">
                   <div className="flex justify-between text-xs text-gray-400 mb-1">
                     <span>Total Load</span>
                     <span>{metrics.totalCensus}</span>
                   </div>
                   <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 rounded-full" style={{ width: '65%' }}></div>
                   </div>
                 </div>
              </div>
    
              {/* Failure Streak Widget */}
              <div 
                onClick={() => setActiveModal('streak')}
                className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${metrics.failureStreak > 0 ? 'border-red-500' : 'border-green-500'} flex flex-col justify-between cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5`}
              >
                 <div className="flex justify-between items-start">
                   <div>
                     <div className="flex items-center gap-1 mb-1">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Failure Streak</p>
                        <ChevronRight className="w-3 h-3 text-gray-300" />
                      </div>
                     <div className="flex items-baseline gap-1">
                        <h3 className="text-2xl font-bold text-gray-800">{metrics.failureStreak}</h3>
                        <span className="text-sm text-gray-500">months</span>
                     </div>
                   </div>
                   {metrics.failureStreak > 0 ? (
                     <AlertCircle className="w-6 h-6 text-red-500" />
                   ) : (
                     <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold uppercase">
                       Stable
                     </div>
                   )}
                </div>
                 <p className="text-xs text-gray-400 mt-2">Consecutive non-conformances</p>
              </div>
    
              {/* Trend Widget */}
              <div 
                onClick={() => setActiveModal('trend')}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                 <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">MoM Trend</p>
                        <ChevronRight className="w-3 h-3 text-gray-300" />
                      </div>
                      <h3 className={`text-2xl font-bold ${isTrendGood ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.trend > 0 ? '+' : ''}{metrics.trend.toFixed(2)}%
                      </h3>
                    </div>
                    <div className={`p-2 rounded-full ${isTrendGood ? 'bg-green-50' : 'bg-red-50'}`}>
                       {isTrendGood ? (
                         <ArrowUpRight className="w-5 h-5 text-green-600" />
                       ) : (
                         <ArrowDownRight className="w-5 h-5 text-red-600" />
                       )}
                    </div>
                 </div>
                 <p className="text-xs text-gray-400 mt-2">vs. Previous Month</p>
              </div>
            </div>
          )
      })()}

      {/* Main Chart */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h3 className="text-lg font-bold text-osmak-800 mb-4">{selectedSection} {selectedKPI !== 'All' ? `- ${selectedKPI}` : ''} {selectedDept !== 'All' ? `(${selectedDept})` : ''} - Performance Trend</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} />
              
              <YAxis yAxisId="left" orientation="left" stroke="#15803d" label={{ value: viewMode === 'percent' ? '% Performance' : 'Time', angle: -90, position: 'insideLeft' }} />
              
              <YAxis yAxisId="right" orientation="right" stroke="#6366f1" hide={!showCensus} label={{ value: 'Census', angle: 90, position: 'insideRight' }} />
              
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36}/>
              
              <Bar 
                yAxisId="left" 
                dataKey={viewMode === 'percent' ? 'actualPct' : 'actualTime'} 
                name="Actual" 
                fill="#22c55e" 
                barSize={30} 
                radius={[4, 4, 0, 0]}
              />
              
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey={viewMode === 'percent' ? 'targetPct' : 'targetTime'} 
                name="Target" 
                stroke="#dc2626" 
                strokeWidth={2} 
                dot={false}
                strokeDasharray="5 5"
              />
              
              {showCensus && (
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="census" 
                  name="Census" 
                  stroke="#6366f1" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: '#6366f1' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Interpretation Section */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
             <h4 className="font-semibold text-gray-700 flex items-center gap-2">
               <Sparkles className="w-4 h-4 text-amber-500" />
               Data Analysis
             </h4>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed border border-gray-100">
            {analysis ? (
              <p>{analysis}</p>
            ) : (
              <p className="text-gray-400 italic">No data available for analysis in the selected range.</p>
            )}
          </div>
        </div>
      </div>

      {/* METRIC DETAIL MODAL */}
      {activeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                      <h2 className="text-lg font-bold text-gray-800">Metric Details</h2>
                      <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                          <X className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>
                  <div className="p-6">
                      {renderModalContent()}
                  </div>
                  <div className="bg-gray-50 p-4 text-right border-t border-gray-100">
                      <button 
                        onClick={() => setActiveModal(null)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default KPITrend;