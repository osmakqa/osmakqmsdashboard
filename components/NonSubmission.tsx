import React, { useState, useMemo } from 'react';
import { KPIRecord } from '../types';
import { AlertTriangle, Calendar, Download } from 'lucide-react';

interface NonSubmissionProps {
  records: KPIRecord[];
}

const NonSubmission: React.FC<NonSubmissionProps> = ({ records }) => {
  // Use passed records prop instead of local fetching

  // Date Filters
  const [dateFrom, setDateFrom] = useState('2023-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const lateRecords = useMemo(() => {
      return records.filter(r => {
        const submitted = new Date(r.dateSubmitted);
        const due = new Date(r.dueDate);
        
        // Check date range relative to Due Date (or Submitted Date depending on policy, using Due Date here)
        const inRange = r.dueDate >= dateFrom && r.dueDate <= dateTo;
        
        return inRange && (submitted > due);
      }).sort((a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime());
  }, [records, dateFrom, dateTo]);

  const calculateDaysLate = (submitted: string, due: string) => {
    const s = new Date(submitted);
    const d = new Date(due);
    const diffTime = Math.abs(s.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
  };

  const handleExport = () => {
    const headers = ["Section", "Department", "KPI", "Due Date", "Date Submitted", "Days Late"];
    const csvContent = [
      headers.join(','),
      ...lateRecords.map(r => [
        `"${r.section}"`, 
        `"${r.department}"`,
        `"${r.kpiName}"`, 
        r.dueDate, 
        r.dateSubmitted, 
        calculateDaysLate(r.dateSubmitted, r.dueDate)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `late_submissions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
        {/* Controls */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap justify-between items-end gap-4">
            <div className="space-y-1 w-full md:w-auto min-w-[300px]">
                <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3"/> Filter by Due Date
                </label>
                <div className="flex gap-2">
                    <input 
                        type="date" 
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="block w-full pl-2 py-2 text-sm border-gray-300 focus:ring-red-500 focus:border-red-500 rounded-md border text-gray-900 bg-white [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <input 
                        type="date" 
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="block w-full pl-2 py-2 text-sm border-gray-300 focus:ring-red-500 focus:border-red-500 rounded-md border text-gray-900 bg-white [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                </div>
            </div>
            
             <button onClick={handleExport} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200 transition-colors w-full md:w-auto justify-center min-w-[140px]">
                <Download className="w-4 h-4" />
                Export List
            </button>
        </div>

        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <div className="flex">
            <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
                <p className="text-sm text-red-700">
                Tracking late submissions. Currently showing {lateRecords.length} records in the selected period.
                </p>
            </div>
            </div>
        </div>

        <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-50">
                    <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Section / Dept
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Required Doc (KPI)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Due Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Date Submitted
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Days Late
                    </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {lateRecords.length > 0 ? (
                        lateRecords.map((record) => {
                        const daysLate = calculateDaysLate(record.dateSubmitted, record.dueDate);
                        return (
                        <tr key={record.id} className="hover:bg-red-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{record.section}</div>
                            <div className="text-sm text-gray-500">{record.department}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.kpiName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.dueDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                            {record.dateSubmitted}
                            </td>
                             <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-red-100 text-red-800">
                                +{daysLate} Days
                            </span>
                            </td>
                        </tr>
                        );
                        })
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                <AlertTriangle className="mx-auto h-12 w-12 text-gray-300" />
                                <p className="mt-2 text-sm">No late submissions recorded in this period.</p>
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default NonSubmission;