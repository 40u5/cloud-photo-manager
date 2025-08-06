import React, { useEffect } from 'react';
import { StatusType } from '../types';

interface StatusAlertProps {
  status: { message: string; type: StatusType } | null;
  onClose: () => void;
}

const StatusAlert: React.FC<StatusAlertProps> = ({ status, onClose }) => {
  // Auto-hide status message after 3 seconds
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  if (!status) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <div className={`px-6 py-4 rounded-lg shadow-lg font-medium max-w-md text-center ${
        status.type === 'success' ? 'bg-green-500 text-white' :
        status.type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
      }`}>
        <h3 className="text-xl font-semibold mb-2">Status</h3>
        {status.message}
      </div>
    </div>
  );
};

export default StatusAlert; 