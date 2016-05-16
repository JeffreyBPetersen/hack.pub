/*
  do
    custom error function [X]
      error mode toggling between console and alert
*/

var loudErrors = false;

var currentVertex = {};
// where to send messages by connection id
var messageRoutes = {};

function generateRandomId(){
  var randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  var output = "";
  for(var i = 0; i < randomBytes.length; i++){
    output += ('0' + randomBytes[i].toString(16)).slice(-2);
  }
  return output;
}

// route messages from connections to the correct function
function messageRouter(msg){
  if(msg.data.id in messageRoutes) messageRoutes[msg.data.id](msg.data);
  else throw 'message from unknown connection id';
}

//? rewrite
//!+ check for whether source is already downloaded, if so then use existing copy
// takes an http url and returns a promise that either resolves with the loaded source object or rejects with an error
function loadHttpSource(url){
  var id = generateRandomId();
  var loader = document.createElement('iframe');
  loader.srcdoc = `<script src='httpLoader.js'></script><script src='${url}'></script>`;
  loader.sandbox = 'allow-scripts';
  loader.style.display = 'none';
  loader.onload = () => loader.contentWindow.postMessage({id: id}, '*');
  document.body.appendChild(loader);
  return new Promise((resolve, reject) => {
    messageRoutes[id] = resolve;
    setTimeout(() => reject(`http request to "${url}" timed out`), 3000);
  }).then(
    msg => {
      delete messageRoutes[id];
      loader.remove();
      return msg;
    },
    error => {
      delete messageRoutes[id];
      loader.remove();
      return Promise.reject(error);
    }
  );
}

function renderEdgeHtml(id, weight){
  if(id.slice(0,8) == ':source '){
    return `<span style='color:#0B0'>${id}</span> : ${(weight*100).toPrecision(3)}% <button onclick='enterVertex("${id}")'>enter</button><button onclick='exploreEdge("${id}")'>explore</button>`;
  }
  else if(id.slice(0,6) == ':link '){
    return `<a href='${id.slice(6)}'>${id}</a> : ${(weight*100).toPrecision(3)}%`;
  }
  else return `${id} : ${(weight*100).toPrecision(3)}%`;
}

function updateDisplay(){
  var html = '';
  var edgeTuples = [];
  for(var edgeId in currentVertex){
    edgeTuples.push([edgeId, currentVertex[edgeId]]);
  }
  edgeTuples.sort((a, b) => a[1] < b[1]);
  for(var index in edgeTuples){
    html += `${renderEdgeHtml(edgeTuples[index][0], edgeTuples[index][1])}<br>`;
  }
  document.getElementById('display').innerHTML = html;
}

function scale(vertex){
  var scaled = {};
  var sum = 0;
  for(edgeId in vertex){
    sum += Math.abs(vertex[edgeId]);
  }
  for(edgeId in vertex){
    scaled[edgeId] = vertex[edgeId]/sum;
  }
  return scaled;
}

//! for testing convenience
function enterHttpSource(){
  var input = document.getElementById('input');
  enterVertex(`:source :http ${input.value}`);
  input.value = '';
}

function expandHttpSource(){
  var input = document.getElementById('input');
  exploreEdge(`:source :http ${input.value}`);
  input.value = '';
}

// takes two scaled vertices and a string, returns a scaled vertex
function propagate(vertexA, vertexB, identifier){
  var propagation = {};
  for(edgeId in vertexA){
    if(edgeId != identifier) propagation[edgeId] = vertexA[edgeId];
  }
  for(edgeId in vertexB){
    if(!propagation[edgeId]) propagation[edgeId] = 0;
    propagation[edgeId] += vertexA[identifier] * vertexB[edgeId]; // product of weights
  }
  return propagation;
}

//+ to be continued
// takes an identifier, returns a promise that resolves to a (scaled) vertex or rejects to an error
function loadVertex(identifier){
  if(identifier.slice(0, 14) == ':source :http '){ //* slice returns string[a,b)
    identifier = identifier.slice(14); // strip ':source :http ' from identifier
    return loadHttpSource(identifier).then(
      msg => msg.isVertex ? scale(JSON.parse(msg.load)) : Promise.reject('graphs unsupported by loadVertex'),
      error => Promise.reject(error)
    );
  }
  else return Promise.reject(`"${identifier}" does not use a protocol supported by loadVertex`);
}

function toss(error){
  loudErrors ? alert(error) : console.error(error);
}

// enters the identified vertex == takes a vertex identifier and displays results
function enterVertex(identifier){
  loadVertex(identifier).then(
    vertex => {
      currentVertex = vertex;
      updateDisplay();
    },
    error => {
      toss(error);
    }
  );
}

// expand the currently displayed vertex by following the identified edge
function exploreEdge(identifier){
  if(!currentVertex) toss('no current vertex to travel from');
  loadVertex(identifier).then(
    loadedVertex => {
      currentVertex = propagate(currentVertex, loadedVertex, identifier);//!+ thing
      updateDisplay();
    },
    error => toss(error)
  );
}

function manualEnter(event){
  if(event && event.keyCode == 13){
    var input = document.getElementById('input');
    enterVertex(`:source :http ${input.value}`);
    input.value = '';
  }
}

function main(){
  // test id generation
  console.log(`Your current visit to hack.pub is sponsored by the number 0x${generateRandomId().toUpperCase()}.`);
  window.addEventListener('message', messageRouter);
  document.getElementById('input').addEventListener('keypress', manualEnter);

  if(location.search){
    var parameterObject = {};
    var parameterStrings = location.search.slice(1).split('&');
    for(var index in parameterStrings){
      var [key, value] = parameterStrings[index].split('=');
      parameterObject[key] = value;
    }

    if(parameterObject.entrance){
      parameterObject.entrance = parameterObject.entrance.replace(/%20/g, ' ');
      enterVertex(parameterObject.entrance)
    };

    console.log(parameterObject);
  }
}

onload = main;
