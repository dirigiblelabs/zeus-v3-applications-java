//var logging = require('log/v3/logging');
//var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');	
var producer = require('messaging/v3/producer');

var svc = require('http/v3/rs-data').service()
  .dao(require("zeus-applications-java/data/dao").create().orm);
  
svc.mappings().create()
	.onEntityInsert(function(entity, ctx){
	    entity.user = require("security/v3/user").getName();
		entity.createTime = Date.now();
	})
	.onAfterEntityInsert(function(entity, ids, context){
		if (ids !== undefined){
			producer.queue("zeus.applications.java.created").send(""+ids);
		}
	});
svc.mappings().update()	
	.onEntityUpdate(function(entity, context){
		entity.lastModifiedTime = Date.now();
		//FIXME: temporary solution. This must live in an onAfterEntityUpdate callback 
		//invoked after update, which is currently missing in db/dao and http/rs-data
		if (entity.id !== undefined){
			producer.queue("zeus.applications.java.updated").send(""+entity.id);
		}
	});
	/*.onAfterEntityUpdate(function(entity, context){
		if(entity.warFilePath !== undefined){
			producer.queue("zeus.applications.java.updated").send(entity.id);
		}
	});*/	
svc.mappings().remove()		
	.onAfterRemove(function(id, context){
		producer.queue("zeus.applications.java.deleted").send(id);
	});	
	
svc.execute();