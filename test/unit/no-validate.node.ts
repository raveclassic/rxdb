import assert from 'assert';
import config from './config';

import {
    addRxPlugin,
    createRxDatabase,
    randomCouchString,
    RxJsonSchema,
} from '../../plugins/core';

import {
    addPouchPlugin,
    getRxStoragePouch
} from '../../plugins/pouchdb';


addRxPlugin(require('../../plugins/no-validate'));
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

config.parallel('no-validate.node.js', () => {
    it('should allow to insert everything', async () => {
        const db = await createRxDatabase({
            name: randomCouchString(10),
            storage: getRxStoragePouch('memory'),
        });
        const cols = await db.addCollections({
            humans: {
                schema
            }
        });
        await cols.humans.insert({
            passportId: randomCouchString(12),
            foo: 'bar'
        });
        db.destroy();
    });
    it('should allow to save everything', async () => {
        const db = await createRxDatabase({
            name: randomCouchString(10),
            storage: getRxStoragePouch('memory'),
        });
        const cols = await db.addCollections({
            humans: {
                schema
            }
        });
        await cols.humans.insert({
            passportId: randomCouchString(12),
            foo: 'bar'
        });
        const doc = await cols.humans.findOne().exec();
        assert.strictEqual(doc.get('foo'), 'bar');

        await doc.atomicPatch({ bar: 'foo' });
        db.destroy();
    });
});
