var utils = require('util');
var EventEmitter = require('events').EventEmitter;
var MFCMessage = require("./MFCMessage");
var MFCMessageType = require("./MFCEnum").MFCMessageType;
var WebSocket = require('ws');
var _  = require('underscore');
_.str = require('underscore.string');
_.mixin(_.str.exports());
_.str.include('Underscore.string', 'string');

function MFCSocket(name, passCode) {
    var self = this;
    //list of websocket chat servers
    var servers = [
        { Name: "xchat11", Type: "hybi00" },
        { Name: "xchat12", Type: "hybi00" },
        { Name: "xchat20", Type: "hybi00" },
        { Name: "xchat7", Type: "rfc6455" },
        { Name: "xchat8", Type: "rfc6455" },
        { Name: "xchat9", Type: "rfc6455" },
        { Name: "xchat10", Type: "rfc6455" }
    ];

    //choose a random server
    var server = servers[Math.floor(Math.random() * servers.length)];
    var serverUrl = _.sprintf("ws://%s.myfreecams.com:8080/fcsl", server.Name);

    //private variables
    var sessionId = null;
    var userName = null;
    var loggedIn = false;
    var socket;
    var queued;

        //socket event handlers
    function onSocketClosed(msg){
        self.emit('socketClosed', msg);
    }
    function onSocketOpened(){
        socket.send("hello fcserver\n\0");
        //login as a guest
        var loginString = (name || "guest") + ":" + (passCode || "guest");
        socket.send(new MFCMessage({Type:MFCMessageType.FCTYPE_LOGIN, From:0, To:0, Arg1:"20071025",Arg2:0,Data: loginString}).asMFCMessage());
        //set up a ping to the server so it doesn't
        //drop connection on us
        setInterval(function(){
            socket.send(new MFCMessage({Type:MFCMessageType.FCTYPE_NULL, From:0, To:0, Arg1:0, Arg2:0}).asMFCMessage());
        }, 15000);
    }
    function onSocketError(err){
        self.emit('socketError', err);
    }
    function onSocketMessage(msg){
        var serverMessage = msg.data;
        //queued = serverMessage.replace(/\r\n/g, ""); //strip out any inserted carriage returns
        queued = serverMessage;
        while (queued.length > 12){
            var dataLength = parseInt(queued.substring(0,4),10);

            if (queued.length < dataLength + 4)
                return; //wait for more data

            var data = queued.substring(4, dataLength + 4);

            if (data.length !== dataLength)
                break; //malformed message

            onMFCMessage(data);

            queued = queued.substring(dataLength + 4);
        }

        queued = "";
    }
    //internal message handler
    function onMFCMessage(msg){
        var parsedMsg = new MFCMessage(msg);

        //capture the sessionid and assigned username
        if (MFCMessageType.FCTYPE_LOGIN == parsedMsg.Type) {
            sessionId = parsedMsg.To;
            userName = parsedMsg.Data;
            loggedIn = true;
            self.emit('loggedIn', {Username: userName, SessionId: sessionId});
        }

        self.emit('mfcMessage', parsedMsg);
    }

    //try to create a socket
    try
    {
        socket = new WebSocket(serverUrl);
    }
    catch(e)
    {
        throw new Error("This environment does not implement WebSockets.");
        return;
    }

    socket.onopen =  onSocketOpened;
    socket.onmessage = onSocketMessage;
    socket.onerror = onSocketError;
    socket.onclose = onSocketClosed;

    //send message
    var sendMessageQueue = [];
    function sendMessage(msg){
        //if there is a msg and its not an MFCMessage, leave
        if ((undefined !== msg) && !(msg instanceof MFCMessage))
            throw new Error("msg is not an instance of MFCMessage");
        else
            sendMessageQueue.push(msg);

        //indicate a problem if the socket is closed
        if (socket.readyState === 3 || socket.readyState === 2) //closed, closing
            throw new Error("Attempt to send message while socket was closing or closed.");

        //if the socket is open process the queue
        if (socket.readyState === 1 && null !== sessionId){
            var currentMsg = sendMessageQueue.pop();
            while (undefined !== currentMsg){
                socket.send(currentMsg.asMFCMessage());
                currentMsg = sendMessageQueue.pop();
            }
        }
        else {
            //otherwise, try again later
            setTimeout(sendMessage, 100);
        }
    }


    this.send = sendMessage;
    this.loggedIn = function(){
        return loggedIn;
    }
    this.getSessionId = function() {
        return sessionId;
    }
    this.logout = function(){
        listeners = [];
        socket.close();
    }
    this.server = server;
}

utils.inherits(MFCSocket, EventEmitter);

module.exports = MFCSocket;