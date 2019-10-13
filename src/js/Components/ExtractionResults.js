import React from 'react';
import ResultSummary from './ResultSummary';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import FeatureStore from '../Stores/FeatureStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';
import AppStore from '../Stores/AppStore';
import { resolve } from 'url';

export default class ExtractionResults extends React.Component {
    constructor(props) {
        super();

        // this.results = [];
        this.state = {
            results: []
        };

        FeatureStore.on('setExtractionResults', () => {
            let results = FeatureStore.getExtractionResults();
            this.setState({
                results: results
            });
            // this.showResults();
        });
    }

    componentDidMount() {
        $('#topKResults').val(20);
    }

    showResults() {
        // get the options for showing results
        // order of the results
        let resultOrderList = document.getElementById('resultOrderList');
        let selectedIdx = resultOrderList.selectedIndex;
        let resultOrder = resultOrderList.options[selectedIdx].value;
        // k value
        let kValue = $('#topKResults').val();
        // distance threshold
        let distTh = $('#distanceThreshold').val();

        // filter results according to the input options
        let results = this.state.results;
        // sort results
        switch(resultOrder) {
            case 'distance':
                results.sort(function (a, b) {
                    return a[3] - b[3];
                });
                break;
            case 'timeStamp':
                results.sort(function (a, b) {
                    let diff = a[1] - b[1];
                    if (diff === 0) {
                        diff = a[0] - b[0];
                    }
                    return diff;
                });
                break;
            case 'data':
                results.sort(function (a, b) {
                    let diff = a[0] - b[0];
                    if (diff === 0) {
                        diff = a[3] - b[3];
                    }
                    return diff;
                });
                break;
        }
        // filter out results with distance higher than threshold
        if (distTh !== '') {
            results = results.filter(function(result) {
                return (result[3] < distTh)? true: false;
            });
        }
        // show only top k results
        if (kValue !== '') {
            results = results.slice(0, kValue);
        }
        // get a snapshot of the time slice
        // step 1: store the current status of the camera
        let targetList = FeatureStore.getTarget();
        let currentCamera = {},
            minJDs = {},
            canvas = {};
        for (let i = 0; i < targetList.length; i++) {
            currentCamera[String(targetList[i])] = TimeTubesStore.getCameraProp(targetList[i]);
            minJDs[String(targetList[i])] = DataStore.getData(targetList[i]).data.meta.min.z;
            canvas[String(targetList[i])] = document.getElementById('TimeTubes_viewport_' + targetList[i]);
            // step 2: reset camera position
            let aspect = currentCamera[String(targetList[i])].aspect;
            TimeTubesAction.updateCamera(targetList[i], {
                xpos: 0,
                ypos: 0,
                zpos: 50,
                fov: 45,
                far: 2000,
                depth: 0,
                aspect: aspect,
                zoom: 1,
                type: 'Perspective'
            });
        }
        console.log(results);
        let summaries = [];
        for (let i = 0; i < results.length; i++) {
            // result: [id, JD, period, dtw distance]
            // step 3: move the camera to the start point
            // step 4: set camera far

            let result = results[i];
            TimeTubesAction.takeSnapshot(result[0], result[1] - minJDs[String(result[0])], result[2]);
            // new Promise((resolve, reject) => {
            //     let result = results[i];
            //     TimeTubesAction.takeSnapshot(result[0], result[1] - minJDs[String(result[0])], result[2]);
            //     resolve(i + 1);
            // });
            // new Promise((resolve, reject) => {
            //     setTimeout(() => {
            //         TimeTubesAction.takeSnapshot(result[0], result[1] - minJDs[String(result[0])], result[2]);
            //         resolve(1);
            //     }, 100);
            // })
            // .then(() => {
            //     console.log('show snapshots')
            //     let canvas = document.getElementById('TimeTubes_viewport_' + result[0]);
            //     let image = new Image();
            //     image.src = canvas.toDataURL();
            //     window.document.body.appendChild(image);
            // })

            let image = new Image();
            image.src = canvas[String(result[0])].toDataURL();
            summaries.push(<ResultSummary
                key={i}
                id={result[0]}
                thumbnail={image}
                period={[result[1], result[1] + result[2]]}
                distance={result[3]}
                rank={i}/>);
        }
        return summaries;
    }

    updateOrder() {
        console.log('update order');
    }

    updateKValue() {
        console.log('update k value');
    }

    updateDistanceThreshold() {
        console.log('distance threshold')
    }

    orderOfResults() {
        return (
            <div
                className="form-group form-inline"
                style={{float: 'right', marginLeft: '1rem'}}
                onChange={this.updateOrder.bind(this)}>
                <label
                    className="col-form-label col-form-label-sm"
                    style={{marginRight: '0.5rem'}}>Align results by</label>
                <select
                    id='resultOrderList'
                    className="custom-select custom-select-sm" 
                    style={{width: '7rem'}}>
                    <option value="distance">Distance</option>
                    <option value="timeStamp">Time stamp</option>
                    <option value="data">Data</option>
                </select>
            </div>
        );
    }

    distanceThreshold() {
        return (
            <div className='form-group form-inline' style={{float: 'right', marginLeft: '1rem'}}>
                <label
                    className="col-form-label col-form-label-sm"
                    style={{marginRight: '0.5rem'}}>Distance threshold</label>
                <input className="form-control form-control-sm"
                       type="text"
                       placeholder="threshold"
                       id="distanceThreshold"
                       onChange={this.updateDistanceThreshold.bind(this)}
                       style={{width: '7rem'}}/>
            </div>
        );
    }

    topKResults() {
        return (
            <div className='form-group form-inline' style={{float: 'right', marginLeft: '1rem'}}>
                <label
                    className="col-form-label col-form-label-sm"
                    style={{marginRight: '0.5rem'}}>Top k result</label>
                <input className="form-control form-control-sm"
                       type="text"
                       placeholder="k value"
                       id="topKResults"
                       onChange={this.updateKValue.bind(this)}
                       style={{width: '7rem'}}/>
            </div>
        );
    }

    render() {
        let results;
        if (AppStore.getMenu() === 'feature' && this.state.results.length > 0) {
            results = this.showResults();
        }
        return (
            <div id='extractionResults' className='resultElem'>
                <div id='resultMenus' style={{overflow: 'hidden'}}>
                    {this.orderOfResults()}
                    {this.distanceThreshold()}
                    {this.topKResults()}
                </div>
                <div id='mainResultArea'>
                    <div id='resultDetailArea'>
                        Result detail area
                    </div>
                    <div id='resultsArea'>
                        {results}
                    </div>
                </div>
            </div>
        );
    }
}
