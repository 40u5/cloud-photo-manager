import { EnvVariablePatterns, TokenResponse, Credentials, StorageInfo, FileMetadata, FileDownloadResult, MediaInfoResult, AccountInfo, RefreshTokenResult } from './types.js';

export default class CloudProvider {
  constructor() {
    if (new.target === CloudProvider) {
      throw new TypeError('Cannot instantiate abstract class CloudProvider directly');
    }
  }

  /**
   * Get the environment variable patterns for this provider
   * @param instanceIndex - The instance index (0-based)
   * @returns Object containing the environment variable patterns
   * @example
   * {
   *   appKey: 'DROPBOX_APP_KEY_${instanceIndex}',
   *   appSecret: 'DROPBOX_APP_SECRET_${instanceIndex}',
   *   accessToken: 'DROPBOX_ACCESS_TOKEN_${instanceIndex}',
   *   refreshToken: 'DROPBOX_REFRESH_TOKEN_${instanceIndex}'
   * }
   */
  getEnvVariablePatterns(instanceIndex: number): EnvVariablePatterns {
    throw new Error("getEnvVariablePatterns Not Implemented In Subclass");
  }

  /**
   * Get the OAuth authorization URL for this provider
   * @param appKey - The app key/client ID
   * @param redirectUri - The redirect URI
   * @param state - The state parameter (usually instance index)
   * @returns The authorization URL
   */
  getAuthorizationUrl(appKey: string, redirectUri: string, state: string): string {
    throw new Error("getAuthorizationUrl Not Implemented In Subclass");
  }

  /**
   * Exchange authorization code for access token
   * @param code - The authorization code
   * @param appKey - The app key/client ID
   * @param appSecret - The app secret
   * @param redirectUri - The redirect URI
   * @returns Object containing access_token and refresh_token
   */
  async exchangeCodeForToken(code: string, appKey: string, appSecret: string, redirectUri: string): Promise<TokenResponse> {
    throw new Error("exchangeCodeForToken Not Implemented In Subclass");
  }

  /**
   * Get the provider type name (e.g., 'dropbox', 'googledrive')
   * @returns The provider type name
   */
  getProviderType(): string {
    throw new Error("getProviderType Not Implemented In Subclass");
  }

  getStorage(): Promise<number> {
    throw new Error("getStorage Not Implemented In Subclass")
  }

  isAuthenticated(): boolean {
    throw new Error("isAuthenticated Not Implemented In Subclass")
  }

  authenticate(credentials: Credentials): boolean {
    throw new Error("authenticate Not Implemented In Subclass")
  }

  async getAccountInfo(): Promise<AccountInfo> {
    throw new Error("getAccountInfo Not Implemented In Subclass")
  }

  async listFiles(folderPath?: string, recursive?: boolean, limit?: number): Promise<any[]> {
    throw new Error("listFiles Not Implemented In Subclass")
  }

  async refreshToken(credentials: Credentials, instanceIndex: number): Promise<RefreshTokenResult> {
    throw new Error("refreshToken Not Implemented In Subclass")
  }
} 