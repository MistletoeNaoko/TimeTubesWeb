import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";

class AppStore extends EventEmitter {
    constructor() {
        super();
        this.previousMenu = undefined;
        this.menu = 'visualization';
    }

    handleActions(action) {
        switch (action.type) {
            case 'SELECT_MENU':
                this.selectMenu(action.menu);
                break;
            case 'RESIZE_EXTRACTION_RESULTS_AREA':
                this.emit('resizeExtractionResultsArea');
                break;
            case 'SHOW_EXTRACTION_SOURCE_PANEL':
                this.emit('showExtractionSourcePanel', action.id);
                break;
            case 'SHOW_RESULTS_PANEL':
                this.emit('showResultsPanel', action.resultsPanel);
            default:
                break;
        }
    }

    getMenu() {
        return this.menu;
    }

    getPreviousMenu() {
        return this.previousMenu;
    }

    selectMenu(menu) {
        this.previousMenu = this.menu;
        this.menu = menu;
        this.emit('selectMenu', menu);
    }
}

const appStore = new AppStore();
dispatcher.register(appStore.handleActions.bind(appStore));
export default appStore;
