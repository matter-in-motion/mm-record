'use strict';
const Promise = require('bluebird');
const uuid5 = require('uuid5');

const dontThrowExists = err => {
  if (err.msg.indexOf('already exists') === -1) {
    throw err;
  }
}

const Controller = function() {
  this.r = null;
};

Controller.prototype.schema = {
  record: {
    db: 'rethinkdb',
    table: 'records',
    indexes: [ 'type', 'index' ],
    apply: function(r, schema) {
      const table = schema.table;
      const applied = {
        tables: [],
        indexes: []
      };

      return r.tableCreate(table).run()
        .then(() => applied.tables.push(table))
        .catch(dontThrowExists)
        .then(() => r.table(table)
          .indexCreate('type')
          .run()
        )
        .then(() => applied.indexes.push(`${table}.type`))
        .catch(dontThrowExists)
        .then(() => r.table(table)
          .indexCreate('index', [ r.row('type'), r.row('sid'), r.row('ts') ])
          .run()
        )
        .then(() => applied.indexes.push(`${table}.index`))
        .catch(dontThrowExists)
        .then(() => applied);
    }
  }
};

Controller.prototype.__init = function(units) {
  this.r = units.require('db.rethinkdb');
  this.table = this.schema.record.table;
};

Controller.prototype.record = function(opts = {}) {
  if (!opts.type || !opts.sid) {
    return Promise.reject(new Error('No type or subject id provided for a record'));
  }

  let id = `${opts.type}.${opts.sid}`;
  let record = {
    type: opts.type,
    sid: opts.sid,
    ts: opts.ts || Date.now()
  };

  if (opts.oid) {
    id += `.${opts.oid}`;
    record.oid = opts.oid;
  }

  if (opts.data) {
    record.data = opts.data;
  }

  record.id = uuid5(id);
  return Promise.resolve(record);
};

Controller.prototype.get = function(id) {
  return this._get(id).run();
};

Controller.prototype._get = function(id) {
  return this.r.table(this.table).get(id);
};

Controller.prototype._getRecord = function(opts) {
  return this.record(opts)
    .then(record => this.r
      .table(this.table)
      .get(record.id)
    );
};

Controller.prototype.getAll = function(opts) {
  const r = this.r;
  let q = r.table(this.table)
    .between([ opts.type, opts.sid, r.minval ], [ opts.type, opts.sid, r.maxval ], { index: 'index' })
    .orderBy({ index: r.desc('index') })

  if (opts.oid) {
    q = q.filter({ oid: opts.oid })
  }

  if (opts.limit) {
    return q.limit(opts.limit);
  }

  return q;
};

Controller.prototype.has = function(opts) {
  return this.record(opts)
    .then(record => this.r
      .table(this.table)
      .get(record.id)
      .hasFields('id')
      .default(false)
      .run()
    );
};

Controller.prototype.add = function(opts) {
  const r = this.r;

  return this.record(opts)
    .then(record => {
      if (opts.update) {
        return r.table(this.table)
          .get(record.id)
          .replace(row => r.branch(
            row,
            row.merge({ ts: record.ts }),
            record
          ))
          .run()
          .then(() => record.id);
      }

      return r.table(this.table)
        .insert(record)
        .then(() => record.id);
    })
};

Controller.prototype.delete = function(opts) {
  return this.record(opts)
    .then(record => this.r
      .table(this.table)
      .get(record.id)
      .delete()
      .run()
      .then(() => record.id)
    )
};

Controller.prototype.deleteAll = function(id) {
  const r = this.r;

  return r.table(this.table)
    .filter(
      r.or(
        r.row('sid').eq(id),
        r.row('oid').eq(id)
      )
    )
    .delete()
    .run();
};

Controller.prototype.search = function(opts = {}) {
  return this._search(opts).run();
};

Controller.prototype._search = function(opts = {}) {
  const r = this.r;
  let q = r.table(this.table)

  if (opts.type !== undefined) {
    q = q.getAll(opts.type, { index: 'type' });
  }

  if (opts.sid) {
    q = q.filter({ sid: opts.sid });
  }

  if (opts.oid) {
    q = q.filter({ oid: opts.oid })
  }

  if (opts.sample) {
    q = q.sample(opts.sample);
  } else if (opts.limit) {
    q = q.limit(opts.limit);
  } else if (opts.count) {
    q = q.count();
  }

  return q;
};

module.exports = Controller;
