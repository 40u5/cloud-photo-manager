export default class CloudProvider {
  constructor(accessToken) {
    if (new.target === CloudProvider) {
      throw new TypeError('Cannot instantiate abstract class CloudProvider directly');
    }
    this.accessToken = accessToken;
  }

  getStorage() {
    throw new Error("getStorage Not Implemented In Subclass")
  }
}
