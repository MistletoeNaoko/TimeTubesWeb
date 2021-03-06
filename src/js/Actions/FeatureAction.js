import dispatcher from '../Dispatcher/dispatcher';

export function updateSource(id) {
    dispatcher.dispatch({type:'UPDATE_SOURCE', id});
}

export function updateTarget(ids) {
    dispatcher.dispatch({type: 'UPDATE_TARGET', ids});
}

export function switchSelector(selector) {
    dispatcher.dispatch({type: 'SWITCH_SELECTOR', selector});
}

export function switchDragSelection() {
    dispatcher.dispatch({type: 'SWITCH_DRAGSELECTION'});
}

export function resetSelection() {
    dispatcher.dispatch({type: 'RESET_SELECTION'});
}

export function selectTimeInterval(value) {
    dispatcher.dispatch({type:'SELECT_TIMEINTERVAL', value});
}

export function updateSelectedPeriod(period) {
    dispatcher.dispatch({type: 'UPDATE_SELECTED_PERIOD', period});
}

// only called by SP
export function selectPeriodfromSP(period) {
    dispatcher.dispatch({type: 'SELECT_PERIOD_FROM_SP', period});
}

export function switchQueryMode(mode) {
    dispatcher.dispatch({type: 'SWITCH_QUERY_MODE', mode});
}

export function setActiveVariables(varList) {
    dispatcher.dispatch({type: 'SET_ACTIVE_VARIABLES', varList});
}

export function setExtractionResults(parameters, results, query, activeVar) {
    dispatcher.dispatch({type: 'SET_EXTRACTION_RESULTS', parameters, results, query, activeVar});
}

export function showLineCharts(LC) {
    dispatcher.dispatch({type: 'SHOW_LINE_CHARTS', LC});
}

export function updateSelectedResult(result, width, height) {
    dispatcher.dispatch({type: 'UPDATE_SELECTED_RESULT', result, width, height});
}

export function clearResults() {
    dispatcher.dispatch({type: 'CLEAR_RESULTS'});
}

export function setQuery(query) {
    dispatcher.dispatch({type: 'SET_QUERY', query});
}

export function convertResultIntoQuery(id, period, activeVar) {
    dispatcher.dispatch({type: 'CONVERT_RESULT_INTO_QUERY', id, period, activeVar});
}

export function updateAEOption(option, value) {
    dispatcher.dispatch({type: 'UPDATE_AE_OPTION', option, value});
}

export function updateShownResults(results) {
    dispatcher.dispatch({type: 'UPDATE_SHOWN_RESULTS', results});
}

export function focusResultfromTimeline(result) {
    dispatcher.dispatch({type: 'FOCUS_RESULT_FROM_TIMELINE', result});
}

export function selectResultFromTimeline(result) {
    dispatcher.dispatch({type: 'SELECT_RESULT_FROM_TIMELINE', result});
}

export function switchQBESelectorSP(selector) {
    dispatcher.dispatch({type: 'SWITCH_QBE_SELECTOR_SP', selector});
}

export function updateKValue(k) {
    dispatcher.dispatch({type: 'UPDATE_K_VALUE', k});
}

export function updateOrder(order) {
    dispatcher.dispatch({type: 'UPDATE_ORDER', order});
}

export function updateDistanceThreshold(threshold) {
    dispatcher.dispatch({type: 'UPDATE_DISTANCE_THRESHOLD', threshold});
}

export function recoverQuery(query) {
    dispatcher.dispatch({type: 'RECOVER_QUERY', query});
}

export function importResultsFromFile(results) {
    dispatcher.dispatch({type: 'IMPORT_RESULTS_FROM_FILE', results});
}

export function convertClusterCenterIntoQuery(clusterCenter) {
    dispatcher.dispatch({type: 'CONVERT_CLUSTER_CENTER_INTO_QUERY', clusterCenter});
}

export function changeDTWMode(DTWMode) {
    dispatcher.dispatch({type: 'CHANGE_DTW_MODE', DTWMode});
}
