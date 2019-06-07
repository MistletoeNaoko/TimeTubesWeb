import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";

class FeatureStore extends EventEmitter {
    constructor() {
        super();
        this.visualQuery = false;
        this.source = -1;
        this.target = [];
        this.selector = true;
        this.dragSelection = true;
        this.selectedInterval = [];
    }

    handleActions(action) {
        switch (action.type) {
            case 'SWITCH_VISUALQUERY':
                this.switchVisualQuery(action.status);
                break;
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
                this.selectTimeInterval(action.value);
                break;
            case 'UPDATE_SELECTEDINTERVAL':
                this.updateSelectedInterval(action.period);
                break;
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

    getSelectedInterval() {
        return this.selectedInterval;
    }

    switchVisualQuery(status) {
        this.visualQuery = status;
        this.emit('switchVisualQuery');
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

    selectTimeInterval(value) {
        this.emit('selectTimeInterval', value);
    }

    updateSelectedInterval(period) {
        this.selectedInterval = period;
        this.emit('updateSelectedInterval', period);
    }
}

const featureStore = new FeatureStore();
dispatcher.register(featureStore.handleActions.bind(featureStore));
export default featureStore;