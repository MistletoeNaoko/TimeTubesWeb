import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";

class AppStore extends EventEmitter {
    constructor() {
        super();
        this.menu = 'Visualization';
    }

    handleActions(action) {
        switch (action.type) {
            case 'SELECT_MENU':
                this.selectMenu(action.menu);
                break;
            case 'RESIZE_EXTRACTION_RESULTS_AREA':
                this.emit('resizeExtractionResultsArea');
                break;
            default:
                break;
        }
    }

    getMenu() {
        return this.menu;
    }

    selectMenu(menu) {
        this.menu = menu;
        this.emit('selectMenu', menu);
    }
}

const appStore = new AppStore();
dispatcher.register(appStore.handleActions.bind(appStore));
export default appStore;
