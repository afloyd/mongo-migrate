/**
 * Arguments.
 */
var args = process.argv.slice(2);

/**
 * Module dependencies.
 */
var migrate = require('./lib/migrate'),
	path = require('path'),
	join = path.join,
	fs = require('fs'),
	verror = require('verror');

/**
 * Option defaults.
 */
var options = { args: [] };

/**
 * Current working directory.
 */
var previousWorkingDirectory = process.cwd();

var configFileName = 'default-config.json',
		dbConfig = null,
		dbProperty = 'mongoAppDb';

/**
 * Usage information.
 */
var usage = [
	''
	, '  Usage: migrate [options] [command]'
	, ''
	, '  Options:'
	, ''
	, '     -runmm, --runMongoMigrate   Run the migration from the command line'
	, '     -dbc, --dbConfig            JSON string containing db settings (overrides -c, -cfg, & -dbn)'
	, '     -c, --chdir <path>    		change the working directory'
	, '     -cfg, --config <path> 		DB config file name'
	, '     -dbn, --dbPropName <string> Property name for database connection in config file'
	, ''
	, '  Commands:'
	, ''
	, '     down   [name]    migrate down till given migration'
	, '     up     [name]    migrate up till given migration (the default command)'
	, '     create [title]   create a new migration file with optional [title]'
	, ''
].join('\n');

/**
 * Migration template.
 */

var template = [
	''
	, 'var mongodb = require(\'mongodb\');'
	, ''
	, 'exports.up = function(db, next){'
	, '    next();'
	, '};'
	, ''
	, 'exports.down = function(db, next){'
	, '    next();'
	, '};'
	, ''
].join('\n');

/**
 * require an argument
 * @returns {*}
 */
function required() {
	if (args.length) return args.shift();
	abort(arg + ' requires an argument');
}

/**
 * abort with a message
 * @param msg
 */
function abort(msg) {
	console.error('  %s', msg);
	process.exit(1);
}

/**
 * Log a keyed message.
 */
function log(key, msg) {
	console.log('  \033[90m%s :\033[0m \033[36m%s\033[0m', key, msg);
}

/**
 * Slugify the given `str`.
 */
function slugify(str) {
	return str.replace(/\s+/g, '-');
}

/**
 * Pad the given number.
 *
 * @param {Number} n
 * @return {String}
 */
function pad(n) {
	return Array(5 - n.toString().length).join('0') + n;
}

function runMongoMigrate(direction, migrationEnd, next) {
	if (direction) {
		options.command = direction;
	}

	if (migrationEnd) {
		options.args.push(migrationEnd);
	}

	if (next) {
		options.args.push(next);
	}

	/**
	 * Load migrations.
	 * @param {String} direction
	 * @param {Number} lastMigrationNum
	 * @param {Number} migrateTo
	 */
	function migrations(direction, lastMigrationNum, migrateTo) {
		var isDirectionUp = direction === 'up',
			hasMigrateTo = !!migrateTo,
			migrateToNum = hasMigrateTo ? parseInt(migrateTo, 10) : undefined,
			migrateToFound = !hasMigrateTo;

		var migrationsToRun = fs.readdirSync('migrations')
			.filter(function (file) {
				var formatCorrect = file.match(/^\d+.*\.js$/),
					migrationNum = formatCorrect && parseInt(file.match(/^\d+/)[0], 10),
					isRunnable = formatCorrect && isDirectionUp ? migrationNum > lastMigrationNum : migrationNum <= lastMigrationNum,
					isFile = fs.statSync(path.join('migrations', file)).isFile();

				if (isFile && !formatCorrect) {
					console.log('"' + file + '" ignored. Does not match migration naming schema');
				}

				return formatCorrect && isRunnable && isFile;
			}).sort(function (a, b) {
				var aMigrationNum = parseInt(a.match(/^\d+/)[0], 10),
						bMigrationNum = parseInt(b.match(/^\d+/)[0], 10);

				if (aMigrationNum > bMigrationNum) {
					return isDirectionUp ? 1 : -1;
				}
				if (aMigrationNum < bMigrationNum) {
					return isDirectionUp ? -1 : 1;
				}

				return 0;
			}).filter(function(file){
				var formatCorrect = file.match(/^\d+.*\.js$/),
					migrationNum = formatCorrect && parseInt(file.match(/^\d+/)[0], 10),
					isRunnable = formatCorrect && isDirectionUp ? migrationNum > lastMigrationNum : migrationNum <= lastMigrationNum;

				if (hasMigrateTo) {
					if (migrateToNum === migrationNum) {
						migrateToFound = true;
					}

					if (isDirectionUp) {
						isRunnable = isRunnable && migrateToNum >= migrationNum;
					} else {
						isRunnable = isRunnable && migrateToNum < migrationNum;
					}
				}

				return formatCorrect && isRunnable;
			}).map(function(file){
				return 'migrations/' + file;
			});

		if (!migrateToFound) {
			return abort('migration `'+ migrateTo + '` not found!');
		}

		return migrationsToRun;
	}

	// create ./migrations

	try {
		fs.mkdirSync('migrations', 0774);
	} catch (err) {
		// ignore
	}

	// commands

	var commands = {
		/**
		 * up
		 */
		up: function(migrateTo, next){
			performMigration('up', migrateTo, next);
		},

		/**
		 * down
		 */
		down: function(migrateTo, next){
			performMigration('down', migrateTo, next);
		},

		/**
		 * create [title]
		 */
		create: function(){
			var migrations = fs.readdirSync('migrations').filter(function(file){
				return file.match(/^\d+/);
			}).map(function(file){
						return parseInt(file.match(/^(\d+)/)[1], 10);
					}).sort(function(a, b){
						return a - b;
					});

			var curr = pad((migrations.pop() || 0) + 5),
					title = slugify([].slice.call(arguments).join(' '));
			title = title ? curr + '-' + title : curr;
			create(title);
		}
	};

	/**
	 * Create a migration with the given `name`.
	 *
	 * @param {String} name
	 */
	function create(name) {
		var path = 'migrations/' + name + '.js';
		log('create', join(process.cwd(), path));
		fs.writeFileSync(path, template);
	}

	/**
	 * Perform a migration in the given `direction`.
	 *
	 * @param {String} direction
	 */
	function performMigration(direction, migrateTo, next) {
		if (!next &&
	    Object.prototype.toString.call(migrateTo) === '[object Function]') {
	    next = migrateTo;
	    migrateTo = undefined;
	  }

		if (!next) {
			next = function(err) {
				if (err) {
					console.error(err);
					process.exit(1);
				} else {
					process.exit();
				}
			}
		}

		var db = require('./lib/db');
		db.getConnection(dbConfig || require(process.cwd() + path.sep + configFileName)[dbProperty], function (err, db) {
			if (err) {
				return next(new verror.WError(err, 'Error connecting to database'));
			}
			var migrationCollection = db.migrationCollection,
					dbConnection = db.connection;

			migrationCollection.find({}).sort({num: -1}).limit(1).toArray(function (err, migrationsRun) {
				if (err) {
					return next(new verror.WError(err, 'Error querying migration collection'));
				}

				var lastMigration = migrationsRun[0],
					lastMigrationNum = lastMigration ? lastMigration.num : 0;

				migrate({
					migrationTitle: 'migrations/.migrate',
					db: dbConnection,
					migrationCollection: migrationCollection
				});
				migrations(direction, lastMigrationNum, migrateTo).forEach(function(path){
					var mod = require(process.cwd() + '/' + path);
					migrate({
						num: parseInt(path.split('/')[1].match(/^(\d+)/)[0], 10),
						title: path,
						up: mod.up,
						down: mod.down});
				});

				//Revert working directory to previous state
				process.chdir(previousWorkingDirectory);

				var set = migrate();

				set.on('migration', function(migration, direction){
					log(direction, migration.title);
				});

				set.on('save', function(){
					log('migration', 'complete');
					return next();
				});

				set[direction](null, lastMigrationNum);
			});
		});
	}

	// invoke command
	var command = options.command || 'up';
	if (!(command in commands)) abort('unknown command "' + command + '"');
	command = commands[command];
	command.apply(this, options.args);
}

function chdir(dir) {
	process.chdir(dir);
}

function setConfigFilename(filename) {
	configFileName = filename;
}

function setConfigFileProperty(propertyName) {
	dbProperty = propertyName;
}

function setDbConfig(conf) {
	dbConfig = JSON.parse(conf);
}

var runmmIdx = args.indexOf('-runmm'),
	runMongoMigrateIdx = args.indexOf('--runMongoMigrate');
if (runmmIdx > -1 || runMongoMigrateIdx > -1) {
	args.splice(runmmIdx > -1 ? runmmIdx : runMongoMigrateIdx, 1);

	// parse arguments
	var arg;
	while (args.length) {
		arg = args.shift();
		switch (arg) {
			case '-h':
			case '--help':
			case 'help':
				console.log(usage);
				process.exit();
				break;
			case '-dbc':
			case '--dbConfig':
				setDbConfig(required());
				break;
			case '-c':
			case '--chdir':
				chdir(required());
				break;
			case '-cfg':
			case '--config':
				setConfigFilename(required());
				break;
			case '-dbn':
			case '--dbPropName':
				setConfigFileProperty(required());
				break;
			default:
				if (options.command) {
					options.args.push(arg);
				} else {
					options.command = arg;
				}
		}
	}

	runMongoMigrate();
} else {
	module.exports = {
		run: runMongoMigrate,
		changeWorkingDirectory: chdir,
		setDbConfig: setDbConfig,
		setConfigFilename: setConfigFilename,
		setConfigFileProp: setConfigFileProperty
	};
}
