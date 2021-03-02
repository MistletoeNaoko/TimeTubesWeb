import dispatcher from '../Dispatcher/dispatcher';

export function showClusteringResults (
    datasets, 
    subsequences, 
    ranges, 
    clusterCenters, 
    labels, 
    clusteringParameters, 
    subsequenceParameters, 
    clusteringScores, 
    filteringProcess, 
    resultsCoordinates, 
    SSEClusters) {
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
        filteringProcess,
        resultsCoordinates, 
        SSEClusters
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

export function updateClusteringResults(subsequences, clusterCenters, labels, clusteringScores, selectedSS, updatedSS, resultsCoordinates) {
    dispatcher.dispatch({
        type: 'UPDATE_CLUSTERING_RESULTS', 
        subsequences, 
        clusterCenters, 
        labels, 
        clusteringScores, 
        selectedSS, 
        updatedSS, 
        resultsCoordinates
    });
}

export function resetClusteringResults() {
    dispatcher.dispatch({type: 'RESET_CLUSTERING_RESULTS'});
}

export function updateSSSelection(selectedSS, updatedSS) {
    dispatcher.dispatch({type: 'UPDATE_SS_SELECTION', selectedSS, updatedSS});
}

export function showTTViewOfSelectedSSClusteringResults (id, period) {
    dispatcher.dispatch({type: 'SHOW_TTVIEW_OF_SELECTED_SS_CLUSTERING', id, period});
}

export function showSelectedSubsequenceInComparisonPanel(id, period, SSId) {
    dispatcher.dispatch({type: 'SHOW_SELECTED_SUBSEQUENCE_IN_COMPARISON_PANEL', id, period, SSId});
}

export function removeSelectedSubsequenceFromComparisonPanel(SSId) {
    dispatcher.dispatch({type: 'REMOVE_SELECTED_SUBSEQUENCE_FROM_COMPARISON_PANEL', SSId});
}

export function recoverClusteringSession(sessionInfo) {
    dispatcher.dispatch({type: 'RECOVER_CLUSTERING_SESSION', sessionInfo});
}
