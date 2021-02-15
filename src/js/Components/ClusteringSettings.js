import React from 'react';
import {performClustering} from '../lib/subsequenceClustering';
import * as ClusteringAction from '../Actions/ClusteringAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import {toggleExtractionMenu} from '../lib/domActions';
import { each } from 'lodash';

export default class clusteringSettings extends React.Component {
    constructor(props) {
        super();
        this.state = {
            queryMode: FeatureStore.getMode(),
            normalize: true,
            clusteringMethod: 'kmedoids',
            distanceMetric: 'DTW',
            medoidDefinition: 'each',
            targetList: FeatureStore.getTarget(),
            filteringSS: ['dataDrivenSlidingWindow', 'sameStartingPoint', 'overlappingDegree']
        };
    }    

    componentDidMount() {
        // $('#normalizationOptionsClustering').prop('seletedIndex', 1);
        $('#targetLengthMinClustering').val(20);
        $('#targetLengthMaxClustering').val(30);
        $('#resolutionOfTimeNormalizedSS').val(30);
        $('#overlappingDegreeThreshold').val(70);
        $('#clusterNumber').val(6);
        FeatureStore.on('switchQueryMode', (mode) => {
            this.setState({
                queryMode: mode
            });
        });
        FeatureStore.on('updateTarget', () => {
            this.setState({
                targetList: FeatureStore.getTarget()
            });
        });
    }

    render() {
        return (
            <div id='clusteringSetting' className='controllersElem featureArea'>
                {this.subsequenceSetting()}
                {this.variableSelector()}
                {this.clusteringMethodsSetting()}
                <button className="btn btn-primary btn-sm"
                    type="button"
                    id='runAutomaticExtractionBtn'
                    style={{float: 'right'}}
                    onClick={this.clickRunButton.bind(this)}>Run</button>
            </div>
        )
    }

    subsequenceSetting() {
        let overlappingDegree;
        if (this.state.filteringSS.indexOf("overlappingDegree") >= 0) {
            overlappingDegree = (
                <div className='row matchingOption'>
                    <div className='col-5'>Threshold of overlapping degree</div>
                    <div className='col form-inline'>
                        <input className="form-control form-control-sm"
                            type="text"
                            placeholder="threshold"
                            id="overlappingDegreeThreshold"
                            style={{width: '40%', marginRight: '0.5rem'}}
                            required={true}/>
                        <label className="col-form-label col-form-label-sm"> %</label>
                    </div>
                </div>
            );
        }
        return (
            <div className='featureElem'>
                <h5>Subsequence setting</h5>
                <div className='row matchingOption'>
                    <div className='col-5'>
                        Length of the target time series
                    </div>
                    <div className='col form-inline'>
                        <input className="form-control form-control-sm"
                            type="text"
                            placeholder="min"
                            id="targetLengthMinClustering"
                            style={{width: '20%', marginRight: '0.5rem'}}
                            required={true}/>
                        ~
                        <input className="form-control form-control-sm"
                            type="text"
                            placeholder="max"
                            id="targetLengthMaxClustering"
                            style={{width: '20%', marginRight: '0.5rem', marginLeft: '0.5rem'}}
                            required={true}/>
                        <label className="col-form-label col-form-label-sm"> days</label>
                    </div>
                </div>
                <div className='row matchingOption'>
                    <div className='col-5'>
                        <div className="custom-control custom-switch">
                            <input 
                                type="checkbox" 
                                className="custom-control-input" 
                                id="normalizeSwitchClustering"
                                checked={this.state.normalize}
                                onClick={this.onClickNormalize.bind(this)}/>
                            <label className="custom-control-label" htmlFor="normalizeSwitchClustering">Normalize</label>
                        </div>
                    </div>
                    <div className='col'>
                        <select
                            className="custom-select custom-select-sm"
                            id='normalizationOptionsClustering'
                            style={{width: '60%'}}
                            disabled={!this.state.normalize}>
                            {/* <option value="minmax">Min-max</option>
                            <option value="centralize">Centralize</option> */}
                            <option value="zScore">z-score</option>
                        </select>
                    </div>
                </div>
                <div className='row matchingOption'>
                    <div className='col-5'>
                        Division number of subsequences
                        {/* Resolution of the time-normalized subsequences */}
                    </div>
                    <div className='col form-inline'>
                        <input className="form-control form-control-sm"
                            type="text"
                            placeholder="resolution"
                            id="resolutionOfTimeNormalizedSS"
                            style={{width: '40%', marginRight: '0.5rem'}}
                            required={true}/>
                        <label className="col-form-label col-form-label-sm"> days</label>
                    </div>
                </div>
                <div className='row matchingOption'>
                    <div className='col-5'>
                        Options of filtering subsequences
                    </div>
                    <div className='col form-group' id="filteringSSOptions" onChange={this.onChangeFilteringSS.bind(this)}>
                        <div className="custom-control custom-checkbox">
                            <input 
                                type="checkbox" 
                                className="custom-control-input" 
                                id="dataDrivenSlidingWindow" 
                                name="filteringSS"
                                value="dataDrivenSlidingWindow"
                                checked={(this.state.filteringSS.indexOf('dataDrivenSlidingWindow') >= 0)? true: false}/>
                            <label className="custom-control-label" htmlFor="dataDrivenSlidingWindow">Data-driven sliding window</label>
                        </div>
                        <div className="custom-control custom-checkbox">
                            <input 
                                type="checkbox" 
                                className="custom-control-input" 
                                id="SSFilterStartingPoint" 
                                name="filteringSS"
                                value="sameStartingPoint"
                                checked={(this.state.filteringSS.indexOf('sameStartingPoint') >= 0)? true: false}/>
                            <label className="custom-control-label" htmlFor="SSFilterStartingPoint">Subsequences starting from the same data sample</label>
                        </div>
                        <div className="custom-control custom-checkbox">
                            <input 
                                type="checkbox" 
                                className="custom-control-input" 
                                id="SSFilterOverlappingDegree" 
                                name="filteringSS"
                                value="overlappingDegree"
                                checked={(this.state.filteringSS.indexOf('overlappingDegree') >= 0)? true: false}/>
                            <label className="custom-control-label" htmlFor="SSFilterOverlappingDegree">Highly overlapping subsequences</label>
                        </div>
                    </div>
                </div>
                {overlappingDegree}
            </div>
        );
    }
    
    onChangeFilteringSS() {
        let selectedOptions = document.getElementsByName('filteringSS');
        let selectedOptionsValues = [];
        for (let i = 0; i < selectedOptions.length; i++) {
            if (selectedOptions[i].checked) {
                selectedOptionsValues.push(selectedOptions[i].value);
            }
        }
        this.setState({
            filteringSS: selectedOptionsValues
        });
    }

    variableSelector() {
        let items = [],
            variables = {},
            targets = FeatureStore.getTarget();
        if (targets.length > 0) {
            for (let i = 0; i < targets.length; i++) {
                let lookup = DataStore.getData(targets[i]).data.lookup;
                for (let key in lookup) {
                    if (!(key in variables)) {
                        variables[key] = lookup[key];
                    } else {
                        for (let j = 0; j < lookup[key].length; j++) {
                            if (variables[key].indexOf(lookup[key][j]) < 0) {
                                variables[key].push(lookup[key][j]);
                            }
                        }
                    }
                }
            }

            for (let key in variables) {
                let label = '';
                // TODO: PAPDを考慮したクラスタリングもできるように！！
                if (key !== 'z' && key !== 'PA' && key !== 'PD') {
                    if (variables[key].length > 1) {
                        label = variables[key].join(',');
                    } else {
                        label = variables[key][0];
                    }
                    items.push(
                        <div className='form-check form-check-inline' key={key}>
                            <input
                                className='form-check-input'
                                type='checkbox'
                                name='clusteringVariables'
                                value={key}
                                id={'clusteringVaribales_' + key}
                            />
                            <label
                                className='form-check-label'
                                htmlFor={'clusteringVaribales_' + key}>
                                {label}
                            </label>
                        </div>
                    );
                }
            }
        }
        let selectorCode = (
            <div className='featureElem'>
                <h6>Variables to be consideded</h6>
                {items}
            </div>
        );
        return selectorCode;
    }

    clusteringMethodsSetting() {
        let methodPulldown = (
            <div className="form-group">
                <select 
                    className="custom-select custom-select-sm" 
                    id='clusteringMethod'
                    style={{width: '60%'}}
                    onChange={this.onChangeClusteringMethod.bind(this)}>
                    <option value="kmedoids">kMedoids</option>
                    <option value="kmeans">kMeans</option>
                </select>
            </div>
        );
        
        let clusteringOptions;
        switch(this.state.clusteringMethod) {
            case 'kmedoids':
                let distanceMetric = (
                    <form
                        className="form-check"
                        id='distanceMetricClustering'
                        onChange={this.switchDistanceMetric.bind(this)}
                        style={{paddingLeft: '0px'}}>
                        <div className="custom-control custom-radio">
                            <input type="radio" id="EuclideanClustering" name="distanceMetricClustering" value='Euclidean'
                                checked={(this.state.distanceMetric === 'Euclidean')? true: false}
                                disabled={true}
                                className="custom-control-input" readOnly/>
                            <label className="custom-control-label" htmlFor="EuclideanClustering">
                                Euclidean
                            </label>
                        </div>    
                        <div className="custom-control custom-radio" 
                            style={{display: (this.state.medoidDefinition === 'each')? 'block': 'none'}}>
                            <input type="radio" id="DTWClustering" name="distanceMetricClustering" value='DTW'
                                checked={(this.state.distanceMetric === 'DTW')? true: false}
                                className="custom-control-input" readOnly/>
                            <label className="custom-control-label" htmlFor="DTWClustering">
                                DTW
                            </label>
                        </div>
                        <div className="custom-control custom-radio"
                            style={{display: (this.state.medoidDefinition === 'unified')? 'block': 'none'}}>
                            <input type="radio" id="DTWIClustering" name="distanceMetricClustering" value='DTWI'
                                checked={(this.state.distanceMetric === 'DTWI')? true: false}
                                className="custom-control-input" readOnly/>
                            <label className="custom-control-label" htmlFor="DTWIClustering">
                                DTW<sub>I</sub>
                            </label>
                        </div>
                        <div className="custom-control custom-radio"
                            style={{display: (this.state.medoidDefinition === 'unified')? 'block': 'none'}}>
                            <input type="radio" id="DTWDClustering" name="distanceMetricClustering" value='DTWD'
                                checked={(this.state.distanceMetric === 'DTWD')? true: false}
                                className="custom-control-input" readOnly/>
                            <label className="custom-control-label" htmlFor="DTWDClustering">
                                DTW<sub>D</sub>
                            </label>
                        </div>
                    </form>
                );
                let medoidDefinition = (
                    <form
                        className="form-check"
                        id='medoidDefinition'
                        onChange={this.switchMedoidDefinition.bind(this)}
                        style={{paddingLeft: '0px'}}>
                        <div className="custom-control custom-radio">
                            <input type="radio" id="medoidEachVariable" name="medoidDefinition" value='each'
                                checked={(this.state.medoidDefinition === 'each')? true: false}
                                className="custom-control-input" readOnly/>
                            <label className="custom-control-label" htmlFor="medoidEachVariable">
                                Independent medoid for each variable
                                {/* a collection of subsequences for each variable */}
                            </label>
                        </div>    
                        <div className="custom-control custom-radio">
                            <input type="radio" id="medoidAllVariables" name="medoidDefinition" value='unified'
                                checked={(this.state.medoidDefinition === 'unified')? true: false}
                                className="custom-control-input" readOnly/>
                            <label className="custom-control-label" htmlFor="medoidAllVariables">
                                Unified medoid for all variables
                                {/* Subsequence itself */}
                            </label>
                        </div>
                    </form>
                );
                clusteringOptions = (
                    <div id='clusteringOptions'>
                        <div className="row matchingOption">
                            <div className='col-5'>
                                Cluster number
                            </div>
                            <div className='col'>
                                <input className="form-control form-control-sm"
                                    type="text"
                                    placeholder="cluster number"
                                    id="clusterNumber"
                                    style={{width: '50%', marginRight: '0.5rem'}}/>
                            </div>
                        </div>
                        <div className="row matchingOption">
                            <div className='col-5'>
                                Distance metric
                            </div>
                            <div className='col'>
                                {distanceMetric}
                            </div>
                        </div>
                        <div className="row matchingOption">
                            <div className='col-5'>
                                Definition of medoids
                            </div>
                            <div className='col'>
                                {medoidDefinition}
                            </div>
                        </div>
                    </div>
                );
                break;
            case 'kmeans':
                clusteringOptions = (
                    <div id='clusteringOptions'>
                        <div className="row matchingOption">
                            <div className='col-5'>
                                Cluster number
                            </div>
                            <div className='col'>
                                <input className="form-control form-control-sm"
                                    type="text"
                                    placeholder="cluster number"
                                    id="clusterNumber"
                                    style={{width: '50%', marginRight: '0.5rem'}}/>
                            </div>
                        </div>
                        <div className="row matchingOption">
                            <div className='col-5'>
                                Distance metric
                            </div>
                            <div className='col'>
                                <form
                                    className="form-check"
                                    id='distanceMetricClustering'
                                    onChange={this.switchDistanceMetric.bind(this)}
                                    style={{paddingLeft: '0px'}}>
                                    <div className="custom-control custom-radio">
                                        <input type="radio" id="EuclideanClustering" name="distanceMetricClustering" value='Euclidean'
                                            checked={(this.state.distanceMetric === 'Euclidean')? true: false}
                                            className="custom-control-input" readOnly/>
                                        <label className="custom-control-label" htmlFor="EuclideanClustering">
                                            Euclidean
                                        </label>
                                    </div>    
                                    <div className="custom-control custom-radio">
                                        <input type="radio" id="DTWIClustering" name="distanceMetricClustering" value='DTWI'
                                            checked={(this.state.distanceMetric === 'DTWI')? true: false}
                                            className="custom-control-input" readOnly/>
                                        <label className="custom-control-label" htmlFor="DTWIClustering">
                                            DTW<sub>I</sub>
                                        </label>
                                    </div>
                                    <div className="custom-control custom-radio">
                                        <input type="radio" id="DTWDClustering" name="distanceMetricClustering" value='DTWD'
                                            checked={(this.state.distanceMetric === 'DTWD')? true: false}
                                            className="custom-control-input" readOnly/>
                                        <label className="custom-control-label" htmlFor="DTWDClustering">
                                            DTW<sub>D</sub>
                                        </label>
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div className="row matchingOption">
                            <div className='col-5'>
                                Cluster center definition
                            </div>
                            <div className='col'>
                                <form
                                    className="form-check"
                                    id='clusterCenter'
                                    style={{paddingLeft: '0px'}}>
                                    <div className="custom-control custom-radio">
                                        <input type="radio" id="DBA" name="clusterCenter" value='DBA'
                                            className="custom-control-input"
                                            checked={true} readOnly/>
                                        <label className="custom-control-label" htmlFor="DBA">
                                            DTW barycenter averaging
                                        </label>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                );
                break;
            default:
                break;
        }

        let clusteringCode = (
            <div className='featureElem'>
                <h5>Clustering settings</h5>
                <div className="row matchingOption">
                    <div className='col-5'>
                        Method
                    </div>
                    <div className='col'>
                        {methodPulldown}
                    </div>
                </div>
                {clusteringOptions}
            </div>
        );
        return clusteringCode;
    }

    switchDistanceMetric() {
        let selectedDistanceMetric = $('input[name=distanceMetricClustering]:checked').val();
        this.setState({
            distanceMetric: selectedDistanceMetric
        });
    }

    switchMedoidDefinition() {
        let selectedMedoidDefinition = $('input[name=medoidDefinition]:checked').val();
        this.setState({
            distanceMetric: (selectedMedoidDefinition === 'each')? 'DTW': 'DTWD',
            medoidDefinition: selectedMedoidDefinition
        });
    }

    onChangeClusteringMethod() {
        let clusteringMethodList = document.getElementById('clusteringMethod');
        let selectedMethodIdx = clusteringMethodList.selectedIndex;
        let clusteringMethod = clusteringMethodList.options[selectedMethodIdx].value;
        ClusteringAction.changeClusteringMethod(clusteringMethod);
        this.setState({
            clusteringMethod: clusteringMethod,
            distanceMetric: (clusteringMethod === 'kmedoids')? 'DTW': 'DTWD'
        });
    }

    onClickNormalize() {
        let current = this.state.normalize;
        this.setState({
            normalize: !current
        });
    }

    clickRunButton() {
        let datasets = [];
        for (let i = 0; i < this.state.targetList.length; i++) {
            datasets.push(DataStore.getData(this.state.targetList[i]));
        }
        let variables = [];
        let variableList = document.getElementsByName('clusteringVariables');
        for (let i = 0; i < variableList.length; i++) {
            if (variableList[i].checked) {
                variables.push(variableList[i].value);
            }
        }
        let clusteringParameters;
        switch (this.state.clusteringMethod) {
            case 'kmedoids':
                clusteringParameters = {
                    method: 'kmedoids',
                    clusterNum: Number($('#clusterNumber').val()),
                    medoidDefinition: this.state.medoidDefinition,
                    distanceMetric: this.state.distanceMetric,
                    window: 0,
                    variables: variables
                };
                break;
            case 'kmeans':
                clusteringParameters = {
                    method: 'kmeans',
                    clusterNum: Number($('#clusterNumber').val()),
                    distanceMetric: this.state.distanceMetric,
                    window: 0,
                    clusterCenter: $('input[name=clusterCenter]:checked').val(),
                    variables: variables
                };
                break;
            default:
                break;
        }
        let subsequenceParameters = {};
        subsequenceParameters.filtering = this.state.filteringSS;
        subsequenceParameters.SSperiod = [Number($('#targetLengthMinClustering').val()), Number($('#targetLengthMaxClustering').val())];
        subsequenceParameters.isometryLen = Number($('#resolutionOfTimeNormalizedSS').val());
        subsequenceParameters.normalize = this.state.normalize;
        if (this.state.filteringSS.indexOf('overlappingDegree') >= 0) {
            subsequenceParameters.overlappingTh = Number($('#overlappingDegreeThreshold').val());
        }
        let [subsequences, ranges, clusterCenters, labels, clusteringScores, filteringProcess, resultsCoordinates] = performClustering(datasets, clusteringParameters, subsequenceParameters);
        // let data = DataStore.getData(0),
        //     clusteringParameters = {
        //         method: 'kmedoids',
        //         clusterNum: 6,
        //         distanceMetric: 'DTWD',
        //         window: 0,
        //     },
        //     SSperiod = [20, 30],
        //     isometryLen = 30,
        //     overlappingTh = 70,
        //     variables = ['x', 'y', 'V', 'H'];
        // // perform clustering
        // let [subsequences, clusterCenters, labels] = performClustering(data, clusteringParameters, SSperiod, isometryLen, overlappingTh, variables);
        // // show clustering results
        let datasetIds = [];
        for (let i = 0; i < datasets.length; i++) {
            datasetIds.push(datasets[i].id);
        }
        toggleExtractionMenu('none');
        $('#clusteringResults').css('width', '100%');
        ClusteringAction.showClusteringResults(
            datasetIds, 
            subsequences, 
            ranges,
            clusterCenters, 
            labels, 
            clusteringParameters, 
            subsequenceParameters,
            clusteringScores,
            filteringProcess,
            resultsCoordinates
        );
    }
}
