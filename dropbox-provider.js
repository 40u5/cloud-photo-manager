// dropbox-provider.js
import CloudProvider from './cloud-provider.js';
import { Dropbox } from 'dropbox';

class DropboxProvider extends CloudProvider {
  // accept a second parameter for fetch
  constructor(apiKey) {
    super(apiKey);
    this.dbx = new Dropbox({
      accessToken: apiKey,
      fetch: fetch,
    });
    
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
      this.storage = allocated - used
      return this.storage;
    } catch (err) {
      throw new Error('Failed to fetch Dropbox storage info: ' + err.message);
    }
  }
}

export default DropboxProvider;
