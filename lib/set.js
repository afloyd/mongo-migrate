/*!
 * migrate - Set
 * Copyright (c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
var EventEmitter = require('events').EventEmitter,
	fs = require('fs'),
	mongodb = require('mongodb');

/**
 * Expose `Set`.
 */
module.exports = Set;

/**
 * Initialize a new migration `Set` with the given `path`
 * which is used to store data between migrations.
 *
 * @param {Object} db
 * @param {Object} migrationCollection
 * @api private
 */
function Set(db, migrationCollection) {
	this.db = db;
	this.migrations = [];
	this.pos = 0;
	this.migrationCollection = migrationCollection;
}

/**
 * Inherit from `EventEmitter.prototype`.
 */
Set.prototype.__proto__ = EventEmitter.prototype;

/**
 * Save the migration data and call `fn(err)`.
 *
 * @param {Function} fn
 * @api public
 */
Set.prototype.save = function (fn) {
	this.emit('save');
	fn && fn(undefined);
};

/**
 * Load the migration data and call `fn(err, obj)`.
 *
 * @param {Function} fn
 * @return {Type}
 * @api public
 */
Set.prototype.load = function (fn) {
	this.emit('load');
	fn(null, {});
};

/**
 * Run down migrations and call `fn(err)`.
 *
 * @param {Function} fn
 * @api public
 */
Set.prototype.down = function (fn, lastMigrationNum) {
	this.migrate('down', fn, lastMigrationNum);
};

/**
 * Run up migrations and call `fn(err)`.
 *
 * @param {Function} fn
 * @api public
 */
Set.prototype.up = function (fn, lastMigrationNum) {
	this.migrate('up', fn, lastMigrationNum);
};

/**
 * Migrate in the given `direction`, calling `fn(err)`.
 *
 * @param {String} direction
 * @param {Function} fn
 * @param {Number} lastMigrationNum
 * @api public
 */
Set.prototype.migrate = function (direction, fn, lastMigrationNum) {
	var self = this;
	fn = fn || function () {};
	this.load(function (err, obj) {
		if (err) {
			if ('ENOENT' != err.code) {
				return fn(err);
			}
		}
		else {
			self.pos = obj.pos;
		}
		self._migrate(direction, fn, lastMigrationNum);
	});
};

/**
 * Get index of given migration in list of migrations
 *
 * @api private
 */
function positionOfMigration(migrations, filename) {
	for (var i = 0; i < migrations.length; ++i) {
		if (migrations[i].title == filename) {
			return i;
		}
	}
	return -1;
}

/**
 * Perform migration.
 *
 * @api private
 */
Set.prototype._migrate = function (direction, fn, lastMigrationNum) {
	var self = this,
		isDirectionUp = direction === 'up'/*,
		migrations,
		migrationPos*/;

	//No migrations to run
	if (!this.migrations.length) {
		self.emit('complete');
		self.save(fn);
		return;
	}

	if (isDirectionUp) {
		//migrations = this.migrations.slice(this.pos, migrationPos + 1);
		this.pos += this.migrations.length;
	} else {
		//migrations = this.migrations.slice(migrationPos, this.pos);//.reverse();
		this.pos -= this.migrations.length;
	}

	function next(err, migration) {
		// error from previous migration
		if (err) {
			return fn(err);
		}

		// done
		if (!migration) {
			self.emit('complete');
			self.save(fn);
			return;
		}

		self.emit('migration', migration, direction);
		try {
			migration[direction](self.db, function (migrationErr) {
				if (migrationErr) {
					console.error('Error inside migration: ', migration.title, '\nError: ', migrationErr);
					//Revert this migration the opposite way
					return migration[direction === 'up' ? 'down' : 'up'](self.db, function (migrateDownErr) {
						if (migrateDownErr) {
							console.error('Error migrating back down: ', migration.title, '\nerr: ', migrateDownErr);
							console.error('The database may be in a corrupted state!');
						}

						process.exit(1);
					});
				}

				if (isDirectionUp) {
					self.migrationCollection.insert({
						num: migration.num || parseInt(migration.title.match(/\d+/)[0].split('-')[0], 10),
						name: migration.title.split('/').pop().split('.js')[0],
						executed: new Date()
					}, function (err, objects) {
						if (err) {
							console.error('Error saving migration run: ', migration.title, '\nerr: ', err);
							process.exit(1);
						}

						next(err, self.migrations.shift());
					});
				} else {
					self.migrationCollection.findAndModify({ num: migration.num }, [], {}, { remove: true }, function (err, doc) {
						if (err) {
							console.error('Error removing migration from DB: ', migration.title, '\nerr: ', err);
							process.exit(1);
						}

						next(err, self.migrations.shift());
					});
				}
			});
		} catch (ex) {
			console.error('Error inside migration: ', migration.title, '\nError: ', ex);
			migration[direction === 'up' ? 'down' : 'up'](self.db, function (migrateDownErr) {
				if (migrateDownErr) {
					console.error('Error migrating back down: ', migration.title, '\nerr: ', migrateDownErr);
					console.error('The database may be in a corrupted state!');
				}

				process.exit(1);
			});
		}
	}

	next(null, this.migrations.shift());
};
