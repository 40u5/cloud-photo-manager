import DropboxProvider from './dropbox-provider.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

class CloudProviderManager {
  constructor() {
    if (CloudProviderManager.instance) {
      return CloudProviderManager.instance;
    }
    
    // Change from Map to object with arrays to support multiple instances
    this.providers = {};
    this.isInitialized = false;
    
    CloudProviderManager.instance = this;
  }

  /**
   * Initialize the manager from environment variables
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('CloudProviderManager already initialized');
      return;
    }

    console.log('Initializing CloudProviderManager from environment variables...');

    await this.initializeProviders();

    this.isInitialized = true;
    console.log('CloudProviderManager initialized successfully');
  }

  /**
   * Initialize providers from environment variables
   */
  async initializeProviders() {
    let providerConfigs = {};
    
    // Scan environment variables to find provider configurations
    for (const key of Object.keys(process.env)) {
      // Look for patterns like DROPBOX_APP_KEY_0
      const match = key.match(/^([A-Z_]+)_APP_KEY_(\d+)$/);
      if (match) {
        const providerType = match[1];
        const instanceIndex = parseInt(match[2]);
        
        // Track the maximum index for each provider type
        if (!providerConfigs[providerType] || instanceIndex > providerConfigs[providerType]) {
          providerConfigs[providerType] = instanceIndex;
        }
      }
    }
    
    // Initialize providers for each type from index 0 to max index
    for (const [providerType, maxIndex] of Object.entries(providerConfigs)) {
      // Initialize providers from index 0 to maxIndex
      for (let i = 0; i <= maxIndex; i++) {
        try {
          await this.addProvider(providerType, i, false); // use existing credentials in env
        } catch (error) {
          console.warn(`Failed to initialize ${providerType} instance ${i}:`, error.message);
        }
      }
    }
  }

  /**
   * Add a new provider instance to the manager
   * @param {string} providerType - Type of the provider (e.g., 'dropbox', 'googleDrive')
   * @param {number} instanceIndex - Instance index for the provider
   * @param {boolean} writeToEnv - Whether to write credentials to .env file
   */
  async addProvider(providerType, instanceIndex, writeToEnv) {
    try {
      // Generate instance ID if not provided
      if (!this.providers[providerType]) {
        this.providers[providerType] = [];
      }

      let provider;

      switch (providerType.toLowerCase()) {
        case 'DROPBOX':
          provider = new DropboxProvider(false);
          break;
        // more providers
        default:
          throw new Error(`Unsupported provider type: ${providerType}`);
      }
      
      if (writeToEnv) {
        provider.writeEnvVariables(instanceIndex); // pass the instance index
      } else {
        // if not writing to env the credentials are already in the env
        const authenticated = provider.addCredentials(instanceIndex);
        
        if (!authenticated) {
          console.log(`Failed to authenticate Dropbox provider instance ${instanceIndex}`);
        }
      }

      this.providers[providerType].push(provider);
      
      // Write credentials to .env file
      // await this.writeCredentialsToEnv(providerType, credentials, instanceIndex);
      
      console.log(`Provider instance ${instanceIndex} (${providerType}) added successfully`);
      return provider;
    } catch (error) {
      console.error(`Failed to add provider instance ${instanceIndex}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a provider instance by type and instance index
   * @param {string} providerType - Type of the provider
   * @param {number} instanceIndex - Instance index (0-based)
   * @returns {Object} The provider instance object
   */
  getProvider(providerType, instanceIndex) {
    const providerInstances = this.providers[providerType];
    
    // Check if provider type exists
    if (!providerInstances || providerInstances.length === 0) {
      throw new Error(`No provider instances found for type: ${providerType}`);
    }

    // Validate instance index
    if (instanceIndex < 0 || instanceIndex >= providerInstances.length) {
      const availableCount = providerInstances.length;
      throw new Error(`Invalid instance index ${instanceIndex}. Available instances: 0-${availableCount - 1}`);
    }

    // Return the requested instance
    return providerInstances[instanceIndex];
  }

  /**
   * Remove environment variables for a specific provider instance
   * and decrement all provider variable indexes greater than instanceIndex
   * @param {string} providerType - Type of the provider
   * @param {number} instanceIndex - Instance index to remove
   */
  removeInstanceEnvVariable(providerType, instanceIndex) {
    try {
      const envPath = path.resolve('.env');
      
      if (!fs.existsSync(envPath)) {
        console.warn('.env file not found, skipping env variable removal');
        return;
      }

      let envContent = fs.readFileSync(envPath, 'utf8');
      const providerVarName = providerType.toUpperCase();
      
      // Step 1: Remove all env variables for the specific instance being removed
      const removePattern = new RegExp(`^${providerVarName}_[^=]*_${instanceIndex}=.*$`, 'gm');
      envContent = envContent.replace(removePattern, '');
      
      // Step 2: Find all environment variables for this provider type with higher indexes
      // and decrement their indexes by 1
      const lines = envContent.split('\n');
      const updatedLines = lines.map(line => {
        // Match pattern: PROVIDER_SOMETHING_INDEX=value
        const match = line.match(new RegExp(`^(${providerVarName}_[^=]*_)(\\d+)(=.*)$`));
        
        if (match) {
          const prefix = match[1];  // e.g., "DROPBOX_APP_KEY_"
          const currentIndex = parseInt(match[2]);  // e.g., 3
          const suffix = match[3];  // e.g., "=your_value_here"
          
          // If current index is greater than the removed instance index, decrement it
          if (currentIndex > instanceIndex) {
            const newIndex = currentIndex - 1;
            return `${prefix}${newIndex}${suffix}`;
          }
        }
        
        return line;
      });
      
      // Step 3: Clean up empty lines and write back to file
      const cleanedContent = updatedLines
        .filter(line => line.trim() !== '')  // Remove empty lines
        .join('\n');
      
      // Add a final newline if content exists
      const finalContent = cleanedContent ? cleanedContent + '\n' : '';
      
      fs.writeFileSync(envPath, finalContent, 'utf8');
      
      console.log(`Removed environment variables for ${providerType} instance ${instanceIndex} and decremented higher indexes`);
      
    } catch (error) {
      console.error(`Failed to remove environment variables for ${providerType} instance ${instanceIndex}:`, error.message);
    }
  }

  /**
   * Remove a provider instance by index and decrement all the providers 
   * @param {string} providerType - Type of the provider
   * @param {number} instanceIndex - Instance index (0-based)
   */
  removeProvider(providerType, instanceIndex) {
    const providerInstances = this.providers[providerType];
    
    // Check if provider type exists
    if (!providerInstances || providerInstances.length === 0) {
      console.log(`No provider instances found for type: ${providerType}`);
      return;
    }

    // Validate instance index
    if (instanceIndex < 0 || instanceIndex >= providerInstances.length) {
      const availableCount = providerInstances.length;
      console.log(`Invalid instance index ${instanceIndex}. Available instances: 0-${availableCount - 1}`);
      return;
    }

    // Remove the instance from the providers array
    providerInstances.splice(instanceIndex, 1);
    
    // Remove environment variables for the removed instance
    this.removeInstanceEnvVariable(providerType, instanceIndex);
            
    console.log(`Provider instance ${instanceIndex} (${providerType}) removed successfully`);
  }
}

// Export a singleton instance
const cloudProviderManager = new CloudProviderManager();
export default cloudProviderManager;