const toErrorMessage = (error) => (error instanceof Error ? error.message : String(error));

const registerCreateItemHandler = (io, socket, dataClient) => {
  socket.on('create_item', async (payload) => {
    try {
      const createdItem = await dataClient.createProduct(payload, (message) => {
        io.emit('new_message', message);
      });
      io.emit('new_message', 'Created item:\t' + JSON.stringify(createdItem));
    } catch (error) {
      io.emit('new_message', 'Error:\t' + toErrorMessage(error));
    }
  });
};

module.exports = { registerCreateItemHandler };
