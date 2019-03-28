angular.module('page', ['ideUiCore', 'ngRsData', 'ui.bootstrap'])
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
.controller('PageController', ['Entity', '$messageHub', '$q', function (Entity, $messageHub, $q) {

    this.dataPage = 1;
    this.dataCount = 0;
    this.dataOffset = 0;
    this.dataLimit = 10;

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
        var deferred = $q.defer();
        Entity.query({
            $limit: this.dataLimit,
            $offset: (this.dataPage - 1) * this.dataLimit
        }).$promise
            .then(function (data) {
                this.dataCount = data.$count;
                this.dataPages = Math.ceil(this.dataCount / this.dataLimit);
                this.data = data;
            }.bind(this))
            .catch(function (error) {
                deferred.resolve(error);
            });

        return deferred.promise;
    };

    this.openNewDialog = function () {
        this.actionType = 'new';
        this.entity = {};
        toggleEntityModal();
    };

    this.openEditDialog = function (entity) {
        this.actionType = 'update';
        this.entity = entity;
        toggleEntityModal();
    };

    this.openDeleteDialog = function (entity) {
        this.actionType = 'delete';
        this.entity = entity;
        toggleEntityModal();
    };

    this.close = function () {
        this.loadPage(this.dataPage);
        toggleEntityModal();
    };

    this.create = function () {
    	var deferred = $q.defer();
    	Entity.save({id: this.entity.id}, this.entity).$promise
    	.then(function () {
                this.loadPage(this.dataPage);
                toggleEntityModal();
                $messageHub.messageEntityModified();
            }.bind(this))
        .catch(function (removeErr) {
            deferred.reject(removeErr);
        });
   		return deferred.promise;
    };

    this.update = function () {
    	var deferred = $q.defer();
    	Entity.update({id: this.entity.id}, this.entity).$promise
    		.then(function(){
	    		this.loadPage(this.dataPage);
	            toggleEntityModal();
	            $messageHub.messageEntityModified();
	    	}.bind(this))
	    	.catch(function(removeErr) {
	            deferred.reject(removeErr);
	        });
	    return deferred.promise;
    };

    this.delete = function () {
		var deferred = $q.defer();
		Entity.remove({id: this.entity.id}).$promise
    	.then(function(){
				this.loadPage(this.dataPage);
                toggleEntityModal();
                $messageHub.messageEntityModified();
			}.bind(this))
		.catch(function(removeErr){
				deferred.reject(removeErr);
			});
		return deferred.promise;
    };

    $messageHub.onEntityRefresh(this.loadPage);

    function toggleEntityModal() {
        $('#entityModal').modal('toggle');
    }
    
    this.loadPage(this.dataPage)
}]);