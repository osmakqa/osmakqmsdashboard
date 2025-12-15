
import React, { useState, useEffect, useMemo } from 'react';
import { KPIRecord, SectionName, KPIType, KPIDefinition } from '../types';
import { dataService } from '../services/dataService';
import { Download, Plus, Search, Edit2, ArrowUp, ArrowDown, X, Save, Trash2, ListPlus, Database, Info, Copy, Sheet, Calendar, Target, CheckCircle, AlertTriangle, Eraser, PenTool, Lock, FileCheck, CheckSquare, Loader } from 'lucide-react';
import LoginModal from './LoginModal';
import { GOOGLE_SHEET_URL } from '../constants';

interface RecordsProps {
  records: KPIRecord[]; // Official/Approved records
  drafts: KPIRecord[];  // Draft records from server
  definitions: KPIDefinition[];
  onRefresh: () => void;
}

// Helper to aggregate records by quarter (duplicate from KPITrend for now, could be moved to utils)
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

    const aggregatedRecord: KPIRecord = {
      ...templateRecord,
      id: `agg-${quarterKey}-${templateRecord.section}-${templateRecord.kpiName}-${templateRecord.department || 'na'}`,
      month: firstMonthOfQuarter,
      census: totalCensus,
      targetTime: countTime > 0 ? sumTargetTime / countTime : undefined,
      actualTime: countTime > 0 ? sumActualTime / countTime : undefined,
      targetPct: countPct > 0 ? sumTargetPct / countPct : 0, // Default 0 for percentage if no records
      actualPct: countPct > 0 ? sumActualPct / countPct : 0, // Default 0 for percentage if no records
      remarks: `Aggregated for ${quarterKey}`,
      status: 'APPROVED', // Assuming input records are approved.
      // Retain timeUnit and kpiType from template, assuming consistency.
    };
    return aggregatedRecord;
  }).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()); // Sort aggregated data
};


const Records: React.FC<RecordsProps> = ({ records, drafts, definitions, onRefresh }) => {
  
  // Filters
  const [filterSection, setFilterSection] = useState<string>('');
  const [filterKPI, setFilterKPI] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewPeriod, setViewPeriod] = useState<'monthly' | 'quarterly'>('monthly'); // New state
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof KPIRecord | string; direction: 'asc' | 'desc' } | null>(null);

  // Auth state
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // New state to track if logged in with master key
  const [pendingAction, setPendingAction] = useState<'add' | 'edit' | 'delete' | 'openSheet' | 'approveAll' | 'checkEntries' | null>(null);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  
  // NEW: Section Selector State (Before Login)
  const [isSectionSelectorOpen, setIsSectionSelectorOpen] = useState(false);
  const [targetSectionForLogin, setTargetSectionForLogin] = useState<string | undefined>(undefined);

  // Add/Edit Entry Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // REVIEW / HOLD STATE
  // "drafts" prop replaces local heldEntries state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);

  // ENTRY STATE
  const [selectedAddSection, setSelectedAddSection] = useState<string>(SectionName.ADMITTING);
  
  // Current Line Item State
  const [currentLineItem, setCurrentLineItem] = useState<Partial<KPIRecord>>({});
  
  // Batch Queue (Local before sending to server as Draft)
  const [batchQueue, setBatchQueue] = useState<KPIRecord[]>([]);

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

  // Add Entry Helpers
  const scopedKPIsForAdd = useMemo(() => {
      if (!selectedAddSection) return [];
      // Combine KPIs from definitions AND existing records for that section
      // This ensures legacy KPIs or ad-hoc KPIs are also selectable
      const definedKPIs = definitions
        .filter(d => d.section === selectedAddSection)
        .map(d => d.kpiName);
        
      const existingRecordKPIs = records
        .filter(r => r.section === selectedAddSection)
        .map(r => r.kpiName);

      return Array.from(new Set([...definedKPIs, ...existingRecordKPIs])).sort();
  }, [selectedAddSection, definitions, records]);

  const scopedDeptsForAdd = useMemo(() => {
      if (!selectedAddSection) return [];
      
      let filteredRecords = records.filter(r => r.section === selectedAddSection);
      
      // If a KPI is selected, restrict departments to that KPI only
      if (currentLineItem.kpiName) {
          filteredRecords = filteredRecords.filter(r => r.kpiName === currentLineItem.kpiName);
      }
      
      const depts = filteredRecords.map(r => r.department).filter(Boolean);
      return Array.from(new Set(depts)).sort();
  }, [selectedAddSection, currentLineItem.kpiName, records]);


  // Initialize Line Item
  const resetLineItem = () => {
      setCurrentLineItem({
          kpiName: '',
          department: '',
          // Default to current month
          month: new Date().toISOString().slice(0, 7),
          census: undefined,
          targetPct: undefined,
          actualPct: undefined,
          targetTime: undefined,
          actualTime: undefined,
          timeUnit: 'Mins',
          kpiType: 'PERCENTAGE',
          dueDate: new Date().toISOString().slice(0, 10),
          dateSubmitted: new Date().toISOString().slice(0, 10),
          status: 'DRAFT'
      });
  };

  // --- LOGIC: Handle KPI Selection ---
  const handleKPISelect = (kpiName: string) => {
      // 1. Try to find Definition first
      const def = definitions.find(d => d.section === selectedAddSection && d.kpiName === kpiName);
      
      let update: Partial<KPIRecord> = { 
          kpiName,
          targetPct: undefined,
          targetTime: undefined,
          timeUnit: undefined,
          kpiType: 'PERCENTAGE',
          department: '' // Reset dept initially
      };
      
      if (def) {
          // Priority: Map DIRECTLY from definition columns
          if (def.targetPct !== undefined && def.targetPct !== null) {
              update.targetPct = def.targetPct;
          }
          if (def.targetTime !== undefined && def.targetTime !== null) {
              update.targetTime = def.targetTime;
              update.timeUnit = def.timeUnit || 'Mins';
          }

          // Infer Type based on presence of targets
          const hasTime = update.targetTime !== undefined;
          const hasPct = update.targetPct !== undefined;
          
          if (hasTime && hasPct) {
               update.kpiType = 'TIME'; // Default logical type, but UI shows both
          } else if (hasTime) {
               update.kpiType = 'TIME';
          } else {
               update.kpiType = 'PERCENTAGE';
          }

          // Auto-fill Department & KPI Type from Definition if available
          if (def.department) {
              update.department = def.department;
          }
          if (def.kpiType) {
              update.kpiType = def.kpiType;
          }

      } else {
          // 2. Fallback: Try to learn from most recent record for this KPI
          const recentRecord = records
            .filter(r => r.section === selectedAddSection && r.kpiName === kpiName)
            .sort((a,b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0];
            
          if (recentRecord) {
              update = {
                  ...update,
                  kpiType: recentRecord.kpiType,
                  targetPct: recentRecord.targetPct,
                  targetTime: recentRecord.targetTime,
                  timeUnit: recentRecord.timeUnit,
                  department: recentRecord.department // Learn department too
              };
          } else {
             // 3. Default if completely new
             update = { ...update, targetPct: 0, targetTime: undefined, timeUnit: 'Mins' };
          }
      }

      setCurrentLineItem(prev => ({ ...prev, ...update }));
  };
  
  const handleClearForm = () => {
      resetLineItem();
  };

  // Auto-Select First KPI when Section Changes
  useEffect(() => {
      if (isModalOpen && !isEditMode && scopedKPIsForAdd.length > 0) {
          // Only auto-select if current selection is empty or invalid for the new section
          if (!currentLineItem.kpiName || !scopedKPIsForAdd.includes(currentLineItem.kpiName)) {
              handleKPISelect(scopedKPIsForAdd[0]);
          }
      }
  }, [selectedAddSection, scopedKPIsForAdd, isModalOpen, isEditMode]);


  // When Modal Opens
  useEffect(() => {
    if (isModalOpen && !isEditMode && editDraftId === null) {
        setBatchQueue([]);
        resetLineItem();
        // Section is already set via the pre-login selector
    }
  }, [isModalOpen, isEditMode, editDraftId]);


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

  const filteredMonthlyRecords = useMemo(() => {
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

    return sortableItems;
  }, [records, filterSection, filterKPI, filterDept, searchTerm]);

  const displayedRecords = useMemo(() => {
    let data = filteredMonthlyRecords;
    if (viewPeriod === 'quarterly') {
        data = aggregateRecordsByQuarter(filteredMonthlyRecords);
    }

    if (sortConfig !== null) {
      data.sort((a, b) => {
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
        if (sortConfig.key === 'month') {
            aValue = new Date(a.month).getTime();
            bValue = new Date(b.month).getTime();
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
    return data;
  }, [filteredMonthlyRecords, viewPeriod, sortConfig]);


  const handleExport = () => {
    if (!filterSection) {
        alert("Please select a section to export data.");
        return;
    }
    
    // Use displayedRecords for export
    const headers = ["Section", "KPI", "Department", "Type", "Period", "Census", "Target Time", "Actual Time", "Target %", "Actual %", "Submitted", "Due Date"];
    const csvContent = [
      headers.join(','),
      ...displayedRecords.map(r => {
        const periodDisplay = viewPeriod === 'quarterly' 
            ? `${new Date(r.month).getFullYear()}-Q${Math.floor(new Date(r.month).getMonth() / 3) + 1}`
            : r.month;

        return [
          `"${r.section}"`, 
          `"${r.kpiName}"`, 
          `"${r.department}"`, 
          getMeasureTypeDisplay(r), 
          periodDisplay, 
          r.census, 
          r.targetTime, 
          r.actualTime, 
          r.targetPct, 
          r.actualPct, 
          r.dateSubmitted, 
          r.dueDate
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kpi_records_${filterSection}_${viewPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const onAddClick = () => {
      // Direct access to section selector
      setIsSectionSelectorOpen(true);
  };

  const onEditClick = (record: KPIRecord) => {
    if (!isAuthenticated) {
        setPendingAction('edit');
        setPendingRecordId(record.id);
        // We know the section from the record
        setTargetSectionForLogin(record.section);
        setIsLoginOpen(true);
      } else {
        setEditDraftId(null);
        setIsEditMode(true);
        // Ensure the record's month is set correctly for the input
        const recordMonth = record.month.slice(0, 7);
        setCurrentLineItem({...record, month: recordMonth}); 
        setIsModalOpen(true);
      }
  };

  const onDeleteClick = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (!isAuthenticated) {
        setPendingAction('delete');
        setPendingRecordId(id);
        if (record) setTargetSectionForLogin(record.section);
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

  // --- REVIEW / HELD ENTRY ACTIONS ---

  const onEditHeld = (draftId: string) => {
      const record = drafts.find(d => d.id === draftId);
      if (!record) return;

      setEditDraftId(draftId);
      setIsEditMode(true);
      setSelectedAddSection(record.section); // Ensure correct dropdown scope
      const recordMonth = record.month.slice(0, 7);
      setCurrentLineItem({...record, month: recordMonth});
      setIsReviewOpen(false);
      setIsModalOpen(true);
  };

  const onDeleteHeld = async (draftId: string) => {
      if (window.confirm("Remove this entry from the review queue?")) {
          setLoading(true);
          try {
              await dataService.deleteRecord(draftId);
              setTimeout(() => {
                  onRefresh();
                  setLoading(false);
              }, 1000);
          } catch (e: any) {
              alert('Delete failed: ' + (e.message || JSON.stringify(e)));
              setLoading(false);
          }
      }
  };

  const handleQueueBatch = async () => {
    // Moves local batch items to server as DRAFT
    let entriesToQueue = [...batchQueue];
    
    // If batch is empty but user filled the form, auto-add current item
    if (entriesToQueue.length === 0 && currentLineItem.kpiName && (currentLineItem.actualPct !== undefined || currentLineItem.actualTime !== undefined)) {
        const newRecord: KPIRecord = {
          id: `draft-${Date.now()}`,
          section: selectedAddSection as SectionName,
          month: `${currentLineItem.month}-01`, 
          dueDate: currentLineItem.dueDate || new Date().toISOString().slice(0, 10),
          dateSubmitted: new Date().toISOString().slice(0, 10),
          kpiName: currentLineItem.kpiName,
          department: currentLineItem.department || '',
          kpiType: currentLineItem.kpiType || 'PERCENTAGE',
          census: Number(currentLineItem.census) || 0,
          targetPct: Number(currentLineItem.targetPct) || 0,
          actualPct: Number(currentLineItem.actualPct) || 0,
          targetTime: currentLineItem.targetTime ? Number(currentLineItem.targetTime) : undefined,
          actualTime: currentLineItem.actualTime ? Number(currentLineItem.actualTime) : undefined,
          timeUnit: currentLineItem.timeUnit || 'Mins',
          remarks: currentLineItem.remarks,
          status: 'DRAFT'
        };
        entriesToQueue.push(newRecord);
    } else if (entriesToQueue.length === 0) {
        alert("Please add entries to the list or fill out the form.");
        return;
    }

    setLoading(true);
    try {
        const promises = entriesToQueue.map(record => {
            const { id, ...payload } = record;
            // Ensure status is DRAFT
            return dataService.addRecord({ ...payload, status: 'DRAFT' } as any);
        });
        
        await Promise.all(promises);
        
        setBatchQueue([]);
        resetLineItem();
        setIsModalOpen(false);
        
        // Refresh to fetch the new drafts
        setTimeout(() => {
            onRefresh();
            setLoading(false);
            alert(`${entriesToQueue.length} entries added to Review Queue (Saved to Cloud). Click "Check Entries" to finalize.`);
        }, 1500);

    } catch (e: any) {
        console.error(e);
        alert('Queue failed: ' + (e.message || JSON.stringify(e)));
        setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    // Strict Auth Check: Must be Admin to approve
    if (!isAdmin) {
        setPendingAction('approveAll');
        setIsReviewOpen(false);
        setTargetSectionForLogin(undefined); // Force admin login
        setIsLoginOpen(true);
        return;
    }

    if (drafts.length === 0) return;
    
    setLoading(true);
    try {
        const promises = drafts.map(record => {
            const updatedRecord = { ...record, status: 'APPROVED' };
            // Strip kpiType if needed, but dataService handles it mostly. 
            // We use updateRecord to just flip the status
            const { kpiType, ...payload } = updatedRecord;
            return dataService.updateRecord(payload as any);
        });
        await Promise.all(promises);
        
        setTimeout(() => {
             onRefresh();
             setLoading(false);
             setIsReviewOpen(false);
             alert("All entries approved and published successfully!");
        }, 1500);
        
    } catch (e: any) {
          console.error(e);
          alert('Save failed: ' + (e.message || JSON.stringify(e)));
          setLoading(false);
    }
  };


  const handleSectionSelectionNext = () => {
    // Force Login before allowing adding entries
    setIsSectionSelectorOpen(false);
    
    // Set target section for login validation (enforces section specific password)
    setTargetSectionForLogin(selectedAddSection);
    setPendingAction('add');
    
    setIsLoginOpen(true);
  };

  const handleLoginSuccess = async (isMasterLogin: boolean) => {
      setIsAuthenticated(true);
      if (isMasterLogin) {
          setIsAdmin(true);
      }
      setIsLoginOpen(false);
      
      if (pendingAction === 'add') {
          setEditDraftId(null);
          setIsEditMode(false);
          // Note: selectedAddSection is preserved in state
          setIsModalOpen(true);
      } else if (pendingAction === 'edit' && pendingRecordId) {
          const record = records.find(r => r.id === pendingRecordId);
          if (record) {
              setEditDraftId(null);
              setIsEditMode(true);
              const recordMonth = record.month.slice(0, 7);
              setCurrentLineItem({...record, month: recordMonth});
              setIsModalOpen(true);
          }
      } else if (pendingAction === 'delete' && pendingRecordId) {
          onDeleteClick(pendingRecordId);
      } else if (pendingAction === 'openSheet') {
        window.open(GOOGLE_SHEET_URL, '_blank');
      } else if (pendingAction === 'approveAll') {
          setIsReviewOpen(true);
      } else if (pendingAction === 'checkEntries') {
          setIsReviewOpen(true);
      }

      setPendingAction(null);
      setPendingRecordId(null);
      // We clear the target section to avoid sticking to a section context for future generic actions
      setTargetSectionForLogin(undefined);
  };
  
  const handleOpenSheetClick = () => {
    if (!isAuthenticated) {
      setPendingAction('openSheet');
      setTargetSectionForLogin(undefined); // Sheet requires admin master key, no specific section
      setIsLoginOpen(true);
    } else {
      window.open(GOOGLE_SHEET_URL, '_blank');
    }
  };

  const onCheckEntriesClick = () => {
      // Require Admin access to check entries (as per requirement: password -> osmakqa123)
      if (!isAdmin) {
          setPendingAction('checkEntries');
          // Check Entries allows viewing/approving, enforce Admin Login
          setTargetSectionForLogin(undefined);
          setIsLoginOpen(true);
      } else {
          setIsReviewOpen(true);
      }
  };

  const addToBatch = () => {
      // Validate
      if (!currentLineItem.kpiName) {
          alert("Please select a KPI Name");
          return;
      }

      const hasTime = currentLineItem.targetTime !== undefined && currentLineItem.targetTime !== null;
      const hasPct = currentLineItem.targetPct !== undefined && currentLineItem.targetPct !== null;

      // Validation logic: Ensure at least one actual value is provided matching the target
      let valid = false;
      if (hasTime && (currentLineItem.actualTime !== undefined && currentLineItem.actualTime !== null)) valid = true;
      if (hasPct && (currentLineItem.actualPct !== undefined && currentLineItem.actualPct !== null)) valid = true;
      
      if (!valid) {
          if (hasTime && hasPct) alert("Please enter at least Actual Time or Actual %");
          else if (hasTime) alert("Please enter Actual Time");
          else alert("Please enter Actual %");
          return;
      }

      const newRecord: KPIRecord = {
          id: `new-${Date.now()}`,
          section: selectedAddSection as SectionName,
          // Use the line item month
          month: `${currentLineItem.month}-01`, 
          dueDate: currentLineItem.dueDate || new Date().toISOString().slice(0, 10),
          dateSubmitted: new Date().toISOString().slice(0, 10),
          kpiName: currentLineItem.kpiName,
          department: currentLineItem.department || '',
          kpiType: currentLineItem.kpiType || 'PERCENTAGE',
          census: Number(currentLineItem.census) || 0,
          
          targetPct: Number(currentLineItem.targetPct) || 0,
          actualPct: Number(currentLineItem.actualPct) || 0,
          
          targetTime: currentLineItem.targetTime ? Number(currentLineItem.targetTime) : undefined,
          actualTime: currentLineItem.actualTime ? Number(currentLineItem.actualTime) : undefined,
          timeUnit: currentLineItem.timeUnit || 'Mins',
          remarks: currentLineItem.remarks,
          status: 'DRAFT'
      };

      setBatchQueue([...batchQueue, newRecord]);
      // Reset line item but keep the Department and Month if user wants to add another for same dept/month
      setCurrentLineItem(prev => ({
          ...prev,
          targetPct: undefined,
          actualPct: undefined,
          targetTime: undefined,
          actualTime: undefined,
          census: undefined
      }));
      if (currentLineItem.kpiName) {
          handleKPISelect(currentLineItem.kpiName);
      }
  };

  const removeFromBatch = (index: number) => {
      const newQueue = [...batchQueue];
      newQueue.splice(index, 1);
      setBatchQueue(newQueue);
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Case 1: Editing a Draft or Official Record
      // We rely on currentLineItem.id and status
      if (currentLineItem.id) {
        setLoading(true);
        try {
            const updatedRecord = {
                ...currentLineItem,
                month: `${currentLineItem.month}-01` // Ensure correct format
            } as KPIRecord;
            
            // Exclude kpiType from payload
            const { kpiType, ...payload } = updatedRecord;
            
            await dataService.updateRecord(payload as any);
            
            setTimeout(() => {
                onRefresh();
                setLoading(false);
                setIsModalOpen(false);
                
                // If it was a draft being edited from Review Screen, re-open Review Screen
                if (editDraftId) {
                    setEditDraftId(null);
                    setIsReviewOpen(true);
                }
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

  // Visibility logic for Inputs
  const showTimeInput = currentLineItem.targetTime !== undefined && currentLineItem.targetTime !== null;
  const showPctInput = currentLineItem.targetPct !== undefined && currentLineItem.targetPct !== null;
  const fallbackShowPct = !showTimeInput && !showPctInput;

  return (
    <div className="space-y-6 animate-fade-in">
       {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-2 w-full flex-1">
          <select 
            className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-osmak-500 focus:border-osmak-500 min-w-[200px]"
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
                    className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-osmak-500 focus:border-osmak-500 min-w-[150px]"
                    value={filterKPI}
                    onChange={(e) => setFilterKPI(e.target.value)}
                >
                    <option value="">All KPIs</option>
                    {availableKPIs.map(k => <option key={k} value={k}>{k}</option>)}
                </select>

                 <select 
                    className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-osmak-500 focus:border-osmak-500 min-w-[150px]"
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
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:ring-osmak-500 focus:border-osmak-500 bg-white text-gray-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
            {/* NEW: View Period Selector */}
            <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase block">AGGREGATION</label>
                <div className="flex bg-gray-100 rounded-md p-1 h-9 items-center">
                    <button
                        onClick={() => setViewPeriod('monthly')}
                        className={`px-3 py-1 text-xs rounded-sm transition-all h-full ${viewPeriod === 'monthly' ? 'bg-white shadow text-osmak-700 font-bold' : 'text-gray-500'}`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setViewPeriod('quarterly')}
                        className={`px-3 py-1 text-xs rounded-sm transition-all h-full ${viewPeriod === 'quarterly' ? 'bg-white shadow text-osmak-700 font-bold' : 'text-gray-500'}`}
                    >
                        Quarterly
                    </button>
                </div>
            </div>
           {/* Check Entries Button */}
           <div className="flex items-end">
               <button 
                  onClick={onCheckEntriesClick}
                  className="relative flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md text-sm hover:bg-indigo-100 transition-colors border border-indigo-200 h-9"
                >
                 <FileCheck className="w-4 h-4" />
                 Check Entries
                 {drafts.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                        {drafts.length}
                    </span>
                 )}
               </button>
           </div>

           <div className="flex items-end">
                <button onClick={handleOpenSheetClick} className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-md text-sm hover:bg-green-200 transition-colors whitespace-nowrap h-9">
                    <Sheet className="w-4 h-4" />
                    Open Sheet
                </button>
           </div>
          
           <div className="flex items-end">
                <button disabled={loading} onClick={onAddClick} className="flex items-center gap-2 bg-osmak-600 text-white px-4 py-2 rounded-md text-sm hover:bg-osmak-700 transition-colors disabled:opacity-50 whitespace-nowrap h-9">
                    <Plus className="w-4 h-4" />
                    Add Entry
                </button>
           </div>
           
           <div className="flex items-end">
                <button onClick={handleExport} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200 transition-colors whitespace-nowrap h-9">
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
           </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">KPI Records Database (Official - {viewPeriod === 'quarterly' ? 'Quarterly' : 'Monthly'})</h3>
            <span className="text-xs font-semibold text-osmak-700 bg-osmak-50 px-2 py-1 rounded-full border border-osmak-100">
                Visible Records: {displayedRecords.length}
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('department')}>Department {renderSortIcon('department')}</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('measureType')}>Type {renderSortIcon('measureType')}</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('conformance')}>Status {renderSortIcon('conformance')}</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('month')}>{viewPeriod === 'quarterly' ? 'Quarter' : 'Month'} {renderSortIcon('month')}</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {displayedRecords.map((record) => {
                    const isPass = dataService.isConformant(record);
                    const measureType = getMeasureTypeDisplay(record);
                    const actualTimeDisplay = record.actualTime !== undefined && record.actualTime !== null && !isNaN(Number(record.actualTime)) ? Number(record.actualTime).toFixed(2) : '-';
                    const actualPctDisplay = record.actualPct !== undefined && record.actualPct !== null && !isNaN(Number(record.actualPct)) ? Number(record.actualPct).toFixed(2) : '0.00';
                    
                    const displayTarget = record.kpiType === 'TIME' ? `${record.targetTime?.toFixed(2)} ${record.timeUnit}` : `${record.targetPct?.toFixed(2)}%`;
                    const displayActual = record.kpiType === 'TIME' ? `${actualTimeDisplay} ${record.timeUnit}` : `${actualPctDisplay}%`;

                    // Handle dual display if defined
                    const hasDual = record.targetTime && record.targetPct;
                    const finalTarget = hasDual ? `${record.targetTime?.toFixed(2)} ${record.timeUnit} | ${record.targetPct?.toFixed(2)}%` : displayTarget;
                    const finalActual = hasDual ? `${actualTimeDisplay} ${record.timeUnit} | ${actualPctDisplay}%` : displayActual;

                    const periodDisplay = viewPeriod === 'quarterly' 
                        ? `${new Date(record.month).getFullYear()}-Q${Math.floor(new Date(record.month).getMonth() / 3) + 1}`
                        : record.month;

                    return (
                    <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-gray-900">{record.section}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 max-w-xs truncate" title={record.kpiName}>{record.kpiName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{record.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs font-semibold">{measureType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{finalTarget}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-700">{finalActual}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{isPass ? 'Conformant' : 'Non-Conformant'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{periodDisplay}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                            {/* Allow editing/deleting only original monthly records for now, not aggregated ones */}
                            {viewPeriod === 'monthly' && (
                                <>
                                    <button onClick={() => onEditClick(record)} className="text-indigo-600 hover:text-indigo-900"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => onDeleteClick(record.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                                </>
                            )}
                            {viewPeriod === 'quarterly' && (
                                <span title="Edit/Delete not available for aggregated data">
                                    <Info className="w-4 h-4 text-gray-400" />
                                </span>
                            )}
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

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onLogin={handleLoginSuccess} 
        targetSection={targetSectionForLogin}
      />

      {/* SECTION SELECTOR MODAL (Pre-Login/Staging) */}
      {isSectionSelectorOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in">
             <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
                 <div className="text-center mb-6">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-osmak-100 mb-4">
                        <Lock className="h-6 w-6 text-osmak-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Select Section</h3>
                    <p className="text-sm text-gray-500 mt-1">Please identify your section to continue.</p>
                 </div>
                 
                 <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Section / Unit</label>
                        <select 
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-osmak-500 focus:border-osmak-500 py-2.5 text-sm font-medium bg-white text-gray-900"
                            value={selectedAddSection}
                            onChange={(e) => setSelectedAddSection(e.target.value)}
                        >
                            {Object.values(SectionName).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                     <div className="flex gap-2 justify-end mt-4">
                         <button 
                            onClick={() => setIsSectionSelectorOpen(false)} 
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                         >
                            Cancel
                         </button>
                         <button 
                            onClick={handleSectionSelectionNext}
                            className="px-4 py-2 text-sm text-white bg-osmak-600 hover:bg-osmak-700 rounded-md font-medium"
                         >
                            Next
                         </button>
                     </div>
                 </div>
             </div>
        </div>
      )}

      {/* REVIEW / CHECK ENTRIES MODAL */}
      {isReviewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-fade-in">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 bg-osmak-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-osmak-800 flex items-center gap-2">
                            <FileCheck className="w-6 h-6"/> Check Entries
                        </h3>
                        <p className="text-sm text-osmak-600">Review, edit, or delete entries before final approval. (Fetched from Cloud)</p>
                    </div>
                    <button onClick={() => setIsReviewOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
                </div>
                
                <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
                    {loading && (
                        <div className="flex justify-center py-10">
                            <Loader className="w-8 h-8 text-osmak-500 animate-spin" />
                        </div>
                    )}
                    
                    {!loading && drafts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <CheckSquare className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">Review Queue is Empty</p>
                            <p className="text-sm">Add entries via "Add Entry" and click "Queue for Review".</p>
                        </div>
                    ) : !loading && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                             <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Section / Dept</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Month / KPI</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Census</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actual Perf</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {drafts.map((record, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900">{record.section}</div>
                                                <div className="text-xs text-gray-500">{record.department || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900">{record.month}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-[200px]" title={record.kpiName}>{record.kpiName}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{record.census}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${dataService.isConformant(record) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {record.kpiType === 'TIME' ? `${record.actualTime} ${record.timeUnit}` : `${record.actualPct}%`}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => onEditHeld(record.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-4 h-4"/></button>
                                                    <button onClick={() => onDeleteHeld(record.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>
                    )}
                </div>

                <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                        {drafts.length} entries waiting for approval.
                    </span>
                    <div className="flex gap-3">
                         <button 
                            onClick={() => setIsReviewOpen(false)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                         >
                             Keep Editing
                         </button>
                         <button 
                            onClick={handleApproveAll}
                            disabled={loading || drafts.length === 0}
                            className="flex items-center gap-2 px-6 py-2 bg-osmak-600 text-white hover:bg-osmak-700 rounded-md text-sm font-bold shadow-md disabled:opacity-50 disabled:shadow-none transition-all"
                         >
                             {loading ? <Loader className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
                             Approve & Save All
                         </button>
                    </div>
                </div>
             </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
            <div className={`bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden`}>
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-osmak-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-osmak-800 flex items-center gap-2">
                            {isEditMode ? <Edit2 className="w-6 h-6"/> : <ListPlus className="w-6 h-6"/>}
                            {isEditMode ? (editDraftId !== null ? 'Edit Queue Entry' : 'Edit Record') : 'Add KPI Records'}
                        </h3>
                        <p className="text-sm text-osmak-600">
                            {isEditMode ? 'Modify record details' : 'Submit multiple monthly reports for a section'}
                        </p>
                    </div>
                    <button onClick={() => {
                        setIsModalOpen(false);
                        if(editDraftId !== null) { setEditDraftId(null); setIsReviewOpen(true); }
                    }} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2"><X className="w-6 h-6"/></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-white">
                    <div className="space-y-6">
                        
                        {/* 1. SECTION SELECTION (Top Bar) */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Section / Unit</label>
                                {isEditMode ? (
                                    <p className="font-bold text-osmak-800">{currentLineItem.section}</p>
                                ) : (
                                    // Locked dropdown since we selected it pre-login/pre-modal, but functionally it's a select
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-osmak-800 text-lg">{selectedAddSection}</p>
                                        <button 
                                            onClick={() => {
                                                setIsModalOpen(false);
                                                setIsAuthenticated(false); // Logout to change section if needed
                                                setIsSectionSelectorOpen(true);
                                            }}
                                            className="text-xs text-indigo-600 hover:underline"
                                        >
                                            Change Section
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. DATA ENTRY ROW */}
                        <div className="bg-white border-2 border-osmak-100 rounded-xl p-5 shadow-sm space-y-4 relative">
                            <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-osmak-600 uppercase border border-osmak-100 rounded">
                                {isEditMode ? 'Edit Details' : 'New Entry Details'}
                            </div>
                            
                            {/* NEW LAYOUT: Grouped Fields */}
                            <div className="space-y-6">
                                
                                {/* Group A: CONTEXT (KPI, Dept, Month) */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                     {/* KPI Selection (Span 5) */}
                                    <div className="md:col-span-5">
                                        <div className="flex justify-between">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">KPI Name</label>
                                            <button onClick={handleClearForm} className="text-[10px] text-gray-400 hover:text-osmak-600 flex items-center gap-1 mb-1" title="Reset Form"><Eraser className="w-3 h-3"/> Clear</button>
                                        </div>
                                        {isEditMode ? (
                                            <input type="text" disabled value={currentLineItem.kpiName} className="w-full bg-gray-100 border-gray-300 rounded text-gray-500 cursor-not-allowed"/>
                                        ) : (
                                            <select 
                                                className="w-full border-gray-300 rounded focus:ring-osmak-500 focus:border-osmak-500 py-2 text-sm text-gray-900 font-medium bg-white"
                                                value={currentLineItem.kpiName}
                                                onChange={(e) => handleKPISelect(e.target.value)}
                                            >
                                                <option value="">-- Select KPI --</option>
                                                {scopedKPIsForAdd.map(k => <option key={k} value={k}>{k}</option>)}
                                            </select>
                                        )}
                                    </div>
                                    
                                    {/* Department (Span 4) */}
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Department</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                list="dept-options"
                                                className="w-full border-gray-300 rounded focus:ring-osmak-500 focus:border-osmak-500 py-2 text-sm text-gray-900 bg-white"
                                                value={currentLineItem.department}
                                                onChange={(e) => setCurrentLineItem({...currentLineItem, department: e.target.value})}
                                                placeholder="e.g. ICU"
                                            />
                                            <datalist id="dept-options">
                                                {scopedDeptsForAdd.map(d => <option key={d} value={d} />)}
                                            </datalist>
                                        </div>
                                    </div>

                                    {/* Reporting Month (Span 3) - Moved Here */}
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Reporting Month</label>
                                        <input 
                                            type="month" 
                                            className="w-full border-gray-300 rounded focus:ring-osmak-500 focus:border-osmak-500 py-2 text-sm text-gray-900 bg-white"
                                            value={currentLineItem.month}
                                            onChange={(e) => setCurrentLineItem({...currentLineItem, month: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    
                                    {/* Group B: REFERENCE TARGETS (Left Side) */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                            <Target className="w-4 h-4"/> Reference Targets
                                        </h5>
                                        <div className="flex gap-4">
                                             {/* Target Time */}
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                                                    Target Time
                                                </label>
                                                <div className="w-full bg-white border border-gray-300 rounded py-2 px-3 text-sm font-bold text-gray-600 h-10 flex items-center">
                                                    {showTimeInput ? `${currentLineItem.targetTime} ${currentLineItem.timeUnit}` : '--'}
                                                </div>
                                            </div>

                                            {/* Target % */}
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                                                    Target %
                                                </label>
                                                <div className="w-full bg-white border border-gray-300 rounded py-2 px-3 text-sm font-bold text-gray-600 h-10 flex items-center">
                                                    {showPctInput ? `${currentLineItem.targetPct}%` : '--'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Group C: USER INPUTS (Right Side) */}
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 relative">
                                        <h5 className="text-xs font-bold text-blue-500 uppercase mb-3 flex items-center gap-2">
                                            <PenTool className="w-4 h-4"/> Enter Data Here
                                        </h5>
                                        
                                        <div className="grid grid-cols-3 gap-4">
                                            {/* Census */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Total Census</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full border-gray-300 rounded focus:ring-osmak-500 focus:border-osmak-500 py-2 text-sm text-gray-900 font-semibold bg-white"
                                                    value={currentLineItem.census ?? ''}
                                                    onChange={(e) => setCurrentLineItem({...currentLineItem, census: Number(e.target.value)})}
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Actual Time */}
                                            <div className={`${!showTimeInput ? 'opacity-50 grayscale' : ''}`}>
                                                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Actual Time</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        disabled={!showTimeInput}
                                                        className="w-full border-gray-300 rounded focus:ring-osmak-500 focus:border-osmak-500 py-2 text-sm text-gray-900 font-bold bg-white"
                                                        value={currentLineItem.actualTime ?? ''}
                                                        onChange={(e) => setCurrentLineItem({...currentLineItem, actualTime: parseFloat(e.target.value)})}
                                                    />
                                                    {showTimeInput && (
                                                        <span className="absolute right-2 top-2 text-xs text-gray-400">{currentLineItem.timeUnit}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actual % */}
                                            <div className={`${!showPctInput && !fallbackShowPct ? 'opacity-50 grayscale' : ''}`}>
                                                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Actual %</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        disabled={!showPctInput && !fallbackShowPct}
                                                        className="w-full border-gray-300 rounded focus:ring-osmak-500 focus:border-osmak-500 py-2 text-sm text-gray-900 font-bold bg-white"
                                                        value={currentLineItem.actualPct ?? ''}
                                                        onChange={(e) => setCurrentLineItem({...currentLineItem, actualPct: parseFloat(e.target.value)})}
                                                    />
                                                    <span className="absolute right-2 top-2 text-xs text-gray-400">%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Group D: Remarks & Action */}
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                     <div className="flex-1">
                                         <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Remarks</label>
                                         <input 
                                            type="text" 
                                            placeholder="Optional notes..." 
                                            className="w-full text-sm border-gray-300 rounded text-gray-900 focus:ring-osmak-500 py-2 bg-white"
                                            value={currentLineItem.remarks || ''}
                                            onChange={(e) => setCurrentLineItem({...currentLineItem, remarks: e.target.value})}
                                         />
                                     </div>
                                     <div className="w-full md:w-auto min-w-[150px]">
                                        {!isEditMode && (
                                            <button 
                                                onClick={addToBatch}
                                                className="w-full bg-osmak-600 text-white py-2 rounded font-bold hover:bg-osmak-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <CheckCircle className="w-5 h-5" /> Add to List
                                            </button>
                                        )}
                                     </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. BATCH QUEUE LIST (Only Add Mode) */}
                        {!isEditMode && batchQueue.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase">Entries to Save ({batchQueue.length})</h4>
                                    <button onClick={() => setBatchQueue([])} className="text-xs text-red-500 hover:underline">Clear All</button>
                                </div>
                                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">KPI</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Census</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                                                <th className="px-3 py-2 text-left text-xs font-bold text-osmak-700 uppercase">Actual</th>
                                                <th className="px-3 py-2 text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {batchQueue.map((r, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2 text-sm text-gray-700 font-medium">{r.month}</td>
                                                    <td className="px-3 py-2 text-sm text-gray-900">{r.kpiName} <span className="text-gray-400 text-xs">{r.department ? `(${r.department})` : ''}</span></td>
                                                    <td className="px-3 py-2 text-sm text-gray-500">{r.census}</td>
                                                    <td className="px-3 py-2 text-sm text-gray-500">{r.kpiType === 'TIME' ? `${r.targetTime} ${r.timeUnit}` : `${r.targetPct}%`}</td>
                                                    <td className="px-3 py-2 text-sm font-bold text-gray-800">{r.kpiType === 'TIME' ? `${r.actualTime} ${r.timeUnit}` : `${r.actualPct}%`}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        <button onClick={() => removeFromBatch(i)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="w-4 h-4"/></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {!isEditMode && batchQueue.length === 0 && (
                             <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
                                 <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
                                 <p className="text-xs text-blue-700">
                                     <strong>Tip:</strong> You can add multiple entries for different months in one go. Just change the "Reporting Month" before clicking "Add to List".
                                 </p>
                             </div>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button onClick={() => {
                        setIsModalOpen(false);
                        if(editDraftId !== null) { setEditDraftId(null); setIsReviewOpen(true); }
                    }} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">Cancel</button>
                    {(isEditMode || batchQueue.length > 0 || currentLineItem.kpiName) && (
                         <button 
                            onClick={isEditMode ? handleUpdateRecord : handleQueueBatch}
                            disabled={loading}
                            className={`px-6 py-2 text-white font-bold rounded shadow transition-colors disabled:opacity-50 flex items-center gap-2 ${isEditMode ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            {loading ? 'Processing...' : (isEditMode ? 'Update Record' : (
                                <>
                                   <FileCheck className="w-4 h-4" />
                                   {batchQueue.length > 0 ? `Queue ${batchQueue.length} Entries for Review` : 'Queue Entry for Review'}
                                </>
                            ))}
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Records;
