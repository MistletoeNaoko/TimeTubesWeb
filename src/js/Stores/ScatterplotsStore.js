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
            case 'MOVE_CURRENT_LINE_ON_TIMESELECTOR':
                this.emit('moveCurrentLineonTimeSelector', action.id, action.zpos);
            default:
        }
    }
}

const scatterplotsStore = new ScatterplotsStore();
dispatcher.register(scatterplotsStore.handleActions.bind(scatterplotsStore));
export default scatterplotsStore;