angular.module('ngRsData', ['ngResource'])
.factory('httpRequestInterceptor', function () {
    return {
        request: function (config) {
            config.headers['X-Requested-With'] = 'Fetch';
            return config;
        }
    };
})
.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.interceptors.push('httpRequestInterceptor');
}])
.service('ResourceSvcConfiguration', ['$log', function ($log) {
    return {
        cfg: {
            query: {
                method: 'GET',
                interceptor: {
                    response: function (res) {
                        var _count = res.headers('X-dservice-list-count');
                        if (_count !== undefined) {
                            _count = parseInt(_count, 10);
                            res.resource.$count = _count;
                        }
                        return res.resource;
                    }
                },
                isArray: true
            },
            save: {
                method: 'POST',
                interceptor: {
                    response: function (res) {
                        var location = res.headers('Location');
                        if (location) {
                            var id = location.substring(location.lastIndexOf('/') + 1);
                            angular.extend(res.resource, { "id": id });
                        } else {
                            $log.error('Cannot infer id after save operation. HTTP Response Header "Location" is missing: ' + location);
                        }
                        return res.resource;
                    }
                },
                isArray: false
            },
            update: {
                method: 'PUT'
            }
        }
    };
}])
.provider('Entity', function EntityProvider() {
    var config = this.config = {};
    this.$get = ['$resource', 'ResourceSvcConfiguration', function ($resource, ResourceSvcConfiguration) {
		var cfg = angular.copy(ResourceSvcConfiguration.cfg);
        return $resource(config.apiEndpoint + '/:id', { id: '@id' }, cfg);
    }];
})