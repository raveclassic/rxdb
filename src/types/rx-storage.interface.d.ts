import type {
    SortComparator,
    QueryMatcher
} from 'event-reduce-js';
import type {
    BulkWriteLocalRow,
    BulkWriteRow,
    ChangeStreamEvent,
    ChangeStreamOnceOptions,
    PreparedQuery,
    RxDocumentData,
    RxLocalDocumentData,
    RxLocalStorageBulkWriteResponse,
    RxStorageBulkWriteResponse,
    RxStorageChangeEvent,
    RxStorageInstanceCreationParams,
    RxStorageQueryResult
} from './rx-storage';
import type {
    BlobBuffer,
    MangoQuery,
    RxJsonSchema
} from './';
import type {
    Observable
} from 'rxjs';

/**
 * TODO WORK IN PROGRESS! Might change without breaking change.
 * This is an interface that abstracts the storage engine.
 * At the moment we only have PouchDB as storage but
 * in the future we want to create many more of them.
 *
 * Also see
 * @link https://github.com/pubkey/rxdb/issues/1636
 *
 *
 */


/**
 * A RxStorage is a module that acts
 * as a factory that can create multiple RxStorageInstance
 * objects.
 */
export interface RxStorage<Internals, InstanceCreationOptions> {
    /**
     * name of the storage engine
     * used to detect if plugins do not work so we can throw propper errors.
     */
    readonly name: string;

    /**
     * Returns a hash of the given value.
     * Used to check equalness of attachments data and other stuff.
     * Pouchdb uses md5 but we can use whatever we want as long as each
     * storage class returns the same hash each time.
     */
    hash(data: Buffer | Blob | string): Promise<string>;

    /**
     * creates a storage instance
     * that can contain the internal database
     * For example the PouchDB instance
     */
    createStorageInstance<DocumentData>(
        params: RxStorageInstanceCreationParams<DocumentData, InstanceCreationOptions>
    ): Promise<RxStorageInstance<DocumentData, Internals, InstanceCreationOptions>>;

    /**
     * Creates the internal storage instance
     * that is only cappable of saving schemaless key-object relations.
     */
    createKeyObjectStorageInstance(
        databaseName: string,
        collectionName: string,
        options: InstanceCreationOptions
    ): Promise<RxStorageKeyObjectInstance<Internals, InstanceCreationOptions>>;
}


export interface RxStorageInstanceBase<Internals, InstanceCreationOptions> {
    readonly databaseName: string;
    /**
     * Returns the internal data that is used by the storage engine.
     * For example the pouchdb instance.
     */
    readonly internals: Readonly<Internals>;
    readonly options: Readonly<InstanceCreationOptions>;

    /**
     * Closes the storage instance so it cannot be used
     * anymore and should clear all memory.
     * The returned promise must resolve when everything is cleaned up.
     */
    close(): Promise<void>;

    /**
     * Remove the database and
     * deletes all of its data.
     */
    remove(): Promise<void>;
}

/**
 * A StorateInstance that is only capable of saving key-object relations,
 * cannot be queried and has no schema.
 * In the past we saved normal and local documents into the same instance of pouchdb.
 * This was bad because it means that on migration or deletion, we always
 * will remove the local documents. Now this is splitted into
 * as separate RxStorageKeyObjectInstance that only stores the local documents
 * aka key->object sets.
 */
export interface RxStorageKeyObjectInstance<Internals, InstanceCreationOptions>
    extends RxStorageInstanceBase<Internals, InstanceCreationOptions> {

    /**
     * Writes multiple local documents to the storage instance.
     * The write for each single document is atomic, there
     * is not transaction arround all documents.
     * It must be possible that some document writes succeed
     * and others error.
     * We need this to have a similar behavior as most NoSQL databases.
     * Local documents always have _id as primary and cannot have attachments.
     * They can only be queried directly by their primary _id.
     */
    bulkWrite<D = any>(
        documentWrites: BulkWriteLocalRow<D>[]
    ): Promise<
        /**
         * returns the response, splitted into success and error lists.
         */
        RxLocalStorageBulkWriteResponse<D>
    >;

    /**
     * Get Multiple local documents by their primary value.
     */
    findLocalDocumentsById<D = any>(
        /**
         * List of primary values
         * of the documents to find.
         */
        ids: string[]
    ): Promise<Map<string, RxLocalDocumentData<D>>>;

    /**
     * Emits all changes to the local documents.
     */
    changeStream(): Observable<RxStorageChangeEvent<RxLocalDocumentData>>;
}

export interface RxStorageInstance<
    /**
     * The type of the documents that can be stored in this instance.
     * All documents in an instance must comply to the same schema.
     */
    DocumentData,
    Internals,
    InstanceCreationOptions
    >
    extends RxStorageInstanceBase<Internals, InstanceCreationOptions> {

    readonly schema: Readonly<RxJsonSchema<DocumentData>>;
    readonly collectionName: string;

    /**
     * pouchdb and others have some bugs
     * and behaviors that must be worked arround
     * before querying the db.
     * For performance reason this preparation
     * runs in a single step so it can be cached
     * when the query is used multiple times.
     * 
     * If your custom storage engine is capable of running
     * all valid mango queries properly, just return the
     * mutateableQuery here.
     * 
     *
     * @returns a format of the query than can be used with the storage
     */
    prepareQuery(
        /**
         * a query that can be mutated by the function without side effects.
         */
        mutateableQuery: MangoQuery<DocumentData>
    ): PreparedQuery<DocumentData>;

    /**
     * Returns the sort-comparator,
     * which is able to sort documents in the same way
     * a query over the db would do.
     */
    getSortComparator(
        query: MangoQuery<DocumentData>
    ): SortComparator<DocumentData>;

    /**
     * Returns a function
     * that can be used to check if a document
     * matches the query.
     *  
     */
    getQueryMatcher(
        query: MangoQuery<DocumentData>
    ): QueryMatcher<DocumentData>;

    /**
     * Writes multiple non-local documents to the storage instance.
     * The write for each single document is atomic, there
     * is no transaction arround all documents.
     * The written documents must be the newest revision of that documents data.
     * If the previous document is not the current newest revision, a conflict error
     * must be returned.
     * It must be possible that some document writes succeed
     * and others error. We need this to have a similar behavior as most NoSQL databases.
     */
    bulkWrite(
        documentWrites: BulkWriteRow<DocumentData>[]
    ): Promise<
        /**
         * returns the response, splitted into success and error lists.
         */
        RxStorageBulkWriteResponse<DocumentData>
    >;

    /**
     * Adds revisions of documents to the storage instance.
     * The revisions do not have to be the newest ones but can also be past
     * states of the documents.
     * Adding revisions can never cause conflicts.
     * 
     * Notice: When a revisions of a document is added and the storage instance
     * decides that this is now the newest revision, the changeStream() must emit an event
     * based on what the previous newest revision of the document was.
     */
    bulkAddRevisions(
        documents: RxDocumentData<DocumentData>[]
    ): Promise<void>;

    /**
     * Get Multiple documents by their primary value.
     * This must also return deleted documents.
     */
    findDocumentsById(
        /**
         * List of primary values
         * of the documents to find.
         */
        ids: string[],
        /**
         * If set to true, deleted documents will also be returned.
         */
        deleted: boolean
    ): Promise<Map<string, RxDocumentData<DocumentData>>>;

    /**
     * Runs a NoSQL 'mango' query over the storage
     * and returns the found documents data.
     * Having all storage instances behave similar
     * is likely the most difficult thing when creating a new
     * rx-storage implementation. Atm we use the pouchdb-find plugin
     * as reference to how NoSQL-queries must work.
     * But the past has shown that pouchdb find can behave wrong,
     * which must be fixed or at least documented.
     *
     * TODO should we have a way for streamed results
     * or a way to cancel a running query?
     */
    query(
        /**
         * Here we get the result of this.prepareQuery()
         * instead of the plain mango query.
         * This makes it easier to have good performance
         * when transformations of the query must be done.
         */
        preparedQuery: PreparedQuery<DocumentData>
    ): Promise<RxStorageQueryResult<DocumentData>>;


    /**
     * Returns the plain data of a single attachment.
     */
    getAttachmentData(
        documentId: string,
        attachmentId: string
    ): Promise<BlobBuffer>;

    /**
     * Returns the ids of all documents that have been
     * changed since the given startSequence.
     */
    getChangedDocuments(
        options: ChangeStreamOnceOptions
    ): Promise<{
        changedDocuments: {
            id: string;
            sequence: number;
        }[];
        /**
         * The last sequence number is returned in a separate field
         * because the storage instance might have left out some events
         * that it does not want to send out to the user.
         * But still we need to know that they are there for a gapless pagination.
         */
        lastSequence: number;
    }>;

    /**
     * Returns an ongoing stream
     * of all changes that happen to the
     * storage instance.
     * Do not forget to unsubscribe.
     */
    changeStream(): Observable<RxStorageChangeEvent<RxDocumentData<DocumentData>>>;
}
