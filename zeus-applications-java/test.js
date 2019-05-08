var bindingsecrets = require('zeus-applications-java/messages/bindingsecrets');
var retry = require("zeus-applications-java/commons/retry");
let test=function(){
    var databaseUrl = "jdbc:postgresql://promart.cbzkdfbpc8mj.eu-central-1.rds.amazonaws.com/promart";
    var databaseUsername = "promart";
    var databasePassword = "Abcd1234";

    bindingsecrets.applyBindingSecret("myservice", "postgre", {
        "DefaultDB_driverClassName": "org.postgresql.Driver",
        "DefaultDB_url": databaseUrl,
        "DefaultDB_username": databaseUsername,
        "DefaultDB_password": databasePassword
    });

    let items;
    retry(function(retriesCount){
        retries = retriesCount;
        items = bindingsecrets.listBindingSecrets("myservice");
        if(items.length){
            console.debug("service bindings secrets: " + JSON.stringify(items, null, 2));
            return true;
        }
        console.debug("service bindings secrets could not be listed. Wating some more time.");
        return false;
    }, 3, 10*1000, false);

    if (items && items.length){
        console.debug("deleting binding secret");
        bindingsecrets.deleteServiceBindingSecrets("myservice");
    } else {
        console.error("Giving up waiting.");
    }
}
test()