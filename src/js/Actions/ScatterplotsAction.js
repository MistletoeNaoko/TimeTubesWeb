import * as d3 from 'd3';
import dispatcher from '../Dispatcher/dispatcher';

export function createScatterplots() {
    
}

export function resetScatterplotsZoom(id) {
    dispatcher.dispatch({type: 'RESET_SCATTERPLOTS', id});
}

export function moveCurrentLineonTimeSelector(id, zpos) {
    dispatcher.dispatch({type: 'MOVE_CURRENT_LINE_ON_TIMESELECTOR', id, zpos});
}