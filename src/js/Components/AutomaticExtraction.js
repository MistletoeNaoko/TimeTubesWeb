import React from 'react';
import * as d3 from 'd3';
import * as mathLib from '../lib/mathLib';
import * as TimeSeriesQuerying from '../lib/TimeSeriesQuerying';
import * as FeatureAction from '../Actions/FeatureAction';
import FeatureStore from '../Stores/FeatureStore';
import TimeTubes from './TimeTubes';

export default class AutomaticExtraction extends React.Component {
    constructor(props) {
        super();
        this.gaussMargin = {top: 10, bottom: 10, left: 10, right: 10};

        this.state = {
            flare: false,
            flareOption: 'automatic AveAve',
            rotation: false,
            anomaly: false
        };
    }

    componentDidMount() {
        document.getElementById('weightForAverageList').selectedIndex = '2';
        this.setGaussCurve();
        // set default values to input forms
        this.setDefaultValues();
    }

    setDefaultValues() {
        $('#flareLookaround').val(3);
        $('#flareSensitivity').val(2);
     
        $('#rotationPeriodMin').val(20);
        $('#rotationPeriodMax').val(30);
        $('#rotationAngle').val(270);
    }

    setGaussCurve() {
        let outerWidth = 200, outerHeight = 200;
        let width = outerWidth - this.gaussMargin.left - this.gaussMargin.right,
            height = outerHeight - this.gaussMargin.top - this.gaussMargin.bottom;

        let svg = d3.select('#gaussCurveArea')
            .append('svg')
            .attr('width', outerWidth)
            .attr('height', outerHeight)
            .attr('id', 'gaussCurve');

        svg
            .append('rect')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('stroke', 'lightgray')
            .attr('transform', 'translate(' + this.gaussMargin.left + ',' + this.gaussMargin.top + ')');

        // scales
        this.xScaleGauss = d3.scaleLinear()
            .range([0, width]);
        this.yScaleGauss = d3.scaleLinear()
            .range([height, 0]);

        let weightList = document.getElementById('weightForAverageList');
        let selectedIdx = weightList.selectedIndex;
        let selectedOpt = weightList.options[selectedIdx].value;  

        let data = mathLib.getGaussData(Number(selectedOpt));

        this.xScaleGauss
            .domain([d3.min(data, d => d.x), d3.max(data, d => d.x)]);
        this.yScaleGauss
            .domain([d3.min(data, d => d.y), d3.max(data, d => d.y)]);
        
        this.gaussPath = svg.append('path')
            .datum(data)
            .style('fill', 'none')
            .style('stroke', 'lightcoral')
            .style('stroke-width', 3)
            .attr('id', 'gaussCurvePath')
            .attr('transform', 'translate(' + this.gaussMargin.left + ',' + this.gaussMargin.top + ')')
            .attr('d', d3.line()
                .x(function(d) {
                    return this.xScaleGauss(d.x);
                }.bind(this))
                .y(function(d) {
                    return this.yScaleGauss(d.y);
                }.bind(this))
                .curve(d3.curveBasis)
            );
    }

    updateWeight() {
        d3.select('#gaussCurvePath').remove();

        let weightList = document.getElementById('weightForAverageList');
        let selectedIdx = weightList.selectedIndex;
        let selectedOpt = weightList.options[selectedIdx].value;  

        let data = mathLib.getGaussData(Number(selectedOpt));

        this.xScaleGauss
            .domain([d3.min(data, d => d.x), d3.max(data, d => d.x)]);
        this.yScaleGauss
            .domain([d3.min(data, d => d.y), d3.max(data, d => d.y)]);
        
        this.gaussPath = d3.select('#gaussCurve')
            .append('path')
            .datum(data)
            .style('fill', 'none')
            .style('stroke', 'lightcoral')
            .style('stroke-width', 3)
            .attr('id', 'gaussCurvePath')
            .attr('transform', 'translate(' + this.gaussMargin.left + ',' + this.gaussMargin.top + ')')
            .attr('d', d3.line()
                .x(function(d) {
                    return this.xScaleGauss(d.x);
                }.bind(this))
                .y(function(d) {
                    return this.yScaleGauss(d.y);
                }.bind(this))
                .curve(d3.curveBasis)
            );    
    }

    runAutomaticExtraction() {
        let targets = FeatureStore.getTarget();
        let flares, rotations, anomalies;
        if (this.state.flare) {
            let mode = this.state.flareOption.split(' ')[0];
            if (mode === 'automatic') {
                let method = this.state.flareOption.split(' ')[1];
                let lookaround = $('#flareLookaround').val(),
                    sensitivity = $('#flareSensitivity').val();
                if (lookaround !== '' && sensitivity !== '') {
                    lookaround = Number(lookaround);
                    sensitivity = Number(sensitivity);   
                    flares = TimeSeriesQuerying.extractFlares(targets, method, lookaround, sensitivity);
                }
            } else if (mode === 'manual') {
                flares = TimeSeriesQuerying.extractFlaresManual(targets, Number($('#flareThreshold').val()));
            }
        }
        if (this.state.rotation) {
            let period = [Number($('#rotationPeriodMin').val()), Number($('#rotationPeriodMax').val())],
                diameter = $('#rotationDiameter').val(),
                angle = $('#rotationAngle').val();
            diameter = (diameter === '')? 0: Number(diameter);
            angle = (angle === '')? 0: Number(angle);
            let weightList = document.getElementById('weightForAverageList');
            let selectedIdx = weightList.selectedIndex;
            let selectedSigma = Number(weightList.options[selectedIdx].value);

            rotations = TimeSeriesQuerying.extractRotations(targets, period, diameter, angle, selectedSigma);
        }
        if (this.state.anomaly) {
            anomalies = TimeSeriesQuerying.extractAnomalies(targets);
        }

        let results = [];
        if (this.state.flare && this.state.rotation) {
            // rotations with a flare
            // only rotations which include a flare in its period
            let i = 0, j = 0;
            let resultTmp;
            while (i < flares.length && j < rotations.length) {
                if (rotations[j].id < flares[i].id) {
                    j++;
                    continue;
                } else if (flares[i].id < rotations[j].id) {
                    i++;
                    continue;
                } else if (rotations[j].start <= flares[i].start
                    && flares[i].start <= rotations[j].start + rotations[j].period) {
                    resultTmp = rotations[j];
                    if (resultTmp.flares === undefined) {
                        resultTmp.flares = [];
                    }
                    resultTmp.flares.push(flares[i]);
                    i++;
                    continue;
                } else if (flares[i].start < rotations[j].start) {
                    i++;
                    continue;
                } else if (rotations[j].start + rotations[j].period < flares[i].start) {
                    if (resultTmp) {
                        results.push(resultTmp);
                        resultTmp = null;
                    }
                    j++;
                    continue;
                }
            }
            if (resultTmp) {
                results.push(resultTmp);
            }
        } else if (this.state.flare) {
            results = flares;
        } else if (this.state.rotation) {
            results = rotations;
        }

        if (this.state.anomaly) {
            results = anomalies;
        }

        // set the extraction results
        FeatureAction.setExtractionResults(results);
        // show the result thumbnails
        TimeSeriesQuerying.setDefaltOrderOfResults();
        TimeSeriesQuerying.showExtractionResults();
    }

    flareOptions() {
        return (
            <form
                className="form-check"
                id='flareOptions'
                style={{paddingLeft: '0px'}}>
                <div className="custom-control custom-radio">
                    <input type="radio" id="flareAutomatic" name="flareOptions" value='automatic'
                        checked={this.state.flareOption.indexOf('automatic') >= 0}
                        disabled={!this.state.flare}
                        onChange={this.switchFlareOption.bind(this)}
                        className="custom-control-input" readOnly/>
                    <label className="custom-control-label" htmlFor="flareAutomatic">
                        Automatic
                    </label>
                    <h6>Parameters</h6>
                    <div className='container'
                        style={{paddingRight: '0px', paddingLeft: '0px', marginBottom: '0.2rem'}}></div>
                        <div className='row matchingOption'>
                            <div className='col-5'>
                                Lookaround
                            </div>
                            <div className='col form-inline'>
                                <input className="form-control form-control-sm"
                                        type="text"
                                        placeholder="k neightbors"
                                        id="flareLookaround"
                                        disabled={!this.state.flare}
                                        style={{width: '7rem', marginRight: '0.5rem'}}/>
                            </div>
                        </div>
                        <div className='row matchingOption'>
                            <div className='col-5'>
                                Sensitivity cutoff
                            </div>
                            <div className='col form-inline'>
                                <input className="form-control form-control-sm"
                                        type="text"
                                        placeholder="h"
                                        id="flareSensitivity"
                                        disabled={!this.state.flare}
                                        style={{width: '7rem', marginRight: '0.5rem'}}/>
                            </div>
                        </div>
                    {/* </div> */}
                    <h6>Peak function</h6>
                    <div className="custom-control custom-checkbox">
                        <input 
                            type="checkbox" 
                            className="custom-control-input" 
                            id="AveMaximumCheck"
                            disabled={!this.state.flare}
                            onChange={this.selectFlareAveMaximum.bind(this)}
                            checked={this.state.flareOption.indexOf('AveMaximum') >= 0}/>
                        <label className="custom-control-label" htmlFor="AveMaximumCheck">
                            Average of the maximums among k left & right neightbors
                        </label>
                    </div>
                    <div className="custom-control custom-checkbox">
                        <input 
                            type="checkbox" 
                            className="custom-control-input" 
                            id="AveAveCheck"
                            disabled={!this.state.flare}
                            onChange={this.selectFlareAveAve.bind(this)}
                            checked={this.state.flareOption.indexOf('AveAve') >= 0}/>
                        <label className="custom-control-label" htmlFor="AveAveCheck">
                            Average of the averages of the signed distance from k left & right neightbors
                        </label>
                    </div>
                    <div className="custom-control custom-checkbox">
                        <input 
                            type="checkbox" 
                            className="custom-control-input" 
                            id="AveDistCheck"
                            disabled={!this.state.flare}
                            onChange={this.selectFlareAveDist.bind(this)}
                            checked={this.state.flareOption.indexOf('AveDist') >= 0}/>
                        <label className="custom-control-label" htmlFor="AveDistCheck">
                            Average signed distance from the averages of k neightbors
                        </label>
                    </div>

                    {/* <div className="custom-control custom-checkbox">
                        <input 
                            type="checkbox" 
                            className="custom-control-input" 
                            id="GESDCheck"
                            disabled={!this.state.flare}
                            onChange={this.selectAutomaticFlareExtractionMode.bind(this)}
                            checked={this.state.flareOption.indexOf('GESD') >= 0}/>
                        <label className="custom-control-label" htmlFor="GESDCheck">Generalized ESD</label>
                    </div>
                    <div className='row matchingOption'>
                        <div className='col-5'>
                            Significance level (α)
                        </div>
                        <div className='col'>
                            <input className="form-control form-control-sm"
                                type="text"
                                placeholder="α value"
                                id="alphaValueForGESD"
                                disabled={!this.state.flare}
                                style={{width: '40%', marginRight: '0.5rem'}}/>
                        </div>
                    </div> */}
                </div>
                <div className="custom-control custom-radio">
                    <input type="radio" id="flareManual" name="flareOptions" value='manual'
                        checked={this.state.flareOption === 'manual'}
                        disabled={!this.state.flare}
                        onChange={this.switchFlareOption.bind(this)}
                        className="custom-control-input" readOnly/>
                    <label className="custom-control-label" htmlFor="flareManual">
                        Manual
                    </label>
                    <div className='row matchingOption'>
                        <div className='col-5'>
                            Intensity Threshold
                        </div>
                        <div className='col'>
                            <input className="form-control form-control-sm"
                                type="text"
                                placeholder="threshold"
                                id="flareThreshold"
                                disabled={!this.state.flare}
                                style={{width: '7rem', marginRight: '0.5rem'}}/>
                        </div>
                    </div>
                </div>
            </form>
        );
    }

    rotationOptions() {
        return (
            <div className='container'
                style={{paddingRight: '0px', paddingLeft: '0px', marginBottom: '0.2rem'}}>
                <div className="row matchingOption"> 
                    <div className='col-5'>
                        Rotation period
                    </div>
                    <div className='col form-inline'>
                        <input className="form-control form-control-sm"
                            type="text"
                            placeholder="min"
                            id="rotationPeriodMin"
                            disabled={!this.state.rotation}
                            style={{width: '20%', marginRight: '0.5rem'}}/>
                        ~
                        <input className="form-control form-control-sm"
                            type="text"
                            placeholder="max"
                            id="rotationPeriodMax"
                            disabled={!this.state.rotation}
                            style={{width: '20%', marginRight: '0.5rem', marginLeft: '0.5rem'}}/>
                        <label className="col-form-label col-form-label-sm"> days</label>
                    </div>
                </div>
                <div className='row matchingOption'>
                    <div className='col-5'>
                        Rotation diameter
                    </div>
                    <div className='col form-inline'>
                        <input className="form-control form-control-sm"
                                type="text"
                                placeholder="diameter"
                                id="rotationDiameter"
                                disabled={!this.state.rotation}
                                style={{width: '40%', marginRight: '0.5rem'}}/>
                    </div>
                </div>
                <div className='row matchingOption'>
                    <div className='col-5'>
                        Rotation angle
                    </div>
                    <div className='col form-inline'>
                        <input className="form-control form-control-sm"
                                type="text"
                                placeholder="angle"
                                id="rotationAngle"
                                disabled={!this.state.rotation}
                                style={{width: '40%', marginRight: '0.5rem'}}/>
                    </div>
                </div>
                <div className='row matchingOption'>
                    <div className='col-5'>
                        Weight for average
                    </div>
                    <div className='col'>
                        <select
                            className="custom-select custom-select-sm"
                            id='weightForAverageList'
                            style={{width: '60%'}}
                            disabled={!this.state.rotation}
                            onChange={this.updateWeight.bind(this)}>
                            <option value="0">Flat (arithmetic mean)</option>
                            <option value="1">σ=1</option>
                            <option value="3">σ=3</option>
                            <option value="5">σ=5</option>
                        </select>
                    </div>
                </div>
                <div id='gaussCurveArea' style={{textAlign: 'center'}}>
                </div>
            </div>
        );
    }

    // extractionOptions() {
    //     return (
    //         <div id='extractionOptions'>
    //             <h5>Extraction options</h5>
    //             <div className="row matchingOption">
    //                 <div className='col-5'>
    //                     Step size of sliding window
    //                 </div>
    //                 <div className='col form-inline'>
    //                     <input className="form-control form-control-sm"
    //                         type="text"
    //                         placeholder="step size"
    //                         id="stepSizeOfSlidingWindow"
    //                         style={{width: '40%', marginRight: '0.5rem'}}/>
    //                     <label className="col-form-label col-form-label-sm"> days</label>
    //                 </div>
    //             </div>
    //         </div>
    //     );
    // }
 
    switchFlareOption() {
        let flareOption = $('input[name=flareOptions]:checked').val();
        this.setState({
            flareOption: flareOption
        });
    }

    selectFlareMethod() {
        let flareMethod = $('input[name=flareMethods]:checked').val();
        this.setState({
            flareOption: 'automatic ' + flareMethod
        })
    }

    selectFlareAveMaximum() {
        this.setState({
            flareOption: 'automatic AveMaximum'
        });
        if (this.state.flareOption.indexOf('automatic') >= 0) {
        }
    }

    selectFlareAveAve() {
            this.setState({
                flareOption: 'automatic AveAve'
            });
        if (this.state.flareOption.indexOf('automatic') >= 0) {
        }
    }

    selectFlareAveDist() {
            this.setState({
                flareOption: 'automatic AveDist'
            });
        if (this.state.flareOption.indexOf('automatic') >= 0) {
        }
    }

    clickFlare() {
        let state = !this.state.flare;
        this.setState({
            flare: state
        });
        FeatureAction.updateAEOption('flare', state);
    }

    clickRotation() {
        let state = !this.state.rotation;
        this.setState({
            rotation: state
        });
        FeatureAction.updateAEOption('rotation', state);
    }

    clickAnomaly() {
        let state = !this.state.anomaly;
        this.setState({
            anomaly: state
        });
        FeatureAction.updateAEOption('anomaly', state);
    }

    render() {
        return (
            <div 
                id='AEQuerying'
                className='featureArea'
                style={{padding: '15px'}}>
                <div className="form-group" name='AEModeForm'>
                    <div className="custom-control custom-checkbox">
                        <input 
                            type="checkbox" 
                            className="custom-control-input" 
                            id="flareExtractionCheck"
                            name='AEMode'
                            value='flare'
                            onChange={this.clickFlare.bind(this)}
                            checked={this.state.flare}/>
                        <label className="custom-control-label" htmlFor="flareExtractionCheck">Flare</label>
                        {this.flareOptions()}
                    </div>
                    <div id='rotationExtraction'>
                        <div className="custom-control custom-checkbox">
                            <input 
                                type="checkbox" 
                                className="custom-control-input" 
                                id="rotationExtractionCheck"
                                name='AEMode'
                                value='rotation'
                                onChange={this.clickRotation.bind(this)}
                                checked={this.state.rotation}/>
                            <label className="custom-control-label" htmlFor="rotationExtractionCheck">Rotation</label>
                        </div>
                        {this.rotationOptions()}
                    </div>
                    <div className="custom-control custom-checkbox">
                        <input 
                            type="checkbox" 
                            className="custom-control-input" 
                            name='AEMode'
                            value='anomaly'
                            id="anomalyExtractionCheck"
                            onChange={this.clickAnomaly.bind(this)}
                            checked={this.state.anomaly}/>
                        <label className="custom-control-label" htmlFor="anomalyExtractionCheck">Anomaly</label>
                    </div>
                </div>
                {/* {this.extractionOptions()} */}
                <button className="btn btn-primary btn-sm"
                        type="button"
                        id='runAutomaticExtractionBtn'
                        style={{float: 'right'}}
                        onClick={this.runAutomaticExtraction.bind(this)}>Run</button>
            </div>
        );
    }
}
