exports.Apply = function(api, resource){
    try{
        api.create(resource);
    } catch (err){
        if(!ErrIsExists(err)){
            throw err;
        }
        api.update(resource.metadata.name, resource);
    }
}

exports.ErrIsExists = function(err){
    var s = err.toString().split("|");
    if (s.length>0){
        //FIXME: the error response is not valid json. fix that
        // try{
        //     var errResponse = JSON.parse(s[1]);
        //     return errResponse.reason === 'AlreadyExists';
        // } catch(_){}
        return s[0].trim() === 'Unexpected response status: 409'
    }
    return false;
}

exports.ErrIsNotFound = function(err){
    if(err.message){
        var s = err.message.split("|");
        if (s.length>0){
            try{
                var errResponse = JSON.parse(s[1]);
                return errResponse.reason === 'NotFound';
            } catch(_){}            
        }
    }
    return false;
}