import React from 'react';
import { Provider } from '../types';

interface ProviderItemProps {
  provider: Provider;
  onAuthenticate: (providerType: string, instanceIndex: number) => void;
  onRemove: (providerType: string, instanceIndex: number) => void;
}

const ProviderItem: React.FC<ProviderItemProps> = ({ 
  provider, 
  onAuthenticate, 
  onRemove 
}) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold text-gray-900">
          {provider.type} Provider (Instance {provider.instanceIndex})
        </h4>
        <div className="flex gap-2 items-center">
          {!provider.authenticated && (
            <button
              onClick={() => onAuthenticate(provider.type, provider.instanceIndex)}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-all duration-200 hover:shadow-md"
            >
              Authenticate
            </button>
          )}
          <button
            onClick={() => onRemove(provider.type, provider.instanceIndex)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-all duration-200 hover:shadow-md"
          >
            Remove
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-1">
        Status: {provider.authenticated ? 'Authenticated' : 'Not Authenticated'}
      </p>
      {provider.accountInfo && (
        <p className="text-sm text-gray-600">
          Account: {provider.accountInfo.name} ({provider.accountInfo.email})
        </p>
      )}
    </div>
  );
};

export default ProviderItem; 