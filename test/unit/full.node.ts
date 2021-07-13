/**
 * this tests some basic behavior and then exits with zero-code
 * this is run in a seperate node-process via plugin.test.js
 */

import assert from 'assert';

const {
    createRxDatabase,
    isRxDocument,
    randomCouchString,
    addPouchPlugin,
    getRxStoragePouch
} = require('../../');
import {
    RxJsonSchema,
} from '../../plugins/core';

addPouchPlugin(require('pouchdb-adapter-memory'));

const schema: RxJsonSchema<{ passportId: string; firstName: string; lastName: string }> = {
    title: 'human schema',
    description: 'describes a human being',
    version: 0,
    primaryKey: 'passportId',
    keyCompression: false,
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        }
    },
    indexes: [],
    required: ['firstName', 'lastName']
};

const run = async function () {
    // create database
    const db = await createRxDatabase({
        name: randomCouchString(10),
        storage: getRxStoragePouch('memory'),
        ignoreDuplicate: true
    });

    // create collection
    await db.addCollections({
        humans: {
            schema
        }
    });

    // insert
    await db.humans.insert({
        passportId: 'mypw',
        firstName: 'steve',
        lastName: 'piotr'
    });

    // query
    const doc = await db.humans.findOne().where('firstName').ne('foobar').exec();
    assert.ok(isRxDocument(doc));

    // destroy database
    await db.destroy();
};

run();
