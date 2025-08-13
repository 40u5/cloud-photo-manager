import { useState, useEffect, useCallback } from 'react';
import { AddProviderRequest, RemoveProviderRequest, AddProviderResponse, StatusType } from './types';
import StatusAlert from './components/StatusAlert';
import ProviderForms from './components/ProviderForms';
import ProviderList from './components/ProviderList';

function App() {
  const [status, setStatus] = useState<{ message: string; type: StatusType } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      // Trigger refresh of providers list
      setRefreshTrigger(prev => prev + 1);
    } else if (error) {
      setStatus({
        message: `Authorization failed: ${error}`,
        type: 'error'
      });
    }
  }, []);

  // Check OAuth callback on component mount
  useEffect(() => {
    checkOAuthCallback();
  }, [checkOAuthCallback]);

  const handleFormSubmit = async (formData: { appKey: string; appSecret: string }) => {
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
      window.location.href = `/oauth/authorize?providerType=dropbox&index=${instanceIndex}`;

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
      window.location.href = `/oauth/authorize?providerType=${providerType.toLowerCase()}&index=${instanceIndex}`;
      
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
      // Trigger refresh of providers list
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error('Error:', error);
      setStatus({
        message: `Error: ${(error as Error).message}`,
        type: 'error'
      });
    }
  };



  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <StatusAlert status={status} onClose={() => setStatus(null)} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Cloud Photo Manager</h1>
          </div>
        </header>

        <main className="space-y-8">
          {/* Provider Setup Section */}
          <ProviderForms onSubmit={handleFormSubmit} isLoading={isLoading} />

          {/* Current Providers Section */}
          <ProviderList
            onAuthenticate={handleAuthenticateProvider}
            onRemove={handleRemoveProvider}
            refreshTrigger={refreshTrigger}
          />
        </main>
      </div>
    </div>
  );
}

export default App; 