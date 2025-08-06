import React, { useState, useEffect, useCallback } from 'react';
import { Provider, AddProviderRequest, RemoveProviderRequest, AddProviderResponse, StatusType } from './types';
import ProviderItem from './components/ProviderItem';

function App() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState<{ message: string; type: StatusType } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    appKey: '',
    appSecret: ''
  });

  const loadProviders = useCallback(async () => {
    try {
      const response = await fetch('/provider/providers');
      if (response.ok) {
        const providersData = await response.json() as Provider[];
        setProviders(providersData);
      } else {
        console.log('No providers endpoint available or error occurred');
      }
    } catch (error) {
      console.log('Could not load providers:', (error as Error).message);
    }
  }, []);

  const checkOAuthCallback = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (code && state) {
      setStatus({
        message: 'Authorization successful! Your Dropbox provider has been configured.',
        type: 'success'
      });
      loadProviders();
    } else if (error) {
      setStatus({
        message: `Authorization failed: ${error}`,
        type: 'error'
      });
    }
  }, [loadProviders]);

  // Load providers on component mount
  useEffect(() => {
    loadProviders();
    checkOAuthCallback();
  }, [loadProviders, checkOAuthCallback]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.appKey || !formData.appSecret) {
      setStatus({
        message: 'Please fill in all required fields.',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);
    setStatus({
      message: 'Adding provider...',
      type: 'info'
    });

    try {
      // Step 1: Add the provider with credentials
      const addResponse = await fetch('/provider/add-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerType: 'DROPBOX',
          credentials: {
            appKey: formData.appKey,
            appSecret: formData.appSecret
          }
        } as AddProviderRequest)
      });

      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.error || 'Failed to add provider');
      }

      const addResponseData = await addResponse.json() as AddProviderResponse;
      setStatus({
        message: 'Provider added successfully! Initiating authorization...',
        type: 'success'
      });

      // Step 2: Redirect to OAuth authorization
      const instanceIndex = addResponseData.instanceIndex || 0;
      window.location.href = `/auth/authorize?providerType=dropbox&index=${instanceIndex}`;

    } catch (error) {
      console.error('Error:', error);
      setStatus({
        message: `Error: ${(error as Error).message}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthenticateProvider = async (providerType: string, instanceIndex: number) => {
    try {
      setStatus({
        message: 'Initiating authentication...',
        type: 'info'
      });
      
      // Redirect to OAuth authorization endpoint
      window.location.href = `/auth/authorize?providerType=${providerType.toLowerCase()}&index=${instanceIndex}`;
      
    } catch (error) {
      console.error('Error:', error);
      setStatus({
        message: `Error: ${(error as Error).message}`,
        type: 'error'
      });
    }
  };

  const handleRemoveProvider = async (providerType: string, instanceIndex: number) => {
    // Confirm removal with user
    if (!confirm(`Are you sure you want to remove ${providerType} Provider (Instance ${instanceIndex})? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setStatus({
        message: 'Removing provider...',
        type: 'info'
      });
      
      const response = await fetch('/provider/remove-provider', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerType: providerType,
          instanceIndex: instanceIndex
        } as RemoveProviderRequest)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove provider');
      }

      setStatus({
        message: 'Provider removed successfully!',
        type: 'success'
      });
      loadProviders(); // Refresh the providers list
      
    } catch (error) {
      console.error('Error:', error);
      setStatus({
        message: `Error: ${(error as Error).message}`,
        type: 'error'
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: { appKey: string; appSecret: string }) => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="container">
      <header>
        <h1>Cloud Photo Manager</h1>
        <p>Setup your Dropbox provider</p>
      </header>

      <main>
        <div className="setup-section">
          <h2>Add Dropbox Provider</h2>
          
          <form onSubmit={handleFormSubmit} className="provider-form">
            <div className="form-group">
              <label htmlFor="appKey">App Key:</label>
              <input
                type="text"
                id="appKey"
                name="appKey"
                value={formData.appKey}
                onChange={handleInputChange}
                required
                placeholder="Enter your Dropbox app key"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="appSecret">App Secret:</label>
              <input
                type="password"
                id="appSecret"
                name="appSecret"
                value={formData.appSecret}
                onChange={handleInputChange}
                required
                placeholder="Enter your Dropbox app secret"
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Adding Provider...' : 'Add Provider & Authorize'}
              </button>
            </div>
          </form>
        </div>

        <div className="status-section">
          <h3>Status</h3>
          {status && (
            <div className={`status-message ${status.type}`}>
              {status.message}
            </div>
          )}
        </div>

        <div className="providers-section">
          <h3>Current Providers</h3>
          <div className="providers-list">
            {providers.length === 0 ? (
              <p>No providers configured yet.</p>
            ) : (
              providers.map(provider => (
                <ProviderItem
                  key={`${provider.type}-${provider.instanceIndex}`}
                  provider={provider}
                  onAuthenticate={handleAuthenticateProvider}
                  onRemove={handleRemoveProvider}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App; 