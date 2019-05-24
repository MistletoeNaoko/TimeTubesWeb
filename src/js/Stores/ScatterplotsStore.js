import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";

class ScatterplotsStore extends EventEmitter {
    constructor() {
        super();
    }

    handleActions(action) {
        switch (action.type) {
            case 'RESET_SCATTERPLOTS':
                this.emit('resetScatterplots', action.id);
                break;
            default:
        }
    }
}

const scatterplotsStore = new ScatterplotsStore();
dispatcher.register(scatterplotsStore.handleActions.bind(scatterplotsStore));
export default scatterplotsStore;