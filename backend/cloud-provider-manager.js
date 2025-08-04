import DropboxProvider from './providers/dropbox-provider.js';
import fs from 'fs';
import EnvFileManager from './env-file-manager.js';


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
    
    // Scan .env file to find provider configurations
    const envContent = EnvFileManager.readEnvFile();
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      // Look for patterns like DROPBOX_APP_KEY_0
      const match = trimmedLine.match(/^([A-Z_]+)_APP_KEY_(\d+)=/);
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
          await this.addProvider(providerType); // use existing credentials in env
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
   */
  async addProvider(providerType) {
    try {
      // Generate instance ID if not provided
      if (!this.providers[providerType]) {
        this.providers[providerType] = [];
      }

      let provider;

      // Dynamically get the provider class from string and instantiate
      const ProviderClass = this.getProviderClass(providerType);
      provider = new ProviderClass(false);
      
      this.providers[providerType].push(provider);
      const authenticated = this.addCredentials(providerType);
      
      if (!authenticated) {
        console.log(`Failed to authenticate ${providerType} provider`);
      }
      
      console.log(`Provider instance (${providerType}) added successfully`);
      return provider;
    } catch (error) {
      console.error(`Failed to add provider instance:`, error.message);
      throw error;
    }
  }

  /**
   * Add credentials to a provider instance using environment variables
   * @param {string} providerType - Type of the provider
   * @returns {boolean} True if authentication was successful, false otherwise
   */
  addCredentials(providerType) {
    try {
      const instanceIndex = this.providers[providerType].length - 1;
      const provider = this.getProvider(providerType, instanceIndex);
      const patterns = provider.getEnvVariablePatterns(instanceIndex);
      
      // Extract credentials from .env file
      const credentials = {};
      for (const [key, pattern] of Object.entries(patterns)) {
        credentials[key] = EnvFileManager.getValue(pattern);
      }
      
      // Authenticate the provider
      return provider.authenticate(credentials);
    } catch (error) {
      console.error(`Failed to add credentials for ${providerType} instance ${instanceIndex}:`, error.message);
      return false;
    }
  }

  /**
   * Write credentials to .env file for a specific provider instance
   * @param {string} providerType - Type of the provider
   * @param {number} instanceIndex - Instance index (0-based)
   * @param {Object} credentials - The credentials object
   */
  writeEnvVariables(providerType, instanceIndex, credentials) {
    try {
      const provider = this.getProvider(providerType, instanceIndex);
      const patterns = provider.getEnvVariablePatterns(instanceIndex);
      
      // Validate that at least one credential is provided
      if (!credentials || Object.keys(credentials).length === 0) {
        throw new Error('No credentials provided for writing');
      }
      
      // Validate that all provided credentials are valid for this provider
      const validKeys = Object.keys(patterns);
      for (const key of Object.keys(credentials)) {
        if (!validKeys.includes(key)) {
          throw new Error(`Invalid credential key: ${key}. Valid keys are: ${validKeys.join(', ')}`);
        }
      }
      
      // Ensure .env file exists
      EnvFileManager.createEnvFile();
      
      // Prepare the environment variables to write (only the provided ones)
      const envLines = Object.keys(credentials).map(key => `${patterns[key]}=${credentials[key]}`);
      
      // Write to .env file using EnvFileManager
      EnvFileManager.writeLines(envLines, true); // append to existing content
    } catch (error) {
      console.error(`Failed to write ${providerType} credentials for instance ${instanceIndex}:`, error.message);
      throw error;
    }
  }

  /**
   * Update existing credentials in .env file for a specific provider instance
   * @param {string} providerType - Type of the provider
   * @param {number} instanceIndex - Instance index (0-based)
   * @param {Object} credentials - The credentials object (only include the ones you want to update)
   */
  updateEnvVariables(providerType, instanceIndex, credentials) {
    try {
      
      const provider = this.getProvider(providerType, instanceIndex);
      const patterns = provider.getEnvVariablePatterns(instanceIndex);
      
      console.log('Provider patterns:', patterns);
      
      // Validate that at least one credential is provided
      if (!credentials || Object.keys(credentials).length === 0) {
        throw new Error('No credentials provided for update');
      }
      
      // Validate that all provided credentials are valid for this provider
      const validKeys = Object.keys(patterns);
      for (const key of Object.keys(credentials)) {
        if (!validKeys.includes(key)) {
          throw new Error(`Invalid credential key: ${key}. Valid keys are: ${validKeys.join(', ')}`);
        }
      }
      
      // Prepare the edits to update only the provided environment variables
      const edits = Object.keys(credentials).map(key => ({
        pattern: `^${patterns[key]}=`,
        newValue: credentials[key]
      }));
      
      // Update the .env file using EnvFileManager
      EnvFileManager.editLines(edits);
      
      const updatedKeys = Object.keys(credentials).join(', ');
      console.log(`Successfully updated ${providerType} credentials for instance ${instanceIndex}: ${updatedKeys}`);
    } catch (error) {
      console.error(`Failed to update ${providerType} credentials for instance ${instanceIndex}:`, error.message);
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
   * Get the provider class by type
   * @param {string} providerType - Type of the provider
   * @returns {Class} The provider class
   */
  getProviderClass(providerType) {
    switch (providerType.toLowerCase()) {
      case 'dropbox':
        return DropboxProvider;
      // Add more providers here as they are implemented
      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }

  /**
   * Remove environment variables for a specific provider instance
   * and decrement all provider variable indexes greater than instanceIndex
   * @param {string} providerType - Type of the provider
   * @param {number} instanceIndex - Instance index to remove
   */
  removeInstanceEnvVariable(providerType, instanceIndex) {
    try {
      // Use the singleton EnvFileManager instance
      const envManager = EnvFileManager;
      const envPath = envManager.envFilePath;
      
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