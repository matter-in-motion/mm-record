# Matter In Motion. Record resource extension

[![NPM Version](https://img.shields.io/npm/v/mm-record.svg?style=flat-square)](https://www.npmjs.com/package/mm-record)
[![NPM Downloads](https://img.shields.io/npm/dt/mm-record.svg?style=flat-square)](https://www.npmjs.com/package/mm-record)

This extension adds a __record__ resource. `Record` resource doesn't provide any API. Its main purpose is to record other resources relationship metadata.

## Usage

[Extensions installation intructions](https://github.com/matter-in-motion/mm/blob/master/docs/extensions.md)

## Record

Record is the object with fields:

* __type__ — string or number, type of the record.
* __sid__ — string or number, subject id
* __oid__ — string or number, _optional_, object id
* __ts__ — record timestamp
* __data__ — any, _optional_ data

## API

No API

## Controller Methods

### add(opts)

Adds a record. Available options:

* __type__ — string or number, type of the record.
* __sid__ — string or number, subject id
* oid — string or number, _optional_, object id
* data — any, data to add to the record
* update — boolean, if true and a record already exists it will update the timestamp of the record

### get(id)

Returns a record with `id`

### getAll(opts)

Returns all the records for the options. New records first. Available options:

* __type__ — selects records by type
* __sid__ — selects records with subject id
* oid — also filters records with object id
* limit — limits result number

### has(opts)

Checks if the record of `type` and with subject `sid` and/or object `oid` is available. Return `true` or `false`.

* __type__ — record type
* __sid__ — record subject id
* oid — record object id

### delete(opts)

Deletes a record

* __type__ — record type
* __sid__ — record subject id
* oid — record object id

### deleteAll(id)

Deletes all the records where `sid` or `oid` is equal to `id` _(slow method)_

### search(opts)

Records search _(slow method)_

* __type__ — with type
* __sid__ — with sid
* __oid__ — with oid
* __sample__ — number, return a random number of records
* __limit__ — limits results number
* __count__ — counts the number of records

_Last three options are exclusive._


License: MIT.
