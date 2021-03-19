import React from 'react';
import * as FeatureAction from '../Actions/FeatureAction';
import {showResultsPanel} from '../Actions/AppAction';
import AppStore from '../Stores/AppStore';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import SelectedTimeSlice from './SelectedTimeSlice';
import QueryByExample from './QueryByExample';
import QueryBySketch from './QueryBySketch';
import * as TimeSeriesQuerying from '../lib/TimeSeriesQuerying';
import * as domActions from '../lib/domActions';

export default class VisualQuery extends React.Component {
    constructor() {
        super();
        this.state = {
            dragSelection: true,
            queryMode: FeatureStore.getMode(),
            selector: true,
            source: -1,
            selectedInterval: [-1, -1],
            coordinate: 'rectangular',
            DTWMode: 'DTWD',
        };
        this.clusterCenter = {};
    }

    componentDidMount() {
        $('#stepSizeOfSlidingWindow').val(5);

        AppStore.on('showExtractionSourcePanel', (id) => {
            this.setState({
                queryMode: 'QBE'
            });
        })
        FeatureStore.on('updateSource', () => {
            this.clusterCenter = {};
            this.setState({
                source: FeatureStore.getSource()
            });
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            this.setState({
                queryMode: mode
            });
            if ($('#resultDetailArea').css('display') === 'block') {
                domActions.toggleExtractionDetailPanel();
            }
            if (mode === 'QBS') {
                this.setState({
                    DTWMode: 'DTWD'
                });
            }
            if ($('#stepSizeOfSlidingWindow').val() === '') {
                $('#stepSizeOfSlidingWindow').val(5);
            }
            if (mode !== 'QBE') {
                document.getElementById('sourceList').selectedIndex = 0;
                if ($('#QBESourceMain').css('display') === 'block') {
                    domActions.toggleSourcePanel();
                }
            }
        });
        FeatureStore.on('updateSelectedPeriod', () => {
            let period = FeatureStore.getSelectedPeriod();
            if (period[1] - period[0] > 0) {
                this.clusterCenter = {};
                this.setState({
                    selectedInterval: period
                });
                this.cancelDisablementOfNormalizationOption();
                this.updateSelectedInterval();
            }
        });
        FeatureStore.on('selectTimeInterval', (id, val) => {
            if (Number(this.state.source) === id) {
                this.clusterCenter = {};
                this.setState({
                    selectedInterval: FeatureStore.getSelectedPeriod()
                });
                this.cancelDisablementOfNormalizationOption();
                this.updateSelectedInterval();
            }
        });
        FeatureStore.on('convertResultIntoQuery', (id, period, activeVar) => {
            this.clusterCenter = {};
            this.setState({
                source: id,
                selectedInterval: period
            });
            this.cancelDisablementOfNormalizationOption();
        });
        FeatureStore.on('recoverQuery', (query) => {
            let mode = FeatureStore.getMode();
            if (mode !== 'AE') {
                this.clusterCenter = {};
                if (mode === 'QBE') {
                    let interval = FeatureStore.getSelectedPeriod();
                    this.setState({
                        source: FeatureStore.getSource(),
                        selectedInterval: interval,
                        coordinate: query.parameters.coordinate,
                        DTWMode: query.parameters.DTWType,
                        queryMode: mode
                    });
                    if ($('#QBESourceMain').css('display') === 'none') {
                        domActions.toggleSourcePanel();
                    }
                } else if (mode === 'QBS') {
                    this.setState({
                        coordinate: query.parameters.coordinate,
                        DTWMode: query.parameters.DTWType,
                        queryMode: mode
                    });
                }

                // recover parameters status for matching
                let parameters = FeatureStore.getParameters();
                // recover normalization options
                this.cancelDisablementOfNormalizationOption();
                $('#NormalizeSwitch').prop('checked', parameters.normalize);
                let normalizationOptionList = document.getElementById('normalizationOptions');
                if (parameters.normalizationOption) {
                    for (let i = 0; i < normalizationOptionList.options.length; i++) {
                        if (normalizationOptionList.options[i].value === parameters.normalizationOption) {
                            normalizationOptionList.selectedIndex = i;
                            break;
                        }
                    }
                } else {
                    normalizationOptionList.selectedIndex = 0;
                }
                // recover distance metric
                let distanceMetric = document.getElementById('distanceMetric');
                for (let i = 0; i < distanceMetric.options.length; i++) {
                    if (distanceMetric.options[i].value === parameters.distanceMetric) {
                        distanceMetric.selectedIndex = i;
                        break;
                    }
                }
                // recover the normalization option of DTW
                let DTWNormalizationOptionList = document.getElementById('distanceNormalization');
                if (parameters.distanceNormalization) {
                    for (let i = 0; i < DTWNormalizationOptionList.options.length; i++) {
                        if (DTWNormalizationOptionList.options[i].value === parameters.distanceNormalization) {
                            DTWNormalizationOptionList.selectedIndex = i;
                            break;
                        }
                    }
                } else {
                    DTWNormalizationOptionList.selectedIndex = 0;
                }
                // recover other parameters
                $('#warpingWindowSize').val(parameters.warpingWindowSize);
                $('#targetLengthMin').val(parameters.timeSliceLength[0]);
                $('#targetLengthMax').val(parameters.timeSliceLength[1]);
                $('#stepSizeOfSlidingWindow').val(parameters.slidingWindow);
            } else {
                this.setState({
                    queryMode: mode
                });
            }
        });
        FeatureStore.on('changeDTWMode', (DTWMode) => {
            this.setState({
                DTWMode: DTWMode
            });
        });
        FeatureStore.on('convertClusterCenterIntoQuery', (clusterCenter) => {
            this.clusterCenter = clusterCenter;
            this.setState({
                source: -1
            });
        });
    }

    switchSelector() {
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

    switchCoordinate() {
        let selectedCoordinate = $('input[name=coordinate]:checked').val();
        this.setState({
            coordinate: selectedCoordinate
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

    updateSelectedInterval() {
        $('#selectedInterval').text('JD: ' + this.state.selectedInterval[0].toFixed(3) + ' - ' + this.state.selectedInterval[1].toFixed(3));
        $('#targetLengthMin').val(Math.floor(this.state.selectedInterval[1]) - Math.ceil(this.state.selectedInterval[0]));
        $('#targetLengthMax').val(Math.floor(this.state.selectedInterval[1]) - Math.ceil(this.state.selectedInterval[0]));
    }

    updateActiveVariables(e) {
        let event = e || window.event;
        let elem = event.target || event.srcElement;
        let elemId = elem.id;
        let varName = elemId.split('_')[1];
        // do not allow to select q, u and PA, PD at the same time
        if (varName === 'x' || varName === 'y') {
            // uncheck PA, PD
            $('#QBEActive_PA').prop('checked', false);
            $('#QBEActive_PD').prop('checked', false);
        } else if (varName === 'PA' || varName === 'PD') {
            $('#QBEActive_x').prop('checked', false);
            $('#QBEActive_y').prop('checked', false);
        }
        let activeVar = domActions.getActiveVariables();
        FeatureAction.setActiveVariables(activeVar);
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
            <div className='featureElem' id='QBEArea' 
                style={{display: (this.state.queryMode === 'QBE')? 'block': 'none'}}>
                <QueryByExample/>
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
            <div className='featureElem' id='QBSArea'
                style={{display: (this.state.queryMode === 'QBS')? 'block': 'none'}}>
                <QueryBySketch
                    xItem={'x'}
                    yItem={'y'}/>
            </div>
        );
    }

    selectionDetail() {
        let selectedTimeSlice;
        // when the mode is QBS, selectedTimeSlice view is not needed to be shown
        if (this.state.queryMode === 'QBE') {
            selectedTimeSlice = <SelectedTimeSlice sourceId={this.state.source}/>;
        }
        let selectionDetail;
        if (this.state.queryMode === 'QBE') {
            let timeIntervalText = '';
            if (this.state.selectedInterval[0] > 0 && this.state.selectedInterval[1] > 0) {
                timeIntervalText = 'JD: ' + this.state.selectedInterval[0].toFixed(3) + ' - ' + this.state.selectedInterval[1].toFixed(3);
            }
            
            selectionDetail = (
                <div className='featureElem' style={{position: 'relative'}}>
                    <h5>Selection Detail</h5>
                    <span id='selectedInterval'>{timeIntervalText}</span>
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
            let activeVariables = FeatureStore.getActive();
            // if inactive variables are already determined, check the checkboxes
            if (activeVariables.length === 0) {
                for (let key in lookup) {
                    let label = '';
                    if (key !== 'z') {// && key !== 'PA' && key !== 'PD') {
                        if (lookup[key].length > 1) {
                            label = lookup[key].join(',');
                        } else {
                            label = lookup[key];
                        }
                        items.push(
                            <div className="form-check form-check-inline"
                                key={key}>
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    name='QBEActive'
                                    value={key}
                                    id={"QBEActive_" + key}
                                />
                                <label
                                    className="form-check-label"
                                    htmlFor={"QBEActive_" + key}>
                                    {label}
                                </label>
                            </div>
                        );
                    }
                }
            } else if (activeVariables.length > 0) {
                for (let key in lookup) {
                    let label = '';
                    if (lookup[key].length > 1) {
                        label = lookup[key].join(',');
                    } else {
                        label = lookup[key];
                    }
                    if (key !== 'z') {// && key !== 'PA' && key !== 'PD') {
                        let defaultChecked = (activeVariables.indexOf(key) >= 0)? true: false;
                        items.push(
                            <div className="form-check form-check-inline"
                                key={key}>
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    name='QBEActive'
                                    value={key}
                                    defaultChecked={defaultChecked}
                                    id={"QBEActive_" + key}
                                />
                                <label
                                    className="form-check-label"
                                    htmlFor={"QBEActive_" + key}>
                                    {label}
                                </label>
                            </div>
                        );
                    }
                }
            }
        } else if (this.state.source < 0 && Object.keys(this.clusterCenter).length > 0) {
            // source file is not selected and cluster center is shown as a QBE
            let lookup = {};
            // let targets = FeatureStore.getTarget();
            let allData = DataStore.getAllData();
            // let activeVariables = FeatureStore.getActive();
            let variables = this.clusterCenter.parameters.variables;
            for (let i = 0; i < allData.length; i++) {
                let lookupTmp = allData[i].data.lookup;
                for (let j = 0; j < variables.length; j++) {
                    if (lookup[variables[j]]) {
                        for (let k = 0; k < lookupTmp[variables[j]].length; k++){
                            lookup[variables[j]].push(lookupTmp[variables[j]][k]);
                        }
                    } else {
                        lookup[variables[j]] = [];
                        for (let k = 0; k < lookupTmp[variables[j]].length; k++){
                            lookup[variables[j]].push(lookupTmp[variables[j]][k]);
                        }
                    }
                }
            }
            for (let key in lookup) {
                let label = '';
                if (lookup[key].length > 1) {
                    label = lookup[key].join(',');
                } else {
                    label = lookup[key];
                }
                if (key !== 'z') {// && key !== 'PA' && key !== 'PD') {
                    // let defaultChecked = (activeVariables.indexOf(key) >= 0)? true: false;
                    items.push(
                        <div className="form-check form-check-inline"
                            key={key}>
                            <input
                                className="form-check-input"
                                type="checkbox"
                                name='QBEActive'
                                value={key}
                                defaultChecked={true}
                                id={"QBEActive_" + key}
                            />
                            <label
                                className="form-check-label"
                                htmlFor={"QBEActive_" + key}>
                                {label}
                            </label>
                        </div>
                    );
                }
            }
        }
        return (
            <div className='featureElem' style={{position: 'relative'}}>
                <h5 onClick={this.collapseMatchingOptions}>Matching</h5>
                <div id='matchingOptionsMain'>
                    <div id='activeVariablesArea' style={{display: (this.state.queryMode === 'QBE')? 'block': 'none'}}>
                        <h6>Active variables</h6>
                        <form id='QBEActiveVariables' onChange={this.updateActiveVariables.bind(this)}>
                            {items}
                        </form>
                    </div>
                    <h6>Computation</h6>
                    <div className='container'
                        style={{paddingRight: '0px', paddingLeft: '0px', marginBottom: '0.2rem'}}>
                        <div className='row matchingOption'
                            style={{paddingLeft: '15px', paddingRight: '15px'}}>   
                            <div className='col-5'
                            style={{paddingLeft: '0'}}>
                                <div className="custom-control custom-switch">
                                    <input type="checkbox" className="custom-control-input" id="NormalizeSwitch"/>
                                    <label className="custom-control-label" htmlFor="NormalizeSwitch">Normalize</label>
                                </div>
                            </div>
                            <div className='col'>
                                <select
                                    className="custom-select custom-select-sm"
                                    id='normalizationOptions'
                                    style={{width: '60%'}}>
                                    <option value="minmax">Min-max</option>
                                    <option value="centralize">Centralize</option>
                                    <option value="zScore">z-score</option>
                                </select>
                            </div>
                        </div>
                        <div className="row matchingOption">
                            <div className='col'>
                                <form
                                    className="form-check form-inline"
                                    id='coordinate'
                                    onChange={this.switchCoordinate.bind(this)}
                                    style={{paddingLeft: '0px'}}>
                                    <div className="custom-control custom-radio">
                                        <input type="radio" id="rectangularCoordinate" name="coordinate" value='rectangular'
                                            checked={(this.state.coordinate === 'rectangular')? true: false}
                                            className="custom-control-input" readOnly/>
                                        <label className="custom-control-label" htmlFor="rectangularCoordinate">
                                            Rectangular coordinate
                                        </label>
                                    </div>
                                    <div className="custom-control custom-radio"
                                        style={{marginLeft: '1.5rem'}}>
                                        <input type="radio" id="polarCoordinate" name="coordinate" value='polar'
                                            checked={(this.state.coordinate === 'polar')? true: false}
                                            className="custom-control-input" readOnly/>
                                        <label className="custom-control-label" htmlFor="polarCoordinate">
                                            Polar coordinate
                                        </label>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                    <h6>Settings of DTW</h6>
                    <div className='container'
                        style={{paddingRight: '0px', paddingLeft: '0px', marginBottom: '0.2rem'}}>
                        <div className="row matchingOption">
                            <div className='col-5'>
                                Distance metric
                            </div>
                            <div className='col'>
                                <select
                                    className="custom-select custom-select-sm"
                                    id='distanceMetric'
                                    style={{width: '60%'}}>
                                    <option value="Euclidean">Euclidean</option>
                                    {/* <option value="Manhattan">Manhattan</option> */}
                                </select>
                            </div>
                        </div>
                        <div className="row matchingOption">
                            <div className="col-5">
                                Distance normalization
                            </div>
                            <div className='col'>
                                <select
                                    className='custom-select custom-select-sm'
                                    id='distanceNormalization'
                                    style={{width: '60%'}}>
                                    <option value='none'>None</option>
                                    <option value='warpingPathLength'>Warping path length</option>
                                    <option value='minLength'>Minimum length</option>
                                    <option value='maxLength'>Maximum length</option>
                                    <option value='timeNormalization'>Time normalization</option>
                                    <option value='pathLengthRatio'>Warping path ratio</option>
                                </select>
                            </div>
                        </div>
                        <div className="row matchingOption">
                            <div className='col-5'>
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
                            <div className='col-5'>
                                Length of the target time series
                            </div>
                            <div className='col form-inline'>
                                <input className="form-control form-control-sm"
                                    type="text"
                                    placeholder="min"
                                    id="targetLengthMin"
                                    style={{width: '20%', marginRight: '0.5rem'}}
                                    required={true}/>
                                ~
                                <input className="form-control form-control-sm"
                                    type="text"
                                    placeholder="max"
                                    id="targetLengthMax"
                                    style={{width: '20%', marginRight: '0.5rem', marginLeft: '0.5rem'}}
                                    required={true}/>
                                <label className="col-form-label col-form-label-sm"> days</label>
                            </div>
                        </div>
                        <div className="row matchingOption">
                            <div className='col-5'>
                                Step size of sliding window
                            </div>
                            <div className='col form-inline'>
                                <input className="form-control form-control-sm"
                                    type="text"
                                    placeholder="step size"
                                    id="stepSizeOfSlidingWindow"
                                    style={{width: '40%', marginRight: '0.5rem'}}
                                    required={true}/>
                                <label className="col-form-label col-form-label-sm"> days</label>
                            </div>
                        </div>
                        {/* <div className="row matchingOption">
                            <div className='col-5'>
                                Restrictions
                            </div>
                            <div className='col'>
                                Restriction checkboxes here
                            </div>
                        </div> */}
                        <div className="row matchingOption">
                            <div className='col-5'>
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
                                            disabled={this.state.queryMode === 'QBS'}
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
                            onClick={this.clickRunButton.bind(this)}>Run</button>
                </div>
            </div>
        );
    }

    cancelDisablementOfNormalizationOption() {
        $('#NormalizeSwitch').prop('disabled', false);
        $('#normalizationOptions').prop('disabled', false);
    }

    collapseMatchingOptions() {
        $('#matchingOptionsMain').slideToggle();
    }

    clickRunButton() {
        $('#topKLabelResults').text('Top ' + FeatureStore.getKValue() + ' results');
        $('#matchingStatus').text('searching...');
        setTimeout(function() {
            this.runMatching();
        }.bind(this), 0);
    }

    runMatching() {
        // normalize
        let normalization = $('#NormalizeSwitch').prop('checked');
        // normalization option
        let normalizationList = document.getElementById('normalizationOptions');
        let selectedNormalizeationIdx = normalizationList.selectedIndex;
        let normlizationOption = normalizationList.options[selectedNormalizeationIdx].value;
        // distance metric
        let distList = document.getElementById('distanceMetric');
        let selectedDistIdx = distList.selectedIndex;
        let selectedDist = distList.options[selectedDistIdx].value;
        // distance normalization
        let distNormalizationList = document.getElementById('distanceNormalization');
        let selectedDistNormalizationIdx = distNormalizationList.selectedIndex;
        let distNormalizationOption = distNormalizationList.options[selectedDistNormalizationIdx].value;
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
        // get target ids
        let targets = FeatureStore.getTarget();
        switch (this.state.queryMode) {
            case 'QBE':
                // get source id: this.state.source
                let source = Number(this.state.source);
                if (targets.length > 0) {
                    if (Object.keys(this.clusterCenter).length === 0) {
                        // get selected time period: FeatureStore.getSelectedPeriod()
                        let period = FeatureStore.getSelectedPeriod();
                        // get what to ignore: this.getIgnoredVariables
                        let activeVar = domActions.getActiveVariables();
                        // PA,PD should always be inactive because PDPA and QIUI means same
                        // ignored.push('PD');
                        // ignored.push('PA');
                        let parameters = {};
                        parameters = {
                            normalize: normalization,
                            normalizationOption: normlizationOption,
                            coordinate: this.state.coordinate,
                            distanceMetric: selectedDist,
                            distanceNormalization: distNormalizationOption,
                            warpingWindowSize: windowSize,
                            timeSliceLength: [periodMin, periodMax],
                            slidingWindow: step,
                            DTWType: DTWType
                        };
                        if (source !== NaN) {
                            // convert a query into an object with arrays (divide time series into equal interval (1day))
                            let results;
                            // compute distance between time slices!
                            // scores of matching with starting JD and period will be returned
                            // result stores {id, start, period, dtw distance, path} (not sorted)
                            let query = TimeSeriesQuerying.makeQueryfromQBE(source, period, activeVar, this.state.coordinate);
                            if (query) {
                                results = TimeSeriesQuerying.runMatching(query.values, targets, parameters);
                                // results = TimeSeriesQuerying.runMatching(query.values, targets, DTWType, normalization, normlizationOption, selectedDist, windowSize, step, [periodMin, periodMax]);
                                results = TimeSeriesQuerying.removeOverlappingQBE(source, period, results);
                                FeatureAction.setExtractionResults(parameters, results, query, activeVar);
                                TimeSeriesQuerying.setDefaltOrderOfResults();
                            }
                        }
                        TimeSeriesQuerying.showExtractionResults();
                    } else {
                        // perform QBE with a query created from a cluster center
                        let promise = Promise.resolve();
                        promise.then(function() {
                            showResultsPanel('featureExtraction');
                        })
                        .then(function() {
                            let parameters = {};
                            parameters = {
                                normalize: normalization,
                                normalizationOption: normlizationOption,
                                coordinate: this.state.coordinate,
                                distanceMetric: selectedDist,
                                distanceNormalization: distNormalizationOption,
                                warpingWindowSize: windowSize,
                                timeSliceLength: [periodMin, periodMax],
                                slidingWindow: step,
                                DTWType: DTWType
                            };
                            let activeVar = domActions.getActiveVariables();
                            let values = {};
                            for (let i = 0; i < activeVar.length; i++) {
                                values[activeVar[i]] = this.clusterCenter.values[activeVar[i]];
                            }
                            values.arrayLength = this.clusterCenter.values.arrayLength;
                            let query = {
                                mode: 'visual query',
                                option: 'query-by-example',
                                query: {
                                    source: 'clustering',
                                    activeVariables: activeVar
                                },
                                values: values
                            };
                            let results = TimeSeriesQuerying.runMatchingClusterCenter(values, targets, parameters);
                            FeatureAction.setExtractionResults(parameters, results, query, activeVar);
                            TimeSeriesQuerying.setDefaltOrderOfResults();
                        }.bind(this))
                        .then(function() {
                            TimeSeriesQuerying.showExtractionResults();
                        });
                    }
                }
                break;
            case 'QBS':
                if (targets.length > 0) {
                    let query = FeatureStore.getQuery();
                    let activeVar = [];
                    for (let key in query.values) {
                        if (Array.isArray(query.values[key])) {
                            if (query.values[key].indexOf(null) < 0) {
                                activeVar.push(key);
                                continue;
                            }
                            let flag = true;
                            for (let i = 0; i < query.values[key].length; i++) {
                                if (query.values[key][i] !== null) {
                                    flag = false;
                                    break;
                                }
                            }
                            // if (flag) ignored.push(key);
                            if (!flag) activeVar.push(key);
                        }
                    }
                    // let variableList = document.getElementById('widthVariables');
                    // let selectedIdx = variableList.selectedIndex;
                    // let selectedText = variableList.options[selectedIdx].innerText;
                    let parameters = {};
                    parameters = {
                        // width: ($('#widthDetectionSwitch').prop('checked'))? selectedText: false,
                        // sketchLength: $('#periodOfSketchQuery').val(),
                        normalize: normalization,
                        normalizationOption: normlizationOption,
                        coordinate: this.state.coordinate,
                        distanceMetric: selectedDist,
                        distanceNormalization: distNormalizationOption,
                        warpingWindowSize: windowSize,
                        timeSliceLength: [periodMin, periodMax],
                        slidingWindow: step,
                        DTWType: DTWType
                    };
                    let results;
                    if (this.state.coordinate === 'polar') {
                        // convert query to polar coordinate
                        query.values = TimeSeriesQuerying.makeQueryPolarQBS(query.values);
                    }
                    if (query.values) {
                        results = TimeSeriesQuerying.runMatchingSketch(query.values, targets, parameters);
                        // results = TimeSeriesQuerying.runMatchingSketch(query.values, targets, DTWType, normalization, normlizationOption, selectedDist, windowSize, step, [periodMin, periodMax]);
                        FeatureAction.setExtractionResults(parameters, results, query, activeVar);
                        TimeSeriesQuerying.setDefaltOrderOfResults();
                    }
                }
                TimeSeriesQuerying.showExtractionResults();
                break;
        }
    }

    render() {
        // let queryDefinition;
        // if (this.state.queryMode === 'QBE') {
        //     queryDefinition = this.QBESelection();
        // } else if (this.state.queryMode === 'QBS') {
        //     queryDefinition = this.QBSSelection();
        // }

        return (
            <div id='featureArea' className='controllersElem featureArea'>
                {this.queryModes()}
                <div id='queryModes'>
                    {this.QBESelection()}
                    {this.QBSSelection()}
                </div>
                {this.selectionDetail()}
                {this.matchingControllers()}
            </div>
        );
    }
}
