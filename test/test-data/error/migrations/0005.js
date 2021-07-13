
var mongodb = require('mongodb');

exports.up = function(db, next){
    throw Error('test error!');
    next();
};

exports.down = function(db, next){
    next();
};
