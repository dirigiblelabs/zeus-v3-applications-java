var upload = require('http/v3/upload');
var cmis = require('cms/v3/cmis');
var streams = require('io/streams');
var producer = require('messaging/v3/producer');
	
require('http/v3/rs')
.service()
  .resource("")
	.post(function(context, request, response){
			console.info("upload request received");
			if (upload.isMultipartContent()) {
				var fileItems = upload.parseRequest();
				for (var i=0; i<fileItems.size(); i++) {
					var fileItem = fileItems.get(i);
					if (!fileItem.isFormField()) {						
						var filename = fileItem.getName();
						var content = fileItem.getBytes();
						if (content.length<1){
							throw "storing " + filename + " cancelled because file size is 0";
						}
						console.info("storing " + filename + " to CMIS storage");
						var documentId = save(filename, content);
						console.info("sending message for war upload");
						producer.queue("zeus.applications.java.war.uploaded").send("documentId");
						response.setHeader("Location", documentId);
					} else {
						console.info("Field Name: " + fileItem.getFieldName());
						console.info("Field Text: " + fileItem.getText());
					}
				}
			    response.setStatus(response.CREATED);
				return;
			}
			response.write("not a multipart content request");
			response.setStatus(response.BAD_REQUEST);
		})
		.consumes('multipart/form-data')
  .resource("{cmisdocumentid}")
	.get(function(context, request, response){
			console.info("get file request received");
			//TODO: get from cmis
		    response.setStatus(response.OK);
		})
		.produces('application/octet-stream')

.execute();

// returns the new document id or throws error
function save(filename, content){
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