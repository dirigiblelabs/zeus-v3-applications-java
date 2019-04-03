var upload = require('http/v3/upload');
var cmis = require('cms/v3/cmis');
var streams = require('io/streams');

var logging = require('log/v3/logging');

var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java');

require('http/v3/rs')
.service()
  .resource("")
	.post(function(context, request, response){
			if (upload.isMultipartContent()) {
				var fileItems = upload.parseRequest();
				for (var i=0; i<fileItems.size(); i++) {
					var fileItem = fileItems.get(i);
					if (!fileItem.isFormField()) {						
						var filename = fileItem.getName();
						var content = fileItem.getBytes();
						if (content.length<1){
							logger.warn("storing {} cancelled because file size is 0", filename);
							throw "storing " + filename + " cancelled because file size is 0";
						}
						logger.debug("storing {} to CMIS storage", filename);
						var documentId = create(filename, content);
						response.setHeader("Location", documentId);
					} else {
						logger.info(fileItem.getFieldName() + ": "+ fileItem.getText());
					}
				}
			    response.setStatus(response.CREATED);
				return;
			}
			response.setStatus(response.BAD_REQUEST);
		})
		.consumes('multipart/form-data')
  .resource("")
	.get(function(context, request, response){
			var resourceList = list();
			var jsonPayload = JSON.stringify(resourceList, null, 2);
			response.println(jsonPayload);
		    response.setStatus(response.OK);
		})
		.produces('application/json')
  .resource("/{cmisdocumentid}")
	.get(function(context, request, response){
			var content = get(context.pathParameters.cmisdocumentid);
			response.write(content);
		    response.setStatus(response.OK);
		})
		.produces('application/octet-stream')
.execute();

// returns the new document id or throws error
function create(filename, content){
	var cmisSession = cmis.getSession();
	var rootFolder = cmisSession.getRootFolder();
		
	var mimetype = "application/zip";
	
	var outputStream = streams.createByteArrayOutputStream();
	outputStream.writeText(content);
	var bytes = outputStream.getBytes();
	var inputStream = streams.createByteArrayInputStream(bytes);
	
	var contentStream = cmisSession.getObjectFactory().createContentStream(filename, bytes.length, mimetype, inputStream);
	
	var properties = {};
	properties[cmis.OBJECT_TYPE_ID] = cmis.OBJECT_TYPE_DOCUMENT;
	properties[cmis.NAME] = filename;

	var newDocument = rootFolder.createDocument(properties, contentStream, cmis.VERSIONING_STATE_MAJOR);
	
	return newDocument.getId(); 
}

function get(documentId){
	var cmisSession = cmis.getSession();		
	var doc = cmisSession.getObject(documentId);
	var contentStream = doc.getContentStream(); // returns null if the document has no content
	if (contentStream !== null) {
	    return contentStream.getStream().readBytes();
	}
	return;
}

function list(){
	var cmisSession = cmis.getSession();
	var rootFolder = cmisSession.getRootFolder();
	var children = rootFolder.getChildren();
	var resources = [];
	for (var i in children) {
		resources.push({
			"id": children[i].getId(),
			"name": children[i].getName()
		});
	}
	return resources;
}