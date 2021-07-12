const expect = require('chai').expect;
const childProcess = require('child_process');
const readLine = require('readline');
const fs = require('fs');
const spawn = childProcess.spawn;
const co = require('co');
const mongodb = require('mongodb');
const dbConfig = JSON.parse(fs.readFileSync('./test/test-data/db-settings.json').toString());
const dbName = dbConfig.mongoAppDb.db;
const connectionString = dbConfig.mongoAppDb.connectionString;
let client, migrationCol, migrationLockCol;

function *getClient(mongoURL) {
  return mongodb.MongoClient.connect(mongoURL);
}

function getCol(client, db, col) {
  return client.db(db).collection(col);;
}

function *initTestDB() {
  if (!client) {
    client = yield getClient(connectionString);
    migrationCol = getCol(client, dbName, 'migrations');
    migrationLockCol = getCol(client, dbName, 'migration_lock')
  }
  yield clearDB();
}

function *clearDB() {
  yield migrationCol.deleteMany({});
  yield migrationLockCol.deleteMany({});
}


function getCommandReader(command, args=[], opts={}) {
  const running = spawn(command, args, opts);
  return {
    stdout: readLine.createInterface(running.stdout),
    stderr: readLine.createInterface(running.stderr),
  }
}

function genArgs(dir) {
  return ['.', '-c', dir, '-runmm', '--config', '../db-settings.json'];
}

function runDir(dir, cb, log=false) {
  const { stdout, stderr } = getCommandReader('node', genArgs(dir));
  let migrateNum = 0;
  let completed = false;
  let erred = false;
  let errs = [];
  let errMessages = [];
  stdout.on('line', function (data) {
    if (log) {
      console.log(data);
    }
    if (data.indexOf('migrations') >= 0) {
      migrateNum++;
    } else if (data.indexOf('complete') >= 0) {
      completed = true;
    }
  });
  stderr.on('line', function (data) {
    if (log) {
    console.log('[error] ', data);
    }
    errs.push(data);
    if (data.indexOf('Error:') >= 0) {
      erred = true;
      errMessages.push(data);
    }
  });
  stdout.on('close', function () {
    cb({
      migrateNum,
      completed,
      erred,
      errMessages,
      errs,
    });
  });
}

describe('migrations tests', () => {
  before(function (done) {
    co(function* callback() {
      yield initTestDB();
      done();
    }).then(() => { }, (err) => {
      done(err);
    });
  });

  after(function (done) {
    co(function* callback() {
      yield client.close();
      done();
    }).then(() => { }, (err) => {
      done(err);
    });
  });

  beforeEach(function (done) {
    co(function* callback() {
      yield clearDB();
      done();
    }).then(() => { }, (err) => {
      done(err);
    });
  });

  afterEach(function (done) {
    done();
  });

  it('migrate normally', done => {
    runDir('./test/test-data/normal', (data) => {
      expect(data.migrateNum).to.equal(3);
      expect(data.completed).to.be.true;
      expect(data.erred).to.be.false;
      expect(data.errMessages).to.be.empty;
      done();
    });
  });

  it('migrate with duplicate numbers', done => {
    runDir('./test/test-data/duplicate-numbers', (data) => {
      expect(data.migrateNum).to.equal(0);
      expect(data.completed).to.be.false;
      expect(data.erred).to.be.true;
      expect(data.errMessages).to.have.lengthOf(1);
      expect(data.errMessages[0]).to.include('Duplicate file numbers');
      done();
    });
  });

  it('migrate with missed numbers', done => {
    co(function *callback() {
      yield migrationCol.insertOne({ num: 5 });
    }).then(() => { }, (err) => {
      done(err);
    });
    runDir('./test/test-data/normal', (data) => {
      expect(data.migrateNum).to.equal(0);
      expect(data.completed).to.be.false;
      expect(data.erred).to.be.true;
      expect(data.errMessages).to.have.lengthOf(1);
      expect(data.errMessages[0]).to.include('Missed migrations numbers : 1');
      done();
    });
  });

  it('migrate with locked numbers', done => {
    co(function *callback() {
      yield migrationLockCol.insertOne({ num: 10 });
    }).then(() => { }, (err) => {
      done(err);
    });
    runDir('./test/test-data/normal', (data) => {
      expect(data.migrateNum).to.equal(2);
      expect(data.completed).to.be.false;
      expect(data.errs[2]).to.equal('Migration Locked');
      done();
    });
  });
});
