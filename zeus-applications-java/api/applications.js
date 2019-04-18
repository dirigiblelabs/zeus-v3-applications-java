var logging = require('log/v3/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');	
var producer = require('messaging/v3/producer');
var topic = producer.topic("/zeus-applications-java/created");

var svc = require('http/v3/rs-data').service()
  .dao(require("zeus-applications-java/data/dao").create().orm);
  
svc.mappings().create()
	.onEntityInsert(function(entity, ctx){
	    entity.user = require("security/v3/user").getName();
		entity.createTime = Date.now();
	})
	.onAfterEntityInsert(function(entity, ids, context){
		if (ids !== undefined){
			var message={
			  warFilePath: entity.warFilePath,
			  id: entity.ids
			};
			logger.trace("----------- Sending message");
			topic.send(JSON.stringify(message));
			logger.trace("----------- message sent");
		}
	});
svc.mappings().update()	
	.onEntityUpdate(function(entity, context){
		entity.lastModifiedTime = Date.now();
		//FIXME: temporary solution. This must live in an onAfterEntityUpdate callback 
		//invoked after update, which is currently missing in db/dao and http/rs-data
		if (entity.id !== undefined){
			var message={
			  warFilePath: entity.warFilePath,
			  id: entity.ids
			};
			topic.topic("/zeus-applications-java/created").send(JSON.stringify(message));
		}
	});
	/*.onAfterEntityUpdate(function(entity, context){
		if(entity.warFilePath !== undefined){
			producer.queue("zeus.applications.java.updated").send(entity.id);
		}
	});*/	
svc.mappings().remove()		
	.onAfterRemove(function(id, context){
		producer.topic("/zeus-applications-java/deleted").send(id);
	});	
	
svc.execute();