import {EventEmitter} from 'events';
import { update } from 'lodash';
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
        this.clusteringScores = {}; // clusteringRadiuses, silhouette, silhouetteSS, davisBouldin, pseudoF
        this.filteringProcess = {}; // subsequences (rawdata), normalSlidingWindow/dataDrivenSlidingWindow, sameStartingPoint, overlappingDegraa
        this.originalResults = {};
        this.selectedSS = {};
        this.updatedSS = {};
        this.resultsCoordinates = {}; // clustersCoord, dataCoord, medoidIdx
        this.selectedCluster = -1;
        // this.clusterOrder = [];
    }

    handleActions(action) {
        switch (action.type) {
            case 'SHOW_CLUSTERING_RESULTS':
                this.showClusteringResults(
                    action.datasets, 
                    action.subsequences, 
                    action.ranges, 
                    action.clusterCenters, 
                    action.labels, 
                    action.clusteringParameters, 
                    action.subsequenceParameters,
                    action.clusteringScores,
                    action.filteringProcess, 
                    action.resultsCoordinates
                );
                break;
            case 'SHOW_CLUSTER_DETAILS':
                this.showClusterDetails(action.cluster);
                break;
            case 'SHOW_FILTERING_STEP':
                this.showFilteringStep(action.selectedProcess);
                break;
            case 'UPDATE_CLUSTERING_RESULTS':
                this.updateClusteringResults(
                    action.subsequences, 
                    action.clusterCenters, 
                    action.labels, 
                    action.clusteringScores, 
                    action.selectedSS, 
                    action.updatedSS,
                    action.resultsCoordinates
                );
                break;
            case 'RESET_CLUSTERING_RESULTS':
                this.resetClusteringResults();
                break;
            case 'UPDATE_SS_SELECTION':
                this.updateSSSelection(action.selectedSS, action.updatedSS);
                break;
            case 'SHOW_TTVIEW_OF_SELECTED_SS_CLUSTERING':
                this.emit('showTTViewOfSelectedSSClustering', action.id, action.period);
                break;
            case 'SHOW_SELECTED_SUBSEQUENCE_IN_COMPARISON_PANEL':
                this.showSelectedSubsequenceInComparisonPanel(action.id, action.period, action.SSId);
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

    getClusteringScores() {
        return this.clusteringScores;
    }

    getFilteringProcess() {
        return this.filteringProcess;
    }

    getSelectedSS() {
        return this.selectedSS;
    }

    getUpdatedSS() {
        return this.updatedSS;
    }

    getSelectedCluster() {
        return this.selectedCluster;
    }

    getResultsCoordinates() {
        return this.resultsCoordinates;
    }

    getClusterOrder() {
        return this.clusterOrder;
    }

    showClusteringResults (
        datasets, 
        subsequences, 
        ranges, 
        clusterCenters, 
        labels, 
        clusteringParameters, 
        subsequenceParameters, 
        clusteringScores, 
        filteringProcess, 
        resultsCoordinates) {
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
        this.clusteringScores = clusteringScores;
        this.filteringProcess = filteringProcess;
        this.originalResults = {
            subsequences: subsequences,
            clusterCenters: clusterCenters,
            labels: labels,
            clusteringScores: clusteringScores,
            resultsCoordinates: resultsCoordinates
        };
        this.selectedSS = {};
        for (let i = 0; i < datasets.length; i++) {
            this.selectedSS[datasets[i]] = [];
            this.updatedSS[datasets[i]] = [];
        }
        for (let i = 0; i < datasets.length; i++) {
            for (let j = 0; j < subsequences.length; j++) {
                this.selectedSS[datasets[i]].push(subsequences[j].idx);
            }   
        }
        this.selectedCluster = -1;
        this.resultsCoordinates = resultsCoordinates;
        this.emit('showClusteringResults');
    }

    showClusterDetails(cluster) {
        this.selectedCluster = cluster;
        this.emit('showClusterDetails', cluster);
    }

    showFilteringStep(selectedProcess) {
        this.emit('showFilteringStep', selectedProcess);
    }

    updateClusteringResults(
        subsequences, 
        clusterCenters, 
        labels, 
        clusteringScores, 
        selectedSS, 
        updatedSS, 
        resultsCoordinates) {
        this.subsequences = subsequences;
        this.clusterCenters = clusterCenters;
        this.labels = labels;
        this.clusteringScores = clusteringScores;
        this.selectedSS = selectedSS;
        this.updatedSS = updatedSS;
        this.resultsCoordinates = resultsCoordinates;
        this.emit('updateClusteringResults');
    }

    resetClusteringResults() {
        // reset the manual selection of SS
        this.subsequences = this.originalResults.subsequences;
        this.clusterCenters = this.originalResults.clusterCenters;
        this.labels = this.originalResults.labels;
        this.clusteringScores = this.originalResults.clusteringScores;
        this.resultsCoordinates = this.originalResults.resultsCoordinates;
        this.updatedSS = [];
        this.emit('resetClusteringResults');
    }

    updateSSSelection(selectedSS, updatedSS) {
        this.selectedSS = selectedSS;
        this.updatedSS = updatedSS;
        this.emit('updateSSSelection');
    }

    showSelectedSubsequenceInComparisonPanel(id, period, SSId) {
        this.emit('showSelectedSubsequenceInComparisonPanel', id, period, SSId);
    }
}

const clusteringStore = new ClusteringStore();
dispatcher.register(clusteringStore.handleActions.bind(clusteringStore));
export default clusteringStore;
