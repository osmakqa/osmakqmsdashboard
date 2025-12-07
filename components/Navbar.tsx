import React from 'react';
import { LayoutDashboard, Trophy, Database, AlertCircle, Menu, X, FileText, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { LOGO_URL } from '../constants';

interface NavbarProps {
  currentView: string;
  setView: (view: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setView }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'trend', label: 'KPI Trend', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'performers', label: 'Top Performers', icon: <Trophy className="w-5 h-5" /> },
    { id: 'records', label: 'Records', icon: <Database className="w-5 h-5" /> },
    { id: 'nonsub', label: 'Non-Submission', icon: <AlertCircle className="w-5 h-5" /> },
    { id: 'reports', label: 'Reports', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'kpi_definitions', label: 'KPI', icon: <FileText className="w-5 h-5" /> },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center gap-4 bg-osmak-700 text-white px-4 py-3 shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
        <img 
            src={LOGO_URL} 
            alt="OsMak Logo" 
            className="h-12 w-auto object-contain"
        />
        
        <div className="flex flex-col flex-1">
            <h1 className="m-0 text-[1.05rem] tracking-wider uppercase font-bold leading-tight">
            OSPITAL NG MAKATI
            </h1>
            <span className="text-[0.8rem] opacity-90 leading-tight">
            KPI Dashboard
            </span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:block ml-auto">
          <div className="flex items-center space-x-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-transparent ${
                  currentView === item.id
                    ? 'bg-osmak-800 text-white shadow-sm border-osmak-600'
                    : 'text-osmak-100 hover:bg-osmak-800 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex lg:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-osmak-800 inline-flex items-center justify-center p-2 rounded-md text-osmak-100 hover:text-white hover:bg-osmak-600 focus:outline-none"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="lg:hidden sticky top-[72px] z-40 bg-osmak-700 border-t border-osmak-600 shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-2 w-full text-left px-3 py-3 rounded-md text-base font-medium ${
                  currentView === item.id
                    ? 'bg-osmak-800 text-white'
                    : 'text-osmak-100 hover:bg-osmak-600'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;