import dispatcher from '../Dispatcher/dispatcher';

export function updateCamera(id, cameraProp) {
    // TODO: seems to need setTimeout in order to avoid dispatch in the middle of a dispatch
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

export function updateFocus(id, zpos, flag) {
    dispatcher.dispatch({type: 'UPDATE_FOCUS', id, zpos, flag});
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

export function setTexture(id, texture) {
    dispatcher.dispatch({type: 'SET_TEXTURE', id, texture});
}

export function updateTexture(id, texture) {
    dispatcher.dispatch({type: 'UPDATE_TEXTURE', id, texture});
}

export function activateViewport(id) {
    dispatcher.dispatch({type: 'ACTIVATE_VIEWPORT', id});
}

export function timeFitting(dst) {
    dispatcher.dispatch({type: 'TIME_FITTING', dst});
}

export function lockControl(ids, state) {
    dispatcher.dispatch({type: 'LOCK_CONTROL', ids, state});
}

export function synchronizeTubes(id, zpos, pos, deg) {
    dispatcher.dispatch({type: 'SYNCHRONIZE_TUBES', id, zpos, pos, deg});
}

export function zoomOutTimeTubes(id) {
    dispatcher.dispatch({type: 'ZOOM_OUT_TIMETUBE', id});
}

export function resetZoomTimeTubes(id) {
    dispatcher.dispatch({type: 'RESET_ZOOM_TIMETUBES', id});
}

export function zoomInTimeTubes(id) {
    dispatcher.dispatch({type: 'ZOOM_IN_TIMETUBES', id});
}

export function updateOpacity(id, opt) {
    dispatcher.dispatch({type: 'UPDATE_OPACITY', id, opt});
}

export function uploadTubeAttributes(id, position, color, indices) {
    dispatcher.dispatch({type: 'UPLOAD_TUBE_ATTRIBUTES', id, position, color, indices});
}

export function takeSnapshot(id, pos, far) {
    dispatcher.dispatch({type: 'TAKE_SNAPSHOT', id, pos, far});
}

export function recoverTube(id, cameraProp, tubePos) {
    dispatcher.dispatch({type: 'RECOVER_TUBE', id, cameraProp, tubePos});
}

export function showTimeTubesOfTimeSlice(id, period) {
    dispatcher.dispatch({type: 'SHOW_TIMETUBES_OF_TIME_SLICE', id, period});
}

export function updateAveragePeriod(value) {
    dispatcher.dispatch({type: 'UPDATE_AVERAGE_PERIOD', value});
}

export function showRotationCenter(id, period, center) {
    dispatcher.dispatch({type: 'SHOW_ROTATION_CENTER', id, period, center});
}

export function switchComment(id, state) {
    dispatcher.dispatch({type: 'SWITCH_COMMENT', id, state});
}

export function updateWheelInterval(interval) {
    dispatcher.dispatch({type: 'UPDATE_WHEEL_INTERVAL', interval});
}
