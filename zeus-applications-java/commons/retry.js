function retry(retriedFunction, maxRetries, interval, progressive){
	let maxretries = maxRetries || 5;
	let retries=0;
	let sleepTime = interval || 15*1000;
	do {
		retries++;
		if (retriedFunction(retries)) {
			return;
		}
		if(progressive){
			if (typeof progressive === 'function'){
				sleepTime = progressive(sleepTime);
			} else {
				sleepTime = sleepTime*2;	
			}
		}
		java.lang.Thread.sleep(sleepTime);
	} while(retries < maxretries)
}

module.exports = retry;