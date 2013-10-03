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
	fs = require('fs');

/**
 * Option defaults.
 */
var options = { args: [] };

/**
 * Current working directory.
 */
var previousWorkingDirectory = process.cwd(),
	cwd = process.cwd();

var configFileName = 'default-config.json',
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
	, '     -runmm, --runMongoMigrate   Run the migration from the command line',
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

function runMongoMigrate(direction, migrationEnd) {
	if (typeof direction !== 'undefined') {
		options.command = direction;
	}

	if (typeof migrationEnd !== 'undefined') {
		options.args.push(migrationEnd);
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
					isRunnable = formatCorrect && isDirectionUp ? migrationNum > lastMigrationNum : migrationNum <= lastMigrationNum;

				if (!formatCorrect) {
					console.log('"' + file + '" ignored. Does not match migration naming schema');
				}

				return formatCorrect && isRunnable;
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
		up: function(migrateTo){
			performMigration('up', migrateTo);
		},

		/**
		 * down
		 */
		down: function(migrateTo){
			performMigration('down', migrateTo);
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
		log('create', join(cwd, path));
		fs.writeFileSync(path, template);
	}

	/**
	 * Perform a migration in the given `direction`.
	 *
	 * @param {String} direction
	 */
	function performMigration(direction, migrateTo) {
		var db = require('./lib/db');
		db.getConnection(require(cwd + path.sep + configFileName)[dbProperty], function (err, db) {
			var migrationCollection = db.migrationCollection,
					dbConnection = db.connection;
			if (err) {
				console.error('Error connecting to database');
				process.exit(1);
			}

			migrationCollection.find({}).sort({num: -1}).limit(1).toArray(function (err, migrationsRun) {
				if (err) {
					console.error('Error querying migration collection', err);
					process.exit(1);
				}

				var lastMigration = migrationsRun[0],
					lastMigrationNum = lastMigration ? lastMigration.num : 0;

				migrate({
					migrationTitle: 'migrations/.migrate',
					db: dbConnection,
					migrationCollection: migrationCollection
				});
				migrations(direction, lastMigrationNum, migrateTo).forEach(function(path){
					var mod = require(cwd + '/' + path);
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
					process.exit();
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
	process.chdir(cwd = dir);
}

function setConfigFilename(filename) {
	configFileName = filename;
}

function setConfigFileProperty(propertyName) {
	dbProperty = propertyName;
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
		setConfigFilename: setConfigFilename,
		setConfigFileProp: setConfigFileProperty
	};
}