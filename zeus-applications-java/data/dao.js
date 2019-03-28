exports.create = function(){
	return require('db/v3/dao').create({
		"table": "ZEUS_APPLICATIONS_JAVA",
		"properties": [
			{
				name: "id",
				column: "APPLICATIONS_ID",
				id: true,
				required: true,
				type: "BIGINT"
			},{
				name: "name",
				column: "APPLICATIONS_NAME",
				type: "VARCHAR",
				size: 126
			},{
				name: "gitrepo",
				column: "APPLICATIONS_WAR",
				type: "VARCHAR",
				size: 1024
			},{
				name: "gitbranch",
				column: "APPLICATIONS_DOCKER_IMAGE",
				type: "VARCHAR",
				size: 126
			}]
		}, 'HTML5DAO');
}