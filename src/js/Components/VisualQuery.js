import React from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import * as FeatureAction from '../Actions/FeatureAction';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import SelectedTimeSlice from './SelectedTimeSlice';
import QueryBySketch from './QueryBySketch';
import ResultSummary from './ResultSummary';
import * as TimeSeriesQuerying from '../lib/TimeSeriesQuerying';
import * as domActions from '../lib/domActions';

export default class VisualQuery extends React.Component {
    constructor() {
        super();
        this.state = {
            visualQuery: false,
            dragSelection: true,
            queryMode: FeatureStore.getMode(),
            selector: true,
            source: -1,
            selectedInterval: [],
            DTWMode: 'DTWD'
        };
    }

    componentWillMount() {
        FeatureStore.on('updateSelectedTimeSlice', () => {
            this.setState({
                selectedInterval: FeatureStore.getSelectedInterval()
            });
            this.updateSelectedInterval();
        });
        FeatureStore.on('updateSource', () => {
            this.setState({
                source: FeatureStore.getSource()
            });
            $('#stepSizeOfSlidingWindow').val('5');
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            this.setState({
                queryMode: mode
            });
        });
        FeatureStore.on('updateSelectedPeriod', () => {
            // this.selectedInterval = FeatureStore.getSelectedPeriod();
            this.updateSelectedInterval();
        });
    }

    switchSelector() {
        console.log('switch selector')
        this.setState({selector: !this.state.selector});
        FeatureAction.switchSelector();
    }

    switchDragSelection() {
        this.setState({dragSelection: !this.state.dragSelection});
        FeatureAction.switchDragSelection();
    }

    switchQueryMode(obj) {
        let selectedQueryMode = $('input[name=queryMode]:checked').val();
        FeatureAction.switchQueryMode(selectedQueryMode);
    }

    switchDTWMode() {
        let selectedDTWMode = $('input[name=DTWType]:checked').val();
        this.setState({
            DTWMode: selectedDTWMode
        });
    }

    resetSelection() {
        FeatureAction.resetSelection();
    }

    selectTimeInterval() {
        let val = $('#selectTimeIntervalInput').val();
        if (!isNaN(val) && val != '') {
            FeatureAction.selectTimeInterval(this.state.source, val);
        }
    }

    updateSource() {
        let sourceList = document.getElementById('sourceList');
        let selectedIdx = sourceList.selectedIndex;
        let selectedId = sourceList.options[selectedIdx].value; // get id
        FeatureAction.updateSource(selectedId);
    }

    updateTarget() {
        // console.log('updateTarget');
    }

    updateSelectedInterval() {
        let period = FeatureStore.getSelectedPeriod();
        this.setState({
            selectedInterval: period
        });
        $('#selectedInterval').text('JD: ' + period[0].toFixed(3) + ' - ' + period[1].toFixed(3));
        $('#targetLengthMin').val(Math.floor(period[1]) - Math.ceil(period[0]));
        $('#targetLengthMax').val(Math.floor(period[1]) - Math.ceil(period[0]));
    }

    updateIgnoredVariables() {
        let ignored = domActions.getIgnoredVariables();
        FeatureAction.setIgnoredVariables(ignored);
    }

    extractionSource() {
        let idFile = DataStore.getAllIdsFileNames();
        let sourceList = idFile.map((data) => {
            return <option value={data.id} key={data.id}>{data.name}</option>;
        });
        sourceList.unshift(<option value='default' key='default'>Select a source</option>)
        return (
            <div className='featureElem'
                 style={{display: (this.state.queryMode === 'QBE') ? 'block': 'none'}}>
                <h5>Source</h5>
                <select
                    className="custom-select custom-select-sm"
                    id='sourceList'
                    style={{width: '40%'}}
                    onChange={this.updateSource.bind(this)}>
                        {sourceList}
                </select>
            </div>
        );
    }

    queryModes() {
        return (
            <div className='featureElem'>
                <h5>Query mode</h5>
                <form className="form-check form-check-inline" id='queryMode' onChange={this.switchQueryMode.bind(this)}>
                    <div className="custom-control custom-radio">
                        <input
                            type="radio"
                            id="QBE"
                            name="queryMode"
                            className="custom-control-input"
                            value="QBE"
                            checked={this.state.queryMode === 'QBE'} readOnly/>
                            <label className="custom-control-label" htmlFor="QBE">Query-by-example</label>
                    </div>
                    <div
                        className="custom-control custom-radio"
                        style={{marginLeft: '0.5rem'}}>
                        <input
                            type="radio"
                            id="QBS"
                            name="queryMode"
                            className="custom-control-input"
                            value="QBS"
                            checked={this.state.queryMode === 'QBS'} readOnly/>
                            <label className="custom-control-label" htmlFor="QBS">Query-by-sketch</label>
                    </div>
                </form>
            </div>
        );
    }

    QBESelection() {
        return (
            <div className='featureElem'>
                <h5>Selection</h5>
                <form className="form-check form-check-inline selector featureRow"
                      id='QBESelector' onChange={this.switchSelector.bind(this)}>
                    <div className="custom-control custom-radio">
                        <input
                            type="radio"
                            id='QBESelect'
                            name="QBESelector"
                            className="custom-control-input"
                            value="Select"
                            checked={this.state.selector} readOnly/>
                        <label className="custom-control-label" htmlFor="QBESelect">Select</label>
                    </div>
                    <div
                        className="custom-control custom-radio"
                        style={{marginLeft: '0.5rem'}}>
                        <input
                            type="radio"
                            id='QBEDeselect'
                            name="QBESelector"
                            className="custom-control-input"
                            value="Deselect"
                            checked={!this.state.selector} readOnly/>
                        <label className="custom-control-label" htmlFor="QBEDeselect">Deselect</label>
                    </div>
                </form>
                <div id='selectTimeInterval' className='form-row featureRow'>
                    <div className="input-group input-group-sm" style={{width: '10rem', marginRight: '1.5rem'}}>
                        <span style={{marginRight: '0.3rem'}}>Select</span>
                        <input
                            type="text"
                            className="form-control custom-input"
                            id='selectTimeIntervalInput'/>
                        <span style={{marginLeft: '0.3rem'}}>days</span>
                    </div>
                    <button className="btn btn-primary btn-sm"
                            type="button"
                            id='selectTimeIntervalBtn'
                            style={{right: '0'}}
                            onClick={this.selectTimeInterval.bind(this)} >Select</button>
                </div>
                <div className="form-check">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="checkboxDragTube"
                        value="option1"
                        checked={this.state.dragSelection}
                        onChange={this.switchDragSelection.bind(this)}/>
                    <label
                        className="form-check-label"
                        htmlFor="inlineCheckbox1">
                        Selection by drag
                    </label>
                </div>
                <button
                    id='resetSelectionBtn'
                    className='btn btn-primary btn-sm featureRow'
                    onClick={this.resetSelection.bind(this)}>
                    Deselect all
                </button>
            </div>
        );
    }

    QBSSelection() {
        let lookupList = [];
        let dataList = DataStore.getAllData();
        dataList.forEach(function (e) {
           lookupList.push(e.data.lookup);
        });
        return (
            <div className='featureElem' id='QBSArea'>
                <QueryBySketch
                    id={this.state.source}
                    xItem={'z'}
                    yItem={'V'}
                    lookup={lookupList}/>
            </div>
        );
    }

    selectionDetail() {
        let selectedTimeSlice;
        // when the mode is QBS, selectedTimeSlice view is not needed to be shown
        if (this.state.source >= 0 && this.state.queryMode === 'QBE') {
            selectedTimeSlice = <SelectedTimeSlice sourceId={this.state.source}/>;
        }
        let selectionDetail;
        if (this.state.queryMode === 'QBE') {
            selectionDetail = (
                <div className='featureElem' style={{position: 'relative'}}>
                    <h5>Selection Detail</h5>
                    <span id='selectedInterval'></span>
                    <div id='selectedIntervalViewArea'>
                        {selectedTimeSlice}
                    </div>
                </div>
            );
        }
        return selectionDetail;
    }

    matchingControllers() {
        let items = [];
        if (this.state.source >= 0) {
            let lookup = DataStore.getData(Number(this.state.source)).data.lookup;
            for (let key in lookup) {
                let label = '';
                if (lookup[key].length > 1) {
                    label = lookup[key].join(',');
                } else {
                    label = lookup[key];
                }
                if (key !== 'z') {
                    items.push(
                        <div className="form-check form-check-inline"
                             key={key}>
                            <input
                                className="form-check-input"
                                type="checkbox"
                                name='QBEIgnored'
                                value={key}
                                id={"QBEIgnored_" + key}
                            />
                            <label
                                className="form-check-label"
                                htmlFor={"QBEIgnored_" + key}>
                                {label}
                            </label>
                        </div>
                    );
                }
            }
        }
        return (
            <div className='featureElem' style={{position: 'relative'}}>
                <h5>Matching</h5>
                <h6>Ignored variables</h6>
                <form id='QBEIgnoredVariables' onChange={this.updateIgnoredVariables.bind(this)}>
                    {items}
                </form>
                <h6>Options</h6>
                <div className='container'
                     style={{paddingRight: '0px', paddingLeft: '0px', marginBottom: '0.2rem'}}>
                    <div className='row matchingOption'
                         style={{paddingLeft: '15px', paddingRight: '15px'}}>
                        <div className="custom-control custom-switch">
                            <input type="checkbox" className="custom-control-input" id="QBENormalizeSwitch"/>
                            <label className="custom-control-label" htmlFor="QBENormalizeSwitch">Normalize</label>
                        </div>
                    </div>
                    <div className="row matchingOption">
                        <div className='col-4'>
                            Distance metric
                        </div>
                        <div className='col'>
                            <select className="custom-select custom-select-sm" id='distanceMetric'>
                                <option value="Euclidean">Euclidean</option>
                                <option value="Manhattan">Manhattan</option>
                            </select>
                        </div>
                    </div>
                    <div className="row matchingOption">
                        <div className='col-4'>
                            Warping window size
                        </div>
                        <div className='col form-inline'>
                            <input className="form-control form-control-sm"
                                   type="text"
                                   placeholder="window size"
                                   id="warpingWindowSize"
                                   style={{width: '40%', marginRight: '0.5rem'}}/>
                            <label className="col-form-label col-form-label-sm"> days</label>
                        </div>
                    </div>
                    <div className="row matchingOption">
                        <div className='col-4'>
                            Length of the target time series
                        </div>
                        <div className='col form-inline'>
                            <input className="form-control form-control-sm"
                                   type="text"
                                   placeholder="min"
                                   id="targetLengthMin"
                                   style={{width: '20%', marginRight: '0.5rem'}}/>
                            ~
                            <input className="form-control form-control-sm"
                                   type="text"
                                   placeholder="max"
                                   id="targetLengthMax"
                                   style={{width: '20%', marginRight: '0.5rem', marginLeft: '0.5rem'}}/>
                            <label className="col-form-label col-form-label-sm"> days</label>
                        </div>
                    </div>
                    <div className="row matchingOption">
                        <div className='col-4'>
                            Step size of sliding window
                        </div>
                        <div className='col form-inline'>
                            <input className="form-control form-control-sm"
                                   type="text"
                                   placeholder="step size"
                                   id="stepSizeOfSlidingWindow"
                                   style={{width: '40%', marginRight: '0.5rem'}}/>
                            <label className="col-form-label col-form-label-sm"> days</label>
                        </div>
                    </div>
                    <div className="row matchingOption">
                        <div className='col-4'>
                            Restrictions
                        </div>
                        <div className='col'>
                            Restriction checkboxes here
                        </div>
                    </div>
                    <div className="row matchingOption">
                        <div className='col-4'>
                            Type of DTW
                        </div>
                        <div className='col'>
                            <form
                                className="form-check"
                                id='DTWType'
                                onChange={this.switchDTWMode.bind(this)}
                                style={{paddingLeft: '0px'}}>
                                <div className="custom-control custom-radio">
                                    <input type="radio" id="DTWI" name="DTWType" value='DTWI'
                                           checked={(this.state.DTWMode === 'DTWI')? true: false}
                                           className="custom-control-input" readOnly/>
                                    <label className="custom-control-label" htmlFor="DTWI">
                                        DTW<sub>I</sub>
                                    </label>
                                </div>
                                <div className="custom-control custom-radio">
                                    <input type="radio" id="DTWD" name="DTWType" value='DTWD'
                                           checked={(this.state.DTWMode === 'DTWD')? true: false}
                                           className="custom-control-input" readOnly/>
                                    <label className="custom-control-label" htmlFor="DTWD">
                                        DTW<sub>D</sub>
                                    </label>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <button className="btn btn-primary btn-sm"
                        type="button"
                        id='runMatchingBtn'
                        style={{float: 'right'}}
                        onClick={this.runMatching.bind(this)}>Run</button>
            </div>
        );
    }

    runMatching() {
        // normalize
        let normalization = $('#QBENormalizeSwitch').prop('checked');
        // distance metric
        let distList = document.getElementById('distanceMetric');
        let selectedIdx = distList.selectedIndex;
        let selectedDist = distList.options[selectedIdx].value;
        // window size
        let windowSize = $('#warpingWindowSize').val();
        windowSize = (windowSize === '')? 0: Number(windowSize);
        // period length
        let periodMin = $('#targetLengthMin').val(), periodMax = $('#targetLengthMax').val();
        periodMin = (periodMin === '')? 0: Number(periodMin);
        periodMax = (periodMax === '')? 0: Number(periodMax);
        // step size
        let step = $('#stepSizeOfSlidingWindow').val();
        step = (step === '')? 1: Number(step);
        let DTWType = $('input[name=DTWType]:checked').val();
        switch (this.state.queryMode) {
            case 'QBE':
                // get source id: this.state.source
                let source = Number(this.state.source);
                // get target ids
                let targets = FeatureStore.getTarget();
                if (targets.length > 0) {
                    // get selected time period: FeatureStore.getSelectedPeriod()
                    let period = FeatureStore.getSelectedPeriod();
                    // get what to ignore: this.getIgnoredVariables
                    let ignored = domActions.getIgnoredVariables();
                    if (source !== NaN) {
                        // convert a query into an object with arrays (divide time series into equal interval (1day))
                        let query = TimeSeriesQuerying.makeQueryfromQBE(source, period, ignored);
                        // compute distance between time slices!
                        // scores of matching with starting JD and period will be returned
                        // result stores [id, JD, period, dtw distance] (not sorted)
                        let results = TimeSeriesQuerying.runMatching(query, targets, DTWType, normalization, selectedDist, windowSize, step, [periodMin, periodMax]);
                        // TODO: Remove overlapping!!
                        FeatureAction.setExtractionResults(results, query, ignored);
                        TimeSeriesQuerying.showExtractionResults();
                        // // close the source panel
                        // if ($('#QBESourceMain').css('display') !== 'none') {
                        //     domActions.toggleSourcePanel();
                        // }
                        // // get the options for showing results
                        // // order of the results
                        // let resultOrderList = document.getElementById('resultOrderList');
                        // let selectedIdx = resultOrderList.selectedIndex;
                        // let resultOrder = resultOrderList.options[selectedIdx].value;
                        // // k value
                        // let kValue = $('#topKResults').val();
                        // // distance threshold
                        // let distTh = $('#distanceThreshold').val();
                        //
                        // // filter results according to the input options
                        // // sort results
                        // switch(resultOrder) {
                        //     case 'distance':
                        //         results.sort(function (a, b) {
                        //             return a[3] - b[3];
                        //         });
                        //         break;
                        //     case 'timeStamp':
                        //         results.sort(function (a, b) {
                        //             let diff = a[1] - b[1];
                        //             if (diff === 0) {
                        //                 diff = a[0] - b[0];
                        //             }
                        //             return diff;
                        //         });
                        //         break;
                        //     case 'data':
                        //         results.sort(function (a, b) {
                        //             let diff = a[0] - b[0];
                        //             if (diff === 0) {
                        //                 diff = a[3] - b[3];
                        //             }
                        //             return diff;
                        //         });
                        //         break;
                        // }
                        //
                        // // filter out results with distance higher than threshold
                        // if (distTh !== '') {
                        //     results = results.filter(function(result) {
                        //         return (result[3] < distTh)? true: false;
                        //     });
                        // }
                        // // show only top k results
                        // if (kValue !== '') {
                        //     results = results.slice(0, kValue);
                        // }
                        // // get a snapshot of the time slice
                        // // step 1: store the current status of the camera
                        // let targetList = FeatureStore.getTarget();
                        // let currentCamera = {},
                        //     currentPos = {},
                        //     minJDs = {},
                        //     canvas = {};
                        // for (let i = 0; i < targetList.length; i++) {
                        //     currentCamera[String(targetList[i])] = TimeTubesStore.getCameraProp(targetList[i]);
                        //     currentPos[String(targetList[i])] = TimeTubesStore.getFocused(targetList[i]);
                        //     minJDs[String(targetList[i])] = DataStore.getData(targetList[i]).data.meta.min.z;
                        //     canvas[String(targetList[i])] = document.getElementById('TimeTubes_viewport_' + targetList[i]);
                        //     // step 2: reset camera position
                        //     let aspect = currentCamera[String(targetList[i])].aspect;
                        //     TimeTubesAction.updateCamera(targetList[i], {
                        //         xpos: 0,
                        //         ypos: 0,
                        //         zpos: 50,
                        //         fov: 45,
                        //         far: 2000,
                        //         depth: 0,
                        //         aspect: aspect,
                        //         zoom: 1,
                        //         type: 'Perspective'
                        //     });
                        // }
                        // let summaries = [];
                        // let domnode = document.getElementById('resultsArea');
                        // // if there are previous results on the result panel, remove all
                        // while (domnode.firstChild) {
                        //     ReactDOM.unmountComponentAtNode(domnode.firstChild);
                        //     domnode.removeChild(domnode.firstChild);
                        // }
                        // for (let i = 0; i < results.length; i++) {
                        //     // add a holder for React component to allow unmount react components
                        //     let divElem = document.createElement('div');
                        //     divElem.id = 'resultSummaryHolder_' + i;
                        //     domnode.appendChild(divElem);
                        //     let result = results[i];
                        //     TimeTubesAction.takeSnapshot(result[0], result[1] - minJDs[String(result[0])], result[2]);
                        //
                        //     let imageHeight = canvas[String(result[0])].height,
                        //         imageWidth = canvas[String(result[0])].width;
                        //     let image = new Image();
                        //     image.src = canvas[String(result[0])].toDataURL();
                        //     image.height = imageHeight;
                        //     image.width = imageWidth;
                        //     ReactDOM.render(<ResultSummary
                        //         key={i}
                        //         id={result[0]}
                        //         thumbnail={image}
                        //         period={[result[1], result[1] + result[2]]}
                        //         distance={result[3]}
                        //         rank={i}/>, divElem);
                        // }
                        // // recover camara status
                        // for (let i = 0; i < targetList.length; i++) {
                        //     TimeTubesAction.recoverTube(targetList[i], currentCamera[String(targetList[i])], currentPos[String(targetList[i])]);
                        // }
                    }
                }
                break;
            case 'QBS':
                console.log('convert QBS into data');
                break;
        }
    }

    showExtractionResults() {
        // close the source panel
        if ($('#QBESourceMain').css('display') !== 'none') {
            domActions.toggleSourcePanel();
        }
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
        // sort results
        let results = FeatureStore.getExtractionResults();
        results.sort(domActions.sortResults(resultOrder));
        // switch(resultOrder) {
        //     case 'distance':
        //         results.sort(function (a, b) {
        //             return a[3] - b[3];
        //         });
        //         break;
        //     case 'timeStamp':
        //         results.sort(function (a, b) {
        //             let diff = a[1] - b[1];
        //             if (diff === 0) {
        //                 diff = a[0] - b[0];
        //             }
        //             return diff;
        //         });
        //         break;
        //     case 'data':
        //         results.sort(function (a, b) {
        //             let diff = a[0] - b[0];
        //             if (diff === 0) {
        //                 diff = a[3] - b[3];
        //             }
        //             return diff;
        //         });
        //         break;
        // }

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
            currentPos = {},
            minJDs = {},
            canvas = {};
        for (let i = 0; i < targetList.length; i++) {
            currentCamera[String(targetList[i])] = TimeTubesStore.getCameraProp(targetList[i]);
            currentPos[String(targetList[i])] = TimeTubesStore.getFocused(targetList[i]);
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
        let summaries = [];
        let domnode = document.getElementById('resultsArea');
        // if there are previous results on the result panel, remove all
        while (domnode.firstChild) {
            ReactDOM.unmountComponentAtNode(domnode.firstChild);
            domnode.removeChild(domnode.firstChild);
        }
        for (let i = 0; i < results.length; i++) {
            // add a holder for React component to allow unmount react components
            let divElem = document.createElement('div');
            divElem.id = 'resultSummaryHolder_' + i;
            domnode.appendChild(divElem);
            let result = results[i];
            TimeTubesAction.takeSnapshot(result[0], result[1] - minJDs[String(result[0])], result[2]);

            let imageHeight = canvas[String(result[0])].height,
                imageWidth = canvas[String(result[0])].width;
            let image = new Image();
            image.src = canvas[String(result[0])].toDataURL();
            image.height = imageHeight;
            image.width = imageWidth;
            ReactDOM.render(<ResultSummary
                key={i}
                id={result[0]}
                thumbnail={image}
                period={[result[1], result[1] + result[2]]}
                distance={result[3]}
                rank={i}/>, divElem);
        }
        // recover camara status
        for (let i = 0; i < targetList.length; i++) {
            TimeTubesAction.recoverTube(targetList[i], currentCamera[String(targetList[i])], currentPos[String(targetList[i])]);
        }
    }

    render() {
        let queryDefinition;
        if (this.state.queryMode === 'QBE') {
            queryDefinition = this.QBESelection();
        } else if (this.state.queryMode === 'QBS') {
            queryDefinition = this.QBSSelection();
        }

        return (
            <div id='featureArea' className='controllersElem'>
                {this.queryModes()}
                {this.extractionSource()}
                {queryDefinition}
                {this.selectionDetail()}
                {this.matchingControllers()}
            </div>
        );
    }
}
