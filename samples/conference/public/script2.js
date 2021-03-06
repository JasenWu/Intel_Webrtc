(function () {
  'use strict';
  var localStream;
  function getParameterByName (name) {
    name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
        results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }

  var subscribeMix = getParameterByName('mix') || 'true';

  function createToken (room, userName, role, callback) {
    var req = new XMLHttpRequest();
    var url = '/createToken/';
    var body = {room: room, username: userName, role: role};
    req.onreadystatechange = function () {
      if (req.readyState === 4) {
        callback(req.responseText);
      }
    };
    req.open('POST', url, true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.send(JSON.stringify(body));
  }

  var conference = Woogeen.ConferenceClient.create({});

  function displayStream (stream, resolution) {
    var div = document.createElement('div');
    var streamId = stream.id();
    if (stream instanceof Woogeen.RemoteMixedStream) {
      resolution = resolution || {width: 640, height: 480};
    } else {
      resolution = resolution || {width: 320, height: 240};
    }
    if (!resolution.width || !resolution.height || resolution.width > 640) {
      resolution = {width: 640, height: 480};
    }
    div.setAttribute('style', 'width: '+resolution.width+'px; height: '+resolution.height+'px;');
    div.setAttribute('id', 'test' + streamId);
    div.setAttribute('title', 'Stream#' + streamId);
    document.body.appendChild(div);
    if (window.navigator.appVersion.indexOf('Trident') < 0){
      stream.show('test' + streamId);
    } else {
      L.Logger.info('displayStream:', stream.id());
      var canvas = document.createElement('canvas');
      canvas.width = resolution.width;
      canvas.height = resolution.height;
      canvas.setAttribute('autoplay', 'autoplay::autoplay');
      div.appendChild(canvas);
      var ieStream = new Woogeen.ieplugin.ieMediaStream(stream.mediaStream.label);
      attachRemoteMediaStream(canvas, ieStream, stream.pcid);
    }
  }

  function trySubscribeStream (stream) {
    if (stream instanceof Woogeen.RemoteMixedStream) {
      stream.on('VideoLayoutChanged', function () {
        L.Logger.info('stream', stream.id(), 'VideoLayoutChanged');
      });
      if (subscribeMix === 'true') {
        L.Logger.info('subscribing:', stream.id());
        var resolutions = stream.resolutions();
        var videoOpt = true;
        var resolution;
        if (resolutions.length > 1) {
          resolution = resolutions[Math.floor(Math.random()*10)%2];
          videoOpt = {resolution: resolution};
          L.Logger.info('subscribe stream with option:', resolution);
        }
        conference.subscribe(stream, {video: videoOpt}, function () {
          L.Logger.info('subscribed:', stream.id());
          displayStream(stream, resolution);
        }, function (err) {
          L.Logger.error(stream.id(), 'subscribe failed:', err);
        });
      } else {
        L.Logger.info('won`t subscribe', stream.id());
      }
    } else {
      ['VideoEnabled', 'AudioEnabled', 'VideoDisabled', 'AudioDisabled'].map(function (event_name) {
        stream.on(event_name, function () {
          L.Logger.info('stream', stream.id(), event_name);
        });
      });
      if (subscribeMix !== 'true' || stream.isScreen()) {
        L.Logger.info('subscribing:', stream.id());
        conference.subscribe(stream, function () {
          L.Logger.info('subscribed:', stream.id());
          displayStream(stream);
        }, function (err) {
          L.Logger.error(stream.id(), 'subscribe failed:', err);
        });
      } else {
        L.Logger.info('won`t subscribe', stream.id());
      }
    }
  }

  conference.onMessage(function (event) {
    L.Logger.info('Message Received:', event.msg);
  });

  conference.on('server-disconnected', function () {
    L.Logger.info('Server disconnected');
  });

  conference.on('stream-added', function (event) {
    var stream = event.stream;
    // if(stream.id() !== localStream.id()) return;
    L.Logger.info('stream added:', stream.id());
    var fromMe = false;
    for (var i in conference.localStreams) {
      if (conference.localStreams.hasOwnProperty(i)) {
        if (conference.localStreams[i].id() === stream.id()) {
          fromMe = true;
          break;
        }
      }
    }
    if (fromMe) {
      L.Logger.info('stream', stream.id(), 'is from me; will not be subscribed.');
      return;
    }
    trySubscribeStream(stream);
  });

  conference.on('stream-removed', function (event) {
    var stream = event.stream;
    L.Logger.info('stream removed: ', stream.id());
    var id = stream.elementId !==undefined ? stream.elementId : 'test' + stream.id();
    if (id !== undefined) {
      var element = document.getElementById(id);
      if (element) {document.body.removeChild(element);}
    }
  });

  conference.on('user-joined', function (event) {
    L.Logger.info('user joined:', event.user);
  });

  conference.on('user-left', function (event) {
    L.Logger.info('user left:', event.user);
  });

  conference.on('recorder-added', function (event) {
    L.Logger.info('media recorder added:', event.recorderId);
  });

  conference.on('recorder-continued', function (event) {
    L.Logger.info('media recorder continued:', event.recorderId);
  });

  conference.on('recorder-removed', function (event) {
    L.Logger.info('media recorder removed:', event.recorderId);
  });

  window.onload = function () {
    L.Logger.setLogLevel(L.Logger.INFO);
    var myResolution = getParameterByName('resolution') || 'vga';
    var shareScreen = getParameterByName('screen') || false;
    var myRoom = getParameterByName('room');
    var isHttps = (location.protocol === 'https:');
    var mediaUrl = getParameterByName('url');
    var isPublish = getParameterByName('publish');

    if (isHttps) {
      var shareButton = document.getElementById('shareScreen');
      if (shareButton) {
        shareButton.setAttribute('style', 'display:block');
        shareButton.onclick = (function () {
          conference.shareScreen({resolution: myResolution}, function (stream) {
            document.getElementById('myScreen').setAttribute('style', 'width:320px; height: 240px;');
            stream.show('myScreen');
          }, function (err) {
            L.Logger.error('share screen failed:', err);
          });
        });
      }
    }

    var externalOutputButton = document.getElementById('externalOutput');
    externalOutputButton.onclick = (function () {
      var isOutputing;
      var startExternalOutput = 'start external streaming';
      var stopExternalOutput = 'stop external streaming';
      externalOutputButton.innerHTML = startExternalOutput;
      return function () {
        var url = document.getElementById('externalOutputURL');
        if (!url || !url.value) {
          L.Logger.error('invalid url of rtsp server.');
          return;
        }
        if (!isOutputing) {
          conference.addExternalOutput(url.value, function () {
            L.Logger.info('started external streaming');
            isOutputing = true;
            externalOutputButton.innerHTML = stopExternalOutput;
          }, function (err) {
            L.Logger.error('start external streaming failed:', err);
          });
        } else {
          conference.removeExternalOutput(url.value, function () {
            L.Logger.info('stopped external streaming');
            isOutputing = false;
            externalOutputButton.innerHTML = startExternalOutput;
          }, function (err) {
            L.Logger.error('stop external streaming failed:', err);
          });
        }
      };
    }());

    createToken(myRoom, 'user', 'presenter', function (response) {
      var token = response;

      conference.join(token, function (resp) {
        if (typeof mediaUrl === 'string' && mediaUrl !== '') {
            Woogeen.ExternalStream.create({
            url: mediaUrl
          }, function (err, stream) {
            if (err) {
              return L.Logger.error('create ExternalStream failed:', err);
            }
            localStream = stream;
            conference.publish(localStream, {}, function (st) {
              L.Logger.info('stream published:', st.id());
            }, function (err) {
               L.Logger.error('publish failed:', err);
            });
          });
        } else if (shareScreen === false) {
          if(isPublish !== 'false') {
            Woogeen.LocalStream.create({
              video: {
                device: 'camera',
                resolution: myResolution
              },
              audio: true
            }, function (err, stream) {
              if (err) {
                return L.Logger.error('create LocalStream failed:', err);
              }
              localStream = stream;
              if (window.navigator.appVersion.indexOf('Trident') < 0){
                localStream.show('myVideo');
              }
              if (window.navigator.appVersion.indexOf('Trident') > -1){
                var canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 240;
                canvas.setAttribute('autoplay', 'autoplay::autoplay');
                document.getElementById('myVideo').appendChild(canvas);
                attachMediaStream(canvas, localStream.mediaStream);
              }
              conference.publish(localStream, {}, function (st) {
                L.Logger.info('stream published:', st.id());
              }, function (err) {
                 L.Logger.error('publish failed:', err);
              });
            });
          }
        } else if (isHttps) {
          conference.shareScreen({resolution: myResolution}, function (stream) {
            document.getElementById('myScreen').setAttribute('style', 'width:320px; height: 240px;');
            stream.show('myScreen');
          }, function (err) {
            L.Logger.error('share screen failed:', err);
          });
        } else {
          L.Logger.error('Share screen must be done in https enviromnent!');
        }
        var streams = resp.streams;
        streams.map(function (stream) {
          L.Logger.info('stream in conference:', stream.id());
          trySubscribeStream(stream);
        });
        var users = resp.users;
        if (users instanceof Array) {
          users.map(function (u) {
            L.Logger.info('user in conference:', u);
          });
        }
      }, function (err) {
        L.Logger.error('server connection failed:', err);
      });
    });
  };

  window.onbeforeunload = function() {
    if (localStream){
      localStream.close();
      if (localStream.channel && typeof localStream.channel.close === 'function') {
        localStream.channel.close();
      }
    }
    for (var i in conference.remoteStreams) {
      if (conference.remoteStreams.hasOwnProperty(i)) {
        var stream = conference.remoteStreams[i];
        stream.close();
        if (stream.channel && typeof stream.channel.close === 'function') {
          stream.channel.close();
        }
        delete conference.remoteStreams[i];
      }
    }
  };

}());
