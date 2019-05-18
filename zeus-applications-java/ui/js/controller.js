angular.module('page', ['ngAnimate', 'ideUiCore', 'ngRsData', 'ui.bootstrap','ngCmis'])
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
.service("Service",["$http", function($http) {
    let get = function(name){
        return $http.get('../../../../../../../../services/v3/js/zeus-applications-java/api/knsvc.js/'+name)
            .then(function(response){
                response.data = response.data.map(function(svc){
                    svc.status = transformStatus(svc.status);
                    return svc;
                });
                return response.data;
            });
    };
    let list = function(){
        return $http.get('../../../../../../../../services/v3/js/zeus-applications-java/api/knsvc.js')
            .then(function(response){
                response.data = response.data.map(function(svc){
                    svc.status = transformStatus(svc.status);
                    return svc;
                });
                return response.data;
            });
    };
    let save = function(entity){
        return $http.post('../../../../../../../../services/v3/js/zeus-applications-java/api/knsvc.js', entity)
    };
    let update = function(entity){
        return $http.put('../../../../../../../../services/v3/js/zeus-applications-java/api/knsvc.js/'+entity.name, entity);
    };
    let remove = function(entity){
        return $http.delete('../../../../../../../../services/v3/js/zeus-applications-java/api/knsvc.js/'+entity.name);
    };
    // let status = function(){
    //     return $http.get('../../../../../../../../services/v3/js/zeus-applications-java/api/status.js');
    // };
    let transformStatus = function(stat) {
        let o = {};
        if(stat){
            if(!stat["knsvc-ready"] && !stat['virtualservice']){
                return {
                    progress: 1,
                    status: "Ready"
                };
            }
            let progress = 0;
            if (stat['knsvc-configready']){
                progress += 0.5;
            }
            if (stat['knsvc-routeready']){
                progress += 0.25;
            }
            if (stat['virtualservice']){
                progress += 0.25;
            }             
            o.progress = progress;
            o.status = stat['knsvc-ready'];
            if (o.status !== 'Failure'){
              if (!stat['virtualservice']){ 
                 o.status = "In progress";
              } else {
                  o.status = "Ready";
              }
            }
            if(stat['knsvc-ready']!=='True'){
                o.reason = stat['knsvc-ready-reason']
            } else if(!stat['virtualservice']){
                o.reason = 'Custom URL not ready.'
            }
        }
        return o;
    }
    return {
        get: get,
        list: list,
        save: save,
        update: update,
        delete: remove,
        // status: status
    }
}])
.service('StatusCheck',  ['$scope', '$interval', 'Service', function($scope, $interval, Service){
    var observables = [];
    var cancellable = $interval(function(){
        Service.status()
        .then(function(stat){
            observable.forEach(function(o){
                if(!o.status){
                    o.status = {};
                }
                if(stat[o.name]!==undefined){
                    let progress = 0;
                    if (stat['knsvc-configready']){
                        progress += 0.5;
                    }
                    if (stat['knsvc-routeready']){
                        progress += 0.25;
                    }
                    if (stat['virtualservice']){
                        progress += 0.25;
                    }             
                    o.status.progress = progress;
                    stat = stat['knsvc-ready'];
                    if (stat === 'Unknown'){
                        stat = "In progress"
                    }
                    o.status.status = stat;
                    if(stat!=='Ready'){
                        o.status.reason = stat['knsvc-ready-reason']
                    }
                }
            });
        });
    }, 30*1000);
    $scope.$on('$destroy', function () {
        $interval.cancel(cancellable);
    });
    return {
        observe: function(observableArr){
            observables = observableArr;
        }
    }
}])
.controller('PageController', ['Service', '$interval', '$scope', '$messageHub', 'Cmis', '$http', function (Service, $interval, $scope, $messageHub, Cmis, $http) {

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
        Service.list()
            .then(function(data){
                this.data = data;
            }.bind(this))
            .catch(function (err) {
	               if (err.data){
		            	console.error(err.data);
		            }
		            console.error(err);
	            })
        // return Entity.query({
		//             $limit: this.dataLimit,
		//             $offset: (this.dataPage - 1) * this.dataLimit
		//         }).$promise
		//         .then(function (data) {
	    //             this.dataCount = data.$count;
	    //             this.dataPages = Math.ceil(this.dataCount / this.dataLimit);
	    //             this.data = data;
	    //         }.bind(this))
	    //         .catch(function (err) {
	    //            if (err.data){
		//             	console.error(err.data);
		//             }
		//             console.error(err);
	    //         });
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
		return Service[action](this.entity)
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
        if (path == 'ROOT'){
            path ="";
        } else {
            path = "/" + path;
        }
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
    var cancellable = $interval(function(){
      this.loadPage(this.dataPage);
    }.bind(this), 30*1000);

    $scope.$on('$destroy', function () {
        $interval.cancel(cancellable);
    });

}])
.controller('BindingsController', ['$http', function($http) {
    this.services = $http.get('../../../../../../../../services/v3/js/zeus-services/api/services.js')
        .then(function(response){
            this.services = response.data;
        }.bind(this));
    this.bindings = $http.get('../../../../../../../../services/v3/js/zeus-bindings/api/bindings.js')
        .then(function(response){
            this.bindings = response.data;
        }.bind(this));
    this.onServiceSelectChange = function(){
        this.bindings = this.bindings.filter(function(binding){
            return binding.service !== this.service.name;
        }.bind(this));
    }.bind(this);
    this.addBinding = function(entity){
        if(this.binding){
            if(!entity.bindings){
                entity.bindings = [];
            }
            entity.bindings.push(this.binding);
            delete this.binding;
            delete this.service;
        }
    }.bind(this);
}]);