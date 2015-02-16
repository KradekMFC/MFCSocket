module.exports = require('./lib/MFCSocket');

module.exports.MFCMessage = require('./lib/MFCMessage');
module.exports.UserLookup = require('./lib/MFCMessage').UserLookup;
module.exports.JoinChannelMessage = require('./lib/MFCMessage').JoinChannelMessage;
module.exports.LeaveChannelMessage = require('./lib/MFCMessage').LeaveChannelMessage;


module.exports.MFCVideoState = require('./lib/MFCEnum').MFCVideoState;
module.exports.MFCChatOpt = require('./lib/MFCEnum').MFCChatOpt;
module.exports.MFCMessageType = require('./lib/MFCEnum').MFCMessageType;
module.exports.MFCResponseType = require('./lib/MFCEnum').MFCResponseType;
