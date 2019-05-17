exports.create = function(){
	return require('db/v3/dao').create({
		"table": "ZEUS_APPLICATIONS_JAVA_STATUS",
		"properties": [
			{
				name: "id",
				column: "APP00J_ID",
				id: true,
				required: true,
				type: "BIGINT"
			},{
				name: "status",
				column: "APP00J_STATUS",
				type: "VARCHAR",
				size: 2048
			},{
				name: "lastUpdateTime",
				column: "APP00J_LASTUPDATE_TIME",
				type: "BIGINT",
				dbValue: function(lastModifiedTime){
					return lastModifiedTime !== undefined ? new Date(lastModifiedTime).getTime() : null;
				},
				value: function(dbValue){
					return dbValue === null || dbValue === undefined? undefined : new Date(dbValue).toISOString();
				}
			}]
		});
}