var Set = require('./set');

exports = module.exports = migrate;

function Migration(title, up, down, num) {
	this.num = num;
	this.title = title;
	this.up = up;
	this.down = down;
}

exports.version = '0.0.1';

function migrate(opts) {
	opts = opts || {};
	// migration
	if ('string' == typeof opts.title && opts.up && opts.down) {
		migrate.set.migrations.push(new Migration(opts.title, opts.up, opts.down, opts.num));
		// specify migration file
	} else if (opts.migrationCollection) {
		migrate.set = new Set(opts.db, opts.migrationCollection);
		// no migration path
	} else if (!migrate.set) {
		throw new Error('must invoke migrate(path) before running migrations');
		// run migrations
	} else {
		return migrate.set;
	}
}