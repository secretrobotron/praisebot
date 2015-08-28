var WebSocketServer = require('ws').Server;
var http = require('http');
var express = require('express');
var irc = require('irc');

var userPort = process.env.USER_PORT || 5000;
var masterPort = process.env.MASTER_PORT || 9000;
var ircNick = 'praisebot';

var userApp = express();
userApp.use(express.static(__dirname + '/public/user'));
userApp.use('/sounds.json', express.static(__dirname + '/public/sounds.json'));
var userServer = http.createServer(userApp);
userServer.listen(userPort);

var masterApp = express();
masterApp.use(express.static(__dirname + '/public/master'));
masterApp.use('/sounds.json', express.static(__dirname + '/public/sounds.json'));
var masterServer = http.createServer(masterApp);
masterServer.listen(masterPort);

console.log('Client HTTP server listening on %d', userPort);
console.log('Master HTTP server listening on %d', masterPort);

var userWSS = new WebSocketServer({server: userServer});
var masterWSS = new WebSocketServer({server: masterServer});

var masterClientConnection = null;
var numUsers = 0;

userWSS.on('connection', function (ws) {
  ++numUsers;

  console.log('User joined (%d).', numUsers);

  ws.on('message', function (data) {
    data = JSON.parse(data);
    if (data.play) {
      console.log('Received play command: ' + data.play);
      if (masterClientConnection) {
        masterClientConnection.send(JSON.stringify(data));
      }
    }
  });

  ws.on('close', function() {
    console.log('User left (%d).', numUsers);
  });
});

masterWSS.on('connection', function (ws) {
  console.log('Master joined.');

  masterClientConnection = ws;

  ws.on('message', function (data) {

  });

  ws.on('close', function() {
    masterClientConnection = null;
    console.log('Master left.');
  });
});

var ircClient = new irc.Client('irc.mozilla.org', ircNick, {
  channels: ['#webmaker']
});

function processIRCMessage (channel, requester, message) {
  var messageMatch = message.match(/^(?:praisebot: )?(\w+)/);

  if (messageMatch && messageMatch[1]) {
    if (masterClientConnection) {
      ircClient.say(channel, requester + ': ok! ' + messageMatch[1] + 'ing');
      masterClientConnection.send(JSON.stringify({play: messageMatch[1]}));
    }
    else {
      ircClient.say(channel, requester + ': Sorry, nobody is around to do that :/.');
    }
  }
}

ircClient.addListener('message', function (from, to, message) {
  console.log('IRC: ' + from + ' => ' + to + ': ' + message);
  if (message.indexOf(ircNick + ': ') === 0) {
    processIRCMessage(to, from, message);
  }
});

ircClient.addListener('pm', function (from, message) {
  console.log('IRC: ' + from + ' => ME: ' + message);
  processIRCMessage(from, from, message);
});
