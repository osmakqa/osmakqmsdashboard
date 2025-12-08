
import React, { useState } from 'react';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (isMaster: boolean) => void;
  targetSection?: string; // Optional: If provided, validates against section-specific password
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, targetSection }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let isValid = false;
    let isMaster = false;
    const masterKey = 'osmakqa123';

    if (password === masterKey) {
        isValid = true;
        isMaster = true;
    } else if (targetSection) {
        // Section-specific password logic: First word of section name + "123"
        const firstWord = targetSection.split(' ')[0].toLowerCase().trim();
        const sectionPassword = `${firstWord}123`;
        
        if (password === sectionPassword) {
            isValid = true;
            isMaster = false;
        }
    }

    if (isValid) {
        onLogin(isMaster);
        setPassword('');
    } else {
        // Provide hint only for usability in this specific internal app context
        const hint = targetSection 
            ? `Password for ${targetSection} (e.g., '${targetSection.split(' ')[0].toLowerCase()}123') or Admin Key.`
            : "Invalid password. Please enter 'osmakqa123'";
        setError(hint);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl transform transition-all animate-fade-in">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-osmak-100 mb-4">
            <Lock className="h-6 w-6 text-osmak-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {targetSection ? 'Section Access' : 'Admin Access'}
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            {targetSection ? `Enter password for ${targetSection}` : 'Enter admin password to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                    type={showPassword ? "text" : "password"}
                    className={`w-full pl-10 pr-10 border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-osmak-500'}`}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
             </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded text-xs text-red-600 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
            </div>
          )}
          
          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-osmak-600 hover:bg-osmak-700 rounded-md font-medium"
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
