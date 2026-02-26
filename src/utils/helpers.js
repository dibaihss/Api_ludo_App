const formatResponse = (data, message = null) => {
  const response = { data };
  if (message) {
    response.message = message;
  }
  return response;
};

const formatError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  formatResponse,
  formatError
};
