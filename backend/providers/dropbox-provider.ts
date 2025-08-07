import CloudProvider from '../cloud-provider.js';
import { Dropbox, DropboxAuth } from 'dropbox';
import axios from 'axios';
import EnvFileManager from '../env-file-manager.js';
import { EnvVariablePatterns, TokenResponse, Credentials, RefreshTokenResult, AccountInfo, FileDownloadResult, MediaInfoResult, DropboxFileEntry, DropboxThumbnailEntry, DropboxSpaceUsage, DropboxAccount } from '../types.js';

class DropboxProvider extends CloudProvider {
  private dbx: Dropbox;
  private authenticated: boolean;

  constructor(authenticated: boolean) {
    super();
    this.dbx = new Dropbox();
    this.authenticated = authenticated;
  }

  /**
   * Check if the provider is authenticated
   * @returns True if authenticated, false otherwise
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Get the environment variable patterns for Dropbox provider
   * @param instanceIndex - The instance index (0-based)
   * @returns Object containing the environment variable patterns
   */
  getEnvVariablePatterns(instanceIndex: number): EnvVariablePatterns {
    return {
      appKey: `DROPBOX_APP_KEY_${instanceIndex}`,
      appSecret: `DROPBOX_APP_SECRET_${instanceIndex}`,
      accessToken: `DROPBOX_ACCESS_TOKEN_${instanceIndex}`,
      refreshToken: `DROPBOX_REFRESH_TOKEN_${instanceIndex}`
    };
  }

  /**
   * Get the OAuth authorization URL for Dropbox
   * @param appKey - The app key/client ID
   * @param redirectUri - The redirect URI
   * @param state - The state parameter (usually instance index)
   * @returns The authorization URL
   */
  getAuthorizationUrl(appKey: string, redirectUri: string, state: string): string {
    return `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&token_access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
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
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', 
      new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: appKey,
        client_secret: appSecret,
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data;
  }

  /**
   * Get the provider type name
   * @returns The provider type name
   */
  getProviderType(): string {
    return 'dropbox';
  }

  /**
   * Authenticate the provider using provided credentials
   * @param credentials - The credentials object containing appKey, appSecret, accessToken, refreshToken
   * @returns True if authentication was successful, false otherwise
   */
  authenticate(credentials: Credentials): boolean {
    try {
      const { appKey, appSecret, accessToken, refreshToken } = credentials;
  
      if (!accessToken || !refreshToken || !appKey || !appSecret) {
        console.log('Missing authentication credentials for Dropbox provider');
        this.authenticated = false;
        return false;
      }
  
      // Create DropboxAuth instance
      const auth = new DropboxAuth({
        clientId: appKey,
        clientSecret: appSecret,
        accessToken: accessToken,
        refreshToken: refreshToken
      });
  
      // Create Dropbox instance with auth
      this.dbx = new Dropbox({ auth });
  
      this.authenticated = true;
      console.log('Successfully authenticated Dropbox provider');
      return true;
    } catch (error) {
      console.error('Failed to authenticate Dropbox provider:', error instanceof Error ? error.message : 'Unknown error');
      this.authenticated = false;
      return false;
    }
  }

  /**
   * Refresh the access token using the refresh token
   * @param credentials - The credentials object containing appKey, appSecret, refreshToken
   * @param instanceIndex - The instance index for environment variable updates
   * @returns Object containing success status and new access token
   */
  async refreshToken(credentials: Credentials, instanceIndex: number): Promise<RefreshTokenResult> {
    try {
      const { appKey, appSecret, refreshToken } = credentials;
      
      if (!refreshToken || !appKey || !appSecret) {
        throw new Error('Missing required credentials for token refresh');
      }

      // Make API call to refresh the access token
      const response = await axios.post('https://api.dropboxapi.com/oauth2/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: appKey,
          client_secret: appSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, refresh_token } = response.data;
      
      // Update the Dropbox instance with new access token
      const auth = new DropboxAuth({
        clientId: appKey,
        clientSecret: appSecret,
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken // Use new refresh token if provided, otherwise keep existing
      });
      
      this.dbx = new Dropbox({ auth });
      this.authenticated = true;

      // Update environment variables with new tokens
      const patterns = this.getEnvVariablePatterns(instanceIndex);
      
      const edits = [
        {
          pattern: `^${patterns.accessToken}=`,
          newValue: access_token
        }
      ];
      
      // Only update refresh token if a new one was provided
      if (refresh_token) {
        edits.push({
          pattern: `^${patterns.refreshToken}=`,
          newValue: refresh_token
        });
      }
      
      EnvFileManager.editLines(edits);
      
      // Update process.env for current session
      process.env[patterns.accessToken] = access_token;
      if (refresh_token) {
        process.env[patterns.refreshToken] = refresh_token;
      }

      console.log('Successfully refreshed Dropbox access token');
      
      return {
        success: true,
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken,
        message: 'Access token refreshed successfully'
      };
      
    } catch (error) {
      console.error('Failed to refresh Dropbox access token:', error instanceof Error ? error.message : 'Unknown error');
      
      let errorMessage = 'Failed to refresh access token';
      if (axios.isAxiosError(error) && error.response?.data?.error === 'invalid_grant') {
        errorMessage = 'Refresh token is invalid or expired. Re-authentication required.';
      } else if (axios.isAxiosError(error) && error.response?.data?.error === 'invalid_client') {
        errorMessage = 'Invalid client credentials.';
      }
      
      return {
        success: false,
        error: errorMessage,
        details: axios.isAxiosError(error) ? error.response?.data?.error_description || error.message : 'Unknown error'
      };
    }
  }

  async getStorage(): Promise<number> {
    try {
      const res = await this.dbx.usersGetSpaceUsage();
      const result = res.result as DropboxSpaceUsage;
      const used = result.used;
      const allocation = result.allocation;
      let allocated = 0;
      if (allocation.allocated) {
        allocated = allocation.allocated;
      } else if (allocation.team && allocation.team.allocated) {
        allocated = allocation.team.allocated;
      }
      return allocated - used;
    } catch (err) {
      throw new Error('Failed to fetch Dropbox storage info: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async listFiles(folderPath: string = '', recursive: boolean = false, limit: number = 2000): Promise<DropboxFileEntry[]> {
    try {
      const params = {
        path: folderPath === '' ? '' : folderPath,
        recursive: recursive,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
        include_mounted_folders: true,
        limit: limit
      };

      const res = await this.dbx.filesListFolder(params);
      let entries = res.result.entries as DropboxFileEntry[];

      // Handle pagination if there are more files
      let hasMore = res.result.has_more;
      let cursor = res.result.cursor;

      while (hasMore) {
        const moreRes = await this.dbx.filesListFolderContinue({ cursor: cursor });
        entries = entries.concat(moreRes.result.entries as DropboxFileEntry[]);
        hasMore = moreRes.result.has_more;
        cursor = moreRes.result.cursor;
      }

      return entries;
    } catch (err) {
      throw new Error('Failed to list files from Dropbox: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async getThumbnails(filePaths: string[], size: string = 'w64h64', format: string = 'jpeg'): Promise<DropboxThumbnailEntry[]> {
    try {
      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        throw new Error('filePaths must be a non-empty array');
      }

      // Dropbox supports up to 25 files per batch request
      const maxBatchSize = 25;
      const batches: string[][] = [];
      
      for (let i = 0; i < filePaths.length; i += maxBatchSize) {
        batches.push(filePaths.slice(i, i + maxBatchSize));
      }

      const allThumbnails: DropboxThumbnailEntry[] = [];

      for (const batch of batches) {
        const entries = batch.map(path => ({
          path: path,
          format: format as any,
          size: size as any
        }));

        const res = await this.dbx.filesGetThumbnailBatch({ entries: entries as any });
        allThumbnails.push(...res.result.entries as DropboxThumbnailEntry[]);
      }
      return allThumbnails;
      
    } catch (err) {
      throw new Error('Failed to get thumbnails batch from Dropbox: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async getFile(filePath: string, options: { rev?: string } = {}): Promise<FileDownloadResult> {
    try {
      const params: { path: string; rev?: string } = {
        path: filePath
      };

      // Add optional parameters if provided
      if (options.rev) params.rev = options.rev;

      const res = await this.dbx.filesDownload(params);
      
      return {
        metadata: {
          name: res.result.name,
          path_lower: res.result.path_lower || '',
          path_display: res.result.path_display || '',
          id: res.result.id,
          client_modified: res.result.client_modified,
          server_modified: res.result.server_modified,
          rev: res.result.rev,
          size: res.result.size,
          content_hash: res.result.content_hash || ''
        },
        fileBinary: (res.result as any).fileBinary,
        fileBlob: (res.result as any).fileBlob
      };
    } catch (err) {
      throw new Error('Failed to download file from Dropbox: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async getMediaInfo(filePath: string): Promise<MediaInfoResult> {
    try {
      const res = await this.dbx.filesGetMetadata({
        path: filePath,
        include_media_info: true
      });

      return {
        metadata: res.result,
        mediaInfo: (res.result as any).media_info || null
      };
    } catch (err) {
      throw new Error('Failed to get media info from Dropbox: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const res = await this.dbx.usersGetCurrentAccount();
      const result = res.result as DropboxAccount;
      return {
        accountId: result.account_id,
        name: result.name.display_name,
        email: result.email
      };
    } catch (err) {
      throw new Error('Failed to get Dropbox account info: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }
}

export default DropboxProvider; 