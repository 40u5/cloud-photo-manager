import DropboxProvider from './providers/dropbox-provider.js';
import fs from 'fs';
import EnvFileManager from './env-file-manager.js';
import CloudProvider from './cloud-provider.js';
import { Credentials, ProviderConfigs, ProviderInstances } from './types.js';
import { ThumbnailHandler } from './thumbnail-handler.js';

class CloudProviderManager {
  private static instance: CloudProviderManager;
  public providers: ProviderInstances = {};
  private isInitialized: boolean = false;
  private thumbnailHandler!: ThumbnailHandler;

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
  async initialize(): Promise<void> {
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
  async initializeProviders(): Promise<void> {
    let providerConfigs: ProviderConfigs = {};
    
    // Scan .env file to find provider configurations
    const envContent = EnvFileManager.readEnvFile();
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      // Look for patterns like DROPBOX_APP_KEY_0
      const match = trimmedLine.match(/^([A-Z_]+)_APP_KEY_(\d+)=/);
      if (match) {
        const providerType = match[1].toLowerCase(); // Convert to lowercase for consistency
        const instanceIndex = parseInt(match[2]);
        
        // Track the maximum index for each provider type
        if (!providerConfigs[providerType] || instanceIndex > providerConfigs[providerType]) {
          providerConfigs[providerType] = instanceIndex;
        }
      }
    }
    
    // Initialize providers for each type from index 0 to max index
    for (const [providerType, maxIndex] of Object.entries(providerConfigs) as [string, number][]) {
      // Initialize providers from index 0 to maxIndex
      for (let i = 0; i <= maxIndex; i++) {
        try {
          await this.addProvider(providerType, i); // use existing credentials in env
        } catch (error) {
          console.warn(`Failed to initialize ${providerType} instance ${i}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }
  }

  /**
   * Add a new provider instance to the manager
   * @param providerType - Type of the provider (e.g., 'dropbox', 'googleDrive')
   * @param instanceIndex - Optional instance index for the provider (defaults to next available index)
   */
  async addProvider(providerType: string, instanceIndex: number | null = null): Promise<CloudProvider> {
    try {
      // Initialize provider array if it doesn't exist
      if (!this.providers[providerType]) {
        this.providers[providerType] = [];
      }

      let provider: CloudProvider;

      // Dynamically get the provider class from string and instantiate
      const ProviderClass = this.getProviderClass(providerType);
      provider = new ProviderClass(false);
      
      // If instanceIndex is provided, ensure we have enough slots
      if (instanceIndex !== null) {
        // Ensure the array is large enough to accommodate the specified index
        while (this.providers[providerType].length <= instanceIndex) {
          this.providers[providerType].push(null as any);
        }
        this.providers[providerType][instanceIndex] = provider;
      } else {
        // Add to the end of the array
        this.providers[providerType].push(provider);
      }
      
      const actualIndex = instanceIndex !== null ? instanceIndex : this.providers[providerType].length - 1;
      const authenticated = this.addCredentials(providerType, actualIndex);
      
      if (!authenticated) {
        console.log(`Failed to authenticate ${providerType} provider at index ${actualIndex}`);
      } else {
        ThumbnailHandler.addThumbnails(await provider.listFiles('', false, 2000, actualIndex));
      }
      console.log(`Provider instance (${providerType}) added successfully at index ${actualIndex}`);
      console.log(`Current providers for ${providerType}:`, this.providers[providerType].map((p, i) => p ? `index ${i}: exists` : `index ${i}: null`));
      return provider;
    } catch (error) {
      console.error(`Failed to add provider instance:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Add credentials to a provider instance using environment variables
   * @param providerType - Type of the provider
   * @param instanceIndex - Instance index for the provider
   * @returns True if authentication was successful, false otherwise
   */
  addCredentials(providerType: string, instanceIndex: number | null = null): boolean {
    try {
      const actualIndex = instanceIndex !== null ? instanceIndex : this.providers[providerType].length - 1;
      const provider = this.getProvider(providerType, actualIndex);
      const patterns = provider.getEnvVariablePatterns(actualIndex);
      
      // Extract credentials from .env file
      const credentials: Credentials = {
        appKey: EnvFileManager.getValue(patterns.appKey) || '',
        appSecret: EnvFileManager.getValue(patterns.appSecret) || '',
        accessToken: EnvFileManager.getValue(patterns.accessToken) || undefined,
        refreshToken: EnvFileManager.getValue(patterns.refreshToken) || undefined
      };
      
      // Authenticate the provider
      return provider.authenticate(credentials);
    } catch (error) {
      console.error(`Failed to add credentials for ${providerType} instance ${instanceIndex}:`, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Write credentials to .env file for a specific provider instance
   * @param providerType - Type of the provider
   * @param instanceIndex - Instance index (0-based)
   * @param credentials - The credentials object
   */
  writeEnvVariables(providerType: string, instanceIndex: number, credentials: Credentials): void {
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
      
      // Prepare the environment variables to write (only the provided ones)
      const envLines = Object.keys(credentials).map(key => `${patterns[key as keyof typeof patterns]}=${credentials[key as keyof Credentials]}`);
      
      // Write to .env file using EnvFileManager
      EnvFileManager.writeLines(envLines, true); // append to existing content
    } catch (error) {
      console.error(`Failed to write ${providerType} credentials for instance ${instanceIndex}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Update existing credentials in .env file for a specific provider instance
   * @param providerType - Type of the provider
   * @param instanceIndex - Instance index (0-based)
   * @param credentials - The credentials object (only include the ones you want to update)
   */
  updateEnvVariables(providerType: string, instanceIndex: number, credentials: Credentials): void {
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
        pattern: `^${patterns[key as keyof typeof patterns]}=`,
        newValue: credentials[key as keyof Credentials] as string
      }));
      
      // Update the .env file using EnvFileManager
      EnvFileManager.editLines(edits);
      
      const updatedKeys = Object.keys(credentials).join(', ');
      console.log(`Successfully updated ${providerType} credentials for instance ${instanceIndex}: ${updatedKeys}`);
    } catch (error) {
      console.error(`Failed to update ${providerType} credentials for instance ${instanceIndex}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get a provider instance by type and instance index
   * @param providerType - Type of the provider
   * @param instanceIndex - Instance index (0-based)
   * @returns The provider instance object
   */
  getProvider(providerType: string, instanceIndex: number): CloudProvider {
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

    // Check if the instance exists (not null)
    const provider = providerInstances[instanceIndex];
    if (!provider) {
      throw new Error(`Provider instance ${instanceIndex} for type ${providerType} does not exist`);
    }

    // Return the requested instance
    return provider;
  }

  /**
   * Get the provider class by type
   * @param providerType - Type of the provider
   * @returns The provider class
   */
  getProviderClass(providerType: string): new (authenticated: boolean) => CloudProvider {
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
   * @param providerType - Type of the provider
   * @param instanceIndex - Instance index to remove
   */
  removeInstanceEnvVariable(providerType: string, instanceIndex: number): void {
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
      console.error(`Failed to remove environment variables for ${providerType} instance ${instanceIndex}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Remove a provider instance by index and decrement all the providers 
   * @param providerType - Type of the provider
   * @param instanceIndex - Instance index (0-based)
   */
  removeProvider(providerType: string, instanceIndex: number): void {
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
    ThumbnailHandler.removeProvider(providerType, instanceIndex);
    
    // Remove environment variables for the removed instance
    this.removeInstanceEnvVariable(providerType, instanceIndex);
            
    console.log(`Provider instance ${instanceIndex} (${providerType}) removed successfully`);
  }

}



// Export a singleton instance
const cloudProviderManager = new CloudProviderManager();
export default cloudProviderManager; 