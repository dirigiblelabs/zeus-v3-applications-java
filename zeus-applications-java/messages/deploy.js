var logging = require('log/v3/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');	

exports.onMessage = function(message) {
	var messageObject = JSON.parse(message);
	var warFilePath = messageObject.warFilePath;
	if (warFilePath == undefined){
		if (messageObject.ids == undefined){
			logger.error("No explicit war file path or applicaiton id specified in the message object. Can not handle.");
			return;
		}
		logger.warn("No explicit war file path given. Falling back to application id not implemented yet.");
		// TODO: implement get from data base or deny such requests
		return;
	}
	// TODO: create and apply a KnativeSevice manifest with the war file path in the build phase
	console.info("message received" + message);
};

exports.onError = function(error) {
	console.error(error)
	//logger.error("message receipt failure: {}", error);
};