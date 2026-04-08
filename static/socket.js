/* global io */
(function bootstrapSocketClient() {
  const socket = io({
    transports: ['websocket', 'polling']
  });

  const ensureElement = (id, tagName, parent = document.body) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement(tagName);
      el.id = id;
      parent.appendChild(el);
    }
    return el;
  };

  const appRoot = ensureElement('socket-example', 'div');
  const logs = ensureElement('socket-logs', 'pre', appRoot);
  const startButton = ensureElement('start-btn', 'button', appRoot);
  startButton.textContent = 'Emit start';

  const form = ensureElement('create-item-form', 'form', appRoot);
  if (!form.hasChildNodes()) {
    form.innerHTML = [
      '<input id="category" name="category" placeholder="category" required />',
      '<input id="name" name="name" placeholder="name" required />',
      '<input id="quantity" name="quantity" placeholder="quantity" type="number" required />',
      '<input id="price" name="price" placeholder="price" type="number" step="0.01" required />',
      '<label><input id="clearance" name="clearance" type="checkbox" /> clearance</label>',
      '<button type="submit">Emit create_item</button>'
    ].join('');
  }

  const appendLog = (line) => {
    logs.textContent += `${line}\n`;
  };

  socket.on('connect', () => {
    appendLog(`Connected: ${socket.id}`);

    socket.on('new_message', (message) => {
      appendLog(`new_message: ${typeof message === 'string' ? message : JSON.stringify(message)}`);
    });

    socket.emit('start');
  });

  startButton.addEventListener('click', () => {
    socket.emit('start');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = {
      category: document.getElementById('category').value,
      name: document.getElementById('name').value,
      quantity: Number(document.getElementById('quantity').value),
      price: Number(document.getElementById('price').value),
      clearance: Boolean(document.getElementById('clearance').checked)
    };
    socket.emit('create_item', payload);
  });
})();
