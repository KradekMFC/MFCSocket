module.exports = require('./lib/MFCSocket');

module.exports.MFCMessage = require('./lib/MFCMessage');
module.exports.UserLookup = require('./lib/MFCMessage').UserLookup;
module.exports.JoinChannelMessage = require('./lib/MFCMessage').JoinChannelMessage;
module.exports.LeaveChannelMessage = require('./lib/MFCMessage').LeaveChannelMessage;


module.exports.MFCEnums = require('./lib/MFCEnums'); //this object includes all enum types classified as unknown
module.exports.MFCVideoState = require('./lib/MFCEnums').MFCVideoState;
module.exports.MFCChatOpt = require('./lib/MFCEnums').MFCChatOpt;
module.exports.MFCMessageType = require('./lib/MFCEnums').MFCMessageType;
module.exports.MFCResponseType = require('./lib/MFCEnums').MFCResponseType;
module.exports.MFCAccessLevel = require('./lib/MFCEnums').MFCAccessLevel;
