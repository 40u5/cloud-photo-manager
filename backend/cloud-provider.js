export default class CloudProvider {
  constructor() {
    if (new.target === CloudProvider) {
      throw new TypeError('Cannot instantiate abstract class CloudProvider directly');
    }
  }

  /**
   * Get the environment variable patterns for this provider
   * @param {number} instanceIndex - The instance index (0-based)
   * @returns {Object} Object containing the environment variable patterns
   * @example
   * {
   *   appKey: 'DROPBOX_APP_KEY_${instanceIndex}',
   *   appSecret: 'DROPBOX_APP_SECRET_${instanceIndex}',
   *   accessToken: 'DROPBOX_ACCESS_TOKEN_${instanceIndex}',
   *   refreshToken: 'DROPBOX_REFRESH_TOKEN_${instanceIndex}'
   * }
   */
  getEnvVariablePatterns(instanceIndex) {
    throw new Error("getEnvVariablePatterns Not Implemented In Subclass");
  }

  /**
   * Get the OAuth authorization URL for this provider
   * @param {string} appKey - The app key/client ID
   * @param {string} redirectUri - The redirect URI
   * @param {string} state - The state parameter (usually instance index)
   * @returns {string} The authorization URL
   */
  getAuthorizationUrl(appKey, redirectUri, state) {
    throw new Error("getAuthorizationUrl Not Implemented In Subclass");
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - The authorization code
   * @param {string} appKey - The app key/client ID
   * @param {string} appSecret - The app secret
   * @param {string} redirectUri - The redirect URI
   * @returns {Object} Object containing access_token and refresh_token
   */
  async exchangeCodeForToken(code, appKey, appSecret, redirectUri) {
    throw new Error("exchangeCodeForToken Not Implemented In Subclass");
  }

  /**
   * Get the provider type name (e.g., 'dropbox', 'googledrive')
   * @returns {string} The provider type name
   */
  getProviderType() {
    throw new Error("getProviderType Not Implemented In Subclass");
  }

  getStorage() {
    throw new Error("getStorage Not Implemented In Subclass")
  }

  isAuthenticated() {
    throw new Error("isAuthenticated Not Implemented In Subclass")
  }
}
