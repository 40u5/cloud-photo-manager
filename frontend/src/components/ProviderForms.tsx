import React from 'react';
import DropboxForm from './DropboxForm';

interface ProviderFormsProps {
  onSubmit: (formData: { appKey: string; appSecret: string }) => Promise<void>;
  isLoading: boolean;
}

const ProviderForms: React.FC<ProviderFormsProps> = ({ onSubmit, isLoading }) => {
  return (
    <div className="space-y-6">
      {/* Dropbox Provider Form */}
      <DropboxForm onSubmit={onSubmit} isLoading={isLoading} />
      
      {/* Future provider forms can be added here */}
      {/* Example:
      <GoogleDriveForm onSubmit={onSubmit} isLoading={isLoading} />
      <OneDriveForm onSubmit={onSubmit} isLoading={isLoading} />
      */}
    </div>
  );
};

export default ProviderForms; 