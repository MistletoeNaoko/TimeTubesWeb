import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';

class FeatureStore extends EventEmitter {
    constructor() {
        super();
        this.visualQuery = false;
        this.mode = 'AE';
        this.source = -1;
        this.target = [];
        this.selector = true;
        this.dragSelection = true;
        this.tubeAttributes = [];
        this.selectedPeriod = [-1, -1];
        this.extractionResults = [];
        this.ignored = [];
    }

    handleActions(action) {
        switch (action.type) {
            case 'UPDATE_SOURCE':
                this.updateSource(action.id);
                break;
            case 'UPDATE_TARGET':
                this.updateTarget(action.ids);
                break;
            case 'SWITCH_SELECTOR':
                this.switchSelector();
                break;
            case 'SWITCH_DRAGSELECTION':
                this.switchDragSelection();
                break;
            case 'RESET_SELECTION':
                this.resetSelection();
                break;
            case 'SELECT_TIMEINTERVAL':
                this.selectTimeInterval(action.id, action.value);
                break;
            case 'SWITCH_QUERY_MODE':
                this.switchQueryMode(action.mode);
                break;
            case 'UPLOAD_TUBE_ATTRIBUTES':
                this.uploadTubeAttributes(action.id, action.position, action.color, action.indices);
                break;
            case 'UPDATE_SELECTED_PERIOD':
                this.updateSelectedPeriod(action.period);
                break;
            case 'SELECT_PERIOD_FROM_SP':
                this.selectPeriodfromSP(action.period);
                break;
            case 'SET_IGNORED_VARIALES':
                this.setIgnoredVariables(action.varList);
                break;
            case 'SET_EXTRACTION_RESULTS':
                this.setExtractionResults(action.results, action.ignored);
                break;
            default:
        }
    }

    getVisualQuery() {
        return this.visualQuery;
    }

    getSource() {
        return this.source;
    }

    getTarget() {
        return this.target;
    }

    getSelector() {
        return this.selector;
    }

    getDragSelection() {
        return this.dragSelection;
    }

    getSelectedPeriod() {
        return this.selectedPeriod;
    }

    getMode() {
        return this.mode;
    }

    getTubeAttributes(id) {
        return this.tubeAttributes[id];
    }

    getExtractionResults() {
        return this.extractionResults;
    }

    getIgnored() {
        return this.ignored;
    }

    updateSource(id) {
        this.source = id;
        this.emit('updateSource');
    }

    updateTarget(ids) {
        this.target = ids;
        this.emit('updateTarget');
    }

    switchSelector() {
        this.selector = !this.selector;
        this.emit('switchSelector');
    }

    switchDragSelection() {
        this.dragSelection = !this.dragSelection;
        this.emit('switchDragSelection');
    }

    resetSelection() {
        this.emit('resetSelection');
    }

    selectTimeInterval(id, value) {
        let valueNum = Number(value);
        let currentPos = TimeTubesStore.getFocused(Number(id)) + DataStore.getData(Number(id)).data.meta.min.z;
        if (this.selectedPeriod[0] !== -1 && this.selectedPeriod[1] !== -1) {
            // previous period: [], selected period: ()
            if (this.selectedPeriod[0] <= currentPos && currentPos <= this.selectedPeriod[1]) {
                // case 1: [(]) or [()]
                this.selectedPeriod[1] = Math.max(this.selectedPeriod[1], currentPos + valueNum);
            } else if (this.selectedPeriod[0] <= currentPos + valueNum && currentPos + valueNum <= this.selectedPeriod[1]) {
                // case 2: ([)] or [()]
                this.selectedPeriod[0] = Math.min(this.selectedPeriod[0], currentPos);
            } else if (currentPos + valueNum < this.selectedPeriod[0]) {
                // case 3: ()[]
                this.selectedPeriod[0] = currentPos;
            } else if (this.selectedPeriod[1] < currentPos) {
                // case 4: []()
                this.selectedPeriod[1] = currentPos + valueNum;
            } else if (currentPos < this.selectedPeriod[0] && this.selectedPeriod[1] < currentPos + valueNum) {
                // case 5: ([])
                this.selectedPeriod = [currentPos, currentPos + valueNum];
            }
        } else if (this.selectedPeriod[0] === -1 && this.selectedPeriod[1] === -1) {
            this.selectedPeriod = [currentPos, currentPos + valueNum];
        }
        this.emit('selectTimeInterval', id, valueNum);
    }

    switchQueryMode(mode) {
        this.mode = mode;
        this.emit('switchQueryMode', mode);
    }

    uploadTubeAttributes(id, pos, col, indices) {
        this.tubeAttributes[id] = {
            position: pos,
            color: col,
            indices: indices
        };
        this.emit('uploadTubeAttributes');
    }

    updateSelectedPeriod(period) {
        this.selectedPeriod = period;
        this.emit('updateSelectedPeriod');
    }

    selectPeriodfromSP(period) {
        this.selectedPeriod = period;
        this.emit('updateSelectedPeriod');
    }

    setIgnoredVariables(varList) {
        this.emit('setIgnoredVariables', varList);
    }

    setExtractionResults(results, ignored) {
        this.extractionResults = results;
        this.ignored = ignored;
        this.emit('setExtractionResults');
    }

    setTexture(texture) {
        this.texture = texture;
        this.emit('setTexture');
    }
}

const featureStore = new FeatureStore();
dispatcher.register(featureStore.handleActions.bind(featureStore));
export default featureStore;
