angular.module('page', ['ideUiCore', 'ngRsData', 'ui.bootstrap','ngCmis'])
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
.config(["CmisProvider", function(cmisProvider) {
  cmisProvider.baseUrl = 'https://cmis.ingress.pro.promart.shoot.canary.k8s-hana.ondemand.com/services/v3/js/ide-documents/api';
}])
.controller('PageController', ['Entity', '$messageHub', 'Cmis', '$http', function (Entity, $messageHub, Cmis, $http) {

    this.dataPage = 1;
    this.dataCount = 0;
    this.dataOffset = 0;
    this.dataLimit = 10;
    this.cmis = Cmis;

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
		            	console.error(err.data);
		            }
		            console.error(err);
	            });
    };

    this.openNewDialog = function (entity) {
        this.actionType = entity?'update':'new';
        this.entity = entity || {
            bindings:[]
        };
        if(this.entity.name){
            this.entity.bindings =$http.get('../../../../../../../../services/v3/js/zeus-applications-java/api/knsvc.js/'+entity.name)
                .then(function(r) {
                    this.entity.bindings = r.data.bindings;
                }.bind(this));
        }
        toggleEntityModal();
    };

    this.openDeleteDialog = function (entity) { 
        this.actionType = 'delete';
        this.entity = entity;
        toggleEntityModal();
    };

    this.close = function () {
//        this.loadPage(this.dataPage);
		delete this.entity;
        toggleEntityModal();
    };
    
    this.cmis.fileUpload.onSuccessItem = function(item, response, status, headers) {
		console.debug(''+item.file.name+" upload successfull.");
    	if(response.length>0){
			this.entity.warFilePath = response[0].id;
			this.entity.warFileName = response[0].name;
    	}
    }.bind(this);
    
	this.cmis.fileUpload.onErrorItem = function(item /*, response, status, headers*/){
		console.error('upload of '+item.file.name+" failed.");
		this.cmis.fileUpload.cancelAll(); //this.cancellAll
	}.bind(this);    
	
	var entityAction = function(action){
		return Entity[action]({id: this.entity.id}, this.entity).$promise
			 	.then(function () {
		            this.loadPage(this.dataPage);
		            $messageHub.messageEntityModified();
		            toggleEntityModal();
		        }.bind(this))
		        .catch(function (err) {
		        	if (err.data && err.data.details){
		            	console.error(err.data.details);
		            }
		            console.error(err);
		        });
	}.bind(this);

    this.create = function () {
		return entityAction('save');
    };

    this.update = function () {
    	return entityAction('update');
    };

    this.delete = function () {
    	return entityAction('delete')
		    	.then(function(){
		    		if(this.entity.warFilePath){
		    		  return this.cmis.remove(this.entity.warFilePath);
		    		}
		    	}.bind(this));
    };
    
    this.removeWar = function(){
    	return this.cmis.remove(this.entity.warFilePath)
		    	.then(function(){
		    		delete this.entity.warFilePath;
		    		delete this.entity.warFileName;
		    	}.bind(this));
    };
    
    this.parseDate = function(dateString){
    	return Date.parse(dateString);
    };

    this.getAccessUrls = function(){
        if (this.entity == undefined){
            return;
        }
        var path = this.entity.warFileName;
        if (path.endsWith(".war")){
            path = path.substring(0, path.length-4);
        }
        if (this.entity.warFileName == 'ROOT'){
            path ="";
        }
        path = "/" + path;
        return [
            "http://"+ this.entity.name + ".apps.onvms.com"+ path,
            "http://"+ this.entity.name + ".zeus.apps.onvms.com"+ path,
        ];
    };

    this.removeBinding = function(binding){
        this.entity.bindings = this.entity.bindings.filter( el => el.name !== binding.name );
    }.bind(this);
    
    $messageHub.onEntityRefresh(this.loadPage);

    var toggleEntityModal = function() {
        $('#entityModal').modal('toggle');//FIXME: dom control from angular controller - not good. use directive or a module that does that.
        this.errors = '';
        this.cmis.fileUpload.clearQueue();
    }.bind(this);
    
    this.loadPage(this.dataPage);
}])
.controller('BindingsController', [function () {
    this.services = fetch('../../../../../../../../services/v3/js/zeus-services/api/services.js')
        .then(function(response){
            return response.json();
        })
        .then(function(services) {
            this.services = services;
        }.bind(this));
    this.bindings = fetch('../../../../../../../../services/v3/js/zeus-bindings/api/bindings.js')
        .then(function(response){
            return response.json();
        })
        .then(function(bindings) {
            this.bindings = bindings;
        }.bind(this));
    this.onServiceSelectChange = function(){
        this.bindings = this.bindings.filter(function(binding){
            return binding.service !== this.serviceName;
        }.bind(this));
    }.bind(this);
    this.addBinding = function(entity){
        if(this.binding){
            if(!entity.bindings){
                entity.bindings = [];
            }
            entity.bindings.push(this.binding);
            delete this.binding;
        }
    }.bind(this);
}]);