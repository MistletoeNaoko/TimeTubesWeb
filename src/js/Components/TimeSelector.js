import React from 'react';
import * as d3 from 'd3';
import DataStore from '../Stores/DataStore';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as ScatterplotsAction from '../Actions/ScatterplotsAction';
import ScatterplotsStore from '../Stores/ScatterplotsStore';

export default class TimeSelector extends React.Component {
    constructor(props) {
        super();
        this.margin = {'top': 10, 'bottom': 30, 'right': 10, 'left': 10};
        this.id = props.id;
        this.divID = props.divID;
        this.data = DataStore.getData(this.id);
        this.selectedRange = [this.data.data.meta.min.z, this.data.data.meta.max.z];
        this.state = {
            width: props.width,
            height: 100
        };
        // this.drawTimeSelector(this.data);
    }

    componentWillMount() {
        ScatterplotsStore.on('moveCurrentLineonTimeSelector', (id, zpos) => {
           if (id === this.id) {
               this.moveCurrentLine(zpos);
           }
        });
        ScatterplotsStore.on('updateTimeRange', (id, range) => {
            if (id === this.id) {
                this.selectedRange = range;
            }
        });
    }

    componentDidMount() {
        this.initializeElements();
        this.drawTimeSelector();
    }

    initializeElements() {
        this.xScale = d3.scaleLinear()
            .domain([this.data.data.meta.min['z'], this.data.data.meta.max['z']]);
        this.brush = d3.brushX();
        this.yScale = d3.scaleLinear()
            .domain([this.data.data.meta.min['V'], this.data.data.meta.max['V']]);
        this.svg = d3.select('#' + this.divID)
            .append('svg')
            .attr('class', 'timeSelector')
            .attr('id', 'timeSelectorSVG_' + this.id);
        this.clip = this.svg
            .append('defs')
            .append('clipPath')
            .attr('id', 'clipTimeSelector_' + this.id)
            .append('rect');
        this.timeCurve = d3.area()
            .curve(d3.curveLinear);
        this.timeSelector = this.svg
            .append('g')
            .attr('class', 'timeSelector')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
        this.timeSelectorGraph = this.timeSelector
            .append('path')
            .datum(this.data.data.color)
            .attr('class', 'area')
            .attr('clip-path', 'url(#clipTimeSelector_' + this.id + ')');
        this.timeSelectorXAxis = this.timeSelector
            .append('g')
            .attr('class', 'axis axis--x');
        this.timeSelectorBrusher = this.timeSelector
            .append('g')
            .attr('class', 'brush');
        this.currentLine = this.svg
            .append('line')
            .attr('stroke-width', 3)
            .attr('stroke', 'orange')
            .attr('id', 'timeSelectorCurrent_' + this.id);
    }

    drawTimeSelector() {
        let id = this.id;
        let divID = this.divID;
        let outerWidth = this.props.width, outerHeight = this.state.height;
        let width = outerWidth - this.margin.left - this.margin.right;
        let height = outerHeight - this.margin.top - this.margin.bottom;
        let selectedRange = this.selectedRange;
        this.svg
            .attr('width', this.props.width)
            .attr('height', this.state.height);

        this.xScale
            .range([0, width]);
        let xScale = this.xScale;
        let xLabel = d3.axisBottom(this.xScale);
        this.brush
            .extent([[0, 0], [width, height]])
            .on('start brush', brushed.bind(this));

        this.yScale
            .range([height, 0]);

        this.clip
            .attr('width', width)
            .attr('height', height);

        this.timeCurve
            .x(function (d) {
                return this.xScale(d.z);
            }.bind(this))
            .y0(height)
            .y1(function (d) {
                return this.yScale(d.y); // d.y = flx(V)
            }.bind(this));

        // timeSelector
        this.timeSelectorGraph
            .attr('d', this.timeCurve);
        this.timeSelectorXAxis
            .attr('transform', 'translate(0,' + height + ')')
            .call(xLabel);
        this.timeSelectorBrusher
            .call(this.brush)
            .call(this.brush.move, [this.invertScale(this.selectedRange[0]), this.invertScale(this.selectedRange[1])]);
        // current line on the TimeSelector
        let drag = d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged.bind(this))
            .on('end', dragended);
        this.currentLine
            .attr('x1', this.margin.left)
            .attr('y1', this.margin.top)
            .attr('x2', this.margin.left)
            .attr('y2', height + this.margin.top)
            .call(drag);

        function brushed() {
            // do something (change the color of selected part of area graph, etc) when brushed
            let s = d3.event.selection || this.xScale.range;
            let xRange = s.map(this.xScale.invert, this.xScale);
            if ((d3.selectAll('.scatterplots' + this.id).size() > 0) && (xRange.toString() !== this.selectedRange.toString())) {
                ScatterplotsAction.updateTimeRange(this.id, xRange);
            }
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
            let line = d3.select('#timeSelectorCurrent_' + this.id);
            let pos = d3.event.x;
            if (pos <= this.margin.left)
                pos = this.margin.left
            else if (this.margin.left + width <= pos)
                pos = this.margin.left + width;
            line.attr('x1', pos)
                .attr('x2', pos);

            // JD of the position of the current line can be retrieved from xScale.invert(d3.event.x - margin.left)
            let dst = this.xScale.invert(pos - this.margin.left);
            TimeTubesAction.searchTime(this.id, dst);
        }
        function dragended() {
            d3.select(this)
                .classed('selectedLine', false);
        }
    }

    invertScale(val) {
        let range = this.xScale.range();
        let domain = this.xScale.domain();
        return (val - domain[0]) * (range[1] - range[0]) / (domain[1] - domain[0]) + range[0];
    }

    updateTimeSelector() {
        let id = this.id;
        let divID = this.divID;
        let outerWidth = this.props.width, outerHeight = this.state.height;
        let width = outerWidth - this.margin.left - this.margin.right;
        let height = outerHeight - this.margin.top - this.margin.bottom;
        let selectedRange = this.selectedRange;
        this.svg
            .attr('width', this.props.width)
            .attr('height', this.state.height);

        this.xScale
            .range([0, width]);
        let xScale = this.xScale;
        let xLabel = d3.axisBottom(this.xScale);
        this.brush
            .extent([[0, 0], [width, height]]);

        this.yScale
            .range([height, 0]);

        this.clip
            .attr('width', width)
            .attr('height', height);

        this.timeCurve
            .x(function (d) {
                return this.xScale(d.z);
            }.bind(this))
            .y0(height)
            .y1(function (d) {
                return this.yScale(d.y); // d.y = flx(V)
            }.bind(this));

        // timeSelector
        this.timeSelectorGraph
            .attr('d', this.timeCurve);
        this.timeSelectorXAxis
            .attr('transform', 'translate(0,' + height + ')')
            .call(xLabel);
        this.timeSelectorBrusher
            .call(this.brush.move, [this.invertScale(this.selectedRange[0]), this.invertScale(this.selectedRange[1])]);


        // current line on the TimeSelector
        this.currentLine
            .attr('y2', height + this.margin.top);
    }

    moveCurrentLine(zpos) {
        let line = d3.select('#timeSelectorCurrent_' + this.id);
        let pos = this.xScale(zpos) + this.margin.left;

        line.attr('x1', pos)
            .attr('x2', pos);
    }

    render() {
        if (d3.selectAll('svg#timeSelectorSVG_' + this.id).size() > 0) {
            // this.drawTimeSelector();
            this.updateTimeSelector();
        }
        return (
                <div
                    id={this.divID}
                    className='timeSelector outerContainer'>
                </div>
        );
    }
}
