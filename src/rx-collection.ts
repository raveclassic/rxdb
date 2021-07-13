import {
    filter,
    startWith,
    mergeMap,
    shareReplay,
    map
} from 'rxjs/operators';

import {
    ucfirst,
    nextTick,
    flatClone,
    promiseSeries,
    pluginMissing,
    ensureNotFalsy,
    getFromMapOrThrow,
    clone
} from './util';
import {
    _handleToStorageInstance,
    _handleFromStorageInstance,
    fillObjectDataBeforeInsert,
    writeToStorageInstance
} from './rx-collection-helper';
import {
    createRxQuery,
    RxQueryBase,
    _getDefaultQuery
} from './rx-query';
import {
    isInstanceOf as isInstanceOfRxSchema,
    createRxSchema
} from './rx-schema';
import {
    newRxError,
    newRxTypeError
} from './rx-error';
import type {
    DataMigrator
} from './plugins/migration';
import {
    Crypter,
    createCrypter
} from './crypter';
import {
    DocCache,
    createDocCache
} from './doc-cache';
import {
    QueryCache,
    createQueryCache,
    defaultCacheReplacementPolicy
} from './query-cache';
import {
    ChangeEventBuffer,
    createChangeEventBuffer
} from './change-event-buffer';
import {
    runAsyncPluginHooks,
    runPluginHooks
} from './hooks';

import type {
    Subscription,
    Observable
} from 'rxjs';

import type {
    KeyFunctionMap,
    RxCouchDBReplicationState,
    MigrationState,
    SyncOptions,
    RxCollection,
    RxDatabase,
    RxQuery,
    RxDocument,
    SyncOptionsGraphQL,
    RxDumpCollection,
    RxDumpCollectionAny,
    MangoQuery,
    MangoQueryNoLimit,
    RxCacheReplacementPolicy,
    RxStorageBulkWriteError,
    RxDocumentData,
    RxDocumentWriteData,
    RxStorageInstanceCreationParams,
    RxStorageKeyObjectInstance,
    BulkWriteRow,
    RxChangeEvent,
    RxChangeEventInsert,
    RxChangeEventUpdate,
    RxChangeEventDelete,
    RxStorage,
    RxStorageInstance
} from './types';
import type {
    RxGraphQLReplicationState
} from './plugins/replication-graphql';

import {
    RxSchema
} from './rx-schema';
import {
    createWithConstructor as createRxDocumentWithConstructor,
    isRxDocument
} from './rx-document';

import {
    createRxDocument,
    getRxDocumentConstructor
} from './rx-document-prototype-merge';
import { storageChangeEventToRxChangeEvent } from './rx-storage-helper';
import { validateDatabaseName } from './plugins/dev-mode/check-names';

const HOOKS_WHEN = ['pre', 'post'];
const HOOKS_KEYS = ['insert', 'save', 'remove', 'create'];
let hooksApplied = false;

export class RxCollectionBase<
    InstanceCreationOptions,
    RxDocumentType = { [prop: string]: any },
    OrmMethods = {},
    StaticMethods = { [key: string]: any }
    > {

    constructor(
        public database: RxDatabase<any, InstanceCreationOptions>,
        public name: string,
        public schema: RxSchema<RxDocumentType>,
        public instanceCreationOptions: InstanceCreationOptions = {} as any,
        public migrationStrategies: KeyFunctionMap = {},
        public methods: KeyFunctionMap = {},
        public attachments: KeyFunctionMap = {},
        public options: any = {},
        public cacheReplacementPolicy: RxCacheReplacementPolicy = defaultCacheReplacementPolicy,
        public statics: KeyFunctionMap = {}
    ) {
        _applyHookFunctions(this.asRxCollection);
    }

    /**
     * returns observable
     */
    get $(): Observable<RxChangeEvent<any>> {
        return this._observable$ as any;
    }
    get insert$(): Observable<RxChangeEventInsert<RxDocumentType>> {
        return this.$.pipe(
            filter(cE => cE.operation === 'INSERT')
        ) as any;
    }
    get update$(): Observable<RxChangeEventUpdate<RxDocumentType>> {
        return this.$.pipe(
            filter(cE => cE.operation === 'UPDATE')
        ) as any;
    }
    get remove$(): Observable<RxChangeEventDelete<RxDocumentType>> {
        return this.$.pipe(
            filter(cE => cE.operation === 'DELETE')
        ) as any;
    }

    get onDestroy() {
        if (!this._onDestroy) {
            this._onDestroy = new Promise(res => this._onDestroyCall = res);
        }
        return this._onDestroy;
    }

    public _isInMemory = false;
    public destroyed = false;
    public _atomicUpsertQueues = new Map(); // TODO type
    // defaults
    public synced: boolean = false;
    public hooks: any = {};
    public _subs: Subscription[] = [];

    // TODO move _repStates into migration plugin
    public _repStates: Set<RxCouchDBReplicationState> = new Set();

    // TODO use type RxStorageInstance when rx-storage is implemented
    public storageInstance: RxStorageInstance<RxDocumentType, any, any> = {} as any;

    /**
     * Stores the local documents so that they are not deleted
     * when a migration runs.
     */
    public localDocumentsStore: RxStorageKeyObjectInstance<any, any> = {} as any;


    public _docCache: DocCache<
        RxDocument<RxDocumentType, OrmMethods>
    > = createDocCache();

    public _queryCache: QueryCache = createQueryCache();
    public _crypter: Crypter = {} as Crypter;
    public _observable$: Observable<RxChangeEvent<RxDocumentType>> = {} as any;
    public _changeEventBuffer: ChangeEventBuffer = {} as ChangeEventBuffer;

    /**
     * returns a promise that is resolved when the collection gets destroyed
     */
    private _onDestroy?: Promise<void>;

    private _onDestroyCall?: () => void;
    public async prepare(
        /**
         * set to true if the collection data already exists on this storage adapter
         */
        wasCreatedBefore: boolean
    ): Promise<any> {


        const storageInstanceCreationParams: RxStorageInstanceCreationParams<RxDocumentType, InstanceCreationOptions> = {
            databaseName: this.database.name,
            collectionName: this.name,
            schema: this.schema.jsonSchema,
            options: this.instanceCreationOptions
        };

        runPluginHooks(
            'preCreateRxStorageInstance',
            storageInstanceCreationParams
        );

        const [
            storageInstance,
            localDocumentsStore
        ] = await Promise.all([
            (this.database.storage as RxStorage<any, any>).createStorageInstance<RxDocumentType>(
                storageInstanceCreationParams
            ),
            this.database.storage.createKeyObjectStorageInstance(
                this.database.name,
                /**
                 * Use a different collection name for the local documents instance
                 * so that the local docs can be kept while deleting the normal instance
                 * after migration.
                 */
                this.name + '-local',
                this.instanceCreationOptions
            )
        ]);
        this.storageInstance = storageInstance;
        this.localDocumentsStore = localDocumentsStore;

        // we trigger the non-blocking things first and await them later so we can do stuff in the mean time

        this._crypter = createCrypter(this.database.password, this.schema);

        this._observable$ = this.database.$.pipe(
            filter((event: RxChangeEvent<any>) => {
                return event.collectionName === this.name;
            })
        );
        this._changeEventBuffer = createChangeEventBuffer(this.asRxCollection);


        const subDocs = storageInstance.changeStream().pipe(
            map(storageEvent => storageChangeEventToRxChangeEvent(
                false,
                storageEvent,
                this.database,
                this as any
            ))
        ).subscribe(cE => {
            this.$emit(cE);
        });
        this._subs.push(subDocs);
        const subLocalDocs = this.localDocumentsStore.changeStream().pipe(
            map(storageEvent => storageChangeEventToRxChangeEvent(
                true,
                storageEvent,
                this.database,
                this as any
            ))
        ).subscribe(cE => this.$emit(cE));
        this._subs.push(subLocalDocs);


        /**
         * When a write happens to the collection
         * we find the changed document in the docCache
         * and tell it that it has to change its data.
         */
        this._subs.push(
            this._observable$
                .pipe(
                    filter((cE: RxChangeEvent<RxDocumentType>) => !cE.isLocal)
                )
                .subscribe(cE => {
                    // when data changes, send it to RxDocument in docCache
                    const doc = this._docCache.get(cE.documentId);
                    if (doc) {
                        doc._handleChangeEvent(cE);
                    }
                })
        );
    }


    // overwritte by migration-plugin
    migrationNeeded(): Promise<boolean> {
        if (this.schema.version === 0) {
            return Promise.resolve(false);
        }
        throw pluginMissing('migration');
    }
    getDataMigrator(): DataMigrator {
        throw pluginMissing('migration');
    }
    migrate(batchSize: number = 10): Observable<MigrationState> {
        return this.getDataMigrator().migrate(batchSize);
    }
    migratePromise(batchSize: number = 10): Promise<any> {
        return this.getDataMigrator().migratePromise(batchSize);
    }

    /**
     * wrapps the query function of the storage instance.
     */
    async _queryStorageInstance(
        rxQuery: RxQuery | RxQueryBase,
        limit?: number,
        noDecrypt: boolean = false
    ): Promise<any[]> {
        const preparedQuery = rxQuery.toJSON();
        if (limit) {
            preparedQuery['limit'] = limit;
        }

        const queryResult = await this.database.lockedRun(
            () => this.storageInstance.query(preparedQuery)
        );

        const docs = queryResult.documents
            .map((doc: any) => _handleFromStorageInstance(this, doc, noDecrypt));
        return docs;
    }

    $emit(changeEvent: RxChangeEvent<any>) {
        return this.database.$emit(changeEvent);
    }


    /**
     * TODO internally call bulkInsert
     * to not have duplicated code.
     */
    async insert(
        json: RxDocumentType | RxDocument
    ): Promise<RxDocument<RxDocumentType, OrmMethods>> {
        // inserting a temporary-document
        let tempDoc: RxDocument | null = null;
        if (isRxDocument(json)) {
            tempDoc = json as RxDocument;
            if (!tempDoc._isTemporary) {
                throw newRxError('COL1', {
                    data: json
                });
            }
            json = tempDoc.toJSON() as any;
        }

        const useJson: RxDocumentWriteData<RxDocumentType> = fillObjectDataBeforeInsert(this as any, json);
        let newDoc = tempDoc;

        await this._runHooks('pre', 'insert', useJson);
        this.schema.validate(useJson);
        const insertResult = await writeToStorageInstance(
            this,
            {
                document: useJson
            }
        );

        if (tempDoc) {
            tempDoc._dataSync$.next(insertResult);
        } else {
            newDoc = createRxDocument(this as any, insertResult);
        }

        await this._runHooks('post', 'insert', useJson, newDoc);

        return newDoc as any;
    }

    async bulkInsert(
        docsData: RxDocumentType[]
    ): Promise<{
        success: RxDocument<RxDocumentType, OrmMethods>[];
        error: RxStorageBulkWriteError<RxDocumentType>[];
    }> {
        const useDocs: RxDocumentType[] = docsData.map(docData => {
            const useDocData = fillObjectDataBeforeInsert(this as any, docData);
            return useDocData;
        });

        const docs = await Promise.all(
            useDocs.map(doc => {
                return this._runHooks('pre', 'insert', doc).then(() => {
                    this.schema.validate(doc);
                    return doc;
                });
            })
        );

        const insertDocs: BulkWriteRow<RxDocumentType>[] = docs.map(d => ({
            document: _handleToStorageInstance(this, d)
        }));
        const docsMap: Map<string, RxDocumentType> = new Map();
        docs.forEach(d => {
            docsMap.set((d as any)[this.schema.primaryPath] as any, d);
        });

        const results = await this.database.lockedRun(
            () => this.storageInstance.bulkWrite(insertDocs)
        );

        // create documents
        const successEntries: [string, RxDocumentData<RxDocumentType>][] = Array.from(results.success.entries());
        const rxDocuments: any[] = successEntries
            .map(([key, writtenDocData]) => {
                const docData: RxDocumentData<RxDocumentType> = getFromMapOrThrow(docsMap, key) as any;
                docData._rev = writtenDocData._rev;
                const doc = createRxDocument(this as any, docData);
                return doc;
            });


        await Promise.all(
            rxDocuments.map(doc => {
                return this._runHooks(
                    'post',
                    'insert',
                    docsMap.get(doc.primary),
                    doc
                );
            })
        );

        return {
            success: rxDocuments,
            error: Array.from(results.error.values())
        };
    }

    async bulkRemove(
        ids: string[]
    ): Promise<{
        success: RxDocument<RxDocumentType, OrmMethods>[];
        error: RxStorageBulkWriteError<RxDocumentType>[];
    }> {
        const rxDocumentMap = await this.findByIds(ids);
        const docsData: RxDocumentData<RxDocumentType>[] = [];
        const docsMap: Map<string, RxDocumentData<RxDocumentType>> = new Map();
        Array.from(rxDocumentMap.values()).forEach(rxDocument => {
            const data: RxDocumentData<RxDocumentType> = clone(rxDocument.toJSON(true)) as any;
            docsData.push(data);
            docsMap.set(rxDocument.primary, data);
        });

        await Promise.all(
            docsData.map(doc => {
                const primary = (doc as any)[this.schema.primaryPath];
                return this._runHooks('pre', 'remove', doc, rxDocumentMap.get(primary));
            })
        );


        const removeDocs: BulkWriteRow<RxDocumentType>[] = docsData.map(doc => {
            const writeDoc = flatClone(doc);
            writeDoc._deleted = true;
            return {
                previous: _handleToStorageInstance(this, doc),
                document: _handleToStorageInstance(this, writeDoc)
            };
        });

        const results = await this.database.lockedRun(
            () => this.storageInstance.bulkWrite(removeDocs)
        );

        const successIds: string[] = Array.from(results.success.keys());

        // run hooks
        await Promise.all(
            successIds.map(id => {
                return this._runHooks(
                    'post',
                    'remove',
                    docsMap.get(id),
                    rxDocumentMap.get(id)
                );
            })
        );

        const rxDocuments: any[] = successIds.map(id => {
            return rxDocumentMap.get(id);
        });

        return {
            success: rxDocuments,
            error: Array.from(results.error.values())
        };
    }

    /**
     * same as insert but overwrites existing document with same primary
     */
    upsert(json: Partial<RxDocumentType>): Promise<RxDocument<RxDocumentType, OrmMethods>> {
        const useJson = fillObjectDataBeforeInsert(this as any, json);
        const primary = useJson[this.schema.primaryPath];
        if (!primary) {
            throw newRxError('COL3', {
                primaryPath: this.schema.primaryPath as string,
                data: useJson,
                schema: this.schema.jsonSchema
            });
        }

        return this.findOne(primary).exec()
            .then((existing: any) => {
                if (existing) {
                    useJson._rev = existing['_rev'];

                    return existing.atomicUpdate(() => useJson as any)
                        .then(() => existing);
                } else {
                    return this.insert(json as any);
                }
            });
    }

    /**
     * upserts to a RxDocument, uses atomicUpdate if document already exists
     */
    atomicUpsert(json: Partial<RxDocumentType>): Promise<RxDocument<RxDocumentType, OrmMethods>> {
        const useJson = fillObjectDataBeforeInsert(this as any, json);
        const primary = (useJson as any)[this.schema.primaryPath];
        if (!primary) {
            throw newRxError('COL4', {
                data: json
            });
        }

        // ensure that it wont try 2 parallel runs
        let queue;
        if (!this._atomicUpsertQueues.has(primary)) {
            queue = Promise.resolve();
        } else {
            queue = this._atomicUpsertQueues.get(primary);
        }
        queue = queue
            .then(() => _atomicUpsertEnsureRxDocumentExists(this as any, primary as any, useJson))
            .then((wasInserted: any) => {
                if (!wasInserted.inserted) {
                    return _atomicUpsertUpdate(wasInserted.doc, useJson)
                        /**
                         * tick here so the event can propagate
                         * TODO we should not need that here
                         */
                        .then(() => nextTick())
                        .then(() => nextTick())
                        .then(() => nextTick())
                        .then(() => wasInserted.doc);
                } else
                    return wasInserted.doc;
            });
        this._atomicUpsertQueues.set(primary, queue);
        return queue;
    }

    find(queryObj?: MangoQuery<RxDocumentType>): RxQuery<
        RxDocumentType,
        RxDocument<RxDocumentType, OrmMethods>[]
    > {
        if (typeof queryObj === 'string') {
            throw newRxError('COL5', {
                queryObj
            });
        }

        if (!queryObj) {
            queryObj = _getDefaultQuery(this as any);
        }

        const query = createRxQuery('find', queryObj, this as any);
        return query as any;
    }

    findOne(queryObj?: MangoQueryNoLimit<RxDocumentType> | string): RxQuery<
        RxDocumentType,
        RxDocument<RxDocumentType, OrmMethods>
        | null
    > {
        let query;

        if (typeof queryObj === 'string') {
            query = createRxQuery('findOne', {
                selector: {
                    [this.schema.primaryPath]: queryObj
                }
            }, this as any);
        } else {
            if (!queryObj) {
                queryObj = _getDefaultQuery(this as any);
            }

            // cannot have limit on findOne queries
            if ((queryObj as MangoQuery).limit) {
                throw newRxError('QU6');
            }

            query = createRxQuery('findOne', queryObj, this as any);
        }

        if (
            typeof queryObj === 'number' ||
            Array.isArray(queryObj)
        ) {
            throw newRxTypeError('COL6', {
                queryObj
            });
        }

        return query as any;
    }

    /**
     * find a list documents by their primary key
     * has way better performance then running multiple findOne() or a find() with a complex $or-selected
     */
    async findByIds(
        ids: string[]
    ): Promise<Map<string, RxDocument<RxDocumentType, OrmMethods>>> {

        const ret = new Map();
        const mustBeQueried: string[] = [];

        // first try to fill from docCache
        ids.forEach(id => {
            const doc = this._docCache.get(id);
            if (doc) {
                ret.set(id, doc);
            } else {
                mustBeQueried.push(id);
            }
        });

        // find everything which was not in docCache
        if (mustBeQueried.length > 0) {
            const docs = await this.storageInstance.findDocumentsById(mustBeQueried, false);
            Array.from(docs.values()).forEach(docData => {
                docData = _handleFromStorageInstance(this, docData);
                const doc = createRxDocument<RxDocumentType, OrmMethods>(this as any, docData);
                ret.set(doc.primary, doc);
            });
        }
        return ret;
    }

    /**
     * like this.findByIds but returns an observable
     * that always emitts the current state
     */
    findByIds$(
        ids: string[]
    ): Observable<Map<string, RxDocument<RxDocumentType, OrmMethods>>> {
        let currentValue: Map<string, RxDocument<RxDocumentType, OrmMethods>> | null = null;
        let lastChangeEvent: number = -1;

        const initialPromise = this.findByIds(ids).then(docsMap => {
            lastChangeEvent = this._changeEventBuffer.counter;
            currentValue = docsMap;
        });
        return this.$.pipe(
            startWith(null),
            mergeMap(ev => initialPromise.then(() => ev)),
            /**
             * Because shareReplay with refCount: true
             * will often subscribe/unsusbscribe
             * we always ensure that we handled all missed events
             * since the last subscription.
             */
            mergeMap(async (ev) => {
                const resultMap = ensureNotFalsy(currentValue);
                const missedChangeEvents = this._changeEventBuffer.getFrom(lastChangeEvent + 1);
                if (missedChangeEvents === null) {
                    /**
                     * changeEventBuffer is of bounds -> we must re-execute over the database
                     * because we cannot calculate the new results just from the events.
                     */
                    const newResult = await this.findByIds(ids);
                    lastChangeEvent = this._changeEventBuffer.counter;
                    Array.from(newResult.entries()).forEach(([k, v]) => resultMap.set(k, v));
                } else {
                    missedChangeEvents
                        .filter(rxChangeEvent => ids.includes(rxChangeEvent.documentId))
                        .forEach(rxChangeEvent => {
                            const op = rxChangeEvent.operation;
                            if (op === 'INSERT' || op === 'UPDATE') {
                                resultMap.set(rxChangeEvent.documentId, this._docCache.get(rxChangeEvent.documentId) as any);
                            } else {
                                resultMap.delete(rxChangeEvent.documentId);
                            }
                        });
                }
                return resultMap;
            }),
            filter(x => !!x),
            shareReplay({
                bufferSize: 1,
                refCount: true
            })
        );
    }

    /**
     * Export collection to a JSON friendly format.
     * @param _decrypted
     * When true, all encrypted values will be decrypted.
     * When false or omitted and an interface or type is loaded in this collection,
     * all base properties of the type are typed as `any` since data could be encrypted.
     */
    exportJSON(_decrypted: boolean): Promise<RxDumpCollection<RxDocumentType>>;
    exportJSON(_decrypted?: false): Promise<RxDumpCollectionAny<RxDocumentType>>;
    exportJSON(_decrypted: boolean = false): Promise<any> {
        throw pluginMissing('json-dump');
    }

    /**
     * Import the parsed JSON export into the collection.
     * @param _exportedJSON The previously exported data from the `<collection>.exportJSON()` method.
     */
    importJSON(_exportedJSON: RxDumpCollectionAny<RxDocumentType>): Promise<void> {
        throw pluginMissing('json-dump');
    }

    /**
     * sync with a CouchDB endpoint
     */
    syncCouchDB(_syncOptions: SyncOptions): RxCouchDBReplicationState {
        throw pluginMissing('replication');
    }

    /**
     * sync with a GraphQL endpoint
     */
    syncGraphQL(options: SyncOptionsGraphQL<RxDocumentType>): RxGraphQLReplicationState<RxDocumentType> {
        throw pluginMissing('replication-graphql');
    }

    /**
     * Create a replicated in-memory-collection
     */
    inMemory(): Promise<RxCollection<RxDocumentType, OrmMethods>> {
        throw pluginMissing('in-memory');
    }


    /**
     * HOOKS
     */
    addHook(when: string, key: string, fun: any, parallel = false) {
        if (typeof fun !== 'function') {
            throw newRxTypeError('COL7', {
                key,
                when
            });
        }

        if (!HOOKS_WHEN.includes(when)) {
            throw newRxTypeError('COL8', {
                key,
                when
            });
        }

        if (!HOOKS_KEYS.includes(key)) {
            throw newRxError('COL9', {
                key
            });
        }

        if (when === 'post' && key === 'create' && parallel === true) {
            throw newRxError('COL10', {
                when,
                key,
                parallel
            });
        }

        // bind this-scope to hook-function
        const boundFun = fun.bind(this);

        const runName = parallel ? 'parallel' : 'series';

        this.hooks[key] = this.hooks[key] || {};
        this.hooks[key][when] = this.hooks[key][when] || {
            series: [],
            parallel: []
        };
        this.hooks[key][when][runName].push(boundFun);
    }
    getHooks(when: string, key: string) {
        try {
            return this.hooks[key][when];
        } catch (e) {
            return {
                series: [],
                parallel: []
            };
        }
    }

    _runHooks(when: string, key: string, data: any, instance?: any): Promise<any> {
        const hooks = this.getHooks(when, key);
        if (!hooks) return Promise.resolve();

        // run parallel: false
        const tasks = hooks.series.map((hook: any) => () => hook(data, instance));
        return promiseSeries(tasks)
            // run parallel: true
            .then(() => Promise.all(
                hooks.parallel
                    .map((hook: any) => hook(data, instance))
            ));
    }

    /**
     * does the same as ._runHooks() but with non-async-functions
     */
    _runHooksSync(when: string, key: string, data: any, instance: any) {
        const hooks = this.getHooks(when, key);
        if (!hooks) return;
        hooks.series.forEach((hook: any) => hook(data, instance));
    }

    /**
     * creates a temporaryDocument which can be saved later
     */
    newDocument(docData: Partial<RxDocumentType> = {}): RxDocument<RxDocumentType, OrmMethods> {
        docData = this.schema.fillObjectWithDefaults(docData);
        const doc: any = createRxDocumentWithConstructor(
            getRxDocumentConstructor(this as any),
            this as any,
            docData
        );
        doc._isTemporary = true;

        this._runHooksSync('post', 'create', docData, doc);
        return doc as any;
    }

    destroy(): Promise<boolean> {
        if (this.destroyed) {
            return Promise.resolve(false);
        }
        if (this._onDestroyCall) {
            this._onDestroyCall();
        }
        this._subs.forEach(sub => sub.unsubscribe());
        if (this._changeEventBuffer) {
            this._changeEventBuffer.destroy();
        }
        Array.from(this._repStates).forEach(replicationState => replicationState.cancel());

        return this.storageInstance.close().then(() => {
            delete this.database.collections[this.name];
            this.destroyed = true;

            return runAsyncPluginHooks('postDestroyRxCollection', this).then(() => true);
        });
    }

    /**
     * remove all data of the collection
     */
    remove(): Promise<any> {
        return this.database.removeCollection(this.name);
    }

    get asRxCollection(): RxCollection<RxDocumentType, OrmMethods, StaticMethods> {
        return this as any;
    }
}

/**
 * adds the hook-functions to the collections prototype
 * this runs only once
 */
function _applyHookFunctions(
    collection: RxCollection<any, any>
) {
    if (hooksApplied) return; // already run
    hooksApplied = true;
    const colProto = Object.getPrototypeOf(collection);
    HOOKS_KEYS.forEach(key => {
        HOOKS_WHEN.map(when => {
            const fnName = when + ucfirst(key);
            colProto[fnName] = function (fun: string, parallel: boolean) {
                return this.addHook(when, key, fun, parallel);
            };
        });
    });
}

function _atomicUpsertUpdate(doc: any, json: any): Promise<any> {
    return doc.atomicUpdate((innerDoc: any) => {
        json._rev = innerDoc._rev;
        innerDoc._data = json;
        return innerDoc._data;
    }).then(() => doc);
}

/**
 * ensures that the given document exists
 * @return promise that resolves with new doc and flag if inserted
 */
function _atomicUpsertEnsureRxDocumentExists(
    rxCollection: RxCollection,
    primary: string,
    json: any
): Promise<{ doc: RxDocument; inserted: boolean }> {
    /**
     * Optimisation shortcut,
     * first try to find the document in the doc-cache
     */
    const docFromCache = rxCollection._docCache.get(primary);
    if (docFromCache) {
        return Promise.resolve({
            doc: docFromCache,
            inserted: false
        });
    }
    return rxCollection.findOne(primary).exec()
        .then(doc => {
            if (!doc) {
                return rxCollection.insert(json).then(newDoc => ({
                    doc: newDoc,
                    inserted: true
                }));
            } else {
                return {
                    doc,
                    inserted: false
                };
            }
        });
}

/**
 * creates and prepares a new collection
 */
export function createRxCollection(
    {
        database,
        name,
        schema,
        instanceCreationOptions = {},
        migrationStrategies = {},
        autoMigrate = true,
        statics = {},
        methods = {},
        attachments = {},
        options = {},
        cacheReplacementPolicy = defaultCacheReplacementPolicy
    }: any,
    wasCreatedBefore: boolean
): Promise<RxCollection> {
    validateDatabaseName(name);

    // ensure it is a schema-object
    if (!isInstanceOfRxSchema(schema)) {
        schema = createRxSchema(schema);
    }

    Object.keys(methods)
        .filter(funName => schema.topLevelFields.includes(funName))
        .forEach(funName => {
            throw newRxError('COL18', {
                funName
            });
        });

    const collection = new RxCollectionBase(
        database,
        name,
        schema,
        instanceCreationOptions,
        migrationStrategies,
        methods,
        attachments,
        options,
        cacheReplacementPolicy,
        statics
    );

    return collection.prepare(wasCreatedBefore)
        .then(() => {

            // ORM add statics
            Object
                .entries(statics)
                .forEach(([funName, fun]) => {
                    Object.defineProperty(collection, funName, {
                        get: () => (fun as any).bind(collection)
                    });
                });

            let ret = Promise.resolve();
            if (autoMigrate && collection.schema.version !== 0) {
                ret = collection.migratePromise();
            }
            return ret;
        })
        .then(() => {
            runPluginHooks('createRxCollection', collection);
            return collection as any;
        });
}

export function isRxCollection(obj: any): boolean {
    return obj instanceof RxCollectionBase;
}
