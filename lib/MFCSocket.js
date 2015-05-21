var utils = require('util');
var EventEmitter = require('events').EventEmitter;
var MFCMessage = require("./MFCMessage");
var MFCMessageType = require("./MFCEnums").MFCMessageType;
var WebSocket = require('ws');
var request = require("request");

function MFCSocket(name, passCode) {
    var self = this;

    //private variables
    var sessionId = null;
    var userName = null;
    var loggedIn = false;
    var socket;
    var pingInterval;

        //socket event handlers
    function onSocketClosed(){
        clearInterval(pingInterval);
        self.emit('socketClosed');
    }
    function onSocketOpened(){
        socket.send("hello fcserver\n\0");
        //login as a guest
        var loginString = (name || "guest") + ":" + (passCode || "guest");
        socket.send(new MFCMessage({Type:MFCMessageType.FCTYPE_LOGIN, Arg1:"20071025", Data:loginString}).asMFCMessage());
        //set up a ping to the server so it doesn't
        //drop connection on us
        pingInterval = setInterval(function(){
            socket.send(new MFCMessage({Type:MFCMessageType.FCTYPE_NULL}).asMFCMessage());
        }, 15000);
    }
    function onSocketError(err){
        clearInterval(pingInterval);
        self.emit('socketError', err);
    }
    function onSocketMessage(msg, flags){
        // We only know how to deal with text.
        if (flags.binary)
            return;
            
        var mfcMessageQueue = msg; //websocket messages are always complete and don't need to be reconstructed/buffered

        //extract all MFC messages from the current websocket message
        while (mfcMessageQueue.length > 12){ //the minimum length required for a valid MFC message
            //get the current MFC message's payload length from the first 4 bytes
            var dataLength = parseInt(mfcMessageQueue.substring(0,4),10);

            //make sure the entire payload exists in the current websocket message
            if (mfcMessageQueue.length < dataLength + 4)
                return; //this is a malformed MFC message; ignore the rest of the current websocket message

            //get the data (payload) of the MFC message and send it to the MFC message handler
            var data = mfcMessageQueue.substring(4, dataLength + 4);

            onMFCMessage(data);

            //chop away the processed MFC message, to let the loop check for any further MFC messages
            mfcMessageQueue = mfcMessageQueue.substring(dataLength + 4);
        }
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
    request("http://www.myfreecams.com/mfc2/data/serverconfig.js", function (error, response, body) {
        if (error) {
            console.error(error);
            throw new Error("Unable to get a list of servers from MFC");
        }

        var mfcServers = JSON.parse(body);
        var servers = Object.keys(mfcServers.websocket_servers);
        var server = servers[Math.floor(Math.random() * servers.length)];

        var serverUrl = utils.format("ws://%s.myfreecams.com:8080/fcsl", server);
        //try to create a socket
        try {
            socket = new WebSocket(serverUrl);
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