import CloudProvider from './cloud-provider.js';
import { Dropbox } from 'dropbox';
import fs from 'fs';
import path from 'path';

class DropboxProvider extends CloudProvider {
  constructor(authenticated) {
    this.dbx = new Dropbox();
    this.authenticated = authenticated;
  }

  /**
   * Authenticate the provider using environment variables for a specific instance
   * @param {number} instanceIndex - The instance index (0-based)
   * @returns {boolean} - True if authentication was successful, false otherwise
   */
  addCredentials(instanceIndex) {
    try {
      // Get credentials from environment variables for the specific instance
      const appKey = process.env[`DROPBOX_APP_KEY_${instanceIndex}`];
      const appSecret = process.env[`DROPBOX_APP_SECRET_${instanceIndex}`];
      const accessToken = process.env[`DROPBOX_ACCESS_TOKEN_${instanceIndex}`];
      const refreshToken = process.env[`DROPBOX_REFRESH_TOKEN_${instanceIndex}`];

      // Check if we have the required authentication credentials
      if (!accessToken || !refreshToken || !appKey || !appSecret) {
        console.log(`Missing authentication credentials for Dropbox instance ${instanceIndex}`);
        this.authenticated = false;
        return false;
      }

      // Configure the Dropbox instance with credentials
      this.dbx.setAccessToken(accessToken);
      this.dbx.setRefreshToken(refreshToken);
      this.dbx.setClientId(appKey);
      this.dbx.setClientSecret(appSecret);

      this.authenticated = true;
      console.log(`Successfully authenticated Dropbox provider instance ${instanceIndex}`);
      return true;
    } catch (error) {
      console.error(`Failed to authenticate Dropbox provider instance ${instanceIndex}:`, error.message);
      this.authenticated = false;
      return false;
    }
  }

  /**
   * Write credentials to .env file for a specific instance
   * @param {number} instanceIndex - The instance index to write credentials for
   */
  writeEnvVariables(instanceIndex = 0, credentials) {
    try {
      // Get credentials from the provided object
      const appKey = credentials.appKey;
      const appSecret = credentials.appSecret;
      const accessToken = credentials.accessToken;
      const refreshToken = credentials.refreshToken;
      
      if (!appKey || !appSecret || !accessToken || !refreshToken) {
        throw new Error(`Missing credentials for Dropbox instance ${instanceIndex}`);
      }
      
      // Prepare the environment variables to write
      const envContent = [
        `DROPBOX_APP_KEY_${instanceIndex}=${appKey}`,
        `DROPBOX_APP_SECRET_${instanceIndex}=${appSecret}`,
        `DROPBOX_ACCESS_TOKEN_${instanceIndex}=${accessToken}`,
        `DROPBOX_REFRESH_TOKEN_${instanceIndex}=${refreshToken}`,
        ''
      ].join('\n');
      
      // Write to .env file (always append, don't check for previous instance)
      const envPath = path.join(process.cwd(), '.env');
      let existingContent = '';
      if (fs.existsSync(envPath)) {
        existingContent = fs.readFileSync(envPath, 'utf8');
      }
      const newContent = existingContent + (existingContent ? '\n' : '') + envContent;
      fs.writeFileSync(envPath, newContent);
    } catch (error) {
      throw error;
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
}
export default DropboxProvider;
