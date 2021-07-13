import {
    ActionName,
    calculateActionName,
    runAction,
    QueryParams,
    QueryMatcher,
    SortComparator
} from 'event-reduce-js';
import type { RxQuery, MangoQuery, RxChangeEvent } from './types';
import { runPluginHooks } from './hooks';
import { rxChangeEventToEventReduceChangeEvent } from './rx-change-event';

export type EventReduceResultNeg = {
    runFullQueryAgain: true;
};
export type EventReduceResultPos<RxDocumentType> = {
    runFullQueryAgain: false;
    changed: boolean;
    newResults: RxDocumentType[];
};
export type EventReduceResult<RxDocumentType> = EventReduceResultNeg | EventReduceResultPos<RxDocumentType>;


export function getSortFieldsOfQuery<RxDocType>(
    primaryKey: keyof RxDocType,
    query: MangoQuery<RxDocType>
): string[] {
    if (!query.sort || query.sort.length === 0) {
        return [primaryKey as any];
    } else {
        return query.sort.map(part => Object.keys(part)[0]);
    }
}



export const RXQUERY_QUERY_PARAMS_CACHE: WeakMap<RxQuery, QueryParams<any>> = new WeakMap();
export function getQueryParams<RxDocType>(
    rxQuery: RxQuery<RxDocType>
): QueryParams<RxDocType> {
    if (!RXQUERY_QUERY_PARAMS_CACHE.has(rxQuery)) {
        const collection = rxQuery.collection;
        const queryJson: MangoQuery<RxDocType> = rxQuery.toJSON();
        const primaryKey = collection.schema.primaryPath;


        /**
         * Create a custom sort comparator
         * that uses the hooks to ensure
         * we send for example compressed documents to be sorted by compressed queries.
         */
        const sortComparator = collection.storageInstance.getSortComparator(queryJson);
        const useSortComparator: SortComparator<RxDocType> = (docA: RxDocType, docB: RxDocType) => {
            const sortComparatorData = {
                docA,
                docB,
                rxQuery
            };
            runPluginHooks('preSortComparator', sortComparatorData);
            return sortComparator(sortComparatorData.docA, sortComparatorData.docB);
        };


        /**
         * Create a custom query matcher
         * that uses the hooks to ensure
         * we send for example compressed documents to match compressed queries.
         */
        const queryMatcher = collection.storageInstance.getQueryMatcher(queryJson);
        const useQueryMatcher: QueryMatcher<RxDocType> = (doc: RxDocType) => {

            const queryMatcherData = {
                doc,
                rxQuery
            };
            runPluginHooks('preQueryMatcher', queryMatcherData);

            return queryMatcher(queryMatcherData.doc);
        };

        const ret: QueryParams<any> = {
            primaryKey: rxQuery.collection.schema.primaryPath as any,
            skip: queryJson.skip,
            limit: queryJson.limit,
            sortFields: getSortFieldsOfQuery(primaryKey, queryJson),
            sortComparator: useSortComparator,
            queryMatcher: useQueryMatcher
        };
        RXQUERY_QUERY_PARAMS_CACHE.set(rxQuery, ret);
        return ret;
    } else {
        return RXQUERY_QUERY_PARAMS_CACHE.get(rxQuery) as QueryParams<RxDocType>;
    }
}


export function calculateNewResults<RxDocumentType>(
    rxQuery: RxQuery<RxDocumentType>,
    rxChangeEvents: RxChangeEvent<RxDocumentType>[]
): EventReduceResult<RxDocumentType> {
    if (!rxQuery.collection.database.eventReduce) {
        return {
            runFullQueryAgain: true
        };
    }
    const queryParams = getQueryParams(rxQuery);
    const previousResults: RxDocumentType[] = rxQuery._resultsData.slice();
    const previousResultsMap: Map<string, RxDocumentType> = rxQuery._resultsDataMap;
    let changed: boolean = false;

    const foundNonOptimizeable = rxChangeEvents.find(cE => {
        const eventReduceEvent = rxChangeEventToEventReduceChangeEvent(cE);
        const actionName: ActionName = calculateActionName({
            queryParams,
            changeEvent: eventReduceEvent,
            previousResults,
            keyDocumentMap: previousResultsMap
        });
        if (actionName === 'runFullQueryAgain') {
            return true;
        } else if (actionName !== 'doNothing') {
            changed = true;
            runAction(
                actionName,
                queryParams,
                eventReduceEvent,
                previousResults,
                previousResultsMap
            );
            return false;
        }
    });
    if (foundNonOptimizeable) {
        return {
            runFullQueryAgain: true,
        };
    } else {
        return {
            runFullQueryAgain: false,
            changed,
            newResults: previousResults
        };
    }
}
