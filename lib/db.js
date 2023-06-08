module.exports = {
	getConnection: getConnection
};

function getDbOpts(opts) {
	opts = opts || {
		host: 'localhost',
		db: 'my-app',
		port: 27017
	};
	opts.port = opts.port || 27017;
	return opts;
}

function getReplicaSetServers(opts, mongodb) {
	var replServers = opts.replicaSet.map(function(replicaSet) {
		var split = replicaSet.split(":");
		var host = split[0] || 'localhost';
		var port = parseInt(split[1]) || 27017;
		return new mongodb.Server(host, port);
	});
	return new mongodb.ReplSet(replServers);
}

function getConnection(opts, cb) {
	var mongodb = require('mongodb');

	if (opts.connectionString) {
		var MongoClient = mongodb.MongoClient;
		MongoClient.connect(opts.connectionString, { useUnifiedTopology: true }, function(err, client) {
			if (err) {
				return cb(err);
			}

			console.log("Connected correctly to server");

			var db = client.db();

			cb(null, {
				connection: db,
				migrationCollection: db.collection('migrations'),
				migrationLockCollection: db.collection('migration_lock'),
			});
		});
		return;
	}

	throw new Error('connectionString is required in migrate config');
}
