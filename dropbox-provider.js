import CloudProvider from './cloud-provider.js';
import { Dropbox, DropboxAuth } from 'dropbox';
import axios from 'axios';
import EnvFileManager from './env-file-manager.js';

class DropboxProvider extends CloudProvider {
  constructor(authenticated) {
    super();
    this.dbx = new Dropbox();
    this.authenticated = authenticated;
  }

  /**
   * Get the environment variable patterns for Dropbox provider
   * @param {number} instanceIndex - The instance index (0-based)
   * @returns {Object} Object containing the environment variable patterns
   */
  getEnvVariablePatterns(instanceIndex) {
    return {
      appKey: `DROPBOX_APP_KEY_${instanceIndex}`,
      appSecret: `DROPBOX_APP_SECRET_${instanceIndex}`,
      accessToken: `DROPBOX_ACCESS_TOKEN_${instanceIndex}`,
      refreshToken: `DROPBOX_REFRESH_TOKEN_${instanceIndex}`
    };
  }

  /**
   * Authenticate the provider using provided credentials
   * @param {Object} credentials - The credentials object containing appKey, appSecret, accessToken, refreshToken
   * @returns {boolean} - True if authentication was successful, false otherwise
   */
  authenticate(credentials) {
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
      console.error('Failed to authenticate Dropbox provider:', error.message);
      this.authenticated = false;
      return false;
    }
  }

  /**
   * Refresh the access token using the refresh token
   * @param {Object} credentials - The credentials object containing appKey, appSecret, refreshToken
   * @param {number} instanceIndex - The instance index for environment variable updates
   * @returns {Object} - Object containing success status and new access token
   */
  async refreshToken(credentials, instanceIndex) {
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
      const envManager = new EnvFileManager();
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
      
      envManager.editLines(edits);
      
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
      console.error('Failed to refresh Dropbox access token:', error.response?.data || error.message);
      
      let errorMessage = 'Failed to refresh access token';
      if (error.response?.data?.error === 'invalid_grant') {
        errorMessage = 'Refresh token is invalid or expired. Re-authentication required.';
      } else if (error.response?.data?.error === 'invalid_client') {
        errorMessage = 'Invalid client credentials.';
      }
      
      return {
        success: false,
        error: errorMessage,
        details: error.response?.data?.error_description || error.message
      };
    }
  }


  async getStorage() {
    try {
      const res = await this.dbx.usersGetSpaceUsage();
      const used = res.result.used;
      const allocation = res.result.allocation;
      let allocated = 0;
      if (allocation.allocated) {
        allocated = allocation.allocated;
      } else if (allocation.team && allocation.team.allocated) {
        allocated = allocation.team.allocated;
      }
      this.storage = allocated - used;
      return this.storage;
    } catch (err) {
      throw new Error('Failed to fetch Dropbox storage info: ' + err.message);
    }
  }

  async listFiles(folderPath = '', recursive = false, limit = 2000) {
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
      let entries = res.result.entries;

      // Handle pagination if there are more files
      let hasMore = res.result.has_more;
      let cursor = res.result.cursor;

      while (hasMore) {
        const moreRes = await this.dbx.filesListFolderContinue({ cursor: cursor });
        entries = entries.concat(moreRes.result.entries);
        hasMore = moreRes.result.has_more;
        cursor = moreRes.result.cursor;
      }

      return entries;
    } catch (err) {
      throw new Error('Failed to list files from Dropbox: ' + err.message);
    }
  }

  async getThumbnails(filePaths, size = 'w64h64', format = 'jpeg') {
    try {
      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        throw new Error('filePaths must be a non-empty array');
      }

      // Dropbox supports up to 25 files per batch request
      const maxBatchSize = 25;
      const batches = [];
      
      for (let i = 0; i < filePaths.length; i += maxBatchSize) {
        batches.push(filePaths.slice(i, i + maxBatchSize));
      }

      const allThumbnails = [];

      for (const batch of batches) {
        const entries = batch.map(path => ({
          path: path,
          format: format,
          size: size
        }));

        const res = await this.dbx.filesGetThumbnailBatch({ entries: entries });
        allThumbnails.push(...res.result.entries);
      }
      return allThumbnails;
      
    } catch (err) {
      throw new Error('Failed to get thumbnails batch from Dropbox: ' + err.message);
    }
  }

  async getFile(filePath, options = {}) {
    try {
      const params = {
        path: filePath
      };

      // Add optional parameters if provided
      if (options.rev) params.rev = options.rev;

      const res = await this.dbx.filesDownload(params);
      
      return {
        metadata: {
          name: res.result.name,
          path_lower: res.result.path_lower,
          path_display: res.result.path_display,
          id: res.result.id,
          client_modified: res.result.client_modified,
          server_modified: res.result.server_modified,
          rev: res.result.rev,
          size: res.result.size,
          content_hash: res.result.content_hash
        },
        fileBinary: res.result.fileBinary,
        fileBlob: res.result.fileBlob
      };
    } catch (err) {
      throw new Error('Failed to download file from Dropbox: ' + err.message);
    }
  }

  async getMediaInfo(filePath) {
    try {
      const res = await this.dbx.filesGetMetadata({
        path: filePath,
        include_media_info: true
      });

      return {
        metadata: res.result,
        mediaInfo: res.result.media_info || null
      };
    } catch (err) {
      throw new Error('Failed to get media info from Dropbox: ' + err.message);
    }
  }

  async getAccountInfo() {
    try {
      const res = await this.dbx.usersGetCurrentAccount();
      return {
        accountId: res.result.account_id,
        name: res.result.name,
        email: res.result.email
      };
    } catch (err) {
      throw new Error('Failed to get Dropbox account info: ' + err.message);
    }
  }
}

export default DropboxProvider;
