document.addEventListener('DOMContentLoaded', function() {
    const dropboxForm = document.getElementById('dropboxForm');
    const statusMessage = document.getElementById('statusMessage');
    const providersList = document.getElementById('providersList');

    // Handle form submission
    dropboxForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(dropboxForm);
        const appKey = formData.get('appKey');
        const appSecret = formData.get('appSecret');
        const instanceIndex = parseInt(formData.get('instanceIndex'));

        if (!appKey || !appSecret) {
            showStatus('Please fill in all required fields.', 'error');
            return;
        }

        try {
            showStatus('Adding provider...', 'info');
            
            // Step 1: Add the provider with credentials
            const addResponse = await fetch('/api/add-provider', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    providerType: 'DROPBOX',
                    instanceIndex: instanceIndex,
                    credentials: {
                        appKey: appKey,
                        appSecret: appSecret
                    }
                })
            });

            if (!addResponse.ok) {
                const errorData = await addResponse.json();
                throw new Error(errorData.error || 'Failed to add provider');
            }

            showStatus('Provider added successfully! Initiating authorization...', 'success');

            // Step 2: Redirect to OAuth authorization
            // The backend OAuth route will handle the authorization flow
            window.location.href = `/auth/dropbox/${instanceIndex}`;

        } catch (error) {
            console.error('Error:', error);
            showStatus(`Error: ${error.message}`, 'error');
        }
    });

    // Function to show status messages
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
    }

    // Function to load and display current providers
    async function loadProviders() {
        try {
            const response = await fetch('/api/providers');
            if (response.ok) {
                const providers = await response.json();
                displayProviders(providers);
            } else {
                console.log('No providers endpoint available or error occurred');
            }
        } catch (error) {
            console.log('Could not load providers:', error.message);
        }
    }

    // Function to display providers
    function displayProviders(providers) {
        if (!providers || providers.length === 0) {
            providersList.innerHTML = '<p>No providers configured yet.</p>';
            return;
        }

        const providersHtml = providers.map(provider => `
            <div class="provider-item">
                <h4>${provider.type} Provider (Instance ${provider.instanceIndex})</h4>
                <p>Status: ${provider.authenticated ? 'Authenticated' : 'Not Authenticated'}</p>
                ${provider.accountInfo ? `<p>Account: ${provider.accountInfo.name} (${provider.accountInfo.email})</p>` : ''}
            </div>
        `).join('');

        providersList.innerHTML = providersHtml;
    }

    // Load providers on page load
    loadProviders();

    // Check if we're returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    const authError = urlParams.get('auth_error');

    if (authSuccess === 'true') {
        showStatus('Authorization successful! Your Dropbox provider has been configured.', 'success');
        loadProviders(); // Refresh the providers list
    } else if (authError) {
        showStatus(`Authorization failed: ${authError}`, 'error');
    }
});
