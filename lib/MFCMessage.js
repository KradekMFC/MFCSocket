var MFCMessageType = require("./MFCEnum").MFCMessageType;
var _  = require('underscore');
_.str = require('underscore.string');
_.mixin(_.str.exports());
_.str.include('Underscore.string', 'string');

function MFCMessage(initializer){
    var self = this;

    if ("string" === typeof(initializer)){
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
                    MFCMessageType.FCTYPE_SETGUESTNAME
                ];

                if (jsonPayload.indexOf(self.Type) != -1 ||
                    (self.Type == MFCMessageType.FCTYPE_JOINCHAN && self.Arg2 == MFCMessageType.FCCHAN_PART)) {
                    var parsed;
                    try {
                        parsed = JSON.parse(unescape(initializer));
                    } catch(err){}
                    self.Data = parsed;
                }
            }
            else
                self.Data = initializer;
        }
    }

    if ("object" === typeof(initializer)){
        _.extend(self, initializer);
    }

    self.asMFCMessage = function asMFCMessage(){
        var msg = _.sprintf("%s %s %s %s %s", self.Type, self.From, self.To, self.Arg1, self.Arg2);
        if (undefined !== self.Data){
            msg += " " + self.Data;
        }
        msg += "\n\0";
        return msg;
    }
}

//shortcut class for userlookups
function UserLookup(username){
    return new MFCMessage({Type: MFCMessageType.FCTYPE_USERNAMELOOKUP, From: 0, To: 0, Arg1: 20, Arg2: 0, Data: username});
}

module.exports = MFCMessage;
module.exports.UserLookup = UserLookup;
