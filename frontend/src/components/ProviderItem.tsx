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
    <div className="provider-item">
      <div className="provider-header">
        <h4>{provider.type} Provider (Instance {provider.instanceIndex})</h4>
        <div className="provider-actions">
          {!provider.authenticated && (
            <button
              className="authenticate-provider-btn"
              onClick={() => onAuthenticate(provider.type, provider.instanceIndex)}
            >
              Authenticate
            </button>
          )}
          <button
            className="remove-provider-btn"
            onClick={() => onRemove(provider.type, provider.instanceIndex)}
          >
            Remove
          </button>
        </div>
      </div>
      <p>Status: {provider.authenticated ? 'Authenticated' : 'Not Authenticated'}</p>
      {provider.accountInfo && (
        <p>Account: {provider.accountInfo.name} ({provider.accountInfo.email})</p>
      )}
    </div>
  );
};

export default ProviderItem; 