var logging = require('log/v4/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');	
var Credentials = require("zeus-deployer/utils/Credentials");
var ServicesApi = require("kubernetes/apis/serving.knative.dev/v1alpha1/Services");

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
		createService(messageObject.name, messageObject.warFilePath);
	}
};

exports.onError = function(error) {
	logger.error("message receipt failure: {}", error);
};

function deleteService(serviceName) {
	var credentials = Credentials.getDefaultCredentials();
	var api = new ServicesApi(credentials.server, credentials.token, credentials.namespace);
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
	var api = new ServicesApi(credentials.server, credentials.token, credentials.namespace);
	return api.create(entity);
}

function getServiceName(kserviceName) {
	var credentials = Credentials.getDefaultCredentials();
	var api = new ServicesApi(credentials.server, credentials.token, credentials.namespace);
	var entity = api.get("/api/v1/services?labelSelector=serving.knative.dev/service%3D"+kserviceName);//TODO: ?
	return entity.metadata.name;
}

function createVirtualService(appName, kserviceName, namespace) {
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
	                            "host": kserviceName+"."+namespace+".svc.cluster.local",
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
	var api = new ServicesApi(credentials.server, credentials.token, credentials.namespace);
	return api.create(entity);
}