export default class CloudProvider {
  constructor(apiKey) {
    if (new.target === CloudProvider) {
      throw new TypeError('Cannot instantiate abstract class CloudProvider directly');
    }
    this.apiKey = apiKey;
  }

  getStorage() {
    throw new Error("not implemented in subclass")
  }
}
