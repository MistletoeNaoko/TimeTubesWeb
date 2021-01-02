import {EventEmitter} from 'events';
import dispatcher from '../Dispatcher/dispatcher';

class ClusteringStore extends EventEmitter {
    constructor() {
        super();
        this.viewportSize = 18;
        this.gridSize = 18;
        this.datasets = [];
        this.subsequences = [];
        this.clusterCenters = [];
        this.labels = [];
        this.clusterColors = []; // hsv color space
    }

    handleActions(action) {
        switch (action.type) {
            case 'SHOW_CLUSTERING_RESULTS':
                this.showClusteringResults(action.datasets, action.subsequences, action.clusterCenters, action.labels);
                break;
            case 'SHOW_CLUSTER_DETAILS':
                this.showClusterDetails(action.cluster);
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

    getDatasets() {
        return this.datasets;
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

    getClusterColors() {
        return this.clusterColors;
    }

    showClusteringResults (datasets, subsequences, clusterCenters, labels) {
        this.datasets = datasets;
        this.subsequences = subsequences;
        this.clusterCenters = clusterCenters;
        this.labels = labels;
        // クラスタの数から適切なグリッドサイズを求める
        let div = this.viewportSize * Math.PI / this.clusterCenters.length;
        this.gridSize = div * 0.8;
        // クラスタの数に応じた色を決定
        this.clusterColors = [];
        for (let i = 0; i < this.clusterCenters.length; i++) {
            let hue = i * 360 / this.clusterCenters.length;
            this.clusterColors.push([hue, 0.5, 0.5]);
        }
        this.emit('showClusteringResults');
    }

    showClusterDetails(cluster) {
        this.emit('showClusterDetails', cluster);
    }
}

const clusteringStore = new ClusteringStore();
dispatcher.register(clusteringStore.handleActions.bind(clusteringStore));
export default clusteringStore;
