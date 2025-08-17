import CloudProvider from '../cloud-provider.js';
import { Dropbox, DropboxAuth } from 'dropbox';
import axios from 'axios';
import EnvFileManager from '../env-file-manager.js';
import { EnvVariablePatterns, TokenResponse, Credentials, RefreshTokenResult,
   AccountInfo, MediaInfoResult, DropboxAccount, PhotoMetadata, ThumbnailResponse } from '../types.js';
import { ThumbnailHandler } from '../thumbnail-handler.js';

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
      const result = res.result as any;
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

  async listFiles(folderPath: string = '', recursive: boolean = false, limit: number = 2000, instanceIndex: number = 0): Promise<PhotoMetadata[]> {
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
      let entries = res.result.entries as any[];

      // Handle pagination if there are more files
      let hasMore = res.result.has_more;
      let cursor = res.result.cursor;

      while (hasMore) {
        const moreRes = await this.dbx.filesListFolderContinue({ cursor: cursor });
        entries = entries.concat(moreRes.result.entries as any[]);
        hasMore = moreRes.result.has_more;
        cursor = moreRes.result.cursor;
      }

      const photoMetadata: PhotoMetadata[] = [];
      for (const entry of entries) {
        photoMetadata.push(await ThumbnailHandler.convertToPhotoMetadata(entry.id,
           entry.name, entry.path_display, new Date(entry.client_modified), entry.size,
            this.getProviderType(), instanceIndex, entry.content_hash));
      }

      return photoMetadata;
    } catch (err) {
      throw new Error('Failed to list files from Dropbox: ' + (err instanceof Error ? err.message : 'Unknown error'));
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

  /**
   * Get a thumbnail for a file from Dropbox
   * @param filePath - The path to the file
   * @param size - The thumbnail size ('small', 'medium', 'large', 'xl')
   * @returns Promise containing thumbnail data or error
   */
  async getThumbnail(filePath: string): Promise<ThumbnailResponse> {
    try {
      if (!this.authenticated) {
        return {
          success: false,
          error: 'Provider not authenticated'
        };
      }

      // Get thumbnail using Dropbox API
      const response = await this.dbx.filesGetThumbnailV2({
        resource: {
          '.tag': 'path',
          path: filePath
        },
        format: {
          '.tag': 'jpeg'
        },
        size: {
          '.tag': 'w256h256'
        },
        mode: {
          '.tag': 'strict'
        }
      });

      // Extract the thumbnail data from the response
      const thumbnailBlob = (response.result as any).fileBinary;
      
      if (!thumbnailBlob) {
        return {
          success: false,
          error: 'No thumbnail data received from Dropbox'
        };
      }

      // Convert to Buffer if it's not already
      let thumbnailBuffer: Buffer;
      if (Buffer.isBuffer(thumbnailBlob)) {
        thumbnailBuffer = thumbnailBlob;
      } else if (thumbnailBlob instanceof ArrayBuffer) {
        thumbnailBuffer = Buffer.from(thumbnailBlob);
      } else if (thumbnailBlob instanceof Uint8Array) {
        thumbnailBuffer = Buffer.from(thumbnailBlob);
      } else {
        // Try to convert from blob-like object
        thumbnailBuffer = Buffer.from(await thumbnailBlob.arrayBuffer());
      }

      return {
        success: true,
        data: thumbnailBuffer,
        mimeType: 'image/jpeg'
      };

    } catch (err) {
      console.error('Failed to get thumbnail from Dropbox:', err);
      
      let errorMessage = 'Failed to get thumbnail';
      if (err instanceof Error) {
        if (err.message.includes('not_found')) {
          errorMessage = 'File not found';
        } else if (err.message.includes('unsupported_file')) {
          errorMessage = 'Thumbnail not available for this file type';
        } else if (err.message.includes('conversion_error')) {
          errorMessage = 'Failed to generate thumbnail for this file';
        } else {
          errorMessage = err.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

export default DropboxProvider; 