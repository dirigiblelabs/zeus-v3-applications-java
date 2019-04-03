exports.create = function(){
	return require('db/v3/dao').create({
		"table": "ZEUS_APPLICATIONS_JAVA",
		"properties": [
			{
				name: "id",
				column: "APP00J_ID",
				id: true,
				required: true,
				type: "BIGINT"
			},{
				name: "name",
				column: "APP00J_NAME",
				type: "VARCHAR",
				size: 256
			},{
				name: "user",
				column: "APP00J_USER",
				type: "VARCHAR",
				size: 256
			},{
				name: "createTime",
				column: "APP00J_CREATE_TIME",
				type: "BIGINT",
				dbValue: function(createTime){
					return createTime !== undefined ? new Date(createTime).getTime() : null;
				},
				value: function(dbValue){
					return dbValue !== null ? new Date(dbValue).toISOString() : undefined;
				}
			},{
				name: "lastModifiedTime",
				column: "APP00J_LASTMODIFIED_TIME",
				type: "BIGINT",
				dbValue: function(lastModifiedTime){
					return lastModifiedTime !== undefined ? new Date(lastModifiedTime).getTime() : null;
				},
				value: function(dbValue){
					return dbValue === null || dbValue === undefined? undefined : new Date(dbValue).toISOString();
				}
			},{
				name: "warFilePath",
				column: "APP00J_WAR_FPATH",
				type: "VARCHAR",
				size: 1024
			},{
				name: "dockerFilePath",
				column: "APP00J_DOCKER_IMAGE_FPATH",
				type: "VARCHAR",
				size: 1024
			}]
		});
}