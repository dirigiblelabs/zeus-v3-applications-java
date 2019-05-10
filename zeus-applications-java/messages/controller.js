var logging = require('log/v4/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');
var Credentials = require("zeus-deployer/utils/Credentials");
var KnServicesApi = require("kubernetes/apis/serving.knative.dev/v1alpha1/Services");
var ServicesApi = require("kubernetes/api/v1/Services");
var SecretsApi = require("kubernetes/api/v1/Secrets");
var VirtualServicesApi = require("kubernetes/apis/networking.istio.io/v1alpha3/VirtualServices");
var bindingsecrets = require('zeus-applications-java/messages/bindingsecrets');
var bindings = require('zeus-bindings/k8s');
var retry = require('zeus-applications-java/commons/retry');

exports.onMessage = function(message) {
	logger.debug("message received: {}", message);
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
		deleteKnativeService(messageObject.name);
		deleteVirtualService("route-"+messageObject.name);
		bindingsecrets.deleteServiceBindingSecrets(messageObject.name);
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
		let _bindings;
		if (messageObject.bindings){
			_bindings = JSON.parse(messageObject.bindings);
		}

		// const databaseUrl = "jdbc:postgresql://promart.cbzkdfbpc8mj.eu-central-1.rds.amazonaws.com/promart";
		// const databaseUsername = "promart";
		// const databasePassword = "Abcd1234";
		// bindingsecrets.applyBindingSecret(messageObject.name, "postgre", {
		// 	"DefaultDB_driverClassName": "org.postgresql.Driver",
		// 	"DefaultDB_url": databaseUrl,
		// 	"DefaultDB_username": databaseUsername,
		// 	"DefaultDB_password": databasePassword
		// });
		// let credentials = Credentials.getDefaultCredentials();
		// let bindingSecret;
		// let bindingSecretName = messageObject.name+"-postgre";
		// retry(function(retriesCount){
		// 		retries = retriesCount;
		// 		let api = new SecretsApi(credentials.server, credentials.token, credentials.namespace);
		// 		bindingSecret = api.get(messageObject.name+"-postgre");
		// 		if(bindingSecret){
		// 			return true;
		// 		}
		// 		logger.debug("service binding {} for knative service {}. Wating some more time.", messageObject.name+"-postgre", messageObject.name);
		// 		return false;
		// 	}, 3, 10*1000, false);	

		createKnativeService(messageObject.name, messageObject.warFilePath, _bindings);
		var serviceName, retries;
		retry(function(retriesCount){
			retries = retriesCount;
			serviceName = getServiceName(messageObject.name);
			if(serviceName){
				logger.debug("Service for knative service route: {}", serviceName);
				return true;
			}
			logger.debug("Service for knative service route not ready yet. Wating some more time.");
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

function deleteKnativeService(serviceName) {
	let credentials = Credentials.getDefaultCredentials();
	let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
	api.delete(serviceName);
}

function createKnativeService(serviceName, warUrl, bindings) {
	// let bindingsSecrets = bindingsecrets.listBindingSecrets(serviceName);

	let env = [];
	let annotations = {}
	if(bindings){
		bindings.forEach(function(secret){
			for (prop in secret.properties){
				env.push({
					"name": prop,
					"valueFrom": {
						"secretKeyRef": {
							"name": secret.name,
							"key": prop
						}
					}
				})
			}
		});
		annotations["zeus.service/bindings"] = bindings.map(function(elem){
													return elem.name;
												}).join(",");
	}

	const sourceUrl = "https://github.com/dirigiblelabs/zeus-v3-sample-war.git";
	const sourceVersion = "a50a66db2cc9296d9c55499427b28764a05f8be3";
	let image = "docker.io/dirigiblelabs/" + serviceName + ":latest";

	let entity = {
		"apiVersion": "serving.knative.dev/v1alpha1",
		"kind": "Service",
		"metadata": {
	        "name": serviceName,
	        "namespace": "zeus",
			"annotations": annotations,
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
	                            "env": env,
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
	let credentials = Credentials.getDefaultCredentials();
	let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
	logger.info("Creating serving.knative.dev/v1alpha1 Service {}", serviceName);
	logger.debug("{}", entity);
	return api.create(entity);
}

function getServiceName(kserviceName) {
	var credentials = Credentials.getDefaultCredentials();
	var api = new ServicesApi(credentials.server, credentials.token, 'zeus');
	logger.debug("Getting service for route with label serving.knative.dev/service: {}", kserviceName);
	let items = api.list({labelSelector: "serving.knative.dev/service%3D" + kserviceName});
	if (items == undefined || items.length === 0){
		return;
	}
	return items[0].metadata.name;
}

function createVirtualService(appName, serviceName, namespace) {
	let vservicename = "route-"+appName
	let entity = {
	    "apiVersion": "networking.istio.io/v1alpha3",
	    "kind": "VirtualService",
	    "metadata": {
	        "name": vservicename,
	        "namespace": "knative-serving",
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
					"retries": {
						"attempts": 3,
						"perTryTimeout": "10m0s"
					},
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
	                ],
					"timeout": "10m0s",
					"websocketUpgrade": true
	            }
	        ]
	    }
	};
	let credentials = Credentials.getDefaultCredentials();
	let api = new VirtualServicesApi(credentials.server, credentials.token, 'knative-serving');
	logger.info("Creating networking.istio.io/v1alpha3 VirtualService {}", vservicename);
	return api.create(entity);
}

function deleteVirtualService(serviceName){
	let credentials = Credentials.getDefaultCredentials();
	let api = new VirtualServicesApi(credentials.server, credentials.token, 'knative-serving');
	logger.info("Deliting networking.istio.io/v1alpha3 VirtualService {}", serviceName);
	return api.delete(serviceName);
}