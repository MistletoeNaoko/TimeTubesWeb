import dispatcher from '../Dispatcher/dispatcher';

export function updateCamera(id, cameraProp) {
    // 非同期処理のためにsetTimeoutが必要？
    setTimeout(function() {
        dispatcher.dispatch({type: 'UPDATE_CAMERA', id, cameraProp});
    }, 1);
}

export function resetCamera(id) {
    dispatcher.dispatch({type: 'RESET_CAMERA', id});
}

export function switchCamera(id) {
    dispatcher.dispatch({type: 'SWITCH_CAMERA', id});
}

export function searchTime(id, dst) {
    dispatcher.dispatch({type: 'SEARCH_TIME', id, dst});
}

export function updateChecked(id) {
    dispatcher.dispatch({type: 'UPDATE_CHECKED', id});
}

export function switchGridDisplay(id, state) {
    dispatcher.dispatch({type: 'SWITCH_GRID', id, state});
}

export function switchLabelDisplay(id, state) {
    dispatcher.dispatch({type: 'SWITCH_LABEL', id, state});
}

export function switchAxisDisplay(id, state) {
    dispatcher.dispatch({type: 'SWITCH_AXIS', id, state});
}

export function switchPlotDisplay(id, state) {
    dispatcher.dispatch({type: 'SWITCH_PLOT', id, state});
}

export function changeBackground(id, color) {
    dispatcher.dispatch({type: 'CHANGE_BACKGROUND', id, color});
}

export function clipTube(id, state) {
    dispatcher.dispatch({type: 'CLIP_TUBE', id, state});
}

export function switchShade(id, state) {
    dispatcher.dispatch({type: 'SWITCH_SHADE', id, state});
}

export function changeFar(id, value) {
    dispatcher.dispatch({type: 'CHANGE_FAR', id, value});
}

export function updateFocus(id, zpos) {
    dispatcher.dispatch({type: 'UPDATE_FOCUS', id, zpos});
}

export function updateMinMaxV(id, min, max) {
    dispatcher.dispatch({type: 'UPDATE_MINMAXV', id, min, max});
}

export function updateMinMaxH(id, min, max) {
    dispatcher.dispatch({type: 'UPDATE_MINMAXH', id, min, max});
}

export function changePlotColor(id, color) {
    dispatcher.dispatch({type: 'CHANGE_PLOTCOLOR', id, color});
}

export function updateCurrentPos(id, zpos) {
    dispatcher.dispatch({type: 'UPDATE_CURRENTPOS', id, zpos});
}