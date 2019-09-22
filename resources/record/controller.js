'use strict';
const uuid5 = require('uuid5');

const RDBDontThrowExists = err => {
  if (!err.msg.includes('already exists')) {
    throw err;
  }
}

class Controller {
  schema = {
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
          .catch(RDBDontThrowExists)
          .then(() => r.table(table)
            .indexCreate('type')
            .run()
          )
          .then(() => applied.indexes.push(`${table}.type`))
          .catch(RDBDontThrowExists)
          .then(() => r.table(table)
            .indexCreate('index', [ r.row('type'), r.row('sid'), r.row('ts') ])
            .run()
          )
          .then(() => applied.indexes.push(`${table}.index`))
          .catch(RDBDontThrowExists)
          .then(() => applied);
      }
    }
  }

  __init(units) {
    this.r = units.require('db.rethinkdb');
    this.table = this.schema.record.table;
  }

  record(opts = {}) {
    if (!opts.type || !opts.sid) {
      return Promise.reject(new Error('No type or subject id provided for a record'));
    }

    let id = `${opts.type}.${opts.sid}`;
    const record = {
      type: opts.type,
      sid: opts.sid,
      ts: opts.ts || Date.now()
    }

    if (opts.oid) {
      id += `.${opts.oid}`;
      record.oid = opts.oid;
    }

    if (opts.data) {
      record.data = opts.data;
    }

    record.id = uuid5(id);
    return Promise.resolve(record);
  }

  get(id) {
    return this._get(id).run();
  }

  _get(id) {
    return this.r.table(this.table).get(id);
  }

  _getRecord(opts) {
    return this.record(opts)
      .then(record => this.r
        .table(this.table)
        .get(record.id)
      );
  }

  getAll(opts) {
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
  }

  has(opts) {
    return this.record(opts)
      .then(record => this.r
        .table(this.table)
        .get(record.id)
        .hasFields('id')
        .default(false)
        .run()
      );
  }

  add(opts) {
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
  }

  delete(opts) {
    return this.record(opts)
      .then(record => this.r
        .table(this.table)
        .get(record.id)
        .delete()
        .run()
        .then(() => record.id)
      )
  }

  deleteAll(id) {
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
  }

  search(opts = {}) {
    return this._search(opts).run();
  }

  _search(opts = {}) {
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
  }
}

module.exports = Controller;
