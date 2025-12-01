import React, { useState, useMemo } from 'react';
import { SectionName, KPIDefinition } from '../types';
import { Target, Calculator, Users, Clock, Info, BookOpen, FileText } from 'lucide-react';

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
      if (!groups[kpi.qualityObjective]) {
        groups[kpi.qualityObjective] = [];
      }
      groups[kpi.qualityObjective].push(kpi);
    });
    return groups;
  }, [kpis]);

  return (
    <div className="space-y-6 animate-fade-in">
       {/* Filter Section */}
       <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-full md:w-1/3">
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Select Section</label>
                <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-osmak-500 focus:border-osmak-500 sm:text-sm rounded-md border text-gray-900 bg-white"
                >
                    {Object.values(SectionName).map(name => (
                    <option key={name} value={name}>{name}</option>
                    ))}
                </select>
              </div>
              <div className="hidden md:block flex-1 text-gray-400 text-sm italic">
                  Select a section to view its specific Key Performance Indicators and operational definitions.
              </div>
          </div>
       </div>

       {/* KPI Groups */}
       <div className="space-y-8">
          {Object.keys(groupedKpis).length > 0 ? (
            Object.keys(groupedKpis).map((objective, index) => {
              const groupKpis = groupedKpis[objective];
              return (
                <div key={index} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                    {/* Header - Quality Objective */}
                    <div className="bg-osmak-700 px-6 py-4 border-b border-osmak-800">
                         <div className="flex items-start gap-3">
                            <Target className="w-6 h-6 text-white mt-1 shrink-0" />
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-wide">
                                    Quality Objective
                                </h3>
                                <p className="text-osmak-100 text-base mt-1 font-medium">
                                    "{objective}"
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Body - List of KPIs */}
                    <div className="divide-y divide-gray-200">
                        {groupKpis.map((kpi) => (
                            <div key={kpi.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                     <h4 className="text-xl font-bold text-osmak-800 flex items-center gap-2">
                                        {kpi.kpiName}
                                     </h4>
                                     <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                                        <FileText className="w-3 h-3"/> Doc #: {kpi.documentNumber}
                                     </span>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left Column */}
                                    <div className="space-y-4">
                                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                            <h5 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-2">
                                                <Info className="w-4 h-4" /> Definition
                                            </h5>
                                            <p className="text-gray-700 text-sm leading-relaxed">
                                                {kpi.definition}
                                            </p>
                                        </div>
                                        
                                        <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                            <h5 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-2 mb-2">
                                                <Calculator className="w-4 h-4" /> Formula
                                            </h5>
                                            <div className="font-mono text-xs md:text-sm text-blue-900">
                                                {kpi.formula}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                                            <div className="shrink-0">
                                                <Target className="w-5 h-5 text-green-600"/>
                                            </div>
                                            <div>
                                                <h5 className="text-xs font-bold text-gray-500 uppercase mb-1">Target</h5>
                                                <p className="text-green-900 text-sm font-bold">{kpi.target}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <h5 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-1">
                                                    <Users className="w-3 h-3" /> Responsible
                                                </h5>
                                                <p className="text-gray-800 text-sm font-medium">{kpi.responsible}</p>
                                            </div>
                                            <div>
                                                <h5 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-1">
                                                    <Clock className="w-3 h-3" /> Schedule
                                                </h5>
                                                <p className="text-gray-800 text-sm font-medium">{kpi.schedule}</p>
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
              <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
                  <p className="text-gray-500">No Key Performance Indicators defined for this section yet.</p>
              </div>
          )}
       </div>
    </div>
  );
}

export default KPIDetails;