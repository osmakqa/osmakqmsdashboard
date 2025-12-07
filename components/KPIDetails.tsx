import React, { useState, useMemo } from 'react';
import { SectionName, KPIDefinition } from '../types';
import { Calculator, Users, Clock, Info, BookOpen, FileText, CheckCircle2 } from 'lucide-react';

interface KPIDetailsProps {
  definitions: KPIDefinition[];
}

const KPIDetails: React.FC<KPIDetailsProps> = ({ definitions }) => {
  // Use passed definitions instead of local fetching
  const [selectedSection, setSelectedSection] = useState<string>(SectionName.ADMITTING);

  const kpis = useMemo(() => {
    return definitions.filter(k => k.section === selectedSection);
  }, [definitions, selectedSection]);

  // Group KPIs by Quality Objective
  const groupedKpis = useMemo(() => {
    const groups: Record<string, KPIDefinition[]> = {};
    kpis.forEach(kpi => {
      const objKey = kpi.qualityObjective || "General KPIs";
      if (!groups[objKey]) {
        groups[objKey] = [];
      }
      groups[objKey].push(kpi);
    });
    return groups;
  }, [kpis]);

  return (
    <div className="space-y-8 animate-fade-in">
       {/* Filter Section */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-1/3">
            <label className="text-xs font-bold text-osmak-700 uppercase tracking-wider block mb-2">Select Section</label>
            <div className="relative">
                <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="block w-full pl-4 pr-10 py-3 text-sm font-medium border-gray-200 focus:outline-none focus:ring-2 focus:ring-osmak-500 focus:border-transparent rounded-lg border text-gray-800 bg-gray-50 hover:bg-white transition-colors cursor-pointer"
                >
                    {Object.values(SectionName).map(name => (
                    <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>
          </div>
          <div className="hidden md:block w-px h-12 bg-gray-200"></div>
          <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-800">{selectedSection}</h2>
              <p className="text-gray-500 text-sm">View operational definitions, formulas, and responsibilities.</p>
          </div>
       </div>

       {/* Main Content Area */}
       <div className="space-y-10">
          {Object.keys(groupedKpis).length > 0 ? (
            Object.keys(groupedKpis).map((objective, index) => {
              const groupKpis = groupedKpis[objective];
              return (
                <div key={index} className="animate-fade-in">
                    
                    {/* Quality Objective Header */}
                    <div className="flex items-start gap-4 mb-6">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-osmak-500 ring-4 ring-osmak-100 shrink-0"></div>
                        <div>
                            <span className="block text-xs font-bold text-osmak-600 uppercase tracking-wider mb-1">Quality Objective</span>
                            <h3 className="text-xl md:text-2xl font-bold text-gray-800 leading-snug">
                                "{objective}"
                            </h3>
                        </div>
                    </div>

                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-1 gap-6 pl-0 md:pl-6">
                        {groupKpis.map((kpi) => (
                            <div key={kpi.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow relative">
                                {/* Top Accent Line */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-osmak-500"></div>

                                <div className="p-6">
                                    {/* KPI Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
                                        <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            {kpi.kpiName}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-50 text-gray-600 text-xs font-medium border border-gray-200">
                                                <FileText className="w-3.5 h-3.5"/> 
                                                {kpi.documentNumber || 'No Doc #'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        
                                        {/* Definition & Formula (Span 8) */}
                                        <div className="lg:col-span-7 space-y-4">
                                            <div>
                                                <h5 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-2">
                                                    <Info className="w-3.5 h-3.5" /> Operational Definition
                                                </h5>
                                                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed border border-gray-100">
                                                    {kpi.definition || 'No definition provided.'}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <h5 className="text-xs font-bold text-blue-400 uppercase flex items-center gap-2 mb-2">
                                                    <Calculator className="w-3.5 h-3.5" /> Formula
                                                </h5>
                                                <div className="bg-blue-50/50 rounded-lg p-3 text-sm font-mono text-blue-900 border border-blue-100 flex items-center gap-2">
                                                   <span>{kpi.formula || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Metadata (Span 4) */}
                                        <div className="lg:col-span-5 flex flex-col justify-between gap-4 bg-white">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                                                <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                                                    <h5 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2 mb-1">
                                                        <Users className="w-3 h-3" /> Responsible Person
                                                    </h5>
                                                    <p className="text-sm font-semibold text-gray-800">{kpi.responsible || 'Unassigned'}</p>
                                                </div>

                                                <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                                                    <h5 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2 mb-1">
                                                        <Clock className="w-3 h-3" /> Reporting Schedule
                                                    </h5>
                                                    <p className="text-sm font-semibold text-gray-800">{kpi.schedule || 'Monthly'}</p>
                                                </div>
                                                
                                                {/* Type Indicator */}
                                                <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                                                     <h5 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2 mb-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Metric Type
                                                    </h5>
                                                    <div className="flex gap-2">
                                                        {kpi.kpiType === 'TIME' || kpi.targetTime ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                                Time Based
                                                            </span>
                                                        ) : null}
                                                        {kpi.kpiType === 'PERCENTAGE' || kpi.targetPct ? (
                                                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
                                                                Percentage
                                                            </span>
                                                        ) : null}
                                                        {!kpi.kpiType && !kpi.targetTime && !kpi.targetPct && (
                                                            <span className="text-sm text-gray-500 italic">Not specified</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              );
            })
          ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border border-dashed border-gray-300 text-center">
                  <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <BookOpen className="w-8 h-8 text-gray-400"/>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No KPIs Found</h3>
                  <p className="text-gray-500 max-w-sm mt-1">
                      There are no Key Performance Indicators defined for the <strong>{selectedSection}</strong> yet.
                  </p>
              </div>
          )}
       </div>
    </div>
  );
}

export default KPIDetails;