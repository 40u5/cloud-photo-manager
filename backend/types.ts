// cloud-provider.ts
export interface EnvVariablePatterns {
  appKey: string;
  appSecret: string;
  accessToken: string;
  refreshToken: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface Credentials {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface StorageInfo {
  used: number;
  allocated: number;
}

export interface FileMetadata {
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  client_modified: string;
  server_modified: string;
  rev: string;
  size: number;
  content_hash: string;
}

export interface FileDownloadResult {
  metadata: FileMetadata;
  fileBinary: Buffer;
  fileBlob: Blob;
}

export interface MediaInfoResult {
  metadata: any;
  mediaInfo: any;
}

export interface AccountInfo {
  accountId: string;
  name: string;
  email: string;
}

export interface RefreshTokenResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  error?: string;
  details?: string;
}

// routes/provider-routes.ts
export interface ProviderInfo {
  type: string;
  instanceIndex: number;
  authenticated: boolean;
  accountInfo?: {
    accountId: string;
    name: string;
    email: string;
  };
}

export interface AddProviderRequest {
  providerType: string;
  credentials: Credentials;
}

export interface RemoveProviderRequest {
  providerType: string;
  instanceIndex: number;
}

// providers/dropbox-provider.ts
export interface DropboxFileEntry {
  '.tag': string;
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  client_modified: string;
  server_modified: string;
  rev: string;
  size: number;
  content_hash: string;
}

export interface DropboxThumbnailEntry {
  '.tag': string;
  metadata: DropboxFileEntry;
  thumbnail?: string;
}

export interface DropboxSpaceUsage {
  used: number;
  allocation: {
    allocated?: number;
    team?: {
      allocated: number;
    };
  };
}

export interface DropboxAccount {
  account_id: string;
  name: {
    display_name: string;
  };
  email: string;
}

// env-file-manager.ts
export interface EditObject {
  pattern: string;
  newValue: string;
  replaceEntireLine?: boolean;
}

// cloud-provider-manager.ts
export interface ProviderConfigs {
  [key: string]: number;
}

export interface ProviderInstances {
  [key: string]: any[];
} 