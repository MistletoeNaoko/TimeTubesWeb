import React from 'react';
import * as d3 from 'd3';

export default class AutomaticExtraction extends React.Component {
    constructor(props) {
        super();
        this.gaussMargin = {top: 10, bottom: 10, left: 10, right: 10};

        this.state = {
            flare: false,
            flareOption: 'automatic GESD',
            rotation: false,
            anomaly: false
        };
    }

    componentDidMount() {
        document.getElementById('weightForAverageList').selectedIndex = '2';
        this.setGaussCurve();
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

        let data = this.getGaussData(Number(selectedOpt));

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

    getGaussData(sigma) {
        let data = [];
        if (sigma > 0) {
            for (let i = -4; i <= 4; i++) {
                let gauss = Math.exp(-i * i / (2 * sigma * sigma)) / Math.sqrt(2 * Math.PI * sigma * sigma);
                data.push({x: i, y: gauss});
            }
        } else {
            data.push({x: -1, y: 1});
            data.push({x: 1, y: 1});
        }
        return data;
    }

    updateWeight() {
        d3.select('#gaussCurvePath').remove();

        let weightList = document.getElementById('weightForAverageList');
        let selectedIdx = weightList.selectedIndex;
        let selectedOpt = weightList.options[selectedIdx].value;  

        let data = this.getGaussData(Number(selectedOpt));

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

    }

    flareOptions() {
        return (
            <form
                className="form-check"
                id='flareOptions'
                onChange={this.switchFlareOption.bind(this)}
                style={{paddingLeft: '0px'}}>
                <div className="custom-control custom-radio">
                    <input type="radio" id="flareAutomatic" name="flareOptions" value='automatic'
                        checked={this.state.flareOption.indexOf('automatic') >= 0}
                        disabled={!this.state.flare}
                        className="custom-control-input" readOnly/>
                    <label className="custom-control-label" htmlFor="flareAutomatic">
                        Automatic
                    </label>
                    <div className="custom-control custom-checkbox">
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
                    </div>
                </div>
                <div className="custom-control custom-radio">
                    <input type="radio" id="flareManual" name="flareOptions" value='manual'
                        checked={this.state.flareOption === 'manual'}
                        disabled={!this.state.flare}
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
                                id="FlareThreshold"
                                disabled={!this.state.flare}
                                style={{width: '40%', marginRight: '0.5rem'}}/>
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

    switchFlareOption() {
        let flareOption = $('input[name=flareOptions]:checked').val();
        if (flareOption === 'automatic') {
            flareOption += ' GESD';
        }
        this.setState({
            flareOption: flareOption
        });
    }

    selectAutomaticFlareExtractionMode() {
        
    }

    clickFlare() {
        this.setState({
            flare: !this.state.flare
        });
    }

    clickRotation() {
        this.setState({
            rotation: !this.state.rotation
        });
    }

    clickAnomaly() {
        this.setState({
            anomaly: !this.state.anomaly
        });
    }

    render() {
        return (
            <div 
                id='AEQuerying'
                className='controllersElem'>
                <div className="form-group" name='AEModeForm'>
                    <div className="custom-control custom-checkbox">
                        <input 
                            type="checkbox" 
                            className="custom-control-input" 
                            id="flareExtractionCheck"
                            name='AEMode'
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
                        onClick={this.runAutomaticExtraction.bind(this)}>Run</button>
            </div>
        );
    }
}
