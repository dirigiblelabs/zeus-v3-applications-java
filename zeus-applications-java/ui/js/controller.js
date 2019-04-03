angular.module('page', ['ideUiCore', 'ngRsData', 'ui.bootstrap','angularFileUpload'])
.config(["messageHubProvider", function(messageHubProvider) {
	messageHubProvider.evtNamePrefix = 'zeus.Explore.Java';
}])    
.factory('$messageHub', ['messageHub', function (messageHub) {
    return {
        onEntityRefresh: function (callback) {
            messageHub.on('refresh', callback);
        },
        messageEntityModified: function () {
            messageHub.send('modified');
        }
    };
}])
.config(["EntityProvider", function(entityProvider) {
  entityProvider.config.apiEndpoint = '../../../../../../../../services/v3/js/zeus-applications-java/api/applications.js';
}])
.service("WarFile", ['$http',function($http){
	var baseurl = '../../../../../../../../services/v3/js/zeus-applications-java/api/wars.js';
	return {
		download: function(filepath){
			return $http.get(baseurl + '/' + filepath, {
				headers: {
					"Accept": ["application/octet-stream"],
				}
			});
		},
		list: function(){
			return $http.get(baseurl + '/', {
				headers: {
					"Accept": ["application/json"],
				}
			});
		}
	}
}])
.controller('PageController', ['Entity', '$messageHub', 'FileUploader', 'WarFile', function (Entity, $messageHub, FileUploader, WarFile) {

    this.dataPage = 1;
    this.dataCount = 0;
    this.dataOffset = 0;
    this.dataLimit = 10;
    this.WarFile = WarFile;
	var uploader = this.uploader = new FileUploader({
		url: '../../../../../../../../services/v3/js/zeus-applications-java/api/wars.js',
		autoUpload: true
	});

    this.getPages = function () {
        return new Array(this.dataPages);
    };

    this.nextPage = function () {
        if (this.dataPage < this.dataPages) {
            this.loadPage(this.dataPage + 1);
        }
    };

    this.previousPage = function () {
        if (this.dataPage > 1) {
            this.loadPage(this.dataPage - 1);
        }
    };

    this.loadPage = function () {
        return Entity.query({
	            $limit: this.dataLimit,
	            $offset: (this.dataPage - 1) * this.dataLimit
	        }).$promise
	        .then(function (data) {
                this.dataCount = data.$count;
                this.dataPages = Math.ceil(this.dataCount / this.dataLimit);
                this.data = data;
            }.bind(this))
            .catch(function (err) {
               if (err.data){
	            	console.error(err.data)
	            }
	            console.error(err);
            });
    };

    this.openNewDialog = function () {
        this.actionType = 'new';
        this.entity = {};
        toggleEntityModal();
    };

    this.openEditDialog = function (entity) {
        this.actionType = 'update';
        this.entity = entity;
        if(entity.warFilePath){
        	this.entity.warFileName = WarFile.list(entity.warFilePath)
							        	.then(function(response){
							        		var list = response.data;
							        		for (var i in list){
							        			if (list[i].id === entity.warFilePath){
							        				this.entity.warFileName = list[i].name;
							        				return
							        			}
							        		}
							        		return;
							        	}.bind(this))
							        	.catch(function(err){
							        		if (err.data){
								            	console.error(err.data.details);
								            }
								            console.error(err);
								        });
    	}
        toggleEntityModal();
    };

    this.openDeleteDialog = function (entity) {
        this.actionType = 'delete';
        this.entity = entity;
        if(entity.warFilePath){
        	this.entity.warFileName = WarFile.list(entity.warFilePath)
							        	.then(function(response){
							        		var list = response.data;
							        		for (var i in list){
							        			if (list[i].id === entity.warFilePath){
							        				this.entity.warFileName = list[i].name;
							        				return
							        			}
							        		}
							        		return;
							        	}.bind(this))
							        	.catch(function(err){
							        		if (err.data){
								            	console.error(err.data.details);
								            }
								            console.error(err);
								        });
    	}
        toggleEntityModal();
    };

    this.close = function () {
        this.loadPage(this.dataPage);
        toggleEntityModal();
    };
    
    uploader.onSuccessItem = function(item, response, status, headers) {
    	this.errors = "";
    	this.entity.warFilePath = headers.location;
    	this.entity.warFileName = item.file.name;
    }.bind(this);

	uploader.onErrorItem = function(item /*, response, status, headers*/){
		this.errors = "Upload failed for " + item.file.name;
		uploader.cancelAll();
	}.bind(this);


    this.create = function () {
	  return Entity.save({id: this.entity.id}, this.entity).$promise
	 	.then(function () {
            this.loadPage(this.dataPage);
            $messageHub.messageEntityModified();
            toggleEntityModal();
        }.bind(this))
        .catch(function (err) {
        	if (err.data){
            	console.error(err.data.details);
            }
            console.error(err);
        });
    };

    this.update = function () {
    	return Entity.update({id: this.entity.id}, this.entity).$promise
    		.then(function(){
	    		this.loadPage(this.dataPage);
	            toggleEntityModal();
	            $messageHub.messageEntityModified();
	    	}.bind(this))
	    	.catch(function(err) {
	            if (err.data){
	            	console.error(err.data.details);
	            }
	            console.error(err);
	        });
    };

    this.delete = function () {
		return Entity.remove({id: this.entity.id}).$promise
    	.then(function(){
				this.loadPage(this.dataPage);
                toggleEntityModal();
                $messageHub.messageEntityModified();
			}.bind(this))
		.catch(function(err){
				if (err.data){
	            	console.error(err.data.details);
	            }
	            console.error(err);
			});
    };
    
    $messageHub.onEntityRefresh(this.loadPage);

    function toggleEntityModal() {
        $('#entityModal').modal('toggle');
        this.errors = '';
    }
    
    this.loadPage(this.dataPage)
}])
.directive('fileReader', function($q) {
    var slice = Array.prototype.slice;

    return {
        restrict: 'A',
        require: '?ngModel',
        link: function(scope, element, attrs, ngModel) {
                if (!ngModel) return;
                element.bind('change', function(e) {
                    var element = e.target;
					ngModel.$setViewValue(element.files);
                }); //change

            } //link
    }; //return
});;