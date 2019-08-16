import React from 'react';
import * as d3 from 'd3';
import DataStore from '../Stores/DataStore';

export default class TimeSelector extends React.Component {
    constructor(props) {
        super();
        this.margin = {'top': 10, "bottom": 30, "right": 10, "left": 10};
        this.id = props.id;
        this.divID = props.divID;
        this.data = DataStore.getData(this.id);
        this.width = 500;
        this.height = 200;
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
            // .on("brush end", brushed);

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

        let timeSelector = svg
            .append('g')
            .attr('class', 'timeSelector')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
        timeSelector
            .append('path')
            .datum(this.data.data.color)
            .attr("class", "area")
            .attr("d", timeCurve)
            .attr('clip-path', 'url(#clipTimeSelector)');
        timeSelector
            .append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + height + ")")
            .call(xLabel);
        timeSelector
            .append("g")
            .attr("class", "brush")
            .call(brush)
            .call(brush.move, xScale.range());
    }

    render() {
        return (
            <div>
            </div>
        );
    }
}