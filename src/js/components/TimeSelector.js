import React from 'react';
import * as d3 from 'd3';
import DataStore from '../Stores/DataStore';

export default class TimeSelector extends React.Component {
    constructor(props) {
        super();
        this.margin = {'top': 10, 'bottom': 30, 'right': 10, 'left': 10};
        this.id = props.id;
        this.divID = props.divID;
        this.data = DataStore.getData(this.id);
        this.width = 500;
        this.height = 100;
        // this.drawTimeSelector(this.data);
    }

    componentDidMount() {
        this.drawTimeSelector(this.data);
    }

    drawTimeSelector(data) {
        let id = this.id;
        let parentArea = d3.select('#timeSelectorHolder_' + this.id);
        console.log('timeSelector' + parentArea)
        let elem = parentArea
            .append('div')
            .attr('id', this.divID);
        let outerWidth = this.width, outerHeight = this.height;
        let width = outerWidth - this.margin.left - this.margin.right;
        let height = outerHeight - this.margin.top - this.margin.bottom;

        let xScale = d3.scaleLinear()
            .domain([this.data.data.meta.min['z'], this.data.data.meta.max['z']])
            .range([0, width]);
        let xLabel = d3.axisBottom(xScale);
        let brush = d3.brushX()
            .extent([[0, 0], [width, height]])
            .on('start brush', brushed);

        let yScale = d3.scaleLinear()
            .domain([this.data.data.meta.min['V'], this.data.data.meta.max['V']])
            .range([height, 0]);

        let svg = d3.select('#' + this.divID)
            .append('svg')
            .attr('width', outerWidth)
            .attr('height', outerHeight)
            .attr('class', 'timeSelector');
        svg
            .append('defs')
            .append('clipPath')
            .attr('id', 'clipTimeSelector')
            .append('rect')
            .attr('width', width)
            .attr('height', height);

        let timeCurve = d3.area()
            .curve(d3.curveLinear)
            .x(function (d) {
                return xScale(d.z);
            })
            .y0(height)
            .y1(function (d) {
                return yScale(d.y); // d.y = flx(V)
            });

        // timeSelector
        let timeSelector = svg
            .append('g')
            .attr('class', 'timeSelector')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
        timeSelector
            .append('path')
            .datum(this.data.data.color)
            .attr('class', 'area')
            .attr('d', timeCurve)
            .attr('clip-path', 'url(#clipTimeSelector)');
        timeSelector
            .append('g')
            .attr('class', 'axis axis--x')
            .attr('transform', 'translate(0,' + height + ')')
            .call(xLabel);
        timeSelector
            .append('g')
            .attr('class', 'brush')
            .call(brush)
            .call(brush.move, xScale.range());


        // current line on the TimeSelector
        let drag = d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
        let currentLine = svg
            .append('line')
            .attr('x1', this.margin.left)
            .attr('y1', this.margin.top)
            .attr('x2', this.margin.left)
            .attr('y2', height + this.margin.top)
            .attr('stroke-width', 3)
            .attr('stroke', 'orange')
            .call(drag);

        function brushed() {
            // do something (change the color of selected part of area graph, etc) when brushed
            // if (d3.event.sourceEvent && d3.event.sourceEvent.type === 'zoom') return;
            // let selection = d3.event.selection || xScale.range();
            // if (selection === null) {
            //     // when not selected
            // } else {
            //     // when selected
            //     let sx = selection.map(xScale.invert);
            // }
            // var x0 = xScale.invert(d3.event.selection[0][0]);
            // var y1 = yScale.invert(d3.event.selection[0][1]);
            // var x1 = xScale.invert(d3.event.selection[1][0]);
            // var y0 = yScale.invert(d3.event.selection[1][1]);
            //
        }
        function dragstarted() {
            d3.select(this)
                .classed('selectedLine', true);
        }
        function dragged() {
            let x = d3.event.dx;
            let line = d3.select(this);
            line.attr('x1', d3.event.x)
                .attr('x2', d3.event.x);
        }
        function dragended() {
            d3.select(this)
                .classed('selectedLine', false);
        }
    }

    render() {
        return (
            <div>
            </div>
        );
    }
}