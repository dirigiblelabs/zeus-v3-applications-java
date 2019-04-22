angular.module('ngCmis',['angularFileUpload'])
.provider('Cmis', function CmisProvider() {
    var baseUrl = this.baseUrl = 'https://cmis.ingress.pro.promart.shoot.canary.k8s-hana.ondemand.com/services/v3/js/ide-documents/api';
	var config = this.config = {
		upload: {
			url: baseUrl + '/manage/create/document?path=/',
			autoUpload: true
		},
		download: {
			url: baseUrl + '/read/document/download?path=/'
		},
		list: {
			url: baseUrl + '/read/folder/list',
			method: 'GET'
		},
		remove: {
			url: baseUrl + '/manage/remove',
			method: 'DELETE'
		}
	};
	var sanitizeObjectId = function(s){
		while(s.startsWith('/')){
			s = s.substring(1);
		}
		return s;
	};
    this.$get = ['FileUploader', '$http', '$window', function (FileUploader, $http, $window) {
    	if (!config.fileUpload) {
	    	config.fileUpload = new FileUploader(config.upload);
    	}
		config.fileUpload.onErrorItem = function(){
			config.fileUpload.cancelAll();
		};		
		return {
			fileUpload: config.fileUpload,
			upload: function(files){
				config.fileUpload.addToQueue(files);
				config.fileUpload.uploadAll();
			},
			downloadUrlForObject: function(objectId){
				objectId = sanitizeObjectId(objectId);
				return config.download.url + objectId;
			},
			download: function(objectId){
				var url = this.downloadUrlForObject(objectId);
				$window.location.href = url;
			},			
			list: function(){
				return $http(config.list);
			},			
			remove: function(objectId){
				var httpConfig = config.remove;
				httpConfig.data = JSON.stringify([objectId]);
				return $http(httpConfig);
			}
		};
    }];
});