//var kserving = require('kubernetes/apis/serving.knative.dev/v1alpha1');
//var kbuild = require('kubernetes/apis/build.knative.dev/v1alpha1');
//var cluster = require('zeus/utils/cluster');
var logging = require('log/v4/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');	

exports.onMessage = function(message) {
	logger.trace("message received: " + message);
	var messageObject;
	try{
		messageObject = JSON.parse(message);	
	} catch (err){
		var msg;
		if (message && message.length > 1024){
			msg = message.substring(0, 1024) + '...';
		}
		logger.error('Invalid JSON: {}', msg);
		throw err;
	}
	
	if (!messageObject.operation){
		logger.error('Invalid message: "operation" is missing');
		throw new Error('Invalid message: "operation" is missing');
	}
	
	if (messageObject.operation.toLowerCase() === 'delete'){
		if (!messageObject.name){
			logger.error('Invalid message: "name" is missing');
			throw new Error('Invalid message: "name" is missing');
		}
		// TODO: handle delete
		// 		 delete existing KnativeSevice resource with the given name	
	}
	
	if (messageObject.operation.toLowerCase() === 'create' || messageObject.operation.toLowerCase() === 'update'){
		// TODO: validate create/update
		if (messageObject.warFilePath == undefined){
			if (messageObject.id == undefined){
				logger.error("No explicit war file path or application id specified in the message object. Can not handle.");
				throw Error("No explicit war file path or application id specified in the message object. Can not handle.");
			}
			logger.warn("No explicit war file path given. Falling back to application id not implemented yet.");
			// TODO: implement get from data base or deny such requests
			return;
		}		
		// TODO: handle create/update
		// 		 create and apply a KnativeSevice manifest or update existing resource with application name and the war file path in the build phase
	}
};

exports.onError = function(error) {
	logger.error("message receipt failure: {}", error);
};

//var buildKService = function(name, namespace){
//	var clusterSettings = cluster.getSettings();
//	var server = clusterSettings.server;
//	var namespace = clusterSettings.namespace;
//	var token = clusterSettings.token;
//	
//	var ksvcApi = new kserving.Services(server, token, namespace);
//
//	var ksvc = ksvcApi.getEntityBuilder();
//	ksvc.getMetadata().setName(name);
//	ksvc.getMetadata().setNamespace(namespace);
//
//	var kbuildApi = new kbuild.Build(server, token, namespace);	
//	var kbuild = ksvcApi.getEntityBuilder();
//	//TODO
//	ksvc.getSpec().getRunLatest().getConfiguration().setBuild(kbuild.build());
//	
//	return ksvc.build();
//};
//
//var deploy = function(){
//
//};