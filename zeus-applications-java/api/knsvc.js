var logging = require('log/v4/logging');
var response = require('http/response');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');
var rs = require('http/v4/rs');
var bindings = require('zeus-bindings/k8s');
var apierrors = require("kubernetes/errors");
var Credentials = require("zeus-deployer/utils/Credentials");
var KnServicesApi = require("kubernetes/apis/serving.knative.dev/v1alpha1/Services");

function fromResource(resource){
    let _e = {
        name: resource.metadata.name,
        bindings: resource.metadata.annotations['zeus.service/bindings'],
        createTime: resource.metadata.creationTimestamp
    };
    if(_e.bindings){
        _e.bindings = _e.bindings.split(",")
    }
    return _e;
}

let BadRequestError = function(message, details) {
  this.name = "BadRequestError";
  this.message = message || "";
  this.details = details || "";
  this.reason = 'BadRequest';
  this.code = 400;
};
BadRequestError.prototype = Error.prototype;

function resolveError(err, ctx){
    ctx.errorMessage = err.message;
    if (err instanceof apierrors.FieldValueInvalidError || err instanceof apierrors.NotFoundError || err instanceof BadRequestError){
        ctx.httpErrorCode = err.code;
        ctx.errorName = err.reason;
    }
    return err;
}

rs.service()
	// .resource('')
	// 	.get(function(ctx, request, response) {
    //         let serviceName = ctx.serviceName;
    //         let entities = [];
    //         let b = new bindings();            
    //         try{
    //             let opts;
    //             if (serviceName){
    //                 let selectors = new selectorsApi();
    //                 opts = {
    //                     labelSelector: selectors.label('zeus.servicebinding/service').equals().value(serviceName)
    //                 };
    //             }
	// 		    entities = b.list(opts).map(fromResource);
    //             response.println(JSON.stringify(entities,null,2));
    //         } catch (err){
    //             throw resolveError(err, ctx);
    //         }
    //         response.setHeader('X-data-count', entities.length);
	// 	})
    //     .before(function(ctx, request, response, methodHandler, controller){
	// 		var queryOptions = {};
	// 		var parameters = request.getParameterNames();
	// 		for (var i = 0; i < parameters.length; i ++) {
	// 			queryOptions[parameters[i]] = request.getParameter(parameters[i]);
	// 		}
    //         let serviceName = queryOptions['serviceName'];
    //         // The serviceName parameter will be used as label value and this validation is required due to the labels value constraints.
    //         if(serviceName && serviceName.length>63){
    //             logger.warn("`serviceName` parameter is {} characters long. It must be 63 characters or less.", serviceName.length);
    //             controller.sendError(response.BAD_REQUEST, undefined, response.HttpCodesReasons.getReason(String(response.BAD_REQUEST)), Error('The `serviceName` parameter is too long ('+serviceName.length+'>63).'));
    //             return;
    //         }
    //         ctx.serviceName = serviceName;
    //     })
    //     .produces("application/json")
	// .resource('count')
	// 	.get(function(ctx, request) {
    //         let entities = [];
    //         let b = new bindings();
    //         try{
    //             var entities = b.list();
    //             response.println(JSON.stringify(entities,null,2));
    //         } catch (err){
    //             throw resolveError(err, ctx);
    //         }
    //         response.setHeader('X-data-count', entities.length);
	// 	})
    //     .produces("application/json")
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
                        return payloadObj.bindings.find(function(name){
                            return name === binding.metadata.name;
                        })
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
	// .resource('')
	// 	.post(function(ctx, request, response) {
    //         let b = new bindings();
    //         try{
    //             b.apply(ctx.binding);
    //             response.setHeader('Content-Location', '/services/v3/js/zeus-bindings/api/bindings.js/' + ctx.binding.metadata.name);
    //             response.status = 201;
    //         } catch (err){
    //             throw resolveError(err, ctx);
    //         }
	// 	})
    //     .before(function(ctx, request, response, methodHandler, controller){
    //         var entity = request.getJSON();
    //         let b = new bindings();
    //         try{
    //             let binding = toResource(entity);
    //             ctx.binding = binding;
    //         } catch (err){
    //             throw resolveError(err, ctx);
    //         }
    //     })
    //     .consumes("application/json")
	// .resource('{name}')
	// 	.put(function(ctx, request, response) {
    //         var name = ctx.pathParameters.name;
	// 		var entity = request.getJSON();
    //         let b = new bindings();
    //         try{
	// 		    let bindings = toResource(entity);
    //             b.apply(bindings);
    //             response.status = 201;
    //         } catch (err){
    //             throw resolveError(err, ctx);
    //         }
	// 	})
    //     .consumes("application/json")
	// .resource('{name}')
	// 	.delete(function(ctx, request, response) {
	// 		var name = ctx.pathParameters.name;
    //         let b = new bindings();
    //         try{
    //             b.delete(name);
    //             response.setStatus(204);
    //         } catch (err){
    //             throw resolveError(err, ctx);
    //         }
	// 	})
.execute();