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