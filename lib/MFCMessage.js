var MFCMessageType = require("./MFCEnum").MFCMessageType;
var MFCChatOpt = require("./MFCEnum").MFCChatOpt;
var util = require("util");
var _  = require('underscore');

function MFCMessage(initializer){
    var self = this;

    self.initializer = initializer; //save a copy of the initializer for debugging

    //if we received an object, simply extend this mfc message object using its data fields
    if ("object" === typeof(initializer)){
        //make sure that they at least provide the Type property
        if (!initializer.hasOwnProperty("Type")) {
            throw new Error("Attempt to initialize an MFCMessage from object without Type property.");
        }
        
        //use a default value of 0 for all typical properties, to allow them to be skipped in initializer
        self.From = self.To = self.Arg1 = self.Arg2 = 0;
        
        //copy all of the initializer object's own (non-inherited) properties, overwriting any default values
        _.extendOwn(self, initializer);
    }

    //otherwise build the mfc message object from a string, if provided
    else if ("string" === typeof(initializer)){
        //strip out newlines
        initializer = initializer.replace(/(\r\n|\n|\r)/gm, "");

        //parse out the typical pieces
        ["Type","From","To","Arg1","Arg2"].forEach(function(part){
            var delimiterPos = initializer.indexOf(" ");
            self[part] = initializer.substring(0, delimiterPos);
            initializer = initializer.substring(delimiterPos + 1)
        });

        //convert Type to an int
        self.Type = parseInt(self.Type,10);

        //parse out data if there is any
        if (initializer.length > 0){

            if (self.Type != MFCMessageType.FCTYPE_LOGIN) {
                //these message types always carry json payloads
                var jsonPayload = [
                    MFCMessageType.FCTYPE_DETAILS,
                    MFCMessageType.FCTYPE_ADDFRIEND,
                    MFCMessageType.FCTYPE_ADDIGNORE,
                    MFCMessageType.FCTYPE_SESSIONSTATE,
                    MFCMessageType.FCTYPE_CMESG,
                    MFCMessageType.FCTYPE_PMESG,
                    MFCMessageType.FCTYPE_TXPROFILE,
                    MFCMessageType.FCTYPE_USERNAMELOOKUP,
                    MFCMessageType.FCTYPE_MYCAMSTATE,
                    MFCMessageType.FCTYPE_SETGUESTNAME,
                    MFCMessageType.FCTYPE_METRICS,
                    MFCMessageType.FCTYPE_ROOMDATA,
                    MFCMessageType.FCTYPE_TOKENINC
                ];

                //if the provided message type has a json payload, we will parse it into an object
                if (jsonPayload.indexOf(self.Type) != -1 ||
                    (self.Type == MFCMessageType.FCTYPE_JOINCHAN && self.Arg2 == MFCMessageType.FCCHAN_PART)) {
                    var parsed;
                    try {
                        parsed = JSON.parse(unescape(initializer));
                    } catch(err){}
                    self.Data = parsed; //store the object payload
                }
            }
            else
                self.Data = initializer; //store the plaintext payload
        }
    }

    self.asMFCMessage = function asMFCMessage(){
        var msg = util.format("%s %s %s %s %s", self.Type, self.From, self.To, self.Arg1, self.Arg2);
        if (undefined !== self.Data){
            if (typeof self.Data == "object")
                msg += " " + JSON.stringify(self.Data); // objects/arrays must be converted to a json string
            else
                msg += " " + self.Data;
        }
        msg += "\n\0";
        return msg;
    }
}

//shortcut class for userlookups
function UserLookup(username){
    return new MFCMessage({ Type: MFCMessageType.FCTYPE_USERNAMELOOKUP, Arg1: 20, Data: username });
}

//shortcut class for join channel
function JoinChannelMessage(sessionId, broadcasterId) {
    var publicChannelId = 100000000 + broadcasterId;
    return new MFCMessage({ Type: MFCMessageType.FCTYPE_JOINCHAN, From: sessionId, Arg1: publicChannelId, Arg2: MFCChatOpt.FCCHAN_JOIN });
}

//shortcut class for join channel
function LeaveChannelMessage(sessionId, broadcasterId) {
    var publicChannelId = 100000000 + broadcasterId;
    return new MFCMessage({ Type: MFCMessageType.FCTYPE_JOINCHAN, From: sessionId, Arg1: publicChannelId, Arg2: MFCChatOpt.FCCHAN_PART });
}

module.exports = MFCMessage;
module.exports.UserLookup = UserLookup;
module.exports.JoinChannelMessage = JoinChannelMessage;
module.exports.LeaveChannelMessage = LeaveChannelMessage;
