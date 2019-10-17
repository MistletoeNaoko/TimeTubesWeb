import React from 'react';
import * as d3 from 'd3';
import {tickFormatting} from '../lib/2DGraphLib';
import FeatureStore from '../Stores/FeatureStore';
import DataStore from '../Stores/DataStore';

export default class LineChart extends React.Component {
    constructor(props) {
        super();
        this.margin = { "top": 30, "bottom": 30, "right": 30, "left": 60 };
        this.id = props.id;
        this.item = props.item;
        this.itemName = DataStore.getData(this.id).data.lookup[this.item];
        this.query = props.query;
        this.target = props.target;
        this.yMinMax = [
            Math.min(Math.min.apply(null, this.query), Math.min.apply(null, this.target)),
            Math.max(Math.max.apply(null, this.query), Math.max.apply(null, this.target))
        ];
        this.state = {
            width: props.width,
            height: props.height,
        }
    }

    componentDidMount() {
        this.initLineChart();
    }

    componentWillUnmount() {
        let parent = document.getElementById('lineChartArea_' + this.id + '_' + this.item);
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
        parent.parentNode.removeChild(parent);
    }

    initLineChart() {
        let width = this.state.width - this.margin.left - this.margin.right,
            height = this.state.height - this.margin.top - this.margin.bottom;
        this.parentArea = d3.select('#lineChartArea_' + this.item);
        this.svg = this.parentArea
            .append('svg')
            .attr('id', 'lineChart_' + this.item)
            .attr('class', 'lineChart')
            .attr('width', this.state.width)
            .attr('height', this.state.height);

        this.graphName = this.svg
            .append('text')
            .attr('x', this.margin.left + width / 2)
            .attr('y', this.margin.top)
            .attr('text-anchor', 'middle')
            .style('fill', 'black')
            .style('font-size', '0.8rem')
            .text(this.itemName);

        this.xScale = d3.scaleLinear()
            .domain([0, Math.max(this.query.length, this.target.length)])
            .nice()
            .range([0, width]);
        this.xLabel = d3.axisBottom(this.xScale)
            // .ticks(10)
            // .tickSize(-height)
            .tickFormat(tickFormatting);
        this.xAxis = this.svg
            .append('g')
            .attr('class', 'x_axis')
            .attr('transform', 'translate(' + this.margin.left + ',' + (this.margin.top +height) + ')')
            .call(this.xLabel);

        this.yScale = d3.scaleLinear()
            .domain(this.yMinMax)
            .nice()
            .range([height, 0]);
        this.yLabel = d3.axisLeft(this.yScale)
            .ticks(5)
            // .tickSize(-width)
            .tickFormat(tickFormatting);
        this.yAxis = this.svg
            .append('g')
            .attr('class', 'y_axis')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .call(this.yLabel);

        this.queryPath = this.svg
            .append('path')
            .datum(this.query)
            .attr('fill', 'none')
            .attr('stroke', '#80b139')
            .attr('stroke-width', 1.5)
            .attr('id', 'lineChartQuery_' + this.item)
            .attr('d', d3.line()
                .x(function (d, i) {
                    return this.xScale(i);
                }.bind(this))
                .y(function(d) {
                    return this.yScale(d);
                }.bind(this))
            )
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

        this.targetPath = this.svg
            .append('path')
            .datum(this.target)
            .attr('fill', 'none')
            .attr('stroke', '#f26418')
            .attr('stroke-width', 1.5)
            .attr('id', 'lineChartTarget_' + this.item)
            .attr('d', d3.line()
                .x(function (d, i) {
                    return this.xScale(i);
                }.bind(this))
                .y(function(d) {
                    return this.yScale(d);
                }.bind(this))
            )
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
    }

    updateLineChart() {
        this.id = this.props.id;
        this.item = this.props.item;
        this.query = this.props.query;
        this.target = this.props.target;
        this.yMinMax = [
            Math.min(Math.min.apply(null, this.query), Math.min.apply(null, this.target)),
            Math.max(Math.max.apply(null, this.query), Math.max.apply(null, this.target))
        ];
        // this.setState({
        //     width: this.props.width,
        //     height: this.props.height
        // });
        this.changeLineChart();
    }

    changeLineChart() {
        console.log('changeLineChart')
        this.xScale
            .domain([0, Math.max(this.query.length, this.target.length)])
            .nice();
        this.xLabel = d3.axisBottom(this.xScale)
            .tickFormat(tickFormatting);
        this.xAxis.call(this.xLabel);

        this.yScale
            .domain(this.yMinMax)
            .nice();
        this.yLabel = d3.axisLeft(this.yScale)
            .ticks(5)
            .tickFormat(tickFormatting);
        this.yAxis.call(this.yLabel);

        this.queryPath
            .datum(this.query)
            .attr('d', d3.line()
                .x(function (d, i) {
                    return this.xScale(i);
                }.bind(this))
                .y(function(d) {
                    return this.yScale(d);
                }.bind(this))
            );
        this.targetPath
            .datum(this.target)
            .attr('d', d3.line()
                .x(function (d, i) {
                    return this.xScale(i);
                }.bind(this))
                .y(function(d) {
                    return this.yScale(d);
                }.bind(this))
            );
    }

    render() {
        if (document.getElementById('lineChartArea_' + this.item)) {
            this.updateLineChart();
        }
        return (
            <div id={'lineChartArea_' + this.item}>

            </div>
        )
    }
}
