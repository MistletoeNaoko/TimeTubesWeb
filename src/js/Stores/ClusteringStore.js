import {EventEmitter} from 'events';
import dispatcher from '../Dispatcher/dispatcher';

class ClusteringStore extends EventEmitter {
    constructor() {
        super();
        this.subsequences = [];
        this.clusterCenters = [];
        this.labels = [];
    }

    handleActions(action) {
        switch (action.type) {
            case 'SHOW_CLUSTERING_RESULTS':
                this.showClusteringResults(action.subsequences, action.clusterCenters, action.labels);
                break;
            default:
                break;
        }
    }

    getSubsequences() {
        return this.subsequences;
    }

    getClusterCenters() {
        return this.clusterCenters;
    }

    getLabels() {
        return this.labels;
    }

    showClusteringResults (subsequences, clusterCenters, labels) {
        this.subsequences = subsequences;
        this.clusterCenters = clusterCenters;
        this.labels = labels;
        this.emit('showClusteringResults');
    }
}

const clusteringStore = new ClusteringStore();
dispatcher.register(clusteringStore.handleActions.bind(clusteringStore));
export default clusteringStore;
