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

  getStorage() {
    throw new Error("getStorage Not Implemented In Subclass")
  }

  isAuthenticated() {
    throw new Error("isAuthenticated Not Implemented In Subclass")
  }
}
