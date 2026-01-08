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
import { TrendingUp, Users, Activity, Sparkles, Calendar, ArrowUpRight, ArrowDownRight, AlertCircle, X, ChevronRight, Download, Loader } from 'lucide-react';
import { toPng } from 'html-to-image';

interface KPITrendProps {
  records: KPIRecord[];
}

// Helper to aggregate records by quarter using averages for metrics
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
    const templateRecord = quarterRecords[0];
    const dateParts = quarterKey.split('-Q'); 
    const year = parseInt(dateParts[0]);
    const quarterNum = parseInt(dateParts[1]);
    const firstMonthOfQuarter = new Date(year, (quarterNum - 1) * 3, 1).toISOString().slice(0, 10);

    let totalCensus = 0;
    let sumTargetTime = 0;
    let sumActualTime = 0;
    let sumTargetPct = 0;
    let sumActualPct = 0;
    let countTime = 0;
    let countPct = 0;

    quarterRecords.forEach(r => {
      totalCensus += r.census || 0;
      if (r.targetTime !== undefined && r.actualTime !== undefined) {
        sumTargetTime += r.targetTime;
        sumActualTime += r.actualTime;
        countTime++;
      }
      if (r.targetPct !== undefined && r.actualPct !== undefined) {
        sumTargetPct += r.targetPct;
        sumActualPct += r.actualPct;
        countPct++;
      }
    });

    const aggregatedRecord: KPIRecord = {
      ...templateRecord,
      id: `agg-${quarterKey}-${templateRecord.section}-${templateRecord.kpiName}`,
      month: firstMonthOfQuarter,
      census: totalCensus,
      targetTime: countTime > 0 ? sumTargetTime / countTime : undefined,
      actualTime: countTime > 0 ? sumActualTime / countTime : undefined,
      targetPct: countPct > 0 ? sumTargetPct / countPct : 0, 
      actualPct: countPct > 0 ? sumActualPct / countPct : 0, 
      remarks: `Averaged data for ${quarterKey}`,
      status: 'APPROVED', 
    };
    return aggregatedRecord;
  }).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
};

const KPITrend: React.FC<KPITrendProps> = ({ records }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedSection, setSelectedSection] = useState<string>(SectionName.ER);
  const [selectedKPI, setSelectedKPI] = useState<string>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [showCensus, setShowCensus] = useState(true);
  const [viewMode, setViewMode] = useState<'percent' | 'time'>('percent');
  const [aggregationPeriod, setAggregationPeriod] = useState<'monthly' | 'quarterly'>('monthly'); 
  const [dateFrom, setDateFrom] = useState('2023-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'success' | 'census' | 'streak' | 'trend' | null>(null);

  const availableKPIs = useMemo(() => {
    const sectionRecords = records.filter(r => r.section === selectedSection);
    return ['All', ...Array.from(new Set(sectionRecords.map(r => r.kpiName))).sort()];
  }, [records, selectedSection]);

  const availableDepts = useMemo(() => {
    const sectionRecords = records.filter(r => 
        r.section === selectedSection && (selectedKPI === 'All' || r.kpiName === selectedKPI)
    );
    return ['All', ...Array.from(new Set(sectionRecords.map(r => r.department))).sort()];
  }, [records, selectedSection, selectedKPI]);

  useEffect(() => { setSelectedKPI('All'); setSelectedDept('All'); }, [selectedSection]);
  useEffect(() => { setSelectedDept('All'); }, [selectedKPI]);

  const filteredMonthlyData = useMemo(() => {
    return records
      .filter(r => 
        r.section === selectedSection &&
        (selectedKPI === 'All' || r.kpiName === selectedKPI) &&
        (selectedDept === 'All' || r.department === selectedDept) &&
        r.month >= dateFrom && r.month <= dateTo
      )
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [records, selectedSection, selectedKPI, selectedDept, dateFrom, dateTo]);

  const displayedData = useMemo(() => {
      return aggregationPeriod === 'quarterly' ? aggregateRecordsByQuarter(filteredMonthlyData) : filteredMonthlyData;
  }, [filteredMonthlyData, aggregationPeriod]);

  useEffect(() => {
    const kpiLabel = selectedKPI !== 'All' ? selectedKPI : "General Operational KPI";
    setAnalysis(analyzeData(displayedData, selectedSection, kpiLabel));
  }, [displayedData, selectedSection, selectedKPI]);

  const metrics = useMemo(() => {
    if (displayedData.length === 0) return null;
    const totalCensus = displayedData.reduce((acc, curr) => acc + (curr.census || 0), 0);
    const successCount = displayedData.filter(r => dataService.isConformant(r)).length;
    let failureStreak = 0;
    const streakRecords: KPIRecord[] = [];
    for (let i = displayedData.length - 1; i >= 0; i--) {
      if (!dataService.isConformant(displayedData[i])) { failureStreak++; streakRecords.push(displayedData[i]); }
      else break;
    }
    const isLowerBetter = displayedData.length > 0 && selectedKPI !== 'All' ? dataService.isLowerBetter(displayedData[0]) : false;
    let trend = 0, lastValue = 0, prevValue = 0;
    if (displayedData.length >= 2) {
      const last = displayedData[displayedData.length-1], prev = displayedData[displayedData.length-2];
      lastValue = (viewMode === 'percent' ? (last.actualPct || 0) : (last.actualTime || 0));
      prevValue = (viewMode === 'percent' ? (prev.actualPct || 0) : (prev.actualTime || 0));
      trend = lastValue - prevValue;
    }
    return { 
        totalCensus, avgCensus: Math.round(totalCensus / displayedData.length), successRate: (successCount / displayedData.length) * 100, 
        failureStreak, streakRecords, trend, isLowerBetterForTrend: isLowerBetter, lastValue, prevValue, successCount, failCount: displayedData.length - successCount
    };
  }, [displayedData, selectedKPI, viewMode]);

  const downloadReportAsPNG = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, { backgroundColor: '#ffffff', cacheBust: true, style: { padding: '20px' } });
      const link = document.createElement('a');
      link.download = `OsMak_KPI_${selectedSection.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) { console.error(error); } finally { setIsExporting(false); }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const data = payload[0].payload;
      const isConformant = dataService.isConformant(data);
      let varianceText = '';
      if (viewMode === 'percent') {
        const variance = (Number(data.actualPct) || 0) - (Number(data.targetPct) || 0);
        varianceText = `${variance > 0 ? '+' : ''}${variance.toFixed(2)}%`;
      } else {
        const variance = (Number(data.actualTime) || 0) - (Number(data.targetTime) || 0);
        varianceText = `${variance > 0 ? '+' : ''}${Math.abs(variance).toFixed(2)} ${data.timeUnit}`;
      }
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50">
          <p className="font-bold text-gray-700 mb-2">{aggregationPeriod === 'quarterly' ? label : new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-4"><span className="text-gray-500">Actual:</span><span className="font-bold text-gray-800">{payload.find((p:any) => p.name === 'Actual Performance')?.value?.toFixed(2)}{viewMode === 'percent' ? '%' : ` ${data.timeUnit}`}</span></p>
            <p className="flex justify-between gap-4"><span className="text-gray-500">Target:</span><span className="font-medium text-gray-600">{payload.find((p:any) => p.name === 'Performance Target')?.value?.toFixed(2)}{viewMode === 'percent' ? '%' : ` ${data.timeUnit}`}</span></p>
            <div className={`mt-2 pt-2 border-t border-gray-100 flex justify-between gap-4 font-bold ${isConformant ? 'text-green-600' : 'text-red-600'}`}>
              <span>Variance:</span><span>{varianceText} {isConformant ? '(Pass)' : '(Fail)'}</span>
            </div>
            {showCensus && <p className="flex justify-between gap-4 text-indigo-500 mt-1"><span>Census:</span><span>{data.census}</span></p>}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end overflow-hidden">
        <div className="space-y-1 flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Section</label>
          <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="block w-full px-3 py-2 text-sm border-gray-300 rounded-md border text-gray-900 bg-white font-medium">
            {Object.values(SectionName).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">KPI Name</label>
          <select value={selectedKPI} onChange={(e) => setSelectedKPI(e.target.value)} className="block w-full px-3 py-2 text-sm border-gray-300 rounded-md border text-gray-900 bg-white font-medium">
            {availableKPIs.map(kpi => <option key={kpi} value={kpi}>{kpi}</option>)}
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type / Department</label>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="block w-full px-3 py-2 text-sm border-gray-300 rounded-md border text-gray-900 bg-white font-medium">
            {availableDepts.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>
        </div>
        <div className="space-y-1 flex-[1.2] min-w-[240px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3"/> Analysis Period</label>
            <div className="flex gap-2">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="block w-full px-2 py-2 text-xs border-gray-300 rounded-md border text-gray-900 bg-white"/>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="block w-full px-2 py-2 text-xs border-gray-300 rounded-md border text-gray-900 bg-white"/>
            </div>
        </div>

        <div className="w-full h-px bg-gray-50 md:hidden"></div>

        <div className="flex flex-wrap gap-4 items-end w-full">
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">VIEW OPTIONS</label>
                <div className="flex items-center gap-3 h-9">
                    <div className="flex bg-gray-100 rounded-lg p-1 shadow-inner border border-gray-200">
                        <button onClick={() => setViewMode('percent')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'percent' ? 'bg-white shadow-sm text-osmak-700' : 'text-gray-400'}`}>% Perf</button>
                        <button onClick={() => setViewMode('time')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'time' ? 'bg-white shadow-sm text-osmak-700' : 'text-gray-400'}`}>Time/Day</button>
                    </div>
                    <label className="inline-flex items-center cursor-pointer group">
                        <input type="checkbox" checked={showCensus} onChange={(e) => setShowCensus(e.target.checked)} className="sr-only peer"/>
                        <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded peer-checked:bg-osmak-600 peer-checked:border-osmak-600 flex items-center justify-center transition-all group-hover:border-osmak-400">
                            <div className={`w-1 h-2 border-r-2 border-b-2 border-white rotate-45 mb-0.5 ${showCensus ? 'block' : 'hidden'}`}></div>
                        </div>
                        <span className="ml-1.5 text-[10px] text-gray-600 font-bold uppercase">Census</span>
                    </label>
                </div>
            </div>
            
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">AGGREGATION</label>
                <div className="flex bg-gray-100 rounded-lg p-1 h-9 shadow-inner border border-gray-200">
                    <button onClick={() => setAggregationPeriod('monthly')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${aggregationPeriod === 'monthly' ? 'bg-white shadow-sm text-osmak-700' : 'text-gray-400'}`}>Monthly</button>
                    <button onClick={() => setAggregationPeriod('quarterly')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${aggregationPeriod === 'quarterly' ? 'bg-white shadow-sm text-osmak-700' : 'text-gray-400'}`}>Quarterly</button>
                </div>
            </div>

            <button onClick={downloadReportAsPNG} disabled={isExporting} className="ml-auto flex items-center gap-2 px-4 h-9 bg-osmak-700 text-white rounded-lg text-xs font-bold hover:bg-osmak-800 transition-all disabled:opacity-50 shadow-sm active:scale-95 group">
                {isExporting ? <Loader className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {isExporting ? 'Exporting...' : 'Download Report'}
            </button>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <MetricCard title="Success Rate" value={`${metrics.successRate.toFixed(1)}%`} subValue="Conformance" onClick={() => setActiveModal('success')} color={metrics.successRate >= 90 ? '#22c55e' : metrics.successRate >= 75 ? '#eab308' : '#ef4444'}>
             <CircularGauge value={metrics.successRate} color={metrics.successRate >= 90 ? '#22c55e' : metrics.successRate >= 75 ? '#eab308' : '#ef4444'} />
          </MetricCard>
          <MetricCard title="Avg Census" value={metrics.avgCensus} subValue={`Total: ${metrics.totalCensus}`} onClick={() => setActiveModal('census')} icon={<Users className="w-5 h-5 text-indigo-600" />} />
          <MetricCard title="Failure Streak" value={metrics.failureStreak} subValue={aggregationPeriod === 'quarterly' ? 'Quarters' : 'Months'} onClick={() => setActiveModal('streak')} color={metrics.failureStreak > 0 ? '#ef4444' : '#22c55e'} icon={<AlertCircle className={`w-5 h-5 ${metrics.failureStreak > 0 ? 'text-red-500' : 'text-green-500'}`} />} />
          <MetricCard title={`${aggregationPeriod === 'quarterly' ? 'QoQ' : 'MoM'} Trend`} value={`${metrics.trend > 0 ? '+' : ''}${metrics.trend.toFixed(2)}%`} subValue="vs. Previous" onClick={() => setActiveModal('trend')} color={(metrics.isLowerBetterForTrend ? metrics.trend < 0 : metrics.trend > 0) ? '#22c55e' : '#ef4444'} icon={(metrics.isLowerBetterForTrend ? metrics.trend < 0 : metrics.trend > 0) ? <ArrowUpRight className="text-green-600 w-5 h-5" /> : <ArrowDownRight className="text-red-600 w-5 h-5" />} />
        </div>
      )}

      <div ref={reportRef} className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h3 className="text-lg font-bold text-osmak-800 mb-6">{selectedSection} {selectedKPI !== 'All' ? `- ${selectedKPI}` : ''} <span className="block text-xs text-gray-400 font-medium uppercase tracking-widest mt-1">Performance Visualization ({aggregationPeriod})</span></h3>
        <div className="h-[380px] mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayedData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" tick={{fontSize: 10, fill: '#64748b'}} axisLine={{stroke: '#e2e8f0'}} tickFormatter={(v) => aggregationPeriod === 'quarterly' ? `${new Date(v).getFullYear()}-Q${Math.floor(new Date(v).getMonth() / 3) + 1}` : new Date(v).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} />
              <YAxis yAxisId="left" stroke="#15803d" tick={{fontSize: 10}} label={{ value: viewMode === 'percent' ? '%' : 'Time', angle: -90, position: 'insideLeft', style: {fontSize: 10, fill: '#15803d'} }} />
              <YAxis yAxisId="right" orientation="right" stroke="#6366f1" hide={!showCensus} tick={{fontSize: 10}} label={{ value: 'Census', angle: 90, position: 'insideRight', style: {fontSize: 10, fill: '#6366f1'} }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" iconType="circle" wrapperStyle={{paddingBottom: '15px', fontSize: '10px'}}/>
              <Bar yAxisId="left" dataKey={viewMode === 'percent' ? 'actualPct' : 'actualTime'} name="Actual Performance" fill="#22c55e" barSize={30} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey={viewMode === 'percent' ? 'targetPct' : 'targetTime'} name="Performance Target" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              {showCensus && <Line yAxisId="right" type="monotone" dataKey="census" name="Patient Census" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1', stroke: '#fff' }} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="pt-6 border-t border-dashed border-gray-100 bg-gray-50/30 -mx-6 px-6 rounded-b-xl">
          <h4 className="font-bold text-gray-700 flex items-center gap-1.5 uppercase text-[10px] mb-3"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Operational Insight</h4>
          <div className="bg-white rounded-lg p-4 text-xs text-gray-700 leading-relaxed border border-gray-200 shadow-sm relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-osmak-500"></div>{analysis ? <p className="italic font-medium">{analysis}</p> : <p className="text-gray-400 italic">No data available for analysis.</p>}</div>
        </div>
      </div>

      {activeModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in" onClick={() => setActiveModal(null)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-4 border-b bg-gray-50/50">
                      <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Activity className="w-4 h-4 text-osmak-700" /> Metric Intelligence</h2>
                      <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-6">
                      {activeModal === 'success' && metrics && <div className="text-center"><h3 className="font-bold mb-4">Conformance Distribution</h3><div className="h-40 w-full mb-4 flex justify-center"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Pass', value: metrics.successCount }, { name: 'Fail', value: metrics.failCount }]} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">{[{ color: '#22c55e' }, { color: '#ef4444' }].map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><p className="text-sm text-gray-600">Overall success: <b>{metrics.successRate.toFixed(1)}%</b></p></div>}
                      {activeModal === 'census' && metrics && <div><h3 className="font-bold mb-2">Volume History</h3><p className="text-xs text-gray-500 mb-4">Average: {metrics.avgCensus} | Total: {metrics.totalCensus}</p><div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">{filteredMonthlyData.slice().reverse().map((r, i) => <div key={i} className="flex justify-between text-xs p-2 bg-gray-50 rounded border"><span>{new Date(r.month).toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}</span><span className="font-bold text-indigo-600">{r.census} pts</span></div>)}</div></div>}
                      {activeModal === 'streak' && metrics && <div><h3 className="font-bold mb-4">Consecutive Misses</h3>{metrics.failureStreak > 0 ? <div className="space-y-2">{metrics.streakRecords.map((r, i) => <div key={i} className="bg-red-50 p-2 rounded border border-red-100 text-xs flex justify-between"><span>{r.month}</span><b>{r.kpiType === 'TIME' ? r.actualTime : r.actualPct}{r.kpiType === 'TIME' ? ' ' + r.timeUnit : '%'}</b></div>)}</div> : <div className="text-center py-8"><p className="text-green-600 font-bold">No active failure streak.</p></div>}</div>}
                      {activeModal === 'trend' && metrics && <div><h3 className="font-bold mb-4">Performance Comparison</h3><div className="flex justify-between items-center bg-gray-50 p-4 rounded border mb-4"><div className="text-center"><p className="text-[10px] text-gray-500 uppercase font-bold">Previous</p><p className="text-lg font-bold">{metrics.prevValue.toFixed(2)}</p></div><div className="text-center font-bold text-osmak-600">{metrics.trend > 0 ? '+' : ''}{metrics.trend.toFixed(2)}%</div><div className="text-center"><p className="text-[10px] text-gray-500 uppercase font-bold">Current</p><p className="text-lg font-bold">{metrics.lastValue.toFixed(2)}</p></div></div></div>}
                  </div>
                  <div className="bg-gray-50 p-3 flex justify-end"><button onClick={() => setActiveModal(null)} className="px-4 py-1.5 bg-white border rounded text-xs font-bold hover:bg-gray-100 transition-all">Dismiss</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

const MetricCard = ({ title, value, subValue, onClick, icon, color, children }: any) => (
  <div onClick={onClick} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 relative group">
    <div>
      <div className="flex items-center gap-1 mb-1">
        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{title}</p>
        <ChevronRight className="w-3 h-3 text-gray-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 tracking-tight" style={color ? { color } : {}}>{value}</h3>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mt-0.5">{subValue}</p>
    </div>
    {children ? children : <div className="bg-gray-50 p-2 rounded-lg group-hover:bg-gray-100 transition-colors">{icon}</div>}
  </div>
);

const CircularGauge = ({ value, color }: { value: number; color: string }) => {
    const radius = 25, stroke = 4, normalizedRadius = radius - stroke * 2, circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;
    return (
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle stroke="#e5e7eb" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} fill="transparent" />
          <circle stroke={color} fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + ' ' + circumference} style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s' }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} />
        </svg>
      </div>
    );
};

export default KPITrend;