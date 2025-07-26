export default class CloudProvider {
  constructor() {
    if (new.target === CloudProvider) {
      throw new TypeError('Cannot instantiate abstract class CloudProvider directly');
    }
  }

  getStorage() {
    throw new Error("getStorage Not Implemented In Subclass")
  }
}
