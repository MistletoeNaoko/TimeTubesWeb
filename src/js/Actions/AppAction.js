import dispatcher from '../Dispatcher/dispatcher';

export function selectMenu(menu) {
    dispatcher.dispatch({type: 'SELECT_MENU', menu});
}

export function resizeExtractionResultsArea() {
    dispatcher.dispatch({type: 'RESIZE_EXTRACTION_RESULTS_AREA'});
}

export function showExtractionSourcePanel(id) {
    dispatcher.dispatch({type: 'SHOW_EXTRACTION_SOURCE_PANEL', id});
}

export function showResultsPanel(resultsPanel) {
    dispatcher.dispatch({type: 'SHOW_RESULTS_PANEL', resultsPanel});
}
