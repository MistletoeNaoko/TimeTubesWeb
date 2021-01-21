import dispatcher from '../Dispatcher/dispatcher';

export function showClusteringResults (datasets, subsequences, ranges, clusterCenters, labels, clusteringParameters, subsequenceParameters, clusteringScores, filteringProcess) {
    dispatcher.dispatch({
        type: 'SHOW_CLUSTERING_RESULTS', 
        datasets, 
        subsequences, 
        ranges,
        clusterCenters, 
        labels,
        clusteringParameters,
        subsequenceParameters,
        clusteringScores,
        filteringProcess
    });
}

export function changeClusteringMethod(method) {
    dispatcher.dispatch({type: 'CHANGE_CLUSTERING_METHOD', method});
}

export function showClusterDetails(cluster) {
    dispatcher.dispatch({type: 'SHOW_CLUSTER_DETAILS', cluster});
}

export function showFilteringStep(selectedProcess) {
    dispatcher.dispatch({type: 'SHOW_FILTERING_STEP', selectedProcess});
}

export function updateClusteringResults(subsequences, clusterCenters, labels, clusteringScores, selectedSS, updatedSS) {
    dispatcher.dispatch({type: 'UPDATE_CLUSTERING_RESULTS', subsequences, clusterCenters, labels, clusteringScores, selectedSS, updatedSS});
}

export function resetClusteringResults() {
    dispatcher.dispatch({type: 'RESET_CLUSTERING_RESULTS'});
}

export function updateSSSelection(selectedSS, updatedSS) {
    dispatcher.dispatch({type: 'UPDATE_SS_SELECTION', selectedSS, updatedSS});
}
