var svc = require('http/v3/rs-data').service()
  .dao(require("zeus-applications-java/data/dao").create().orm)
svc
  .resource("/wars")
	.post(function(context, request, response){
			// TODO send to CMIS
			console.info("upload request received");
			response.setHeader("Location", "cmise path here")
			response.setStatus(response.CREATED);
		})
		.consumes(["*/*"])
svc.mappings().create().onEntityInsert(function(entity, ctx){
    entity.user = require("security/v3/user").getName();
	entity.uploadTime = Date.now();
});
svc.execute();