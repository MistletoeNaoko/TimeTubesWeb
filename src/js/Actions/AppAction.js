import dispatcher from '../Dispatcher/dispatcher';

export function selectMenu(menu) {
    dispatcher.dispatch({type: 'SELECT_MENU', menu});
}
