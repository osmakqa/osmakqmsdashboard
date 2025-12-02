import React, { useState, useEffect, useMemo } from 'react';
import { KPIRecord, SectionName, KPIType, KPIDefinition } from '../types';
import { dataService } from '../services/dataService';
import { Download, Plus, Search, Edit2, ArrowUp, ArrowDown, X, Save, Trash2, ListPlus, Database, Info, Copy, Sheet } from 'lucide-react';
import LoginModal from './LoginModal';
import { GOOGLE_SHEET_URL } from '../constants';

interface RecordsProps {
  records: KPIRecord[];
  definitions: KPIDefinition[];
  onRefresh: () => void;
}

// Helper to parse target strings like "95%" or "< 30 Mins"
const parseKPITarget = (targetString: string): Partial<KPIRecord> => {
  const result: Partial<KPIRecord> = { kpiType: 'PERCENTAGE', targetPct: 0 };
  const numMatch = targetString.match(/[\d.]+/);
  const value = numMatch ? parseFloat(numMatch[0]) : 0;

  if (targetString.includes('%')) {
    result.kpiType = 'PERCENTAGE';
    result.targetPct = value;
    result.targetTime = undefined;
    result.timeUnit = undefined;
  } else {
    result.kpiType = 'TIME';
    result.targetTime = value;
    result.targetPct = undefined;
    if (/min/i.test(targetString)) result.timeUnit = 'Mins';
    else if (/hour/i.test(targetString)) result.timeUnit = 'Hours';
    else if (/day/i.test(targetString)) result.timeUnit = 'Days';
    else result.timeUnit = 'Mins';
  }
  return result;
};


const Records: React.FC<RecordsProps> = ({ records, definitions, onRefresh }) => {
  
  // Filters
  const [filterSection, setFilterSection] = useState<string>('');
  const [filterKPI, setFilterKPI] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof KPIRecord | string; direction: 'asc' | 'desc' } | null>(null);

  // Auth state
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingAction, setPendingAction] = useState<'add' | 'edit' | 'delete' | 'openSheet' | null>(null);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);

  // Add/Edit Entry Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Batch Entry State (For "Spreadsheet" Mode)
  type BatchRow = Partial<KPIRecord> & { isNewKpi?: boolean; isNewDept?: boolean };
  const [batchQueue, setBatchQueue] = useState<BatchRow[]>([]);
  
  // Single Entry State (For Edit Mode Only)
  const [currentEntry, setCurrentEntry] = useState<Partial<KPIRecord>>({});

  // Default empty record template
  const defaultRecord: Partial<KPIRecord> = {
      section: SectionName.ADMITTING,
      kpiName: '',
      department: '',
      kpiType: 'PERCENTAGE',
      month: new Date().toISOString().slice(0, 7) + '-01',
      census: undefined,
      targetPct: undefined,
      actualPct: undefined,
      targetTime: undefined,
      actualTime: undefined,
      timeUnit: 'Mins',
      dueDate: new Date().toISOString().slice(0, 10),
      dateSubmitted: new Date().toISOString().slice(0, 10),
  };

  // Filter Dropdown Options
  const availableKPIs = useMemo(() => {
    if (!filterSection) return [];
    const definedKPIs = definitions.filter(d => d.section === filterSection).map(d => d.kpiName);
    const existingKPIs = records.filter(r => r.section === filterSection).map(r => r.kpiName);
    return Array.from(new Set([...definedKPIs, ...existingKPIs])).sort();
  }, [filterSection, definitions, records]);

  const availableDepts = useMemo(() => {
    if (!filterSection) return [];
    const deptRecords = records.filter(r => r.section === filterSection);
    return Array.from(new Set(deptRecords.map(r => r.department))).sort();
  }, [filterSection, records]);

  // Helper to get dropdown options for a specific row in the batch table
  const getScopedKPIs = (section: string | undefined) => {
     if (!section) return [];
     const definedKPIs = definitions.filter(d => d.section === section).map(d => d.kpiName);
     const existingKPIs = records.filter(r => r.section === section).map(r => r.kpiName);
     return Array.from(new Set([...definedKPIs, ...existingKPIs])).sort();
  };
  
  const getScopedDepts = (section: string | undefined) => {
      if (!section) return [];
      const depts = records.filter(r => r.section === section).map(r => r.department);
      return Array.from(new Set(depts)).sort();
  }

  // Reset form when modal opens
  useEffect(() => {
    if (isModalOpen) {
        if (!isEditMode) {
            setBatchQueue([{ 
                ...defaultRecord, 
                section: (filterSection as SectionName) || SectionName.ADMITTING,
                id: `new-${Date.now()}`
            }]);
        }
    }
  }, [isModalOpen, isEditMode]);


  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getMeasureTypeDisplay = (record: KPIRecord | Partial<KPIRecord>) => {
    if (record.kpiType === 'PERCENTAGE') return '-';
    if (record.timeUnit?.toLowerCase().includes('day')) return 'Day';
    return 'Time';
  };

  const filteredRecords = useMemo(() => {
    if (!filterSection) return [];

    let sortableItems = records.filter(r => {
      const matchesSection = r.section === filterSection;
      const matchesKPI = filterKPI ? r.kpiName === filterKPI : true;
      const matchesDept = filterDept ? r.department === filterDept : true;
      const matchesSearch = searchTerm 
        ? r.kpiName.toLowerCase().includes(searchTerm.toLowerCase()) || 
          r.department.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesSection && matchesKPI && matchesDept && matchesSearch;
    });

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // @ts-ignore dynamic key access
        let aValue = a[sortConfig.key];
        // @ts-ignore
        let bValue = b[sortConfig.key];
        
        if (sortConfig.key === 'conformance') {
            aValue = dataService.isConformant(a) ? 1 : 0;
            bValue = dataService.isConformant(b) ? 1 : 0;
        }
        if (sortConfig.key === 'measureType') {
            // @ts-ignore
            aValue = getMeasureTypeDisplay(a);
            // @ts-ignore
            bValue = getMeasureTypeDisplay(b);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [records, filterSection, filterKPI, filterDept, searchTerm, sortConfig]);

  const handleExport = () => {
    if (!filterSection) {
        alert("Please select a section to export data.");
        return;
    }
    const headers = ["Section", "KPI", "Department", "Type", "Month", "Census", "Target Time", "Actual Time", "Target %", "Actual %", "Submitted", "Due Date"];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r => [
        `"${r.section}"`, `"${r.kpiName}"`, `"${r.department}"`, getMeasureTypeDisplay(r), r.month, r.census, r.targetTime, r.actualTime, r.targetPct, r.actualPct, r.dateSubmitted, r.dueDate
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kpi_records_${filterSection}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const onAddClick = () => {
    if (!isAuthenticated) {
      setPendingAction('add');
      setIsLoginOpen(true);
    } else {
      setIsEditMode(false);
      setIsModalOpen(true);
    }
  };

  const onEditClick = (record: KPIRecord) => {
    if (!isAuthenticated) {
        setPendingAction('edit');
        setPendingRecordId(record.id);
        setIsLoginOpen(true);
      } else {
        setIsEditMode(true);
        setCurrentEntry({...record});
        setIsModalOpen(true);
      }
  };

  const onDeleteClick = async (id: string) => {
    if (!isAuthenticated) {
        setPendingAction('delete');
        setPendingRecordId(id);
        setIsLoginOpen(true);
    } else {
        if (window.confirm("Are you sure you want to delete this record?")) {
            setLoading(true);
            try {
                await dataService.deleteRecord(id);
                setTimeout(onRefresh, 1000);
            } catch (e: any) {
                alert('Delete failed: ' + (e.message || JSON.stringify(e)));
            } finally {
                setLoading(false);
            }
        }
    }
  };

  const handleLoginSuccess = async () => {
      setIsAuthenticated(true);
      setIsLoginOpen(false);
      
      if (pendingAction === 'add') {
          setIsEditMode(false);
          setIsModalOpen(true);
      } else if (pendingAction === 'edit' && pendingRecordId) {
          const record = records.find(r => r.id === pendingRecordId);
          if (record) {
              setIsEditMode(true);
              setCurrentEntry({...record});
              setIsModalOpen(true);
          }
      } else if (pendingAction === 'delete' && pendingRecordId) {
          onDeleteClick(pendingRecordId);
      } else if (pendingAction === 'openSheet') {
        window.open(GOOGLE_SHEET_URL, '_blank');
      }

      setPendingAction(null);
      setPendingRecordId(null);
  };
  
  const handleOpenSheetClick = () => {
    if (!isAuthenticated) {
      setPendingAction('openSheet');
      setIsLoginOpen(true);
    } else {
      window.open(GOOGLE_SHEET_URL, '_blank');
    }
  };

  // --- Spreadsheet Logic ---
  const handleRowChange = (index: number, field: keyof BatchRow, value: any) => {
      const newQueue = [...batchQueue];
      const currentRow = { ...newQueue[index], [field]: value };
      
      // If Section changes, reset KPI and Dept
      if (field === 'section') {
          currentRow.kpiName = '';
          currentRow.department = '';
          currentRow.isNewKpi = false;
          currentRow.isNewDept = false;
      }

      // Handle "Create New" selection
      if (field === 'kpiName' && value === 'CREATE_NEW') {
          currentRow.isNewKpi = true;
          currentRow.kpiName = ''; // Clear it for text input
      } else if (field === 'kpiName' && currentRow.isNewKpi) {
          // Do nothing, let user type
      } else if (field === 'kpiName') {
          currentRow.isNewKpi = false;
          // Prefill logic
          const definition = definitions.find(d => d.kpiName === value && d.section === currentRow.section);
          if (definition && definition.target) {
              const parsedTarget = parseKPITarget(definition.target);
              Object.assign(currentRow, parsedTarget);
          }
      }

      if (field === 'department' && value === 'CREATE_NEW') {
          currentRow.isNewDept = true;
          currentRow.department = ''; // Clear it for text input
      } else if (field === 'department') {
          currentRow.isNewDept = false;
      }

      newQueue[index] = currentRow;
      setBatchQueue(newQueue);
  };

  const addNewRow = () => {
      const lastRow = batchQueue[batchQueue.length - 1];
      const newRow = {
          ...defaultRecord,
          section: lastRow?.section || defaultRecord.section,
          month: lastRow?.month || defaultRecord.month,
          dueDate: lastRow?.dueDate || defaultRecord.dueDate,
          dateSubmitted: lastRow?.dateSubmitted || defaultRecord.dateSubmitted,
          id: `new-${Date.now()}`
      };
      setBatchQueue([...batchQueue, newRow]);
  };

  const duplicateRow = (index: number) => {
      const rowToCopy = batchQueue[index];
      const newRow = { ...rowToCopy, id: `copy-${Date.now()}` };
      const newQueue = [...batchQueue];
      newQueue.splice(index + 1, 0, newRow);
      setBatchQueue(newQueue);
  };

  const removeRow = (index: number) => {
      if (batchQueue.length === 1) {
          alert("Cannot remove the last row.");
          return;
      }
      const newQueue = [...batchQueue];
      newQueue.splice(index, 1);
      setBatchQueue(newQueue);
  };

  const handleSaveBatch = async () => {
      // Validate
      const invalidRow = batchQueue.findIndex(r => !r.section || !r.kpiName || !r.department);
      if (invalidRow >= 0) {
          alert(`Row ${invalidRow + 1} is missing required fields (Section, KPI, or Department).`);
          return;
      }

      setLoading(true);
      try {
        const promises = batchQueue.map(record => dataService.addRecord(record as KPIRecord));
        await Promise.all(promises);
        
        setTimeout(() => {
             onRefresh();
             setLoading(false);
             setIsModalOpen(false);
             setBatchQueue([]);
        }, 1500);
        
      } catch (e: any) {
          console.error(e);
          alert('Save failed: ' + (e.message || JSON.stringify(e)));
          setLoading(false);
      }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
      e.preventDefault();
      if (currentEntry.id) {
        setLoading(true);
        try {
            await dataService.updateRecord(currentEntry as KPIRecord);
            setTimeout(() => {
                onRefresh();
                setLoading(false);
                setIsModalOpen(false);
            }, 1000);
        } catch (e: any) {
            console.error(e);
            alert('Update failed: ' + (e.message || JSON.stringify(e)));
            setLoading(false);
        }
      }
  };

  const renderSortIcon = (key: string) => {
      if (!sortConfig || sortConfig.key !== key) return null;
      return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
       {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-2 w-full flex-1">
          <select 
            className="border rounded-md px-3 py-2 text-sm bg-white focus:ring-osmak-500 focus:border-osmak-500 min-w-[200px]"
            value={filterSection}
            onChange={(e) => {
                setFilterSection(e.target.value);
                setFilterKPI('');
                setFilterDept('');
            }}
          >
            <option value="">Select Section to View Records</option>
            {Object.values(SectionName).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          {filterSection && (
            <>
                <select 
                    className="border rounded-md px-3 py-2 text-sm bg-white focus:ring-osmak-500 focus:border-osmak-500 min-w-[150px]"
                    value={filterKPI}
                    onChange={(e) => setFilterKPI(e.target.value)}
                >
                    <option value="">All KPIs</option>
                    {availableKPIs.map(k => <option key={k} value={k}>{k}</option>)}
                </select>

                 <select 
                    className="border rounded-md px-3 py-2 text-sm bg-white focus:ring-osmak-500 focus:border-osmak-500 min-w-[150px]"
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                >
                    <option value="">All Departments</option>
                    {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
            </>
          )}

          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:ring-osmak-500 focus:border-osmak-500 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
           <button onClick={handleOpenSheetClick} className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-md text-sm hover:bg-green-200 transition-colors whitespace-nowrap">
            <Sheet className="w-4 h-4" />
            Open Sheet
          </button>
          <button disabled={loading} onClick={onAddClick} className="flex items-center gap-2 bg-osmak-600 text-white px-4 py-2 rounded-md text-sm hover:bg-osmak-700 transition-colors disabled:opacity-50 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200 transition-colors whitespace-nowrap">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">KPI Records Database</h3>
            <span className="text-xs font-semibold text-osmak-700 bg-osmak-50 px-2 py-1 rounded-full border border-osmak-100">
                Visible Records: {filteredRecords.length}
            </span>
        </div>
        
        {!filterSection ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-gray-50 min-h-[300px]">
                <Database className="w-12 h-12 mb-4 opacity-50"/>
                <p className="text-lg font-medium">No Section Selected</p>
                <p className="text-sm">Please select a section from the dropdown above to load records.</p>
            </div>
        ) : (
            <div className="overflow-auto custom-scrollbar max-h-[550px]">
            <table className="min-w-full divide-y divide-gray-200 relative">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('section')}>Section {renderSortIcon('section')}</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('kpiName')}>KPI {renderSortIcon('kpiName')}</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('department')}>Type/Dept {renderSortIcon('department')}</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('measureType')}>Type {renderSortIcon('measureType')}</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target (Time)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual (Time)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target (%)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Actual (%)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('conformance')}>Status {renderSortIcon('conformance')}</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('month')}>Date {renderSortIcon('month')}</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {filteredRecords.map((record) => {
                    const isPass = dataService.isConformant(record);
                    const measureType = getMeasureTypeDisplay(record);
                    const actualTimeDisplay = record.actualTime !== undefined && record.actualTime !== null && !isNaN(Number(record.actualTime)) ? Number(record.actualTime).toFixed(2) : '-';
                    const actualPctDisplay = record.actualPct !== undefined && record.actualPct !== null && !isNaN(Number(record.actualPct)) ? Number(record.actualPct).toFixed(2) : '0.00';
                    
                    return (
                    <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-gray-900">{record.section}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 max-w-xs truncate" title={record.kpiName}>{record.kpiName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{record.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs font-semibold">{measureType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{record.kpiType === 'TIME' ? `${record.targetTime} ${record.timeUnit}` : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-700">{record.kpiType === 'TIME' ? `${actualTimeDisplay} ${record.timeUnit}` : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{record.targetPct}%</td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-700">
                            <div className="relative w-full h-8 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                                <div className={`absolute top-0 left-0 h-full transition-all duration-500 ${isPass ? 'bg-osmak-400' : 'bg-red-400'}`} style={{ width: `${Math.min(Number(actualPctDisplay), 100)}%` }}></div>
                                <span className="absolute inset-0 flex items-center justify-center text-xs z-10 font-bold text-gray-800 drop-shadow-sm">{actualPctDisplay}%</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{isPass ? 'Conformant' : 'Non-Conformant'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{record.month}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => onEditClick(record)} className="text-indigo-600 hover:text-indigo-900"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => onDeleteClick(record.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-start gap-3 text-sm text-gray-600">
          <Info className="w-5 h-5 text-osmak-600 mt-0.5 shrink-0" />
          <div className="space-y-2">
              <p className="font-bold text-gray-800">Legend & Definitions:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></div><span><span className="font-semibold">Conformant:</span> Record met or exceeded the Target.</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></div><span><span className="font-semibold">Non-Conformant:</span> Record failed to meet the Target.</span></div>
              </div>
          </div>
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={handleLoginSuccess} />

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className={`bg-white rounded-lg w-full ${isEditMode ? 'max-w-2xl' : 'max-w-[95vw]'} max-h-[90vh] flex flex-col shadow-2xl overflow-hidden`}>
                
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                         {isEditMode ? <Edit2 className="w-5 h-5 text-osmak-600"/> : <ListPlus className="w-5 h-5 text-osmak-600"/>}
                         <h3 className="text-lg font-bold text-gray-900">{isEditMode ? 'Edit Single Record' : 'Batch Data Entry'}</h3>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1"><X className="w-6 h-6"/></button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-auto bg-white">
                    {isEditMode ? (
                        // ----------------- EDIT MODE (Single Form) -----------------
                        <form onSubmit={handleUpdateRecord} className="p-6 space-y-6">
                           {/* ... Edit form ... */}
                        </form>
                    ) : (
                        // ----------------- ADD MODE (Spreadsheet Table) -----------------
                        <div className="min-h-[400px]">
                            <div className="overflow-x-auto">
                                <table className="min-w-max divide-y divide-gray-200 border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-40">Section</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-48">KPI Name</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-40">Dept/Type</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-32">Month</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-20">Census</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-20 bg-blue-50/50">Tgt %</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-20 bg-green-50/50">Act %</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-20 bg-gray-50">Type</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-20 bg-gray-50">Tgt Time</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-20 bg-gray-50">Act Time</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-24 bg-gray-50">Unit</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-32">Due</th>
                                            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase w-32">Submit</th>
                                            <th className="px-2 py-3 text-center text-xs font-bold text-gray-600 uppercase w-16 sticky right-0 bg-gray-100 shadow-l">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {batchQueue.map((row, index) => (
                                            <tr key={row.id || index} className="group hover:bg-gray-50">
                                                <td className="p-1 border-r border-gray-100">
                                                    <select 
                                                        className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-gray-900"
                                                        value={row.section}
                                                        onChange={e => handleRowChange(index, 'section', e.target.value)}
                                                    >
                                                        {Object.values(SectionName).map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-1 border-r border-gray-100">
                                                    {row.isNewKpi ? (
                                                        <input 
                                                            type="text" 
                                                            autoFocus
                                                            className="w-full text-xs border-0 bg-yellow-50 p-1 ring-2 ring-osmak-500 rounded text-gray-900"
                                                            value={row.kpiName}
                                                            onChange={e => handleRowChange(index, 'kpiName', e.target.value)}
                                                            onBlur={() => { if (!row.kpiName) handleRowChange(index, 'isNewKpi', false) }}
                                                        />
                                                    ) : (
                                                        <select 
                                                            className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-gray-900"
                                                            value={row.kpiName}
                                                            onChange={e => handleRowChange(index, 'kpiName', e.target.value)}
                                                        >
                                                            <option value="">Select...</option>
                                                            {getScopedKPIs(row.section).map(k => <option key={k} value={k}>{k}</option>)}
                                                            <option value="CREATE_NEW" className="font-bold text-blue-600 bg-gray-100">+ Create New</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="p-1 border-r border-gray-100">
                                                     {row.isNewDept ? (
                                                        <input 
                                                            type="text" 
                                                            autoFocus
                                                            className="w-full text-xs border-0 bg-yellow-50 p-1 ring-2 ring-osmak-500 rounded text-gray-900"
                                                            value={row.department}
                                                            onChange={e => handleRowChange(index, 'department', e.target.value)}
                                                            onBlur={() => { if (!row.department) handleRowChange(index, 'isNewDept', false) }}
                                                        />
                                                    ) : (
                                                        <select 
                                                            className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-gray-900"
                                                            value={row.department}
                                                            onChange={e => handleRowChange(index, 'department', e.target.value)}
                                                        >
                                                            <option value="">Select...</option>
                                                            {getScopedDepts(row.section).map(d => <option key={d} value={d}>{d}</option>)}
                                                            <option value="CREATE_NEW" className="font-bold text-blue-600 bg-gray-100">+ Create New</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="p-1 border-r border-gray-100">
                                                    <input 
                                                        type="month" 
                                                        className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-gray-900" 
                                                        value={row.month ? row.month.slice(0, 7) : ''} 
                                                        onChange={e => handleRowChange(index, 'month', e.target.value ? `${e.target.value}-01` : '')} 
                                                    />
                                                </td>
                                                <td className="p-1 border-r border-gray-100">
                                                    <input type="number" placeholder="-" className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-right text-gray-900" value={row.census ?? ''} onChange={e => handleRowChange(index, 'census', e.target.value)} />
                                                </td>
                                                <td className="p-1 border-r border-gray-100 bg-blue-50/20">
                                                    <input type="number" placeholder="%" className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-right font-medium text-blue-800" value={row.targetPct ?? ''} onChange={e => handleRowChange(index, 'targetPct', e.target.value)} />
                                                </td>
                                                <td className="p-1 border-r border-gray-100 bg-green-50/20">
                                                    <input type="number" placeholder="%" className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-right font-bold text-green-800" value={row.actualPct ?? ''} onChange={e => handleRowChange(index, 'actualPct', e.target.value)} />
                                                </td>
                                                <td className="p-1 border-r border-gray-100 bg-gray-50/50">
                                                    <select className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-gray-900" value={row.kpiType} onChange={e => handleRowChange(index, 'kpiType', e.target.value)}>
                                                        <option value="PERCENTAGE">%</option><option value="TIME">Time</option>
                                                    </select>
                                                </td>
                                                <td className="p-1 border-r border-gray-100 bg-gray-50/50">
                                                    <input disabled={row.kpiType !== 'TIME'} type="number" className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-right disabled:opacity-30 text-gray-900" value={row.targetTime ?? ''} onChange={e => handleRowChange(index, 'targetTime', e.target.value)} />
                                                </td>
                                                <td className="p-1 border-r border-gray-100 bg-gray-50/50">
                                                    <input disabled={row.kpiType !== 'TIME'} type="number" className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-right disabled:opacity-30 text-gray-900" value={row.actualTime ?? ''} onChange={e => handleRowChange(index, 'actualTime', e.target.value)} />
                                                </td>
                                                <td className="p-1 border-r border-gray-100 bg-gray-50/50">
                                                    <select
                                                        disabled={row.kpiType !== 'TIME'}
                                                        className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded disabled:opacity-30 text-gray-900"
                                                        value={row.timeUnit || 'Mins'}
                                                        onChange={e => handleRowChange(index, 'timeUnit', e.target.value)}
                                                    >
                                                        <option>Mins</option>
                                                        <option>Hours</option>
                                                        <option>Days</option>
                                                    </select>
                                                </td>
                                                <td className="p-1 border-r border-gray-100">
                                                    <input type="date" className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-gray-900" value={row.dueDate} onChange={e => handleRowChange(index, 'dueDate', e.target.value)} />
                                                </td>
                                                <td className="p-1 border-r border-gray-100">
                                                    <input type="date" className="w-full text-xs border-0 bg-transparent p-1 focus:ring-2 focus:ring-osmak-500 rounded text-gray-900" value={row.dateSubmitted} onChange={e => handleRowChange(index, 'dateSubmitted', e.target.value)} />
                                                </td>
                                                <td className="p-1 text-center sticky right-0 bg-white group-hover:bg-gray-50 shadow-l border-l border-gray-100">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => duplicateRow(index)} className="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Duplicate Row"><Copy className="w-3 h-3"/></button>
                                                        <button onClick={() => removeRow(index)} className="p-1 text-red-500 hover:bg-red-100 rounded" title="Remove Row"><X className="w-3 h-3"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-center">
                                <button onClick={addNewRow} className="flex items-center gap-2 text-osmak-700 hover:bg-white hover:shadow-sm px-4 py-2 rounded-full transition-all border border-transparent hover:border-gray-200">
                                    <Plus className="w-4 h-4" /> Add Row
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white p-6 border-t border-gray-200 flex justify-between items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={isEditMode ? handleUpdateRecord : handleSaveBatch}
                        disabled={loading || (!isEditMode && batchQueue.length === 0)}
                        className={`inline-flex items-center justify-center py-2 px-8 border border-transparent shadow-md text-sm font-bold rounded-md text-white transition-all
                            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-osmak-600 hover:bg-osmak-700 hover:shadow-lg transform hover:-translate-y-0.5'}`}
                    >
                        {loading ? 'Saving...' : (isEditMode ? 'Update Record' : `Save ${batchQueue.length} Records`)}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Records;