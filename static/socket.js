let socket = new WebSocket("ws://0.0.0.0:8081");

// отправка сообщения из формы
document.forms.publish.onsubmit = function() {
  let outgoingMessage = this.message.value;

  socket.send(outgoingMessage);
  return false;
};

// получение сообщения - отобразить данные в div#messages
socket.onmessage = function(event) {
  let message = JSON.parse(event.data);

  let messageElem = document.createElement('div');
  messageElem.textContent = message.data + ' | from: ' + message.author;
  
  document.getElementById('messages').prepend(messageElem);
}