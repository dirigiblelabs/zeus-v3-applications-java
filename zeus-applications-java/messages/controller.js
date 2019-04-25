var logging = require('log/v4/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');	
var Credentials = require("zeus-deployer/utils/Credentials");
var KnServicesApi = require("kubernetes/apis/serving.knative.dev/v1alpha1/Services");
var ServicesApi = require("kubernetes/api/v1/Services");
var VirtualServicesApi = require("kubernetes/apis/networking.istio.io/v1alpha3/VirtualServices");
var threads = require("core/v4/threads");

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
		deleteService(messageObject.name);
		deleteVirtualService("route-"+messageObject.name);
	}
	
	if (messageObject.operation.toLowerCase() === 'create' || messageObject.operation.toLowerCase() === 'update'){
		if (messageObject.warFilePath == undefined){
			if (messageObject.id == undefined){
				logger.error("No explicit war file path or application id specified in the message object. Can not handle.");
				throw Error("No explicit war file path or application id specified in the message object. Can not handle.");
			}
			logger.warn("No explicit war file path given. Falling back to application id not implemented yet.");
			// TODO: implement get from data base or deny such requests
			return;
		}		
		createService(messageObject.name, messageObject.warFilePath);
		var serviceName, retries;
		retry(function(retriesCount){
			retries = retriesCount;
			serviceName = getServiceName(messageObject.name);
			if(serviceName){
				logger.debug("Service for knative service route: {}", serviceName);
				return true;
			}
			logger.warn("Service for knative service route not ready yet. Wating some more time.");
			return false;
		}, 5, 30*1000, false);
		if (!serviceName){
			logger.error("Route service for knative service {} not ready after {} retries. Giving up to create VirtualService for it.", messageObject.name, retries);
		}
		createVirtualService(messageObject.name, serviceName, 'zeus');
	}
};

exports.onError = function(error) {
	logger.error("message receipt failure: {}", error);
};

function deleteService(serviceName) {
	var credentials = Credentials.getDefaultCredentials();
	var api = new KnServicesApi(credentials.server, credentials.token, credentials.namespace);
	api.delete(serviceName);
}

function createService(serviceName, warUrl) {
	var sourceUrl = "https://github.com/dirigiblelabs/zeus-v3-sample-war.git";
	var sourceVersion = "3dcfec744dcfe88adda56a1d9db73275cb82021a";
	var image = "docker.io/dirigiblelabs/" + serviceName + ":latest";
	
	var databaseUrl = "jdbc:postgresql://promart.cbzkdfbpc8mj.eu-central-1.rds.amazonaws.com/promart";
	var databaseUsername = "promart";
	var databasePassword = "Abcd1234";

	var entity = {
		"apiVersion": "serving.knative.dev/v1alpha1",
		"kind": "Service",
		"metadata": {
	        "name": serviceName,
	        "namespace": "zeus",
	    },
	    "spec": {
	        "runLatest": {
	            "configuration": {
	                "build": {
	                    "apiVersion": "build.knative.dev/v1alpha1",
	                    "kind": "Build",
	                    "spec": {
	                        "serviceAccountName": "kneo",
	                        "source": {
	                            "git": {
	                                "revision": sourceVersion,
	                                "url": sourceUrl
	                            }
	                        },
	                        "template": {
	                            "arguments": [
	                                {
	                                    "name": "IMAGE",
	                                    "value": image,
	                                },
	                                {
	                                    "name": "ARG",
	                                    "value": "WAR_URL=https://cmis.ingress.pro.promart.shoot.canary.k8s-hana.ondemand.com/services/v3/js/ide-documents/api/read/document/download?path=" + warUrl
	                                }
	                            ],
	                            "name": "kaniko-war-template"
	                        }
	                    },
	                    "timeout": "10m"
	                },
	                "revisionTemplate": {
	                    "metadata": {
	                        "annotations": {
	                            "autoscaling.knative.dev/maxScale": "10",
	                            "autoscaling.knative.dev/minScale": "1"
	                        },
	                        "creationTimestamp": null
	                    },
	                    "spec": {
	                        "container": {
	                            "env": [
	                                {
	                                    "name": "DefaultDB_driverClassName",
	                                    "value": "org.postgresql.Driver"
	                                },
	                                {
	                                    "name": "DefaultDB_url",
	                                    "value": databaseUrl
	                                },
	                                {
	                                    "name": "DefaultDB_username",
	                                    "value": databaseUsername
	                                },
	                                {
	                                    "name": "DefaultDB_password",
	                                    "value": databasePassword
	                                }
	                            ],
	                            "image": image,
	                            "imagePullPolicy": "Always",
	                            "name": "",
	                            "resources": {}
	                        },
	                        "timeoutSeconds": 300
	                    }
	                }
	            }
	        }
	    }
	};
	var credentials = Credentials.getDefaultCredentials();
	var api = new KnServicesApi(credentials.server, credentials.token, credentials.namespace);
	return api.create(entity);
}

function getServiceName(kserviceName) {
	var credentials = Credentials.getDefaultCredentials();
	var api = new ServicesApi(credentials.server, credentials.token, credentials.namespace);
	logger.debug("Getting service for route with label serving.knative.dev/service: {}", kserviceName);
	var items = api.list({labelSelector: "serving.knative.dev/service%3D" + kserviceName});
	if (items == undefined || items.length === 0){
		return;
	}
	return items[0].metadata.name;
}

function createVirtualService(appName, serviceName, namespace) {
	var entity = {
	    "apiVersion": "networking.istio.io/v1alpha3",
	    "kind": "VirtualService",
	    "metadata": {
	        "name": "route-"+appName,
	        "namespace": "zeus",
	    },
	    "spec": {
	        "gateways": [
	            "knative-ingress-gateway",
	            "mesh"
	        ],
	        "hosts": [
	            appName+".apps.onvms.com"
	        ],
	        "http": [
	            {
	                "match": [
	                    {
	                        "authority": {
	                            "exact": appName+".apps.onvms.com"
	                        }
	                    }
	                ],
	                "route": [
	                    {
	                        "destination": {
	                            "host": serviceName+"."+namespace+".svc.cluster.local",
	                            "port": {
	                                "number": 80
	                            }
	                        },
	                        "weight": 100
	                    }
	                ]
	            }
	        ]
	    }
	};
	var credentials = Credentials.getDefaultCredentials();
	var api = new VirtualServicesApi(credentials.server, credentials.token, credentials.namespace);
	return api.create(entity);
}

function deleteVirtualService(serviceName){
	var credentials = Credentials.getDefaultCredentials();
	var api = new VirtualServicesApi(credentials.server, credentials.token, credentials.namespace);
	return api.delete(serviceName);
}

function retry(retriedFunction, maxRetries, interval, progressive){
	var maxretries = maxRetries || 5;
	var retries=0;
	var sleepTime = interval || 15*1000;
	do {
		retries++;
		if (retriedFunction(retries)) {
			return;
		}
		if(progressive){
			if (typeof progressive === 'function'){
				sleepTime = progressive(sleepTime);
			} else {
				sleepTime = sleepTime*2;	
			}
		}
		java.lang.Thread.sleep(sleepTime);
	} while(retries < maxretries)
}