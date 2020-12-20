import React from 'react';
import {performClustering} from '../lib/subsequenceClustering';
import * as ClusteringAction from '../Actions/ClusteringAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';

export default class Clustering extends React.Component {
    constructor(props) {
        super();
        this.state = {
            queryMode: FeatureStore.getMode(),
            clusteringMethod: 'kmedoids',
            distanceMetric: 'DTWD',
            targetList: FeatureStore.getTarget()
        };
    }    

    componentDidMount() {
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
                        Resolution of the time-normalized subsequences
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
                    <div className='col form-group'>
                        <div className="custom-control custom-checkbox">
                            <input type="checkbox" className="custom-control-input" id="slidingWindowDataPoint"/>
                            <label className="custom-control-label" htmlFor="slidingWindowDataPoint">Sliding window according to data points</label>
                        </div>
                        <div className="custom-control custom-checkbox">
                            <input type="checkbox" className="custom-control-input" id="SSFilterStartingPoint"/>
                            <label className="custom-control-label" htmlFor="SSFilterStartingPoint">Representative of subsequences starting from the same data points</label>
                        </div>
                        <div className="custom-control custom-checkbox">
                            <input type="checkbox" className="custom-control-input" id="SSFilterOverlappingDegree"/>
                            <label className="custom-control-label" htmlFor="SSFilterOverlappingDegree">Filtering out highly overlapping subsequences</label>
                        </div>
                    </div>
                </div>
            </div>
        );
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
                if (key !== 'z') {
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
                                            checked={(this.state.distanceMetric === 'DTWI')? true: false}
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

    onChangeClusteringMethod() {
        let clusteringMethodList = document.getElementById('clusteringMethod');
        let selectedMethodIdx = clusteringMethodList.selectedIndex;
        let clusteringMethod = clusteringMethodList.options[selectedMethodIdx].value;
        ClusteringAction.changeClusteringMethod(clusteringMethod);
        this.setState({
            clusteringMethod: clusteringMethod
        });
    }

    clickRunButton() {
        let data = DataStore.getData(0),
            clusteringParameters = {
                method: 'kmedoids',
                clusterNum: 6,
                distanceMetric: 'DTWD',
                window: 0,
            },
            SSperiod = [20, 30],
            isometryLen = 30,
            overlappingTh = 70,
            variables = ['x', 'y', 'V', 'H'];
        // perform clustering
        let [subsequences, clusterCenters, labels] = performClustering(data, clusteringParameters, SSperiod, isometryLen, overlappingTh, variables);
        // show clustering results
        ClusteringAction.showClusteringResults(subsequences, clusterCenters, labels);
    }
}
