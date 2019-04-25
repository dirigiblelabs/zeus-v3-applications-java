var response = require("http/v4/response");
var Credentials = require("zeus-deployer/utils/Credentials");
var ServicesApi = require("kubernetes/api/v1/Services");

var credentials = Credentials.getDefaultCredentials();
var api = new ServicesApi(credentials.server, credentials.token, credentials.namespace);
var items = api.list({labelSelector: "serving.knative.dev/service%3Dsample"});
response.println(JSON.stringify(items));