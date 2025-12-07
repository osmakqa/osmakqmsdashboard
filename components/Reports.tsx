
import React, { useState, useMemo } from 'react';
import { KPIRecord, SectionName, KPIDefinition } from '../types';
import { Search, Printer } from 'lucide-react';

interface ReportsProps {
  records: KPIRecord[];
  definitions: KPIDefinition[];
}

const Reports: React.FC<ReportsProps> = ({ records, definitions }) => {
  // 1. Filters State
  const [selectedSection, setSelectedSection] = useState<string>(Object.values(SectionName)[0]);
  const [selectedKPI, setSelectedKPI] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  
  // Default to current month YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // 2. Derived Options based on selection
  const availableKPIs = useMemo(() => {
    return Array.from(new Set(records.filter(r => r.section === selectedSection).map(r => r.kpiName))).sort();
  }, [records, selectedSection]);

  const availableDepts = useMemo(() => {
    return Array.from(new Set(records.filter(r => 
      r.section === selectedSection && 
      (!selectedKPI || r.kpiName === selectedKPI)
    ).map(r => r.department))).sort();
  }, [records, selectedSection, selectedKPI]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    records.forEach(r => {
        if (r.month) months.add(r.month.slice(0, 7)); // Extract YYYY-MM
    });
    return Array.from(months).sort().reverse();
  }, [records]);

  // Set default month
  useMemo(() => {
      if (!selectedMonth && availableMonths.length > 0) {
          setSelectedMonth(availableMonths[0]);
      }
  }, [availableMonths, selectedMonth]);

  // 3. Find the specific record
  const selectedRecord = useMemo(() => {
    return records.find(r => 
      r.section === selectedSection &&
      (!selectedKPI || r.kpiName === selectedKPI) &&
      (!selectedDept || r.department === selectedDept) &&
      r.month.startsWith(selectedMonth)
    );
  }, [records, selectedSection, selectedKPI, selectedDept, selectedMonth]);

  // 4. Find the Definition for Document No.
  const selectedDefinition = useMemo(() => {
      if (!selectedRecord) return null;
      return definitions.find(d => 
          d.section === selectedRecord.section && 
          d.kpiName === selectedRecord.kpiName
      );
  }, [selectedRecord, definitions]);

  const formatMonth = (yyyyMm: string) => {
      if (!yyyyMm) return '';
      const [year, month] = yyyyMm.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  };

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
        {/* Print Styles */}
        <style>
            {`
            @media print {
                body * {
                    visibility: hidden;
                }
                #printable-report, #printable-report * {
                    visibility: visible;
                }
                #printable-report {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    border: none;
                    box-shadow: none;
                    transform: scale(1.2); /* Adjust scale if needed */
                    transform-origin: top left;
                }
                @page {
                    size: auto;
                    margin: 0mm;
                }
                /* Ensure background colors/images print */
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
            `}
        </style>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end print:hidden">
             <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Section</label>
                <select
                    value={selectedSection}
                    onChange={(e) => {
                        setSelectedSection(e.target.value);
                        setSelectedKPI('');
                        setSelectedDept('');
                    }}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-osmak-500 focus:border-osmak-500 sm:text-sm bg-white text-gray-900 py-2"
                >
                    {Object.values(SectionName).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
             </div>

             <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">KPI Name</label>
                <select
                    value={selectedKPI}
                    onChange={(e) => setSelectedKPI(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-osmak-500 focus:border-osmak-500 sm:text-sm bg-white text-gray-900 py-2"
                >
                    <option value="">-- All KPIs --</option>
                    {availableKPIs.map(k => (
                        <option key={k} value={k}>{k}</option>
                    ))}
                </select>
             </div>

             <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Department</label>
                <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-osmak-500 focus:border-osmak-500 sm:text-sm bg-white text-gray-900 py-2"
                >
                    <option value="">-- All Depts --</option>
                    {availableDepts.map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
             </div>

             <div className="flex-none w-[180px]">
                 <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Month-Year</label>
                 <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-osmak-500 focus:border-osmak-500 sm:text-sm bg-white text-gray-900 py-2"
                 >
                     {availableMonths.map(m => (
                         <option key={m} value={m}>{formatMonth(m)}</option>
                     ))}
                     {availableMonths.length === 0 && <option value="">No Data Available</option>}
                 </select>
             </div>

             <div className="flex-none">
                 <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-osmak-600 text-white px-4 py-2 rounded-md shadow hover:bg-osmak-700 transition-colors"
                 >
                     <Printer className="w-4 h-4" />
                     Print
                 </button>
             </div>
        </div>

        {/* Visual Report Display */}
        <div className="bg-gray-100 rounded-xl border border-gray-200 p-2 flex justify-center overflow-auto print:bg-white print:border-none print:p-0">
            
            <div 
                id="printable-report"
                style={{ 
                    width: '600px', // Maintained 600px width constraint
                    height: '800px', 
                    position: 'relative',
                    backgroundColor: 'white',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
            >
                {/* Background Image (DO NOT TOUCH) */}
                <div 
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundImage: "url('https://maxterrenal-hash.github.io/justculture/MMI3.png')",
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'top center',
                        zIndex: 1
                    }}
                />

                {/* OVERLAY CONTENT */}
                {selectedRecord && (
                    <div className="absolute inset-0 z-10 font-sans text-gray-900 font-medium text-xs">
                        
                        {/* HEADER FIELDS (Document No, Period, etc.) */}
                        {/* Document No */}
                        <div style={{ position: 'absolute', top: '5.5%', left: '60%', width: '19.5%', textAlign: 'center', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30px' }}>
                            {selectedDefinition?.documentNumber || 'QAD-GEN-001'}
                        </div>
                        {/* Effectivity Date */}
                        <div style={{ position: 'absolute', top: '5.5%', left: '79.5%', width: '19.5%', textAlign: 'center', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30px' }}>
                            01-Jan-2023
                        </div>
                        {/* Reporting Period */}
                        <div style={{ position: 'absolute', top: '12.5%', left: '60%', width: '19.5%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30px' }}>
                            {formatMonth(selectedMonth)}
                        </div>
                        
                        {/* Removed Page No as requested */}


                        {/* Table 1: Header Info (Section, KPI, Category) */}
                        <div style={{ position: 'absolute', top: '27%', left: '2%', width: '96%' }}>
                            <table style={{ width: '100%', tableLayout: 'fixed', textAlign: 'center' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '33.3%', verticalAlign: 'top', fontWeight: 'bold', paddingTop: '5px', fontSize: '11px' }}>
                                            {selectedRecord.section}
                                        </td>
                                        <td style={{ width: '33.3%', verticalAlign: 'top', fontWeight: 'bold', paddingTop: '5px', fontSize: '11px' }}>
                                            {selectedRecord.kpiName}
                                        </td>
                                        <td style={{ width: '33.3%', verticalAlign: 'top', fontWeight: 'bold', paddingTop: '5px', fontSize: '11px' }}>
                                            {selectedRecord.department}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Table 2: Metrics Data */}
                        <div style={{ position: 'absolute', top: '48%', left: '2%', width: '96%' }}>
                             <table style={{ width: '100%', tableLayout: 'fixed', textAlign: 'center' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '15%', fontSize: '11px' }}>
                                            {new Date(selectedRecord.month).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td style={{ width: '11%', fontSize: '11px' }}>{selectedRecord.census}</td>
                                        
                                        <td style={{ width: '13%', fontSize: '11px' }}>
                                            {selectedRecord.kpiType === 'TIME' ? selectedRecord.actualTime : selectedRecord.actualPct}
                                        </td>
                                        
                                        <td style={{ width: '13%', fontSize: '11px' }}>
                                            {selectedRecord.kpiType === 'TIME' ? selectedRecord.targetTime : selectedRecord.targetPct}
                                        </td>
                                        
                                        <td style={{ width: '13%', fontSize: '11px' }}>
                                            {selectedRecord.kpiType === 'TIME' ? selectedRecord.timeUnit : '%'}
                                        </td>
                                        
                                        <td style={{ width: '17.5%', fontSize: '11px' }}>
                                            {selectedRecord.actualPct ? `${selectedRecord.actualPct}%` : '-'}
                                        </td>
                                        
                                        <td style={{ width: '17.5%', fontSize: '11px' }}>
                                            {selectedRecord.targetPct ? `${selectedRecord.targetPct}%` : '-'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>
                )}
                
                {/* No Data Overlay */}
                {!selectedRecord && (
                    <div style={{
                        position: 'absolute',
                        zIndex: 20,
                        top: '40%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '2px dashed #ccc',
                        textAlign: 'center'
                    }} className="print:hidden">
                        <Search className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <h3 className="text-lg font-bold text-gray-700">No Record Found</h3>
                        <p className="text-sm text-gray-500">Try adjusting the filters to find a valid entry.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Reports;
