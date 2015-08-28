var ws = require('ws').Server;
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var basicAuth = require('basic-auth');
var irc = require('irc');
var sounds = require('./public/sounds.json');

var port = process.env.PORT || 5000;
var ircNick = 'praisebot';

var app = express();
var server = http.createServer(app);

function auth (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };

  var user = basicAuth(req);
  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === process.env.MASTER_USERNAME && process.env.MASTER_PASSWORD) {
    return next();
  } else {
    return unauthorized(res);
  };
};

app.use(bodyParser.json());

app.use('/', express.static(__dirname + '/public/user'));
app.use('/sounds.json', express.static(__dirname + '/public/sounds.json'));
app.use('/master', auth, express.static(__dirname + '/public/master'));

server.listen(port);

console.log('HTTP server listening on %d', port);

var websocketServer = new ws({server: server});

var masterClientConnection = null;

app.post('/play', function (req, res) {
  if (masterClientConnection) {
    if (req.body.play && sounds[req.body.play]) {
      masterClientConnection.send(JSON.stringify({play: req.body.play}));
      res.status(200).json({status: 'ok'});
    }
    else {
      res.status(200).json({status: 'invalid'});
    }
  }
  else {
    res.status(200).json({status: 'no master'});
  }
});

websocketServer.on('connection', function (ws) {
  console.log('Master joined.');

  if (!masterClientConnection) {
    masterClientConnection = ws;
  }
  else {
    console.warn('Another master tried to join.');
  }

  ws.on('close', function() {
    masterClientConnection = null;
    console.log('Master left.');
  });
});

// var ircClient = new irc.Client('irc.mozilla.org', ircNick, {
//   channels: ['#webmaker']
// });

// function processIRCMessage (channel, requester, message) {
//   var messageMatch = message.match(/^(?:praisebot: )?(\w+)/);

//   if (messageMatch && messageMatch[1]) {
//     if (masterClientConnection) {
//       if (sounds[messageMatch[1]]) {
//         ircClient.say(channel, requester + ': ok! ' + messageMatch[1] + 'ing');
//         masterClientConnection.send(JSON.stringify({play: messageMatch[1]}));
//       }
//       else {
//         ircClient.say(channel, requester + ': Sorry, that\'s not a thing I know how to do.');
//       }
//     }
//     else {
//       ircClient.say(channel, requester + ': Sorry, nobody is around to do that :/.');
//     }
//   }
// }

// ircClient.addListener('message', function (from, to, message) {
//   console.log('IRC: ' + from + ' => ' + to + ': ' + message);
//   if (message.indexOf(ircNick + ': ') === 0) {
//     processIRCMessage(to, from, message);
//   }
// });

// ircClient.addListener('pm', function (from, message) {
//   console.log('IRC: ' + from + ' => ME: ' + message);
//   processIRCMessage(from, from, message);
// });
