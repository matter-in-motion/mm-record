'use strict';
const test = require('ava');
const extension = require('./index');
const createApp = require('mm-test').createApp;

const rxUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

process.env.NODE_ENV = 'production';
const app = createApp({
  extensions: [
    'rethinkdb',
    'rethinkdb-schema',
    'db-schema',
    extension
  ],

  rethinkdb: {
    db: 'test',
    silent: true
  }
});

const record = app.units.require('resources.record.controller');

test.before(() => app.run('db', 'updateSchema'));
test.after.always(() => app.run('db', 'dropSchema'));

test.serial('tries to apply scheme again and gets quite', t => app
  .run('db', 'updateSchema')
  .then(() => t.pass())
  .catch(() => t.fail())
);

test.serial('adds a full record', t => {
  const ts = Date.now();

  return record
    .add({
      type: 'test',
      sid: 'subject',
      oid: 'object',
      ts: ts,
      data: {
        test: 'data'
      }
    })
    .then(id => {
      t.regex(id, rxUUID)
      return record.get(id);
    })
    .then(record => {
      t.is(record.type, 'test');
      t.is(record.sid, 'subject');
      t.is(record.oid, 'object');
      t.is(record.ts, ts);
      t.is(record.data.test, 'data');
    });
});

let simpleId;
test.serial('adds a simple record', t => record
  .add({
    type: 'test',
    sid: 'subject'
  })
  .then(id => {
    simpleId = id;
    t.regex(id, rxUUID);
    return record.get(id);
  })
  .then(record => {
    t.is(record.type, 'test');
    t.is(record.sid, 'subject');
    t.is(record.oid, undefined);
    t.is(record.data, undefined);
    t.truthy(record.ts);
  })
);

test.serial('gets a record by its properties', t => record
  ._getRecord({
    type: 'test',
    sid: 'subject'
  })
  .then(record => {
    t.is(record.id, simpleId);
    t.is(record.type, 'test');
    t.is(record.sid, 'subject');
  })
);

test.serial('updates a simple record', t => {
  const ts = Date.now();
  return record
    .add({
      type: 'test',
      sid: 'subject',
      ts: ts,
      update: true
    })
    .then(id => {
      t.regex(id, rxUUID);
      t.is(id, simpleId);
      return record.get(id);
    })
    .then(record => {
      t.is(record.type, 'test');
      t.is(record.sid, 'subject');
      t.is(record.ts, ts);
    });
});

test.serial('fails to get all the records', t => record
  .getAll({ type: 'test' })
  .then(() => t.fail())
  .catch(() => t.pass())
);

test.serial('gets all records by type and subject id', t => record
  .getAll({
    type: 'test',
    sid: 'subject'
  })
  .then(records => {
    t.is(records.length, 2);
    t.true(records[0].ts > records[1].ts);
  })
);

test.serial('gets all records by type and subject id with limit', t => record
  .getAll({
    type: 'test',
    sid: 'subject',
    limit: 1
  })
  .then(records => t.is(records.length, 1))
);

test.serial('gets all records by type, subject id and object id', t => record
  .getAll({
    type: 'test',
    sid: 'subject',
    oid: 'object'
  })
  .then(records => t.is(records.length, 1))
);

test.serial('checks is it has a record', t => record
  .has({
    type: 'test',
    sid: 'subject'
  })
  .then(res => t.true(res))
);

test.serial('checks is it has a non-existent record', t => record
  .has({
    type: 'test',
    sid: 'none'
  })
  .then(res => t.false(res))
);

test.serial('checks is it has a record with object id', t => record
  .has({
    type: 'test',
    sid: 'subject',
    oid: 'object'
  })
  .then(res => t.true(res))
);

test.serial('checks is it has a record with non-existent object id', t => record
  .has({
    type: 'test',
    sid: 'subject',
    oid: 'none'
  })
  .then(res => t.false(res))
);

//search
test.serial('checks the search: type', t => record
  .search({
    type: 'test'
  })
  .then(records => t.is(records.length, 2))
);

test.serial('checks the search: type, sid', t => record
  .search({
    type: 'test',
    sid: 'subject'
  })
  .then(records => t.is(records.length, 2))
);

test.serial('checks the search: type, oid', t => record
  .search({
    type: 'test',
    oid: 'object'
  })
  .then(records => t.is(records.length, 1))
);

test.serial('checks the search: type, sid, oid', t => record
  .search({
    type: 'test',
    sid: 'subject',
    oid: 'object'
  })
  .then(records => t.is(records.length, 1))
);

test.serial('checks the search: no results', t => record
  .search({
    sid: 'none',
    oid: 'object'
  })
  .then(records => t.is(records.length, 0))
);

test.serial('checks the search: type, count', t => record
  .search({
    type: 'test',
    count: true
  })
  .then(records => t.is(records, 2))
);

test.serial('checks the search: type, limit', t => record
  .search({
    type: 'test',
    limit: 1
  })
  .then(records => t.is(records.length, 1))
);

test.serial('checks the search: type, sample', t => record
  .search({
    type: 'test',
    sample: 1
  })
  .then(records => t.is(records.length, 1))
);

//delete
test.serial('fails to delete a records', t => record
  .delete({ type: 'test' })
  .then(() => t.fail())
  .catch(() => t.pass())
);

test.serial('deletes a record', t => record
  .delete({
    type: 'test',
    sid: 'subject'
  })
  .then(id => t.regex(id, rxUUID))
);

test.serial('deletes all the records with id', t => record
  .deleteAll('object')
  .then(res => {
    t.is(res.deleted, 1);
    t.pass();
  })
);
