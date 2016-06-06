/*
  fix
    currentRoot setting bug
  test
    currentRoot setting
    aliasing
  do
    ':alias <title> <identifier>' system
      original identifier tooltip on alias hover
    show current root
    message when no content is loaded
    ensure vertices are scaled before cached
    ng file generation tool
    uploading tool
    hosting tool
    custom error function [X]
      error mode toggling between console and alert
    toggle whether aliased or unaliased identifiers are underlined
*/

// whether to nalert on errors
var loudErrors = false;

// last source root entered !? old
var currentRoot;

// currently displayed content
// {source: {identifier: weight, ...}, ...}
var currentContent = {}; //! group identifiers by source
var currentVertex = {}; //! old

// cached content
var cache = {};

// content loaded for this session
var localGraph = {};

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
      return msg.load;
    },
    error => {
      delete messageRoutes[id];
      loader.remove();
      return Promise.reject(error);
    }
  );
}

function getSortedEdgeTuples(vertex){
  var edgeTuples = [];
  for(var edgeId in vertex){
    edgeTuples.push([edgeId, vertex[edgeId]]);
  }
  edgeTuples.sort((a, b) => a[1] < b[1]);
  return edgeTuples;
}

function renderResultHtml(result){
  var html = `<tr><td style='border-right: 1px solid #333'>${result.sources.length > 1 ? '<i>multiple</i>' : result.sources[0]}</td>
  <td style='border-right: 1px solid #333'>`;
  if(result.localID.slice(0,6) == ':link '){
    html += `<a href='${result.localID.slice(6)}'>${result.localID}</a>`;
  } else if(result.localID.slice(0,8) == ':source ') {
    html += `<span class='source' onclick='exploreSource("${result.localID}")'>${result.localID}</span>`; //! incomplete
  } else {
    html += result.localID;
  }
  html += `</td><td>${(result.weight*100).toPrecision(3)}%</td></tr>`;
  return html;
}

function getOrderedCurrentContent(){
  //!+ group results by matching localID, then sort
  var grouped = {};
  for(var source in currentContent){
    for(var localID in currentContent[source]){
      //ordered.push({source: source, localID: localID, weight: currentContent[source][localID]});
      if(!grouped[localID]){
        grouped[localID] = {sources: [source], localID: localID, weight: currentContent[source][localID]};
      } else {
        grouped[localID].sources.push(source);
        grouped[localID].weight += currentContent[source][localID];
      }
    }
  }
  var ordered = [];
  for(var localID in grouped){
    ordered.push(grouped[localID]);
  }
  ordered.sort((resultA, resultB) => resultA.weight < resultB.weight);
  console.log('ordered: ', ordered); //! debug
  /*var ordered = [];
  for(var source in currentContent){
    for(var localID in currentContent[source]){
      ordered.push({source: source, localID: localID, weight: currentContent[source][localID]});
    }
  }
  ordered.sort((resultA, resultB) => resultA.weight < resultB.weight);
  */
  return ordered;
}

function updateDisplay(){
  var html = '<table>';
  var orderedContent = getOrderedCurrentContent();
  for(var index in orderedContent){
    html += `${renderResultHtml(orderedContent[index])}`;
  }
  html += '</table>';
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

// take a source (string) and break it into protocol and link
function partitionRoot(source){
  return {
    protocol: source.split(' ')[0],
    link: source.split(' ')[1]
  };
}

// takes a source identifier, returns a promise that resolves to scaled results or rejects to an error
function loadSource(source){
  var parts = partitionSource(source);
  // if the query has cached results, return them
  if(cache[parts.root] && cache[parts.root][parts.localID]){
    return Promise.resolve(cache[parts.root][parts.localID]);
  }
  // parse the root into protocol and link
  var rootParts = partitionRoot(parts.root);
  // check if protocol is supported
  if(rootParts.protocol != ':http') toss(`unrecognized protocol: "${rootParts.protocol}"`);
  // load the source, then continue
  return loadHttpSource(rootParts.link).then(
    load => {
      var parsedLoad = JSON.parse(load);
      if(!cache[parts.root]) cache[parts.root] = {};
      for(var localID in parsedLoad){
        cache[parts.root][localID] = parsedLoad[localID];
      }
      return scale(parsedLoad[parts.localID])
    },
    error => toss(error)
  );
}

function toss(error){
  if(loudErrors) alert(error);
  throw new Error(error);
}

function defaultTo(defaultValue){
  return (x) => x ? x : defaultValue;
}

function partitionSource(identifier){
  if(identifier.slice(0,6) == ':http '){
    var indexOfLocalID = identifier.indexOf(' ', 6) + 1; // 0 if none
    return {
      localID: indexOfLocalID ? identifier.slice(indexOfLocalID) : '',
      // slice out source, avoiding trailing space and slicing to end of string if no localID
      root: identifier.slice(0, indexOfLocalID ? indexOfLocalID - 1 : undefined)
    }
  }
  else toss(`unrecognized source: "${identifier}"`);
}

// enters the identified vertex == takes a vertex identifier and displays results
/*function enterSource(identifier){
  loadSource(identifier).then(
    vertex => {
      currentRoot = defaultTo('local')(partitionSource(identifier).root);
      currentVertex = vertex;
      updateDisplay();
    },
    error => {
      toss(error);
    }
  );
}*/
function enterSource(identifier){
  if(identifier.slice(0,8) != ':source ') toss(`${identifier} is not a ":source"`);
  loadSource(identifier.slice(8)).then(
    // sourced vertex is of form {<source>: {<result> : <weight>, ...}}
    source => {
      currentContent = {
        [identifier.slice(8)]: source
      };
      updateDisplay();
    },
    error => {
      toss(error);
    }
  );
}

//! not currently working
// expand the currently displayed vertex by following the identified edge
function exploreSource(identifier){
  if(identifier.slice(0,8) != ':source '){
    toss(`${identifier} is not a "source"`);
  }
  var source = identifier.slice(8);
  loadSource(identifier.slice(8)).then(
    loadedSource => {
      console.log('loaded: ', loadedSource); //! debug
      //currentContent = propagate(source, results);
      var propagatedWeight = 0;
      for(var pastSource in currentContent){
        if(currentContent[pastSource][identifier]){
          propagatedWeight += currentContent[pastSource][identifier];
          delete currentContent[pastSource][identifier];
        }
      }
      if(!currentContent[source]) currentContent[source] = {};
      for(var localID in loadedSource){
        currentContent[source][localID] = propagatedWeight * loadedSource[localID];
      }
      updateDisplay();
    },
    error => toss(error)
  );
}

function manualEnter(event){
  if(event && event.keyCode == 13){
    var input = document.getElementById('input');
    enterSource(`:source :http ${input.value}`);
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
      enterSource(parameterObject.entrance)
    };
  }
}

onload = main;
