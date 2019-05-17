var logging = require('log/v4/logging');
var response = require('http/response');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');
var rs = require('http/v4/rs');
var producer = require('messaging/v3/producer');
var messagesTopic = producer.topic("/zeus-applications-java/control");
var bindings = require('zeus-bindings/k8s');
var apierrors = require("kubernetes/errors");
var selectorsApi = require("kubernetes/labelselectors");
var Credentials = require("zeus-deployer/utils/Credentials");
var KnServicesApi = require("kubernetes/apis/serving.knative.dev/v1alpha1/Services");

let BadRequestError = function(message, details) {
  this.name = "BadRequestError";
  this.message = message || "";
  this.details = details || "";
  this.reason = 'BadRequest';
  this.code = 400;
};
BadRequestError.prototype = Error.prototype;

function getLastModifiedTime(resource){
    if(resource.status.conditions){
        let readyCondition = resource.status.conditions.find(function(condition){
            return condition.type === 'Ready' && condition.status === "True";
        });
        if(readyCondition)
            return readyCondition.lastTransitionTime;
    }
    return;
}

function getStatus(resource){
    let s = {};
    if(resource.status.conditions){
        s.progress = 0.25;
        let configReadyCondition = resource.status.conditions.find(function(condition){
            return condition.type === 'ConfigurationsReady';
        });
        if(configReadyCondition && configReadyCondition.status === 'True'){
            s.progress += 0.5;
        }
        let routeReadyCondition = resource.status.conditions.find(function(condition){
            return condition.type === 'RoutesReady';
        });
        if(routeReadyCondition && routeReadyCondition.status === 'True'){
            s.progress += 0.25;
        }
        let readyCondition = resource.status.conditions.find(function(condition){
            return condition.type === 'Ready';
        });
        if (readyCondition){
            s.message = readyCondition.reason;
            if(readyCondition.status === 'Unknown'){
                s.status = 'Building';
            } else if(readyCondition.status == "True"){
                s.status = 'Done';
            } else {
                s.status = s.status;
            }
        }
    }
    return s;
}

function fromResource(resource){
    let _e = {
        name: resource.metadata.name,
        bindings: resource.metadata.annotations['zeus.service/bindings'],
        createTime: resource.metadata.creationTimestamp,
        address: resource.status.domain,
        latestReadyRevision: resource.status.latestReadyRevisionName,
        lastModifiedTime: getLastModifiedTime(resource),
        status: getStatus(resource)
    };
    if(resource.status.address){
        _e.clusterAddress = resource.status.address.hostname;
    }
    if(_e.bindings){
        try{
            _e.bindings = JSON.parse(resource.metadata.annotations["zeus.service/bindings"]);
        } catch (err){
            _e.bindings = _e.bindings.split(",");
        }
    }
    if(resource.metadata.annotations){
        _e.knCreator = resource.metadata.annotations['serving.knative.dev/creator'];
        _e.knLastModifier = resource.metadata.annotations['serving.knative.dev/lastModifier'];
        _e.creator = resource.metadata.annotations["zeus.service/creator"];
        _e.lastModifier = resource.metadata.annotations["zeus.service/lastmodifier"];
    }
    if(resource.spec.runLatest && resource.spec.runLatest.configuration.build.spec.template.arguments){
        let arg = resource.spec.runLatest.configuration.build.spec.template.arguments.find(function(arg){
            return arg.name.toLowerCase() === "arg"
        });
        if(arg){
            _e.warFile=arg.value.substring("WAR_URL=".length);
            //TODO: should be agnostic to the object store (could be s3 too)
            let url = new java.net.URL(_e.warFile);
            if(url.getQuery()){
                let path = url.getQuery().split('&').find(function(v){
                    return v.startsWith('path=');
                });
                _e.warFileName = path.split('=')[1];
            }
        }
    }
    return _e;
}

function toResource(entity) {
	let env = [];
	let annotations = {}
	if(entity.bindings){
		entity.bindings.forEach(function(secret){
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
		annotations["zeus.service/bindings"] = JSON.stringify(entity.bindings.map(function(elem){
													return {
                                                        "name": elem.name,
                                                        "service": elem.service
                                                    }
												}));
	}

    annotations["zeus.service/creator"] = entity.creator;
    annotations["zeus.service/lastmodifier"] = entity.lastModifier;

	const sourceUrl = "https://github.com/dirigiblelabs/zeus-v3-sample-war.git";
	const sourceVersion = "7b075fb0ac8f65d72e565318ba98ab65be03b6b8";
	let image = "docker.io/dirigiblelabs/" + entity.name + ":latest";

	let manifest = {
		"apiVersion": "serving.knative.dev/v1alpha1",
		"kind": "Service",
		"metadata": {
	        "name": entity.name,
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
	                                    "value": "WAR_URL=https://cmis.ingress.pro.promart.shoot.canary.k8s-hana.ondemand.com/services/v3/js/ide-documents/api/read/document/download?path=" + entity.warFileName
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
	                            "resources": {
                                    "requests": {
                                        "cpu": "400m"
                                    }
                                }
	                        },
	                        "timeoutSeconds": 300
	                    }
	                }
	            }
	        }
	    }
	};
    return manifest;
}

function resolveError(err, ctx){
    ctx.errorMessage = err.message;
    if (err instanceof apierrors.BadRequestError || err instanceof apierrors.FieldValueInvalidError || err instanceof apierrors.NotFoundError || err instanceof BadRequestError){
        ctx.httpErrorCode = err.code;
        ctx.errorName = err.reason;
    }
    return err;
}

var messageProducer = {
    onCreate: function(knservice){
        if (knservice){
			var message = {
			  name: knservice.metadata.name,
			  bindings: JSON.stringify(knservice.metadata.annotations["zeus.service/bindings"]),
			  operation: 'create'
			};
			logger.debug('sending message: {}', JSON.stringify(message));
			messagesTopic.send(JSON.stringify(message));
		}
    },
    onUpdate: function(knservice){
        if (knservice){
			var message = {
			  name: knservice.metadata.name,
			  bindings: JSON.stringify(knservice.metadata.annotations["zeus.service/bindings"]),
			  operation: 'update'			  
			};
			logger.debug('sending message: {}', JSON.stringify(message));
			messagesTopic.send(JSON.stringify(message));
		}
    },
    onDelete: function(name){
        if (name){
			var message = {
				name: name,
				operation: 'delete'
			};
			logger.debug('sending message: {}', JSON.stringify(message));
			messagesTopic.send(JSON.stringify(message));
		}
    }
}

rs.service()
	.resource('')
		.get(function(ctx, request, response) {
            let items = [];
            try{
                let credentials = Credentials.getDefaultCredentials();
	            let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
                let selectors = new selectorsApi();
                let opts = {
                        labelSelector: selectors.label('zeus.servicebinding/service')
                    };
                let items = api.list(opts).map(fromResource);
                let payload = JSON.stringify(items,null,2);
                response.println(payload);
            } catch (err){
                console.error(err)
                throw resolveError(err, ctx);
            }
            response.setHeader('X-data-count', items.length);
		})
        .produces("application/json")
	.resource('count')
		.get(function(ctx, request) {
            let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
            try{
                let credentials = Credentials.getDefaultCredentials();
                let selectors = new selectorsApi();
                let opts = {
                        labelSelector: selectors.label('zeus.servicebinding/service')
                    };
                let count = api.list(opts).lenght;
                response.println(JSON.stringify({
                    "count": count
                },null,2));
            } catch (err){
                throw resolveError(err, ctx);
            }
		})
        .produces("application/json")
	.resource('{name}')
		.get(function(ctx, request, response) {
			var name = ctx.pathParameters.name;
            try{
                let credentials = Credentials.getDefaultCredentials();
	            let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
                let entity = api.get(name);
                let payloadObj = fromResource(entity);
                if (payloadObj.bindings){
                    let b = new bindings();
                    let arr = b.list().filter(function(binding){
                        if(payloadObj.bindings.find){
                            return payloadObj.bindings.find(function(_b){
                                return _b.name === binding.metadata.name;
                            })
                        }
                    }).map(function(binding){
                        return {
                            name: binding.metadata.name,
                            service: binding.metadata.labels["zeus.servicebinding/service"]
                        }
                    });
                    payloadObj.bindings = arr;
                }
                let payload = JSON.stringify(payloadObj,null,2);
                response.println(payload);
            } catch (err){
                throw resolveError(err, ctx);
            }
		})
        .produces("application/json")
	.resource('')
		.post(function(ctx, request, response) {
            let credentials = Credentials.getDefaultCredentials();
            let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
            try{
                api.apply(ctx.knsvc);
                response.setHeader('Content-Location', '/services/v3/js/zeus-application-java/api/knsvc.js/' + ctx.knsvc.metadata.name);
                response.status = 201;
                messageProducer.onCreate(ctx.knsvc);
            } catch (err){
                throw resolveError(err, ctx);
            }
		})
        .before(function(ctx, request, response, methodHandler, controller){
            var entity = request.getJSON();
            let bindingsApi = new bindings();
            try{
                entity.creator = require("security/v3/user").getName();
                let knsvc = toResource(entity);
                if (knsvc.bindings){
                    knsvc.bindings = knsvc.bindings.map(function(b){
                        return bindingsApi.get(b.name);
                    });
                }
                ctx.knsvc = knsvc;
            } catch (err){
                throw resolveError(err, ctx);
            }
        })
        .consumes("application/json")
	.resource('{name}')
		.put(function(ctx, request, response) {
            var knsvc = ctx.knsvc;
            let credentials = Credentials.getDefaultCredentials();
            let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
            try{
                api.apply(knsvc);
                response.status = 201;
                messageProducer.onUpdate(ctx.knsvc);
            } catch (err){
                throw resolveError(err, ctx);
            }
		})
        .before(function(ctx, request, response, methodHandler, controller){
            var entity = request.getJSON();
            let bindingsApi = new bindings();
            try{
                if (entity.bindings){
                    entity.bindings = knsvc.bindings.map(function(b){
                        return bindingsApi.get(b.name);
                    });
                }
                entity.lastModifier = require("security/v3/user").getName();
                let knsvc = toResource(entity);
                ctx.knsvc = knsvc;
            } catch (err){
                throw resolveError(err, ctx);
            }
        })
        .consumes("application/json")
	.resource('{name}')
		.delete(function(ctx, request, response) {
			var name = ctx.pathParameters.name;
            let credentials = Credentials.getDefaultCredentials();
            let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
            try{
                api.delete(name);
                response.setStatus(204);
                messageProducer.onDelete(name);
            } catch (err){
                throw resolveError(err, ctx);
            }
		})
.execute();