import React from 'react';
import * as d3 from 'd3';
import FeatureStore from '../Stores/FeatureStore';

export default class DistanceHistogram extends React.Component {
    constructor(prop) {
        super();
        this.height = 100;
        this.margin = {left: 25, right: 10, top: 10, bottom: 22};
        this.results = [];
    }

    render() {
        return (
            <div id='distanceHistogram' style={{width: '100%'}}>

            </div>
        );
    }

    componentDidMount() {
        this.initHistogram();

        FeatureStore.on('updateShownResults', () => {
            let parameters = FeatureStore.getParameters();
            if ('QBE' in parameters || 'QBS' in parameters) {
                this.results = FeatureStore.getExtractionResults();
                this.updateHistogram();
            }
        });
    }

    initHistogram() {
        this.svg = d3.select('#distanceHistogram')
            .append('svg')
            .attr('id', 'distanceHistogramSVG');
        
        this.xScale = d3.scaleLinear();
        this.xAxis = this.svg
            .append('g')
            .attr('class', 'x-axis');

        this.yScale = d3.scaleLinear();
        this.yAxis = this.svg
            .append('g')
            .attr('class', 'y-axis');

        this.tooltip = d3.select('#distanceHistogram')
            .append('div')
            .attr('class', 'tooltip')
            .attr('id', 'tooltipDistanceHistogram')
            .style('opacity', 0.75)
            .style('visibility', 'hidden');
    }

    updateHistogram() {
        let outerWidth = $('#distanceHistogram').width();
        let width = outerWidth - this.margin.left - this.margin.right,
            height = this.height - this.margin.top - this.margin.bottom;

        this.svg
            .attr('width', outerWidth)
            .attr('height', this.height);
        
        let xRange = d3.extent(this.results, d => d.distance);
        xRange[0] = Math.floor(xRange[0]);
        xRange[1] = Math.ceil(xRange[1]);
        this.xScale
            .domain(xRange)
            .range([0, width]);
        this.xLabel = d3.axisBottom(this.xScale);
        this.xAxis
            .attr('transform', 'translate(' + this.margin.left + ',' + (this.margin.top + height) + ')')
            .call(this.xLabel);

        let histogram = d3.histogram()
            .value(function(d) {
                return d.distance;
            })
            .domain(this.xScale.domain())
            .thresholds(this.xScale.ticks(Math.floor(this.results.length / 4)));
        
        let bins = histogram(this.results);

        this.yScale
            .range([height, 0])
            .domain([0, d3.max(bins, function(d) {
                return d.length;
            })]);
        this.yLabel = d3.axisLeft(this.yScale)
            .ticks(5);
        this.yAxis
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .call(this.yLabel);

        // remove previous rectangles before putting new ones
        this.svg
            .selectAll('rect.histogramRect')
            .remove();
        this.bars = this.svg
            .selectAll('rect')
            .data(bins)
            .enter()
            .append('rect')
            .attr('class', 'histogramRect')
            .attr('x', 1)
            .attr('transform', function(d) {
                return 'translate(' + (this.xScale(d.x0) + this.margin.left) + ',' + (this.yScale(d.length) + this.margin.top) + ')';
            }.bind(this))
            .attr('width', function(d) {
                return this.xScale(d.x1) - this.xScale(d.x0) - 1;
            }.bind(this))
            .attr('height', function(d) {
                return height - this.yScale(d.length);
            }.bind(this))
            .style('fill', "#284a6c")
            .style('opacity', 0.75);
    }
}
