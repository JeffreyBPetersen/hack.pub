var message = {};

function sendMessage(){
  window.parent.postMessage(message, '*');
}

function receiveMessage(msg){
  message.id = msg.data.id;
  if(message.load) sendMessage();
}

function load(obj){
  message.load = JSON.stringify(obj);
  if(message.id) sendMessage();
}

window.addEventListener('message', receiveMessage);
