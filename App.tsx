
import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import KPITrend from './components/KPITrend';
import TopPerformers from './components/TopPerformers';
import Records from './components/Records';
import NonSubmission from './components/NonSubmission';
import Reports from './components/Reports';
import KPIDetails from './components/KPIDetails';
import { KPIRecord, KPIDefinition } from './types';
import { dataService } from './services/dataService';
import { Loader } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('trend');
  const [records, setRecords] = useState<KPIRecord[]>([]);
  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial Data Load with Cache Strategy
  const loadData = async (forceRefresh = false) => {
    if (!forceRefresh && records.length > 0) return; // Already loaded

    setLoading(true);
    try {
      const [recData, defData] = await Promise.all([
        dataService.getRecords(forceRefresh),
        dataService.getKPIDefinitions(forceRefresh)
      ]);
      setRecords(recData);
      setDefinitions(defData);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Called by child components when they update data (add/edit/delete)
  const refreshData = () => {
    loadData(true);
  };

  // Filter records: Dashboard views should only see APPROVED records
  const approvedRecords = useMemo(() => records.filter(r => r.status !== 'DRAFT'), [records]);
  
  // Draft records for the Review Queue
  const draftRecords = useMemo(() => records.filter(r => r.status === 'DRAFT'), [records]);

  const renderView = () => {
    if (loading && records.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader className="w-12 h-12 text-osmak-600 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading Dashboard Data...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'trend':
        return <KPITrend records={approvedRecords} />;
      case 'performers':
        return <TopPerformers records={approvedRecords} />;
      case 'records':
        return <Records records={approvedRecords} drafts={draftRecords} definitions={definitions} onRefresh={refreshData} />;
      case 'nonsub':
        return <NonSubmission records={approvedRecords} />;
      case 'reports':
        return <Reports records={approvedRecords} definitions={definitions} />;
      case 'kpi_definitions':
        return <KPIDetails definitions={definitions} />;
      default:
        return <KPITrend records={approvedRecords} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar currentView={currentView} setView={setCurrentView} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderView()}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Ospital ng Makati. Quality Assurance Division.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;