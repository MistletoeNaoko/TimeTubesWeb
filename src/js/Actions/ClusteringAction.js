import dispatcher from '../Dispatcher/dispatcher';

export function showClusteringResults (subsequences, clusterCenters, labels) {
    dispatcher.dispatch({type: 'SHOW_CLUSTERING_RESULTS', subsequences, clusterCenters, labels});
}

export function changeClusteringMethod(method) {
    dispatcher.dispatch({type: 'CHANGE_CLUSTERING_METHOD', method});
}
