var testVertex;

function randomFromArray(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

function randomID(){
  var id = '';
  var doneness = 0;
  var lastWasVowel = true;
  while(doneness < 1){
    id += lastWasVowel
      ? randomFromArray(['b','c','d','f','g','h','j','k','l','m','n','p','q','r','s','t','v','w','x','z'])
      : randomFromArray(['a','e','i','o','u','y']);
    lastWasVowel = !lastWasVowel;
    doneness += Math.pow(Math.random(), 3);
  }
  return id;
}

function generateTestVertex(){
  testVertex = {};
  for(var i = 0; i < 8; i++){
    testVertex[randomID()] = Math.ceil(Math.random()*8);
  }
}

//! placeholder
function partitionIdentifier(id){
  return {
    source: ['local',':http jackthe.net'][Math.floor(Math.random()*2)],
    localID: id
  };
}

function genTable(){
  var html = '<table>';
  for(var edgeID in testVertex){
    var parts = partitionIdentifier(edgeID);
    html += `<tr><td style='border-right: 1px solid #333'>${parts.source}</td><td style='border-right: 1px solid #333'>${parts.localID}</td><td>${testVertex[edgeID]}</td></tr>`
  }
  html += '</table>';
  return html;
}

function main(){
  generateTestVertex();
  document.body.innerHTML = genTable();
}

onload = main;
