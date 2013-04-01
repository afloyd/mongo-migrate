#mongo-migrate
=============

Built with a starting framework from: https://github.com/visionmedia/node-migrate


## Installation
	$ npm install mongo-migrate
	
##Usage
```
Usage: node mongo-migrate [options] [command]

Options:
	-runmm, --runMongoMIgrate		Run the migration from the command line
	-c, --chdir <path>				Change the working directory (if you wish to store your migrations outside of this folder
	-cfg, --config <filename>		DB config file name
	--dbn, --dbPropName <string>		Property name for the database connection in the config file. The configuration file should 
									contain something like 
									{ 	
										appDb : { //appDb would be the dbPropName
											host: 'localhost', 
											db: 'mydbname',
											//port: '27017' //include a port if necessary
										}
									}
	
Commands:
	down [revision]		migrate down (stop at optional revision name/number)
	up [revision]		migrate up (stop at optional revision name/number)
	create [title]		create a new migration file with optional [title]
```

##Creating Migrations
To create a migration execute with `node mongo-migrate create` and optionally a title. mongo-migrate will create a node module within `./migrations/` which contains the following two exports:
```
var mongodb = require('mongodb');

exports.up = function (db, next) {
	next();
};

exports.down = function (db. mext) {
	next();
};
```

All you have to do is populate these, invoking `next()` when complete, and you are ready to migrate! If you detect an error during the `exports.up` or `exports.down` pass next(err) and the migration will attempt to revert the opposite direction. If you're migrating up and error, it'll try to do that migration down.

For example:

```
	$ node mongo-migrate -runmm create add-pets
	$ node mongo-migrate -runmm create add-owners
```

The first call creates `./migrations/0005-add-pets.js`, which we can populate:
```
exports.up = function (db, next) {
	var pets = mongodb.Collection(db, 'pets');
	pets.insert({name: 'tobi'}, next);
};

exports.down = function (db, next) {
	var pets = mongodb.Collection(db, 'pets');
	pets.findAndModify({name: 'tobi'}, [], {}, { remove: true }, next);
};
```

The second creates `./migrations/0010-add-owners.js`, which we can populate:
```
	exports.up = function(db, next){
		var owners = mongodb.Collection(db, 'owners');
		owners.insert({name: 'taylor'}, next);		
    };

	exports.down = function(db, next){
		var owners = mongodb.Collection(db, 'owners');
		pets.findAndModify({name: 'taylor'}, [], {}, { remove: true }, next);
	};
```

## Running Migrations
When first running the migrations, all will be executed in sequence.

```
	node mongo-migrate -runmm
	up : migrations/0005-add-pets.js
	up : migrations/0010-add-owners.js
	migration : complete
```

Subsequent attempts will simply output "complete", as they have already been executed on the given database. `mongo-migrate` knows this because it stores migrations already run against the database in the `migrations` collection.
```
	$ node mongo-migrate -runmm
	migration : complete
```

If we were to create another migration using `mongo-migrate create coolest-owner`, and then execute migrations again, we would execute only those not previously executed:
```
	$ node mongo-migrate -runmm
	up : migrations/0015-coolest-owner
```

If we were to then migrate using `mongo-migrate down 5`. This means to run from current revision, which in this case would be `0015-coolecst-owner`, down to revision number 5. Note that you can use either the revision number, or then full revision name `0005-add-pets`
```
	$ node mongo-migrate -runmm down 5
	down : migrations/0015-coolest-owner
	down : migrations/0010-add-owners
```

## Configuration
### Working Directory
The options for connecting to the database are read in from a file. You can configure where the file is read in from and where the migration directory root is by the `-c <path>` option.
```
	$ node mongo-migrate -c ../.. up
	migration : complete
```
This would set the working directory two levels above the mongo-migrate directory, such as if you included it into another project and it was nested in the node_modules folder.

### Config filename
The default configuration filename is `default-config.json`. If you wish to use a different filename, use the `-cfg <filename>` option:
```
	$ node mongo-migrate -cfg my-config.json up
	migration : complete
```

### Config file property name
Inside the configuration file, mongo-migrate expects the database connection information to be nested inside an object. The default object name is `mongoAppDb`. If you wish to change this you can use the `-dbn <string>` option:
```
	$ node mongo-migrate -dbn dbSettings up
	migration : complete
```
This would tell mongo-migrate your config file looks something like:
```
	{
		dbSettings: {
			host: 'localhost',
			db: 'myDatabaseName',
			//port: 27017 //Specifying a port is optional
		}
	}
```


All of these settings can be combined as desired, except for the up/down obviously ;)














(The MIT License)

Copyright &copy; 2013 Austin Floyd &lt;austin.floyd@sparcedge.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


