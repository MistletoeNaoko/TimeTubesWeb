import {EventEmitter} from 'events';
import dispatcher from '../Dispatcher/dispatcher';

class ClusteringStore extends EventEmitter {
    constructor() {
        super();
        this.viewportSize = 18;
        this.gridSize = 18;
        this.datasets = [];
        this.subsequences = [];
        this.ranges = [];
        this.clusterCenters = [];
        this.labels = [];
        this.clusterColors = []; // hsv color space
        this.clusteringParameters = {};
        this.subsequenceParameters = {};
    }

    handleActions(action) {
        switch (action.type) {
            case 'SHOW_CLUSTERING_RESULTS':
                this.showClusteringResults(action.datasets, action.subsequences, action.ranges, action.clusterCenters, action.labels, action.clusteringParameters, action.subsequenceParameters);
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

    getRanges() {
        return this.ranges;
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

    getClusteringParameters() {
        return this.clusteringParameters;
    }

    getSubsequenceParameters() {
        return this.subsequenceParameters;
    }

    showClusteringResults (datasets, subsequences, ranges, clusterCenters, labels, clusteringParameters, subsequenceParameters) {
        this.datasets = datasets;
        this.subsequences = subsequences;
        this.ranges = ranges;
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
        this.clusteringParameters = clusteringParameters;
        this.subsequenceParameters = subsequenceParameters;
        this.emit('showClusteringResults');
    }

    showClusterDetails(cluster) {
        this.emit('showClusterDetails', cluster);
    }
}

const clusteringStore = new ClusteringStore();
dispatcher.register(clusteringStore.handleActions.bind(clusteringStore));
export default clusteringStore;
