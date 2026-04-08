const registerMessageHandler = (socket, emitToAll) => {
  socket.on('client_message', (payload) => {
    const message = payload && typeof payload.message === 'string' ? payload.message.trim() : '';
    const receivedAt = new Date().toISOString();

    if (!message) {
      socket.emit('server_message', {
        message: 'Validation failed: message is required',
        receivedAt,
        socketId: socket.id
      });
      return;
    }

    const response = {
      message: 'Server received: ' + message,
      receivedAt,
      socketId: socket.id
    };

    socket.emit('server_message', response);
    emitToAll('Socket message:\t' + response.message);
  });
};

module.exports = { registerMessageHandler };
