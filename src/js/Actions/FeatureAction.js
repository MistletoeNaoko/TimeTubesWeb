import dispatcher from '../Dispatcher/dispatcher';

export function updateSource(id) {
    dispatcher.dispatch({type:'UPDATE_SOURCE', id});
}

export function updateTarget(ids) {
    dispatcher.dispatch({type: 'UPDATE_TARGET', ids});
}

export function switchSelector() {
    dispatcher.dispatch({type: 'SWITCH_SELECTOR'});
}

export function switchDragSelection() {
    dispatcher.dispatch({type: 'SWITCH_DRAGSELECTION'});
}

export function resetSelection() {
    dispatcher.dispatch({type: 'RESET_SELECTION'});
}

export function selectTimeInterval(id, value) {
    dispatcher.dispatch({type:'SELECT_TIMEINTERVAL', id, value});
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

export function setIgnoredVariables(varList) {
    dispatcher.dispatch({type: 'SET_IGNORED_VARIALES', varList});
}

export function setExtractionResults(results, query, ignored) {
    dispatcher.dispatch({type: 'SET_EXTRACTION_RESULTS', results, query, ignored});
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

export function convertResultIntoQuery(id, period, ignored) {
    dispatcher.dispatch({type: 'CONVERT_RESULT_INTO_QUERY', id, period, ignored});
}

export function updateAEOption(option, value) {
    dispatcher.dispatch({type: 'UPDATE_AE_OPTION', option, value});
}

export function updateShownResults(results) {
    dispatcher.dispatch({type: 'UPDATE_SHOWN_RESULTS', results});
}
