var utils = require('util');
var EventEmitter = require('events').EventEmitter;
var MFCMessage = require("./MFCMessage");
var MFCMessageType = require("./MFCEnums").MFCMessageType;
var WebSocket = require('ws');
var request = require("request");
var nconf = require("nconf");

// Allow a config file to override constants
nconf.file({file: "mfcsocket.json"});

// Set up constants defaults
nconf.defaults({
    protocol: {
        name: "rfc6455", // default to rfc5455
        version: 13
    },
    urls: {
        origin: "http://m.myfreecams.com",
        serverConfigFile: "http://www.myfreecams.com/mfc2/data/serverconfig.js",
        socketFormat: "ws://%s.myfreecams.com:8080/fcsl"
    },
    pingIntervalInSeconds: 15000, // keep alive ping every 15 seconds
    defaultUserName: "guest",
    defaultPassCode: "guest",
    msgLengthCharCount: 4
});

var SOCKET_CONFIG = nconf.get();

function MFCSocket(name, passCode) {
    var self = this;

    //private variables
    var sessionId = null;
    var userName = null;
    var loggedIn = false;
    var socket;
    var pingInterval;
    var buffer = "";

    //socket event handlers
    function onSocketClosed(){
        clearInterval(pingInterval);
        self.emit('socketClosed');
    }
    function onSocketError(err){
        clearInterval(pingInterval);
        self.emit('socketError', err);
    }
    function onSocketOpened(){
        socket.send("hello fcserver\n\0");
        //login as a guest
        var loginString = (name || SOCKET_CONFIG.defaultUserName) + ":" + (passCode || SOCKET_CONFIG.defaultPassCode);
        socket.send(new MFCMessage({Type:MFCMessageType.FCTYPE_LOGIN, Arg1:"20071025", Data:loginString}).asMFCMessage());
        //set up a ping to the server so it doesn't
        //drop connection on us
        pingInterval = setInterval(function(){
            socket.send(new MFCMessage({Type:MFCMessageType.FCTYPE_NULL}).asMFCMessage());
        }, SOCKET_CONFIG.pingIntervalInSeconds);
    }
    function onSocketMessage(msg, flags){
        // We only know how to deal with text
        if (flags.binary)
            return;

        //copy server message into buffer
        buffer += msg;
        //while we have valid messages, parse them out
        do {
            //determine the length of the first message in the buffer
            var msgLength = parseInt(buffer.substr(0, SOCKET_CONFIG.msgLengthCharCount), 10);
            var fullMsgLength = msgLength + SOCKET_CONFIG.msgLengthCharCount;
            
            if (isNaN(msgLength)) {
                //we got screwed up somewhere, may want to actually attempt a disconnect/reconnect
                //for now, just reset the buffer and leave
                buffer = "";
                return;   
            }

            //if the buffer does not contain enough data for the current message, wait for more data
            if (buffer.length < fullMsgLength)
                return;
            
            buffer = buffer.substr(SOCKET_CONFIG.msgLengthCharCount);
            
            //capture the MFC message and send it to the handler
            onMFCMessage(buffer.substr(0, msgLength));
            
            //remove the current message from the buffer
            buffer = buffer.substr(msgLength)

        } while (buffer.length >= SOCKET_CONFIG.msgLengthCharCount);
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

    //attempt to get a list of the available servers from MFC and connect to a random one
    request(SOCKET_CONFIG.urls.serverConfigFile, function (error, response, body) {
        if (error) {
            console.error(error);
            throw new Error("Unable to get a list of servers from MFC");
        }

        var mfcServers = JSON.parse(body).websocket_servers;
        var servers = Object.keys(mfcServers).filter(function(k){ return mfcServers[k] === SOCKET_CONFIG.protocol.name; });
        var server = servers[Math.floor(Math.random() * servers.length)];

        var serverUrl = utils.format(SOCKET_CONFIG.urls.socketFormat, server);
        //try to create a socket
        try {
            var opts = {
                protocolVersion: SOCKET_CONFIG.protocol.version, 
                origin: SOCKET_CONFIG.urls.origin
            };
            socket = new WebSocket(serverUrl, opts);
        }
        catch (e) {
            throw new Error("Error creating websocket.");
        }

        socket.on("open", onSocketOpened);
        socket.on("message", onSocketMessage);
        socket.on("error", onSocketError);
        socket.on("close", onSocketClosed);
        self.server = server;
    });

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
        socket.close();
    }
}

utils.inherits(MFCSocket, EventEmitter);

module.exports = MFCSocket;