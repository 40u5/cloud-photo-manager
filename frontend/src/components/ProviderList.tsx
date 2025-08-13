import { useState, useEffect, useCallback } from 'react';
import { Provider } from '../types';
import ProviderItem from './ProviderItem';

interface ProviderListProps {
  onAuthenticate: (providerType: string, instanceIndex: number) => void;
  onRemove: (providerType: string, instanceIndex: number) => void;
  refreshTrigger?: number; // Optional prop to trigger refresh from parent
}

function ProviderList({ onAuthenticate, onRemove, refreshTrigger }: ProviderListProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/provider/providers');
      if (response.ok) {
        const providersData = await response.json() as Provider[];
        setProviders(providersData);
      } else {
        console.log('No providers endpoint available or error occurred');
        setProviders([]);
      }
    } catch (error) {
      console.log('Could not load providers:', (error as Error).message);
      setError((error as Error).message);
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load providers on component mount
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // Refresh providers when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadProviders();
    }
  }, [refreshTrigger, loadProviders]);



  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-green-500">
          Current Providers
        </h2>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <span className="ml-2 text-gray-600">Loading providers...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-green-500">
          Current Providers
        </h2>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Error loading providers: {error}</p>
          <button
            onClick={loadProviders}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-green-500">
        <h2 className="text-2xl font-bold text-gray-900">
          Current Providers
        </h2>
        <button
          onClick={loadProviders}
          className="text-green-600 hover:text-green-700 text-sm font-medium transition-colors"
          title="Refresh providers"
        >
          Refresh
        </button>
      </div>
      <div className="space-y-4">
        {providers.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No providers configured yet.</p>
        ) : (
          providers.map(provider => (
            <ProviderItem
              key={`${provider.type}-${provider.instanceIndex}`}
              provider={provider}
              onAuthenticate={onAuthenticate}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ProviderList;
