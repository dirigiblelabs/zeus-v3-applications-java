var producer = require('messaging/v3/producer');
var messagesTopic = producer.topic("/zeus-applications-java/control");

var logging = require('log/v4/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');	

var svc = require('http/v3/rs-data').service()
  .dao(require("zeus-applications-java/data/dao").create().orm);
  
svc.mappings().create()
	.onEntityInsert(function(entity, ctx){
	    entity.user = require("security/v3/user").getName();
		entity.createTime = Date.now();
	})
	.onAfterEntityInsert(function(entity, ids){
		if (ids !== undefined && entity !== undefined){
			var message = {
			  warFilePath: entity.warFilePath,
			  id: ids,
			  operation: 'create'
			};
			logger.debug('sending message: {}', JSON.stringify(message));
			messagesTopic.send(JSON.stringify(message));
		}
	});
svc.mappings().update()	
	.onEntityUpdate(function(entity, context){
		entity.lastModifiedTime = Date.now();
		//FIXME: temporary solution. This must live in an onAfterEntityUpdate callback 
		//invoked after update, which is currently missing in db/dao and http/rs-data
		if (entity.id !== undefined){
			var message = {
			  warFilePath: entity.warFilePath,
			  id: entity.id,
			  operation: 'update'
			};
			logger.debug('sending message: {}', JSON.stringify(message));
			messagesTopic.send(JSON.stringify(message));
		}
	});
	/*.onAfterEntityUpdate(function(entity, context){
		if(entity.warFilePath !== undefined){
			producer.queue("zeus.applications.java.updated").send(entity.id);
		}
	});*/	
svc.mappings().remove()
	.onBeforeRemove(function(id, context){
		context.entity = this._dao.find(id);
	})
	.onAfterRemove(function(id, context){
		if (id != undefined){
			var message = {
				name: context.entity.name,
				id: id,
				operation: 'remove'
			};
			logger.debug('sending message: {}', JSON.stringify(message));
			messagesTopic.send(JSON.stringify(message));
		}
	});

svc.execute();