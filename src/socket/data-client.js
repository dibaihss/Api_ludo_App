const DataClient = {
  async start(_emitCb) {
    return Promise.resolve();
  },
  async createProduct(payload, emitCb) {
    emitCb('Processing create_item request');
    return { ...payload };
  }
};

module.exports = DataClient;
