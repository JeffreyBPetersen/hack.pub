var message = {};

function sendMessage(){
  window.parent.postMessage(message, '*');
}

function receiveMessage(msg){
  message.id = msg.data.id;
  if(message.isVertex || message.isGraph) sendMessage();
}

function vertex(obj){
  message.load = JSON.stringify(obj);
  message.isVertex = true;
  if(message.id) sendMessage();
}

function graph(obj){
  message.load = JSON.stringify(obj);
  message.isGraph = true;
  if(message.id) sendMessage();
}

window.addEventListener('message', receiveMessage);
