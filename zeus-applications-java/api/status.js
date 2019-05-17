// require('http/v3/rs-data')
//   .service()
//   .dao(require("zeus-applications-java/data/status-dao").create().orm)
//   .execute()

var logging = require('log/v4/logging');
var logger = logging.getLogger('org.eclipse.dirigible.zeus.apps.java.status');	
var Credentials = require("zeus-deployer/utils/Credentials");
var KnServicesApi = require("kubernetes/apis/serving.knative.dev/v1alpha1/Services");
var KnServicesApi = require("kubernetes/apis/networking.istio.io/v1alpha3/VirtualServices");
//var statusesDao = require("zeus-applications-java/data/status-dao").create();
var selectorsApi = require("kubernetes/labelselectors");

function getKnServices(){
    let credentials = Credentials.getDefaultCredentials();
    let api = new KnServicesApi(credentials.server, credentials.token, 'zeus');
    //let selectors = new selectorsApi();
    // let opts = {
    //         labelSelector: selectors.label('zeus.servicebinding/service')
    //     };
    return api.list();
}

function KnserviceConditionStatus(resource, conditionType){
    let condition = resource.status.conditions.find(function(condition){
            return condition.type === conditionType;
        });
    return condition;
}

function getVirtualServices(){
    let credentials = Credentials.getDefaultCredentials();
    let api = new KnServicesApi(credentials.server, credentials.token, 'knative-serving');
    return api.list();
};

var status = function(knsvcs){
    logger.trace("synchronizing status record for work in progress")
    var statusrecord = {};
    knsvcs = knsvcs || getKnServices();
    var vservices = getVirtualServices();
    knsvcs.forEach(function(knsvc){
        var vservice = vservices.find(function(s){
            return s.metadata.name === 'route-'+knsvc.metadata.name //TODO: maybe use labels instead
        })
        if (KnserviceConditionStatus(knsvc, 'Ready').status === 'True' && vservice!==undefined){
            return;
        }
        statusrecord[knsvc.metadata.name] = {
            "knsvc-ready": KnserviceConditionStatus(knsvc, 'Ready').status,
            "knsvc-ready-reason": KnserviceConditionStatus(knsvc, 'Ready').reason,
            "knsvc-configready": KnserviceConditionStatus(knsvc, 'ConfigurationsReady').status === 'True',
            "knsvc-routeready": KnserviceConditionStatus(knsvc, 'RoutesReady').status === 'True'
        }
        statusrecord[knsvc.metadata.name]["virtualservice"] = vservice!==undefined;
    })

    // var s = JSON.stringify({
    //         status: statusrecord
    //     }.null,2);
    logger.debug("synchronizing status records finished {}", JSON.stringify({status: statusrecord}.null,2))
    return statusrecord
};

module.exports = status