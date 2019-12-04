import React from 'react';
import LineChart from './LineChart';
import ResultTimeline from './ResultTimeline';
import * as domActions from '../lib/domActions';
import * as TimeSeriesQuerying from '../lib/TimeSeriesQuerying';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as AppAction from '../Actions/AppAction';
import FeatureStore from '../Stores/FeatureStore';
import DataStore from '../Stores/DataStore';
import { formatValue } from '../lib/2DGraphLib';

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
            selected: {}
        };

        FeatureStore.on('setExtractionResults', () => {
            let results = FeatureStore.getExtractionResults();
            this.setState({
                results: results
            });
            if ($('#QBESourceMain').css('display') !== 'none') {
                domActions.toggleSourcePanel();
            }
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
    }

    componentDidMount() {
        $('#topKResults').val(20);
    }

    updateOrder() {
        TimeSeriesQuerying.showExtractionResults();
    }

    updateKValue() {
        TimeSeriesQuerying.showExtractionResults();
    }

    updateDistanceThreshold() {
        TimeSeriesQuerying.showExtractionResults();
    }

    orderOfResults() {
        return (
            <div
                className="form-group form-inline"
                style={{float: 'right', marginLeft: '1rem'}}
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
        let disabledFlag = false;
        if (FeatureStore.getMode() === 'AE') {
            if (FeatureStore.getAEOptionStatus('flare') || FeatureStore.getAEOptionStatus('rotations')) {
                disabledFlag = true;
            }
        }
        return (
            <div className='form-group form-inline' style={{float: 'right', marginLeft: '1rem'}}>
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
                let timeSlice = {};
                let minIdx = targetData.z.indexOf(this.state.selected.start),
                    maxIdx = targetData.z.indexOf(this.state.selected.start + this.state.selected.period);
                let query = FeatureStore.getQuery();
                for (let key in query) {
                    if (Array.isArray(query[key]) && Array.isArray(targetData[key]) && key !== 'z') {
                        if (query[key].indexOf(null) >= 0) {
                            let flag = false;
                            for (let i = 0; i < query[key].length; i++) {
                                if (query[key][i]) {
                                    flag = true;
                                    break;
                                }
                            }
                            if (!flag) continue;
                        }
                        timeSlice[key] = targetData[key].slice(minIdx, maxIdx + 1);
                        lineCharts.push(
                            <LineChart
                                key={key}
                                id={this.state.selected.id}
                                item={key}
                                query={query[key]}
                                target={timeSlice[key]}
                                width={this.LCWidth}
                                height={this.LCHeight}
                                path={(typeof(this.optimalWarpPath) === 'Object')? this.optimalWarpPath[key]: this.optimalWarpPath}/>);
                    }
                }
            }
            // set up the table for the detail info
            for (let key in this.state.selected) {
                if (key !== 'id' && !Array.isArray(this.state.selected[key])) {
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
                <div id='resultMenus' style={{overflow: 'hidden'}}>
                    {this.orderOfResults()}
                    {this.distanceThreshold()}
                    {this.topKResults()}
                </div>
                <div id='mainResultArea'>
                    <div
                        id='resultTimelinesArea'
                        className='container'>
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
                                        Show TimeTubes
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
