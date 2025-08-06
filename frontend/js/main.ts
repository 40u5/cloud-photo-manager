// Type definitions for the application
interface Provider {
    type: string;
    instanceIndex: number;
    authenticated: boolean;
    accountInfo?: {
        name: string;
        email: string;
    };
}

interface AddProviderRequest {
    providerType: string;
    credentials: {
        appKey: string;
        appSecret: string;
    };
}

interface RemoveProviderRequest {
    providerType: string;
    instanceIndex: number;
}

interface AddProviderResponse {
    instanceIndex?: number;
}

type StatusType = 'info' | 'success' | 'error';

document.addEventListener('DOMContentLoaded', function(): void {
    const dropboxForm = document.getElementById('dropboxForm') as HTMLFormElement;
    const statusMessage = document.getElementById('statusMessage') as HTMLElement;
    const providersList = document.getElementById('providersList') as HTMLElement;

    // Handle form submission
    dropboxForm.addEventListener('submit', async function(e: Event): Promise<void> {
        e.preventDefault();
        
        const formData = new FormData(dropboxForm);
        const appKey = formData.get('appKey') as string;
        const appSecret = formData.get('appSecret') as string;

        if (!appKey || !appSecret) {
            showStatus('Please fill in all required fields.', 'error');
            return;
        }

        try {
            showStatus('Adding provider...', 'info');
            
            // Step 1: Add the provider with credentials
            const addResponse = await fetch('/provider/add-provider', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    providerType: 'DROPBOX',
                    credentials: {
                        appKey: appKey,
                        appSecret: appSecret
                    }
                } as AddProviderRequest)
            });

            if (!addResponse.ok) {
                const errorData = await addResponse.json();
                throw new Error(errorData.error || 'Failed to add provider');
            }

            const addResponseData = await addResponse.json() as AddProviderResponse;
            showStatus('Provider added successfully! Initiating authorization...', 'success');

            // Step 2: Redirect to OAuth authorization
            // The backend OAuth route will handle the authorization flow
            // Get the instance index from the response or use 0 as default
            const instanceIndex = addResponseData.instanceIndex || 0;
            
            window.location.href = `/auth/authorize?providerType=dropbox&index=${instanceIndex}`;

        } catch (error) {
            console.error('Error:', error);
            showStatus(`Error: ${(error as Error).message}`, 'error');
        }
    });

    // Function to show status messages
    function showStatus(message: string, type: StatusType = 'info'): void {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
    }

    // Function to load and display current providers
    async function loadProviders(): Promise<void> {
        try {
            const response = await fetch('/provider/providers');
            if (response.ok) {
                const providers = await response.json() as Provider[];
                displayProviders(providers);
            } else {
                console.log('No providers endpoint available or error occurred');
            }
        } catch (error) {
            console.log('Could not load providers:', (error as Error).message);
        }
    }

    // Function to display providers
    function displayProviders(providers: Provider[]): void {
        if (!providers || providers.length === 0) {
            providersList.innerHTML = '<p>No providers configured yet.</p>';
            return;
        }

        const providersHtml = providers.map(provider => `
            <div class="provider-item">
                <div class="provider-header">
                    <h4>${provider.type} Provider (Instance ${provider.instanceIndex})</h4>
                    <div class="provider-actions">
                        ${!provider.authenticated ? 
                            `<button class="authenticate-provider-btn" data-provider-type="${provider.type}" data-instance-index="${provider.instanceIndex}">
                                Authenticate
                            </button>` : ''
                        }
                        <button class="remove-provider-btn" data-provider-type="${provider.type}" data-instance-index="${provider.instanceIndex}">
                            Remove
                        </button>
                    </div>
                </div>
                <p>Status: ${provider.authenticated ? 'Authenticated' : 'Not Authenticated'}</p>
                ${provider.accountInfo ? `<p>Account: ${provider.accountInfo.name} (${provider.accountInfo.email})</p>` : ''}
            </div>
        `).join('');

        providersList.innerHTML = providersHtml;
        
        // Add event listeners to remove buttons
        const removeButtons = document.querySelectorAll('.remove-provider-btn') as NodeListOf<HTMLButtonElement>;
        removeButtons.forEach(button => {
            button.addEventListener('click', handleRemoveProvider);
        });

        // Add event listeners to authenticate buttons
        const authenticateButtons = document.querySelectorAll('.authenticate-provider-btn') as NodeListOf<HTMLButtonElement>;
        authenticateButtons.forEach(button => {
            button.addEventListener('click', handleAuthenticateProvider);
        });
    }

    // Function to handle provider authentication
    async function handleAuthenticateProvider(event: Event): Promise<void> {
        const button = event.target as HTMLButtonElement;
        const providerType = button.getAttribute('data-provider-type') as string;
        const instanceIndex = parseInt(button.getAttribute('data-instance-index') as string);
        
        try {
            showStatus('Initiating authentication...', 'info');
            
            // Redirect to OAuth authorization endpoint
            window.location.href = `/auth/authorize?providerType=${providerType.toLowerCase()}&index=${instanceIndex}`;
            
        } catch (error) {
            console.error('Error:', error);
            showStatus(`Error: ${(error as Error).message}`, 'error');
        }
    }

    // Function to handle provider removal
    async function handleRemoveProvider(event: Event): Promise<void> {
        const button = event.target as HTMLButtonElement;
        const providerType = button.getAttribute('data-provider-type') as string;
        const instanceIndex = parseInt(button.getAttribute('data-instance-index') as string);
        
        // Confirm removal with user
        if (!confirm(`Are you sure you want to remove ${providerType} Provider (Instance ${instanceIndex})? This action cannot be undone.`)) {
            return;
        }
        
        try {
            showStatus('Removing provider...', 'info');
            
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

            showStatus('Provider removed successfully!', 'success');
            loadProviders(); // Refresh the providers list
            
        } catch (error) {
            console.error('Error:', error);
            showStatus(`Error: ${(error as Error).message}`, 'error');
        }
    }

    // Load providers on page load
    loadProviders();

    // Check if we're returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (code && state) {
        // We're returning from OAuth callback with success
        showStatus('Authorization successful! Your Dropbox provider has been configured.', 'success');
        loadProviders(); // Refresh the providers list
    } else if (error) {
        showStatus(`Authorization failed: ${error}`, 'error');
    }
}); 