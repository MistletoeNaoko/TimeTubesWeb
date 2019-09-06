import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";

class ScatterplotsStore extends EventEmitter {
    constructor() {
        super();
        this.timeRange = [];
    }

    handleActions(action) {
        switch (action.type) {
            case 'UPLOAD_DATA':
                this.uploadData(action.data);
                break;
            case 'RESET_SCATTERPLOTS':
                this.emit('resetScatterplots', action.id);
                break;
            case 'MOVE_CURRENT_LINE_ON_TIMESELECTOR':
                this.emit('moveCurrentLineonTimeSelector', action.id, action.zpos);
                break;
            case 'UPDATE_TIME_RANGE':
                this.updateTimeRange(action.id, action.range);
                break;
            default:
        }
    }

    getTimeRange(id) {
        return this.timeRange[id];
    }

    uploadData(data) {
        this.timeRange.push([data.meta.min.z, data.meta.max.z]);
        this.emit('upload');
    }

    updateTimeRange(id, range) {
        this.timeRange[id] = range;
        this.emit('updateTimeRange', id, range);
    }
}

const scatterplotsStore = new ScatterplotsStore();
dispatcher.register(scatterplotsStore.handleActions.bind(scatterplotsStore));
export default scatterplotsStore;