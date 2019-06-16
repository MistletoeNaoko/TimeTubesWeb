import dispatcher from '../Dispatcher/dispatcher';

export function switchVisualQuery(status) {
    dispatcher.dispatch({type: 'SWITCH_VISUALQUERY', status});
}

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

export function selectTimeInterval(value) {
    dispatcher.dispatch({type:'SELECT_TIMEINTERVAL', value});
}

export function updateSelectedInterval(period, pos, color, indices) {
    dispatcher.dispatch({type: 'UPDATE_SELECTEDINTERVAL', period, pos, color, indices});
}