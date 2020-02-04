import React from 'react';
import * as d3 from 'd3';
import * as FeatureAction from '../Actions/FeatureAction';
import {showExtractionResults} from '../lib/TimeSeriesQuerying';
import FeatureStore from '../Stores/FeatureStore';

let svgz = require('svg-z-order');

export default class DistanceHistogram extends React.Component {
    constructor(prop) {
        super();
        this.height = 100;
        this.margin = {left: 25, right: 10, top: 5, bottom: 22};
        this.results = [];
        this.bins = [];
        this.dragFlag = false;
        this.handleFlag = false;
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

        this.brushRect = this.svg
            .append('rect')
            .attr('id', 'brushingRectHistogram')
            .style('fill', 'rgb(119, 119, 119)')
            .style('fill-opacity', 0.3);
        this.brushLine = this.svg
            .append('line')
            .attr('id', 'brushingLineHistogram')
            .attr('stroke', '#80b139')
            .attr('stroke-width', 2);

        this.horizontalLine = this.svg
            .append('line')
            .attr('id', 'horizontalLineHistogram')
            .attr('stroke', 'orange')
            .attr('stroke-width', 2)
            .attr("fill", "none")
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
            .thresholds(this.xScale.ticks(Math.min(20, Math.floor(this.results.length / 4))));
        
        this.bins = histogram(this.results);
        this.yScale
            .range([height, 0])
            .domain([0, d3.max(this.bins, function(d) {
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
            .data(this.bins)
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
            .style('opacity', 0.75)
            .on('mouseover', this.mouseOverOnHistogram())
            .on('mouseout', this.mouseOutFromHistogram());

        // decide the width of brushing rect
        let currentKValue = FeatureStore.getKValue();
        let sum = 0;
        for (let i = 0; i < this.bins.length; i++) {
            if (sum + this.bins[i].length >= currentKValue) {
                let rightPos = this.xScale(
                    this.bins[i].x0 + 
                    (this.bins[i].x1 - this.bins[i].x0) / this.bins[i].length * (currentKValue - sum)
                );
                this.brushRect
                    .attr('x', this.margin.left)
                    .attr('y', this.margin.top)
                    .attr('width', rightPos)
                    .attr('height', this.yScale(0));
                this.brushLine
                    .attr('x1', rightPos + this.margin.left)
                    .attr('y1', this.margin.top)
                    .attr('x2', rightPos + this.margin.left)
                    .attr('y2', this.yScale(0) + this.margin.top);
                break;
            } else {
                sum += this.bins[i].length;
                continue;
            }
        }
        let drag = d3.drag()
            .on('start', this.dragStartOnHistogram())
            .on('drag', this.dragOnHistogram())
            .on('end', this.dragEndOnHistogram());
        this.brushLine
            .call(drag);
        svgz.element(this.brushLine.node()).toTop();
    }

    mouseOverOnHistogram() {
        let horizontalLine = this.horizontalLine;
        let xScale = this.xScale,
            yScale = this.yScale;
        let margin = this.margin;
        return function(d) {
            d3.selectAll('rect.histogramRect')
                .style('fill', '#7b7971');
            d3.select(this)
                .style('fill', '#284a6c');
            
            horizontalLine
                .attr('x1', xScale(xScale.domain()[0]) + margin.left)
                .attr('y1', yScale(d.length) + margin.top)
                .attr('x2', xScale(d.x1) + margin.left)
                .attr('y2', yScale(d.length) + margin.top)
                .style('visibility', 'visible');
            svgz.element(horizontalLine.node()).toTop();
        };
    }

    mouseOutFromHistogram() {
        let horizontalLine = this.horizontalLine;
        return function(d) {
            d3.selectAll('rect.histogramRect')
                .style('fill', '#284a6c');
            horizontalLine
                .style('visibility', 'hidden');
        };
    }

    dragStartOnHistogram() {
        return function() {
            d3.select(this)
                .classed('brushingLineHistogram', true);
        };
    }

    dragOnHistogram() {
        let margin = this.margin;
        let graphWidth = this.xScale.range();
        let xScale = this.xScale;
        let bins = this.bins;
        return function() {
            let line = d3.select('#brushingLineHistogram');
            let pos = d3.event.x;
            if (pos <= margin.left) {
                pos = margin.left;
            } else if (margin.left + graphWidth[1] <= pos) {
                pos = margin.left + graphWidth[1];
            }
            line
                .attr('x1', pos)
                .attr('x2', pos);

            d3.select('rect#brushingRectHistogram')
                .attr('width', pos - margin.left);

            let rectWidth = d3.select('rect#brushingRectHistogram')
                .attr('width');
            let rightEdgePos = xScale.invert(rectWidth);
            let displayedNum = 0;
            for (let i = 0; i < bins.length; i++) {
                if (bins[i].x1 <= rightEdgePos) {
                    displayedNum += bins[i].length;
                } else if (bins[i].x0 <= rightEdgePos && rightEdgePos <= bins[i].x1) {
                    let diff = rightEdgePos - bins[i].x0;
                    displayedNum += Math.ceil(bins[i].length * diff / (bins[i].x1 - bins[i].x0));
                    break;
                }
            }

            $('#topKLabelResults').text('Top ' + displayedNum + ' results');
        };
    }

    dragEndOnHistogram() {
        let xScale = this.xScale;
        let bins = this.bins;
        return function() {
            d3.select(this)
                .classed('brushingLineHistogram', true);
                
            let rectWidth = d3.select('rect#brushingRectHistogram')
                .attr('width');
            let rightEdgePos = xScale.invert(rectWidth);
            let displayedNum = 0;
            for (let i = 0; i < bins.length; i++) {
                if (bins[i].x1 <= rightEdgePos) {
                    displayedNum += bins[i].length;
                } else if (bins[i].x0 <= rightEdgePos && rightEdgePos <= bins[i].x1) {
                    let diff = rightEdgePos - bins[i].x0;
                    displayedNum += Math.ceil(bins[i].length * diff / (bins[i].x1 - bins[i].x0));
                    break;
                }
            }
            FeatureAction.updateKValue(displayedNum);
            $('#topKResults').val(displayedNum);
            $('#topKLabelResults').text('Top ' + displayedNum + ' results');
            $('#matchingStatus').text('searching...');
            setTimeout(function() {
                showExtractionResults();
            }.bind(this), 0);
        };
    }
}
