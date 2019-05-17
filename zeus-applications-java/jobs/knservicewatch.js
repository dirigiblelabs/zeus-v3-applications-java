console.warn("-------- JOB  ------")
var logging = require('log/v4/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java.job.status');	
var Credentials = require("zeus-deployer/utils/Credentials");
var KnServicesApi = require("kubernetes/apis/serving.knative.dev/v1alpha1/Services");
var KnServicesApi = require("kubernetes/apis/networking.istio.io/v1alpha3/VirtualServices");
var statusesDao = require("zeus-applications-java/data/status-dao").create();
var selectorsApi = require("kubernetes/labelselectors");

function getKnServices(){
    let credentials = Credentials.getDefaultCredentials();
    let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
    let selectors = new selectorsApi();
    let opts = {
            labelSelector: selectors.label('zeus.servicebinding/service')
        };
    return api.list(opts)
}

function KnserviceConditionStatus(resource, conditionType){
    let condition = resource.status.conditions.find(function(condition){
            return condition.type === conditionType;
        });
    return condition.status;
}

function getVirtualServices(){
    let credentials = Credentials.getDefaultCredentials();
    let api = new KnServicesApi(credentials.server, credentials.token, 'knative-serving');
    return api.list();
};

function status(){
    logger.trace("synchronizing status record")
    var statusrecord = statusesDao.list()[0] || {};
    logger.debug("status record: {}", JSON.stringify(statusrecord,null,2))
    logger.debug("synchronizing status records. removing resources with status ready")
    var readyknsvcs = getKnServices().filter(function(svc){
        return KnserviceConditionStatus(svc, 'Ready') === 'True'
    });
    var invalidatedKeys = Object.keys(statusrecord).filter(function(svcname){
        return readyknsvcs.find(function(knsvc){
            return knsvc.metadata.name === svcname;
        }) !== undefined;
    });
    invalidatedKeys.forEach(function(key){
        delete statusrecord[key];
    })
    logger.debug("synchronizing status records. updating resources in progress")
    var vservices = getVirtualServices();
    knsvcs.forEach(function(knsvc){
        statusrecord[knsvc.metadata.name] = {
            "knsvc-ready": KnserviceConditionStatus(knsvc, 'Ready') === 'True',
            "knsvc-configready": KnserviceConditionStatus(knsvc, 'ConfigurationsReady') === 'True',
            "knsvc-routeready": KnserviceConditionStatus(knsvc, 'RoutesReady') === 'True'
        }
        var vservice = vservices.find(function(s){
            return s.metadata.name === 'route-'+knsvc.metadata.name //TODO: maybe use labels instead
        })
        statusrecord[knsvc.metadata.name]["virtualservice"] = vservice;
    })

    var s = JSON.stringify({
            status: statusrecord
        });
    if(!statusrecord.id){
        statusesDao.save(s);
    } else {
        statusesDao.update(s);
    }
    logger.debug("synchronizing status records finished")
};

status();