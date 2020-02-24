import React from 'react';
import ReactDOM from "react-dom";
import LineChart from './LineChart';
import ResultTimeline from './ResultTimeline';
import DistanceHistogram from './DistanceHistogram';
import * as domActions from '../lib/domActions';
import * as TimeSeriesQuerying from '../lib/TimeSeriesQuerying';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as AppAction from '../Actions/AppAction';
import * as DataAction from '../Actions/DataAction';
import * as FeatureAction from '../Actions/FeatureAction';
import FeatureStore from '../Stores/FeatureStore';
import DataStore from '../Stores/DataStore';
import { formatValue } from '../lib/2DGraphLib';
import {transformCamelToSentence} from '../lib/domActions';
import * as dataLib from '../lib/dataLib';

export default class ExtractionResults extends React.Component {
    constructor(props) {
        super();

        // this.results = [];
        this.LCWidth = 300;
        this.LCHeight = 200;
        this.optimalWarpPath = null;
        this.state = {
            shownResults: [], 
            LC: [],
            selected: {},
            accessibility: 'private',
            mode: FeatureStore.getMode(),
            AEOptions: FeatureStore.getAEOptions(),
            importedResults: {}
        };
    }

    componentDidMount() {
        $('#topKResults').val(20);

        FeatureStore.on('setExtractionResults', () => {
            this.setState({
                // shownResults: [],
                selected: {}
            });
            if ($('#resultDetailArea').css('display') === 'block') {
                domActions.toggleExtractionDetailPanel();
            }
            // let results = FeatureStore.getExtractionResults();
            // this.setState({
            //     results: results
            // });
            // if ($('#QBESourceMain').css('display') !== 'none') {
            //     domActions.toggleSourcePanel();
            // }
        });
        FeatureStore.on('showLineCharts', (LC) => {
            // remove all previous LCs
            this.setState({
                LC: LC
            });
        });
        FeatureStore.on('updateSelectedResult', (result, width, height) => {
            this.LCWidth = Math.max(300, width);
            this.LCHeight = Math.max(200, height);
            if (result.path) {
                this.optimalWarpPath = result.path;
            }
            this.setState({
                selected: result
            });
        });
        FeatureStore.on('clearResults', () => {
            this.setState({
                shownResults: []
            });
        });
        FeatureStore.on('updateShownResults', (results) => {
            this.setState({
                shownResults: results
            });
        });
        FeatureStore.on('selectResultFromTimeline', (result) => {
            let width = $('#extractionDetailLC').width();
            this.LCWidth = Math.max(300, width);
            this.LCHeight = 200;
            if (result.path) {
                this.optimalWarpPath = result.path;
            }
            this.setState({
                selected: result
            });
        });
        FeatureStore.on('switchQueryMode', () => {
            this.setState({
                mode: FeatureStore.getMode()
            });
        });
        FeatureStore.on('updateAEOption', () => {
            this.setState({
                AEOptions: FeatureStore.getAEOptions()
            });
        });
        FeatureStore.on('recoverQuery', (query) => {
            this.setState({
                mode: FeatureStore.getMode()
            });
            if ($('#resultDetailArea').css('display') === 'block') {
                domActions.toggleExtractionDetailPanel();
            }
        });
    }

    updateOrder() {
        let resultOrderList = document.getElementById('resultOrderList');
        let selectedIdx = resultOrderList.selectedIndex;
        let resultOrder = resultOrderList.options[selectedIdx].value;
        FeatureAction.updateOrder(resultOrder);
        TimeSeriesQuerying.showExtractionResults();
    }

    updateKValue() {
        FeatureAction.updateKValue(Number($('#topKResults').val()));
        $('#topKLabelResults').text('Top ' + $('#topKResults').val() + ' results');
        TimeSeriesQuerying.showExtractionResults();
    }

    updateDistanceThreshold() {
        FeatureAction.updateDistanceThreshold($('#distanceThreshold').val());
        TimeSeriesQuerying.showExtractionResults();
    }

    orderOfResults() {
        return (
            <div
                className="form-group form-inline resultMenu"
                style={{float: 'left', marginLeft: '1rem'}}
                onChange={this.updateOrder.bind(this)}>
                <label
                    className="col-form-label col-form-label-sm"
                    style={{marginRight: '0.5rem'}}>Sort results by</label>
                <select
                    id='resultOrderList'
                    className="custom-select custom-select-sm" 
                    style={{width: '7rem'}}>
                    {TimeSeriesQuerying.updateSortResultsPulldown()}
                </select>
            </div>
        );
    }

    distanceThreshold() {
        return (
            <div className='form-group form-inline resultMenu' style={{float: 'left', marginLeft: '1rem'}}>
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
        let disabledFlag = false;
        if (this.state.mode === 'AE') {
            if (this.state.AEOptions.flare || this.state.AEOptions.rotation) {
                disabledFlag = true;
            }
        }
        return (
            <div className='form-group form-inline resultMenu' style={{float: 'left', marginLeft: '1rem'}}>
                <label
                    className="col-form-label col-form-label-sm"
                    style={{marginRight: '0.5rem'}}>Top k result</label>
                <input className="form-control form-control-sm"
                       type="text"
                       placeholder="k value"
                       id="topKResults"
                       disabled={disabledFlag}
                       onChange={this.updateKValue.bind(this)}
                       style={{width: '7rem'}}/>
            </div>
        );
    }

    importResultsButton() {
        return (
            <div
                className="form-group form-inline resultMenu"
                style={{float: 'right'}}>
                <button
                    id='importResultsBtn'
                    className='btn btn-primary btn-sm'
                    onClick={this.importResultsClick.bind(this)}>
                    Import
                </button>
            </div>
        );
    }

    importResultsClick() {
        // from file or storage
        let popupForm = document.getElementById('importResultsForm');
        if (popupForm.style.display === 'block') {
            document.getElementById('importResultsForm').style.display = 'none';
        } else {
            document.getElementById('importResultsForm').style.display = 'block';
        }
    }

    exportResultsButton() {
        return (
            <div
                className="form-group form-inline resultMenu"
                style={{float: 'right'}}>
                <button 
                    id='exportResultsBtn'
                    className='btn btn-primary btn-sm'
                    onClick={this.exportResults.bind(this)}>
                    Export
                </button>
            </div>
        );
    }

    exportResults() {
        let results = {};
        results.query = FeatureStore.getQuery();
        results.query.parameters = FeatureStore.getParameters();
        results.results = [];
        for (let i = 0; i < this.state.shownResults.length; i++) {
            let result = {};
            for (let key in this.state.shownResults[i]) {
                if (key === 'id') {
                    result.fileName = DataStore.getFileName(Number(this.state.shownResults[i][key]));
                } else {
                    result[key] = this.state.shownResults[i][key];
                }
            }
            results.results.push(result);
        }
        results = JSON.stringify(results, null, '\t');
        let filename = 'extractionResults_' + dataLib.createDateLabel() + '.json';
        let blob = new Blob([results], {type: 'application/json'});
        let url = window.URL || window.webkitURL;
        let blobURL = url.createObjectURL(blob);
        let a = document.createElement('a');
        a.download = decodeURI(filename);
        a.href = blobURL;
    
        a.click();
    }
    
    popupCommentForm() {
        return (
            <div className='formPopup' id='commentFormFeatureExtraction'>
                <form className='formContainer'>
                    <h6>User name</h6>
                    <input 
                        type="text" 
                        id='userNameComment'
                        className='form-control form-control-sm' 
                        placeholder="Enter Name" 
                        name="name" required/>
                    <h6>Accessibility</h6>
                    <div
                        className="form-check form-inline"
                        id='accessibility'
                        onChange={this.updateAccessibility.bind(this)}
                        style={{paddingLeft: '0px'}}>
                        <div className="custom-control custom-radio">
                            <input type="radio" id="privateComment" name="accessibility" value='private'
                                checked={(this.state.accessibility === 'private')? true: false}
                                className="custom-control-input" readOnly/>
                            <label className="custom-control-label" htmlFor="privateComment">
                                Private
                            </label>
                        </div>
                        {/* <div className="custom-control custom-radio"
                            style={{marginLeft: '1.5rem'}}>
                            <input type="radio" id="publicComment" name="accessibility" value='public'
                                checked={(this.state.accessibility === 'public')? true: false}
                                disabled={true}
                                className="custom-control-input" readOnly/>
                            <label className="custom-control-label" htmlFor="publicComment">
                                Public
                            </label>
                        </div> */}
                    </div>
                    <h6>Label</h6>
                    <div className="form-check form-check-inline menuItem">
                        <select
                            className="form-control custom-select"
                            id='commentLabelColorList'
                            style={{fontSize: '0.8rem', height: '1.5rem', width: '7rem'}}>
                            <option value='0x29ABE0' style={{color: '#29ABE0'}}>Blue</option>
                            <option value='0x80b139' style={{color: '#80b139'}}>Green</option>
                            <option value='0xffd700' style={{color: '#ffd700'}}>Yellow</option>
                            <option value='0xF47C3C' style={{color: '#F47C3C'}}>Orange</option>
                            <option value='0xd9534f' style={{color: '#d9534f'}}>Red</option>
                            <option value='0xba55d3' style={{color: '#ba55d3'}}>Purple</option>
                        </select>
                    </div>
                    <h6>Comment</h6>
                    <textarea 
                        className="form-control" 
                        id="textareaComment" 
                        placeholder="Enter comment" 
                        rows="3"
                        style={{marginBottom: '0.5rem'}}/>
                    <button
                        className='btn btn-primary btn-sm'
                        type='button'
                        id='submitCommentBtn'
                        onClick={this.submitComment.bind(this)}
                        style={{float: 'right'}}>
                        Submit
                    </button>
                    <button
                        className='btn btn-secondary btn-sm'
                        type='button'
                        id='cancelCommentBtn'
                        style={{float: 'right'}}
                        onClick={this.cancelComment.bind(this)}>
                        Cancel
                    </button>
                </form>
            </div>
        );
    }

    popupImportResultsForm() {
        let queryInfoTable = [];
        if (Object.keys(this.state.importedResults).length > 0) {
            for (let key in this.state.importedResults.query) {
                if (key === 'mode' || key === 'option') {
                    let text = this.state.importedResults.query[key];
                    if (Array.isArray(text)) {
                        text = text.join(', ');
                    }
                    queryInfoTable.push(
                        <tr key={key}>
                            <td>{transformCamelToSentence(key)}</td>
                            <td>{text}</td>
                        </tr>
                    );
                } else if (key === 'query') {
                    for (let keyQuery in this.state.importedResults.query.query) {
                        if (keyQuery !== 'controlPoints' && keyQuery !== 'path' && keyQuery !== 'size' && keyQuery !== 'length') {
                            let textQuery = this.state.importedResults.query.query[keyQuery];
                            if (keyQuery === 'inactiveVariables') {
                                let textTmp = [];
                                for (let i = 0; i < this.state.importedResults.query.query[keyQuery].length; i++) {
                                    textTmp.push(this.state.importedResults.query.query[keyQuery][i].join(', '));
                                }
                                textQuery = textTmp.join(', ');
                            } else if (Array.isArray(textQuery)) {
                                textQuery = textQuery.join(', ');
                            }
                            queryInfoTable.push(
                                <tr key={keyQuery}>
                                    <td>{transformCamelToSentence(keyQuery)}</td>
                                    <td>{textQuery}</td>
                                </tr>
                            );
                        }
                    }
                }
            }
        }
        return (
            <div className='formPopup' id='importResultsForm'>
                <h6>From a file</h6>
                    <div className="custom-file" style={{marginRight: '0.5rem'}}>
                        <input type='file' id='importResultsFile' className='custom-file-input' onChange={this.importResultsFile.bind(this)}/>
                        <label className='custom-file-label' htmlFor='importResultsFile' style={{justifyContent: 'start'}}>Import results</label>
                    </div>
                {/* <h6>From the browser storage</h6> */}
                <div id='importedQueryInfo' style={{display: (Object.keys(this.state.importedResults).length > 0)? 'block': 'none'}}>
                    <h6>Query information</h6>
                    <table id='importedQueryInfoTable' className="table table-hover">
                        <tbody id='importedQueryInfoBody'>
                            {queryInfoTable}
                        </tbody>
                    </table>
                    <div id='importedQueryMenu' style={{float: 'right'}}>
                        <button
                            className='btn btn-primary btn-sm'
                            type='button'
                            id='recoverTheImportedQueryBtn'
                            onClick={this.recoverTheQuery.bind(this)}>
                            Recover the query
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    importResultsFile() {
        let file = document.getElementById('importResultsFile').files;
        let reader = new FileReader();
        reader.readAsText(file[0]);
        reader.onload = function() {
            let contents = JSON.parse(reader.result);
            FeatureAction.importResultsFromFile(contents.results);
            this.setState({
                importedResults: contents
            });
        }.bind(this);
    } 

    recoverTheQuery() {

    }

    updateAccessibility() {
        let selectedAccessibility = $('input[name=accessibility]:checked').val();
        this.setState({
            accessibility: selectedAccessibility
        });
    }

    addComment() {
        document.getElementById('commentFormFeatureExtraction').style.display = 'block';
    }

    cancelComment() {
        document.getElementById('commentFormFeatureExtraction').style.display = 'none';
    }

    submitComment(e) {
        // e.preventDefault();
        let options = {year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false};
        let userName = $('#userNameComment').val(),
            accessibility = this.state.accessibility,
            comment = $('#textareaComment').val(),
            timeStamp = new Date().toLocaleString("en-US", options);
        let colorList = document.getElementById('commentLabelColorList');
        let selectedIdx = colorList.selectedIndex;
        let selectedColor = colorList.options[selectedIdx].value;
        if (accessibility === 'private') {
            let data = {
                timeStamp: timeStamp,
                fileName: DataStore.getData(this.state.selected.id).name,
                userName: userName,
                labelColor: selectedColor,
                start: this.state.selected.start,
                period: ('period' in this.state.selected)? this.state.selected.period: undefined,
                comment: comment,
            }
            dataLib.addCommentData(data, FeatureStore.getQuery(), FeatureStore.getParameters());
        } else if (accessibility == 'public') {
            // ToDo: Store in the database
        }
        // hide the form
        document.getElementById('commentFormFeatureExtraction').style.display = 'none';
        // clear the input forms 
        $('#userNameComment').val('');
        $('#textareaComment').val('');
        DataAction.updatePrivateComment();
    }

    showTT() {
        // switch tab from feature to visualization
        AppAction.selectMenu('visualization');
        // move a tube to the JD and change far value of the camera
        // pass this.state.selected.id & this.state.selected.period
        if (this.state.selected.angle) {
            TimeTubesAction.showRotationCenter(this.state.selected.id, [this.state.selected.start, this.state.selected.start + this.state.selected.period], this.state.selected.center);
        } else if (this.state.selected.period) {
            TimeTubesAction.showTimeTubesOfTimeSlice(this.state.selected.id, [this.state.selected.start, this.state.selected.start + this.state.selected.period]);
        } else {
            TimeTubesAction.searchTime(this.state.selected.id, this.state.selected.start);
        }
    }

    showLegendOfLC() {
        return (
            <svg id='lineChartLegend' height='20px' width='300px'>
                <line x1='0' y1='12' x2='40' y2='12' style={{stroke: '#80b139', strokeWidth: 3}}/>
                <text x='50px' y='15px' fill='black' fontSize='0.8rem'>Query</text>
                <line x1='100' y1='12' x2='140' y2='12' style={{stroke: '#f26418', strokeWidth: 3}}/>
                <text x='150px' y='15px' fill='black' fontSize='0.8rem'>Result</text>
            </svg>
        );
    }

    splitResultsByData() {
        let sortedResults = this.state.shownResults.slice().sort(TimeSeriesQuerying.sortResults('data'));
        let splitedResult = {};
        let i = 0;
        let currentData = [],
            currentDataIdx = sortedResults[0].id;
        while (i < sortedResults.length) {
            if (sortedResults[i].id !== currentDataIdx) {
                splitedResult[currentDataIdx] = currentData;
                currentDataIdx = sortedResults[i].id;
                currentData = [];
            } else {
                currentData.push(sortedResults[i]);
            }
            i++;
        }
        if (currentData.length > 0) {
            splitedResult[currentDataIdx] = currentData;
        }
        return splitedResult;
    }

    render() {
        let lineCharts = [], tbodyDetail = []; 
        if (Object.keys(this.state.selected).length > 0) {
            if (this.state.selected.period && !this.state.selected.angle) {
                let targetData = DataStore.getDataArray(this.state.selected.id, 1);
                let query = FeatureStore.getQuery();
                let timeSlice;
                let minIdx = targetData.z.indexOf(this.state.selected.start),
                    maxIdx = targetData.z.indexOf(this.state.selected.start + this.state.selected.period);
                for (let key in query.values) {
                    if (Array.isArray(query.values[key]) && (Array.isArray(targetData[key]) || key == 'r' || key === 'theta') && key !== 'z') {
                        if (query.values[key].indexOf(null) >= 0) {
                            let flag = false;
                            for (let i = 0; i < query.values[key].length; i++) {
                                if (query.values[key][i]) {
                                    flag = true;
                                    break;
                                }
                            }
                            if (!flag) continue;
                        }
                        let propertyName = key;
                        if (key === 'r') {
                            timeSlice = targetData['PD'].slice(minIdx, maxIdx + 1);
                            propertyName = 'PD';
                        } else if (key === 'theta') {
                            timeSlice = targetData['PA'].slice(minIdx, maxIdx + 1);
                            propertyName = 'PA';
                        } else {
                            timeSlice = targetData[key].slice(minIdx, maxIdx + 1);
                        }
                        lineCharts.push(
                            <LineChart
                                key={key}
                                id={this.state.selected.id}
                                item={propertyName}
                                query={query.values[key]}
                                target={timeSlice}
                                width={this.LCWidth}
                                height={this.LCHeight}
                                path={(typeof(this.optimalWarpPath) === 'Object')? this.optimalWarpPath[key]: this.optimalWarpPath}/>);
                    }
                }
            }
            // set up the table for the detail info
            for (let key in this.state.selected) {
                if (key !== 'id' && key !== 'path' && !Array.isArray(this.state.selected[key])) {
                    let label;
                    if (key === 'V') {
                        label = 'Flx(V)';
                    } else {
                        label = domActions.transformCamelToSentence(key);
                    }  
                    let value = this.state.selected[key];
                    if (typeof(value) === 'object') {
                        let valueLabel = '(';
                        for (let valueKey in value) {
                            valueLabel += formatValue(value[valueKey]) + ', ';
                        }
                        valueLabel = valueLabel.slice(0, valueLabel.length - 2);
                        valueLabel += ')';
                        value = valueLabel;
                    } else if (typeof(value) === 'string') {
                        // do nothing
                    } else if (typeof(value) === 'number') {
                        value = formatValue(value);
                    }
                    tbodyDetail.push(
                        <tr id={'extractionDetail' + label} key={key}>
                            <td>{label}</td>
                            <td id={'extractionDetail' + label + 'Value'}>{value}</td>
                        </tr>
                    );
                } 
            }
            let lookup = DataStore.getData(this.state.selected.id).data.lookup;
            let ignored = FeatureStore.getIgnored();
            if (ignored) {
                let variables = [];
                for (let key in lookup) {
                    if (ignored.indexOf(key) < 0 && key !== 'z') {
                        variables.push(key);
                    }
                }
                let variablesLabel = '';
                for (let i = 0; i < variables.length; i++) {
                    variablesLabel += lookup[variables[i]] + ', ';
                }
                variablesLabel = variablesLabel.slice(0, variablesLabel.length - 2);
                     
                tbodyDetail.push(
                    <tr id={'extractionDetailVariables'} key='variables'>
                        <td>Variables</td>
                        <td id={'extractionDetailVariablesValue'}>{variablesLabel}</td>
                    </tr>
                );
            }
        }
        let timelines = [];
        if (this.state.shownResults.length > 0) {
            // extract the results only shown on the result panel (top k?)

            // and then split results by data
            let splitedResult = this.splitResultsByData();
            for (let key in splitedResult) {
                timelines.push(
                    <div className='row' key={key}>
                        <div className='col-2' 
                            style={{
                                wordWrap: 'anywhere', 
                                position: 'relative', 
                                fontSize: '0.7rem',
                                lineHeight: '90%'}}>
                            <label style={{position: 'absolute', top: '50%', transform: 'translateY(-50%)'}}>
                                {DataStore.getFileName(Number(key))}
                            </label>
                        </div>
                        <div className='col-10' id={'resultTimelineArea_' + key}>
                            <ResultTimeline id={Number(key)} results={splitedResult[key]} height={40}/>
                        </div>
                    </div>);
            }
        }
        return (
            <div id='extractionResults' className='resultElem'>
                <div id='resultMenus' style={{overflow: 'hidden', height: '2rem'}}>
                    {this.topKResults()}
                    {this.distanceThreshold()}
                    {this.orderOfResults()}
                    {this.exportResultsButton()}
                    {this.importResultsButton()}
                    {this.popupImportResultsForm()}
                </div>
                <div id='mainResultArea'>
                    <div
                        id='distanceHistogramArea'
                        className='resultAreaElem'
                        style={{display: (this.state.mode === 'QBE' || this.state.mode === 'QBS')? 'block': 'none'}}>
                        <h5>Distance distribution (number vs. distance)</h5>
                        <label id='topKLabelResults'></label>
                        <DistanceHistogram/>
                    </div>
                    <div
                        id='resultTimelinesArea'
                        className='container resultAreaElem'>
                        {timelines}
                    </div>
                    <div id='resultDetail' style={{position: 'relative', height: '1.5rem', marginBottom: '0px'}}>
                        <div 
                            id='resultDetailArea'
                            className='container'
                            style={{display: 'none'}}>
                            <div className='row'>
                                <div 
                                    className='col-3'
                                    id='extractionDetailThumbnail'>
                                    <canvas
                                        id='detailThumbnailCanvas'></canvas>
                                </div>
                                <div 
                                    className='col-3'
                                    id='extractionDetailInfo'>
                                    <table
                                        id='extractionDetailInfoTable'
                                        style={{width: '100%'}}>
                                        <tbody>
                                            {tbodyDetail}
                                        </tbody>
                                    </table>
                                    <button
                                        className='btn btn-primary btn-sm'
                                        type="button"
                                        id='showTTBtn'
                                        style={{float: 'right'}}
                                        onClick={this.showTT.bind(this)}>
                                        TimeTubes
                                    </button>
                                    <button
                                        className='btn btn-primary btn-sm'
                                        type='button'
                                        id='commentBtn'
                                        style={{float: 'right'}}
                                        onClick={this.addComment.bind(this)}>
                                        Comment
                                    </button>
                                </div>
                                <div
                                    className='col'
                                    id='extractionDetailLC'>
                                    {this.showLegendOfLC()}
                                    {lineCharts}
                                </div>
                            </div>
                        </div>
                        {this.popupCommentForm()}
                        <button
                            id='collapseResultDetailPanel'
                            className="btn btn-primary btn-sm"
                            style={{width: '4rem', height: '1.5rem',position: 'absolute', right: '0.5rem'}}
                            onClick={domActions.toggleExtractionDetailPanel}>
                            Open
                        </button>
                    </div>
                    <label id='matchingStatus'></label>
                    <div id='resultsArea'>
                        {/*{results}*/}
                    </div>
                </div>
            </div>
        );
    }
}
