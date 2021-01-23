import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';
import {uncheckIgnoredVariables} from '../lib/domActions';

class FeatureStore extends EventEmitter {
    constructor() {
        super();
        this.visualQuery = false;
        this.mode = 'AE';
        this.AEOptions = {
            flare: false,
            rotation: false,
            anomaly: false
        };
        this.source = -1;
        this.target = [];
        this.selector = true;
        this.dragSelection = true;
        this.tubeAttributes = [];
        this.selectedPeriod = [-1, -1];
        this.extractionResults = [];
        this.query = {};
        this.ignored = [];
        this.parameters = {};
        this.kValue = 20;
        this.order = 'timeStamp';
        this.distanceThreshold = '';
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
                this.switchSelector(action.selector);
                break;
            case 'SWITCH_DRAGSELECTION':
                this.switchDragSelection();
                break;
            case 'RESET_SELECTION':
                this.resetSelection();
                break;
            case 'SELECT_TIMEINTERVAL':
                this.selectTimeInterval(action.value);
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
                this.setExtractionResults(action.parameters, action.results, action.query, action.ignored);
                break;
            case 'SHOW_LINE_CHARTS':
                this.showLineCharts(action.LC);
                break;
            case 'UPDATE_SELECTED_RESULT':
                this.updateSelectedResult(action.result, action.width, action.height);
                break;
            case 'CLEAR_RESULTS':
                this.emit('clearResults');
                break;
            case 'SET_QUERY':
                this.setQuery(action.query);
                break;
            case 'CONVERT_RESULT_INTO_QUERY':
                this.convertResultIntoQuery(action.id, action.period, action.ignored);
                break;
            case 'UPDATE_AE_OPTION':
                this.updateAEOption(action.option, action.value);
                break;
            case 'UPDATE_SHOWN_RESULTS':
                this.updateShownResults(action.results);
                break;
            case 'FOCUS_RESULT_FROM_TIMELINE':
                this.focusResultFromTimeline(action.result);
                break;
            case 'SELECT_RESULT_FROM_TIMELINE':
                this.selectResultFromTimeline(action.result);
                break;
            case 'SWITCH_QBE_SELECTOR_SP':
                this.switchQBESelectorSP(action.selector);
                break;
            case 'UPDATE_K_VALUE':
                this.updateKValue(action.k);
                break;
            case 'UPDATE_ORDER':
                this.updateOrder(action.order);
                break;
            case 'UPDATE_DISTANCE_THRESHOLD':
                this.updateDistanceThreshold(action.threshold);
                break;
            case 'RECOVER_QUERY':
                this.recoverQuery(action.query);
                break;
            case 'IMPORT_RESULTS_FROM_FILE':
                this.importResultsFromFile(action.results);
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

    getQuery() {
        return this.query;
    }
    
    getAEOptions() {
        return this.AEOptions;
    }

    getAEOptionStatus(option) {
        return this.AEOptions[option];
    }

    getParameters() {
        return this.parameters;
    }

    getKValue() {
        return this.kValue;
    }

    getOrder() {
        return this.order;
    }

    getDistanceThreshold() {
        return this.distanceThreshold;
    }

    updateSource(id) {
        this.source = id;
        this.emit('updateSource');
    }

    updateTarget(ids) {
        this.target = ids;
        this.emit('updateTarget');
    }

    switchSelector(selector) {
        this.selector = selector;
        this.emit('switchSelector');
    }

    switchDragSelection() {
        this.dragSelection = !this.dragSelection;
        this.emit('switchDragSelection');
    }

    resetSelection() {
        this.emit('resetSelection');
    }

    resetAEOptions() {
        for (let key in this.AEOptions) {
            this.AEOptions[key] = false;
        }
    }

    selectTimeInterval(value) {
        let id = this.source;
        let valueNum = Number(value);
        let currentPos = TimeTubesStore.getFocused(Number(id)) + DataStore.getData(Number(id)).data.meta.min.z;
        this.selectedPeriod = [currentPos, currentPos + valueNum];
        // if (this.selectedPeriod[0] && this.selectedPeriod[1]) {
        // // if (this.selectedPeriod[0] !== -1 && this.selectedPeriod[1] !== -1) {
        //     // previous period: [], selected period: ()
        //     if (this.selectedPeriod[0] <= currentPos && currentPos <= this.selectedPeriod[1]) {
        //         // case 1: [(]) or [()]
        //         this.selectedPeriod[1] = Math.max(this.selectedPeriod[1], currentPos + valueNum);
        //     } else if (this.selectedPeriod[0] <= currentPos + valueNum && currentPos + valueNum <= this.selectedPeriod[1]) {
        //         // case 2: ([)] or [()]
        //         this.selectedPeriod[0] = Math.min(this.selectedPeriod[0], currentPos);
        //     } else if (currentPos + valueNum < this.selectedPeriod[0]) {
        //         // case 3: ()[]
        //         this.selectedPeriod[0] = currentPos;
        //     } else if (this.selectedPeriod[1] < currentPos) {
        //         // case 4: []()
        //         this.selectedPeriod[1] = currentPos + valueNum;
        //     } else if (currentPos < this.selectedPeriod[0] && this.selectedPeriod[1] < currentPos + valueNum) {
        //         // case 5: ([])
        //         this.selectedPeriod = [currentPos, currentPos + valueNum];
        //     }
        // } else {
        //     this.selectedPeriod = [currentPos, currentPos + valueNum];
        // }
        this.emit('selectTimeInterval', id, valueNum);
    }

    switchQueryMode(mode) {
        this.mode = mode;
        if (mode !== 'AE') {
            for (let key in this.AEOptions) {
                this.AEOptions[key] = false;
            }
        }
        if (mode !== 'QBE') {
            this.source = 'default';
            this.ignored = [];
            uncheckIgnoredVariables();
        }
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

    setExtractionResults(parameters, results, query, ignored) {
        this.parameters = (parameters !== undefined)? parameters: {};
        this.extractionResults = results;
        this.query = query;
        this.ignored = (ignored !== undefined)? ignored: [];
        this.emit('setExtractionResults');
    }

    setTexture(texture) {
        this.texture = texture;
        this.emit('setTexture');
    }

    showLineCharts(LC) {
        this.emit('showLineCharts', LC);
    }

    updateSelectedResult(result, width, height) {
        this.emit('updateSelectedResult', result, width, height);
    }

    setQuery(query) {
        this.query = query;
        this.emit('setQuery');
    }

    convertResultIntoQuery(id, period, ignored) {
        if (this.mode == 'QBE') {
            this.selectedPeriod = period;
            this.ignored = ignored;
        }
        this.emit('convertResultIntoQuery', id, period, ignored);
    }

    updateAEOption(option, value) {
        this.AEOptions[option] = value;
        this.emit('updateAEOption');
    }

    updateShownResults(results) {
        this.emit('updateShownResults', results);
    }

    focusResultFromTimeline(result) {
        this.emit('focusResultFromTimeline', result);
    }

    selectResultFromTimeline(result) {
        this.emit('selectResultFromTimeline', result);
    }

    switchQBESelectorSP(selector) {
        this.emit('switchQBESelectorSP', selector);
    }

    updateKValue(k) {
        this.kValue = k;
        this.emit('updateKValue');
    }

    updateOrder(order) {
        this.order = order;
        this.emit('updateOrder');
    }

    updateDistanceThreshold(threshold) {
        this.distanceThreshold = threshold;
        this.emit('updateDistanceThreshold');
    }

    recoverQuery(query) {
        if (query.mode === 'automatic extraction') {
            this.mode = 'AE';
            this.resetAEOptions();
            for (let i = 0; i < query.option.length; i++) {
                this.AEOptions[query.option[i]] = true;
            }
        } else if (query.mode === 'visual query') {
            if (query.option === 'query-by-example') {
                this.mode = 'QBE';
                this.selectedPeriod = query.query.period;
                this.source = DataStore.getIdFromName(query.query.source);
                // set ignored variable
                let lookup = DataStore.getData(this.source).data.lookup;
                let ignoredTmp = [];

                for (let i = 0; i < query.query.inactiveVariables.length; i++) { 
                    for (let key in lookup) {
                        if (lookup[key].indexOf(query.query.inactiveVariables[i][0]) >= 0) {
                            ignoredTmp.push(key);
                        }
                    }
                }
                this.ignored = ignoredTmp;
                this.parameters = query.parameters;
            } else if (query.option === 'query-by-sketch') {
                this.mode = 'QBS';
                this.parameters = query.parameters;
            }
        }
        let targetList = [];
        let datasets = DataStore.getAllData();
        for (let i = 0; i < datasets.length; i++) {
            targetList.push(datasets[i].id);
        }
        this.target = targetList;
        this.emit('recoverQuery', query);
    }

    importResultsFromFile(results) {
        this.emit('importResultsFromFile', results);
    }
}

const featureStore = new FeatureStore();
dispatcher.register(featureStore.handleActions.bind(featureStore));
export default featureStore;
