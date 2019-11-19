import React from 'react';
import * as d3 from 'd3';

export default class AutomaticExtraction extends React.Component {
    constructor(props) {
        super();
        this.gaussMargin = {top: 10, bottom: 10, left: 10, right: 10};
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
            for (let i = -5; i <= 5; i++) {
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

    render() {
        return (
            <div 
                id='automaticExtractionQuerying'
                className='controllersElem'>
                <div className="custom-control custom-checkbox">
                    <input type="checkbox" className="custom-control-input" id="flareExtractionCheck"/>
                    <label className="custom-control-label" htmlFor="flareExtractionCheck">Flare</label>
                </div>
                <div id='rotationExtraction'>
                    <div className="custom-control custom-checkbox">
                        <input type="checkbox" className="custom-control-input" id="rotationExtractionCheck"/>
                        <label className="custom-control-label" htmlFor="rotationExtractionCheck">Rotation</label>
                    </div>
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
                                    style={{width: '20%', marginRight: '0.5rem'}}/>
                                ~
                                <input className="form-control form-control-sm"
                                    type="text"
                                    placeholder="max"
                                    id="rotationPeriodMax"
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
                </div>
                <div className="custom-control custom-checkbox">
                    <input type="checkbox" className="custom-control-input" id="anomalyExtractionCheck"/>
                    <label className="custom-control-label" htmlFor="anomalyExtractionCheck">Anomaly</label>
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
