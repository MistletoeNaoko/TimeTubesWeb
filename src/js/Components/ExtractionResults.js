import React from 'react';
import ReactDOM from "react-dom";
import ResultSummary from './ResultSummary';
import LineChart from './LineChart';
import * as domActions from '../lib/domActions';
import * as TimeSeriesQuerying from '../lib/TimeSeriesQuerying';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import FeatureStore from '../Stores/FeatureStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';
import AppStore from '../Stores/AppStore';

export default class ExtractionResults extends React.Component {
    constructor(props) {
        super();

        // this.results = [];
        this.LCWidth = 300;
        this.LCHeight = 200;
        this.state = {
            results: [], 
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
        FeatureStore.on('updateSelectedResult', (id, period, width, height) => {
            this.LCWidth = width;
            this.LCHeight = height;
            this.setState({
                selected: {
                    id: id,
                    period: period
                }
            });
        });
        FeatureStore.on('clearResults', () => {
            this.setState({
                results: []
            });
        });
    }

    componentDidMount() {
        $('#topKResults').val(20);
    }

    updateOrder() {
        console.log('update order');
        TimeSeriesQuerying.showExtractionResults();
    }

    updateKValue() {
        console.log('update k value');
        TimeSeriesQuerying.showExtractionResults();
    }

    updateDistanceThreshold() {
        console.log('distance threshold');
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

    showTT() {
        // switch tab from feature to visualization
        // move a tube to the JD and change far value of the camera
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

    render() {
        let lineCharts = [];
        if (Object.keys(this.state.selected).length > 0) {
            let targetData = DataStore.getDataArray(this.state.selected.id, 1);
            let timeSlice = {};
            let minIdx = targetData.z.indexOf(this.state.selected.period[0]),
                maxIdx = targetData.z.indexOf(this.state.selected.period[1]);
            let query = FeatureStore.getQuery();
            for (let key in query) {
                if (Array.isArray(query[key]) && Array.isArray(targetData[key]) && key !== 'z') {
                    timeSlice[key] = targetData[key].slice(minIdx, maxIdx + 1);
                    lineCharts.push(
                        <LineChart
                            key={key}
                            id={this.state.selected.id}
                            item={key}
                            query={query[key]}
                            target={timeSlice[key]}
                            width={this.LCWidth}
                            height={this.LCHeight}/>);
                }
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
                                            <tr id='extractionDetailPeriod'>
                                                <td>Period (JD)</td>
                                                <td id='extractionDetailPeriodValue'></td>
                                            </tr>
                                            <tr id='extractionDetailDistance'>
                                                <td>Distance</td>
                                                <td id='extractionDetailDistanceValue'></td>
                                            </tr>
                                            <tr id='extractionDetailVariable'>
                                                <td>Variables</td>
                                                <td id='extractionDetailVariableValue'></td>
                                            </tr>
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
                    <div id='resultsArea'>
                        {/*{results}*/}
                    </div>
                </div>
            </div>
        );
    }
}
