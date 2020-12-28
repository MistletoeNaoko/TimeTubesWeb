import {EventEmitter} from 'events';
import dispatcher from '../Dispatcher/dispatcher';

class ClusteringStore extends EventEmitter {
    constructor() {
        super();
        this.viewportSize = 18;
        this.subsequences = [];
        this.clusterCenters = [];
        this.labels = [];
        this.gridSize = 18;
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

    getViewportSize() {
        return this.viewportSize;
    }

    getGridSize() {
        return this.gridSize;
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
        // クラスタの数から適切なグリッドサイズを求める
        let div = this.viewportSize * Math.PI / this.clusterCenters.length;
        this.gridSize = div * 0.8;
        this.emit('showClusteringResults');
    }
}

const clusteringStore = new ClusteringStore();
dispatcher.register(clusteringStore.handleActions.bind(clusteringStore));
export default clusteringStore;
