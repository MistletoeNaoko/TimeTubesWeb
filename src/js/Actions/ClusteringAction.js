import dispatcher from '../Dispatcher/dispatcher';

export function showClusteringResults (datasets, subsequences, ranges, clusterCenters, labels, clusteringParameters, subsequenceParameters) {
    dispatcher.dispatch({
        type: 'SHOW_CLUSTERING_RESULTS', 
        datasets, 
        subsequences, 
        ranges,
        clusterCenters, 
        labels,
        clusteringParameters,
        subsequenceParameters
    });
}

export function changeClusteringMethod(method) {
    dispatcher.dispatch({type: 'CHANGE_CLUSTERING_METHOD', method});
}

export function showClusterDetails(cluster) {
    dispatcher.dispatch({type: 'SHOW_CLUSTER_DETAILS', cluster});
}
