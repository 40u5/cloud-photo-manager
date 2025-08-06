import React, { useState } from 'react';

interface DropboxFormProps {
  onSubmit: (formData: { appKey: string; appSecret: string }) => Promise<void>;
  isLoading: boolean;
}

const DropboxForm: React.FC<DropboxFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    appKey: '',
    appSecret: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: { appKey: string; appSecret: string }) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-blue-500">
        Provider Setup
      </h2>
      
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="appKey" className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
            App Key:
          </label>
          <input
            type="text"
            id="appKey"
            name="appKey"
            value={formData.appKey}
            onChange={handleInputChange}
            required
            placeholder="Enter your Dropbox app key"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="appSecret" className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
            App Secret:
          </label>
          <input
            type="password"
            id="appSecret"
            name="appSecret"
            value={formData.appSecret}
            onChange={handleInputChange}
            required
            placeholder="Enter your Dropbox app secret"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
          />
        </div>
        
        <div className="pt-4">
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isLoading ? 'Adding Provider...' : 'Authorize Dropbox'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DropboxForm; 