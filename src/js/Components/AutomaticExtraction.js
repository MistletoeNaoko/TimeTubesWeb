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
        document.getElementById('stdConstraintsList').selectedIndex = '1';
        this.setGaussCurve();
        // set default values to input forms
        this.setDefaultValues();

        FeatureStore.on('recoverQuery', (query) => {
            if (FeatureStore.getMode() === 'AE') {
                let flare = false, 
                    flareOption = this.state.flareOption, 
                    rotation = false, 
                    anomaly = false;

                if (query.option.indexOf('flare') >= 0) {
                    flare = true;
                    if ('threshold' in query.query) {
                        flareOption = 'manual';
                        $('#flareThreshold').val(query.query.threshold);
                    } else {
                        flareOption = 'automatic ' + query.query.peakFunction;
                        $('#flareLookaround').val(query.query.lookaround);
                        $('#flareSensitivity').val(query.query.sensitivity);
                        $('img[name=peakFunction]').each(function() {
                            $(this).removeClass('selected');
                        });
                        $('#peak' + query.query.peakFunction).addClass('selected');
                    }
                }
                if (query.option.indexOf('rotation') >= 0) {
                    rotation = true;
                    $('#rotationPeriodMin').val(query.query.rotationPeriod[0]);
                    $('#rotationPeriodMax').val(query.query.rotationPeriod[1]);
                    $('#rotationDiameter').val(query.query.rotationDiameter);
                    $('#rotationAngle').val(query.query.rotationAngle);
                    let stdList = document.getElementById('stdConstraintsList');
                    let stdOptions = stdList.options;
                    for (let i = 0; i < stdOptions.length; i++) {
                        if (stdOptions[i].value === query.query.stdOfthePeriod) {
                            stdList.selectedIndex = i;
                            break;
                        }
                    }
                    let weightList = document.getElementById('weightForAverageList');
                    let weightOptions = weightList.options;
                    for (let i = 0; i < weightOptions.length; i++) {
                        if (weightOptions[i].value === query.query.weightForAverage) {
                            weightList.selectedIndex = i;
                            break;
                        }
                    }
                }
                if (query.option.indexOf('anomaly') >= 0) {
                    anomaly = true;
                }
                this.setState({
                    flare: flare,
                    flareOption: flareOption,
                    rotation: rotation,
                    anomaly: anomaly
                });
            }
        });
    }

    setDefaultValues() {
        $('#flareLookaround').val(3);
        $('#flareSensitivity').val(2);
     
        $('#rotationPeriodMin').val(20);
        $('#rotationPeriodMax').val(30);
        $('#rotationAngle').val(270);
        $('#alphaES').val(0.1);
    }

    setGaussCurve() {
        let outerWidth = 150, outerHeight = 150;
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

    clickRunButton() {
        $('#topKLabelResults').text('Top ' + FeatureStore.getKValue() + ' results');
        $('#matchingStatus').text('searching...');
        setTimeout(function() {
            this.runAutomaticExtraction();
        }.bind(this), 0);
    }

    runAutomaticExtraction() {
        let targets = FeatureStore.getTarget();
        let flares, rotations, anomalies;
        let parameters = {};
        let query = {};
        query.mode = 'automatic extraction'
        query.option = [];
        query.query = {};
        if (this.state.flare) {
            query.option.push('flare');
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
                query.query.lookaround = lookaround;
                query.query.sensitivity = sensitivity;
                query.query.peakFunction = method;
            } else if (mode === 'manual') {
                flares = TimeSeriesQuerying.extractFlaresManual(targets, Number($('#flareThreshold').val()));
                query.query.threshold = Number($('#flareThreshold').val());
            }
        }
        if (this.state.rotation) {
            query.option.push('rotation');
            let period = [Number($('#rotationPeriodMin').val()), Number($('#rotationPeriodMax').val())],
                diameter = $('#rotationDiameter').val(),
                angle = $('#rotationAngle').val(),
                alpha = $('#alphaES').val();
            diameter = (diameter === '')? 0: Number(diameter);
            angle = (angle === '')? 0: Number(angle);
            alpha = (alpha === '')? 0.1: Number(alpha);
            // std constraint
            let stdConstraintsList = document.getElementById('stdConstraintsList');
            let selectedIdx = stdConstraintsList.selectedIndex;
            let selectedStdConstraint = stdConstraintsList.options[selectedIdx].value;
            // weight for average
            let weightList = document.getElementById('weightForAverageList');
            selectedIdx = weightList.selectedIndex;
            let selectedSigma = Number(weightList.options[selectedIdx].value);

            rotations = TimeSeriesQuerying.extractRotations(targets, period, diameter, angle, selectedSigma, selectedStdConstraint, alpha);
            query.query.rotationPeriod = period;
            query.query.rotationDiameter = diameter;
            query.query.rotationAngle = angle;
            query.query.stdOfthePeriod = selectedStdConstraint;
            query.query.alpha = alpha;
            query.query.weightForAverage = (selectedSigma === 0)? 'flat': selectedSigma;
        }
        if (this.state.anomaly) {
            query.option.push('anomaly');
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
        } else if (this.state.anomaly && this.state.rotation) {
            // rotations with an anomaly
            // only rotations which include an anomaly in its period
            let i = 0, j = 0;
            let resultTmp;
            while (i < anomalies.length && j < rotations.length) {
                if (rotations[j].id < anomalies[i].id) {
                    j++;
                    continue;
                } else if (anomalies[i].id < rotations[j].id) {
                    i++;
                    continue;
                } else if (rotations[j].start <= anomalies[i].start
                    && anomalies[i].start <= rotations[j].start + rotations[j].period) {
                    resultTmp = rotations[j];
                    if (resultTmp.anomalies === undefined) {
                        resultTmp.anomalies = [];
                    }
                    resultTmp.anomalies.push(anomalies[i]);
                    i++;
                    continue;
                } else if (anomalies[i].start < rotations[j].start) {
                    i++;
                    continue;
                } else if (rotations[j].start + rotations[j].period < anomalies[i].start) {
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
        } else if (this.state.anomaly) {
            results = anomalies;
        }

        // set the extraction results
        FeatureAction.setExtractionResults(undefined, results, query);
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
                    <div className="form-check form-check-inline">
                        <img 
                            id='peakAveMaximum'
                            className='selectorIcon'
                            name="peakFunction"
                            value="AveMaximum"
                            src='img/icons/flare1.png'
                            alt='Average of the maximums among k left & right neightbors'
                            width='80'
                            height='80'
                            title='Average of the maximums among k left & right neightbors'
                            onClick={this.selectFlareAveMaximum.bind(this)} readOnly/>
                        <img 
                            id='peakAveAve'
                            className='selectorIcon selected'
                            name="peakFunction"
                            value="AveAve"
                            src='img/icons/flare2.png'
                            alt='Average of the averages of the signed distance from k left & right neightbors'
                            width='80'
                            height='80'
                            title='Average of the averages of the signed distance from k left & right neightbors'
                            onClick={this.selectFlareAveAve.bind(this)} readOnly/>
                        <img 
                            id='peakAveDist'
                            className='selectorIcon'
                            name="peakFunction"
                            value="AveDist"
                            src='img/icons/flare3.png'
                            alt='Average signed distance from the averages of k neightbors'
                            width='80'
                            height='80'
                            title='Average signed distance from the averages of k neightbors'
                            onClick={this.selectFlareAveDist.bind(this)} readOnly/>
                    </div>
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
                    <div className='col-5' 
                        title='Sx and Sy are standard deviations of the whole data, 
                        sx and sy are those of the time interval'>
                        Standard deviation of the period
                    </div>
                    <div className='col'>
                        <select
                            className="custom-select custom-select-sm"
                            id='stdConstraintsList'
                            style={{width: '60%'}}
                            disabled={!this.state.rotation}>
                            <option value="no">No constraints</option>
                            <option value="and">Sx &lt; sx &cap; Sy &lt; sy</option>
                            <option value="or">Sx &lt; sx &cup; Sy &lt; sy</option>
                            <option value="x">Sx &lt; sx</option>
                            <option value="y">Sy &lt; sy</option>
                        </select>
                    </div>
                </div>
                <div className='row matchingOption'>
                    <div className='col-5'>
                        &#945; of the exponential smoothing
                    </div>
                    <div className='col'>
                        <input className="form-control form-control-sm"
                            type="text"
                            placeholder="alpha"
                            id="alphaES"
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
 
    switchFlareOption() {
        let flareOption = $('input[name=flareOptions]:checked').val();
        if (flareOption === 'automatic') {
            $('img[name=peakFunction]').each(function(i, val) {
                if ($(this).attr('class').indexOf('selected') >= 0) {
                    let id = $(val).attr('id');
                    flareOption += ' ' + id.slice(4, id.length);
                }
            });
        }
        this.setState({
            flareOption: flareOption
        });
    }

    selectFlareAveMaximum() {
        this.setState({
            flareOption: 'automatic AveMaximum'
        });
        // if (this.state.flareOption.indexOf('automatic') >= 0) {
        // }
        $('img[name=peakFunction]').each(function() {
            $(this).removeClass('selected');
        });
        $('#peakAveMaximum').addClass('selected');
    }

    selectFlareAveAve() {
        this.setState({
            flareOption: 'automatic AveAve'
        });
        // if (this.state.flareOption.indexOf('automatic') >= 0) {
        // }
        $('img[name=peakFunction]').each(function() {
            $(this).removeClass('selected');
        });
        $('#peakAveAve').addClass('selected');
    }

    selectFlareAveDist() {
        this.setState({
            flareOption: 'automatic AveDist'
        });
        // if (this.state.flareOption.indexOf('automatic') >= 0) {
        // }
        $('img[name=peakFunction]').each(function() {
            $(this).removeClass('selected');
        });
        $('#peakAveDist').addClass('selected');
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
                <button className="btn btn-primary btn-sm"
                        type="button"
                        id='runAutomaticExtractionBtn'
                        style={{float: 'right'}}
                        onClick={this.clickRunButton.bind(this)}>Run</button>
            </div>
        );
    }
}
