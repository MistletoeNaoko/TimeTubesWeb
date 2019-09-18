import React from 'react';
import paper from 'paper';
import * as d3 from 'd3';

export default class QueryBySketch extends React.Component{
    constructor(props) {
        super();
        this.path;
    }

    componentDidMount() {
        this.setUpCanvas();
    }

    setUpCanvas() {
        // this.canvas = document.getElementById('QBSSketchPad');
        // console.log(document.getElementById('QBSSketchPad'), d3.select('#QBSSketchPad').node());
        // paper.setup(this.canvas);
        let margin = {"bottom": 20, "left": 20 };
        let outerSize = $('#QBSQuerying').width();
        let width = outerSize - margin.left, height = outerSize - margin.bottom;
        let parentArea = d3.select('#QBSCanvasArea')
            .style('position', 'relative')
            .style('padding-bottom', outerSize + 'px');
        this.canvas = parentArea.append('canvas')
            .attr('width', outerSize + 'px')
            .attr('height', outerSize + 'px')
            .attr('id', 'QBSSketchPad')
            .style('position', 'absolute')
            .style('border', '1px solid lightgray');
        paper.setup(this.canvas.node());

        this.xAxis = parentArea
            .append('g')
            .attr('class', 'x_axis')
            .style('position', 'absolute');
        this.xAxis
            .style('left', outerSize / 2 + 'px')
            .style('top', outerSize - margin.bottom + 'px');
        this.xAxisText = this.xAxis
            .append('text')
            .attr('class', 'axisLabel')
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .text('x');

        this.yAxis = parentArea
            .append('g')
            .attr('class', 'y_axis')
            .style('position', 'absolute');
        this.yAxis
            .style('left', margin.left / 2 + 'px')
            .style('top', outerSize / 2 + 'px');
        this.yAxisText = this.yAxis
            .append('text')
            .attr('class', 'axisLabel')
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .text('y');

        this.tool = new paper.Tool();
        this.tool.onMouseDown = this.CanvasOnMouseDown().bind(this);
        this.tool.onMouseDrag = this.CanvasOnMouseDrag().bind(this);
        this.tool.onMouseUp = this.CanvasOnMouseUp().bind(this);
    }

    CanvasOnMouseDown() {
        return function (event) {
            if (this.path) {
                this.path.selected = false;
            }

            this.path = new paper.Path({
                segments: [event.point],
                strokeColor: 'black',
                fullySelected: true
            });
        }
    }

    CanvasOnMouseDrag() {
        return function (event) {
            this.path.add(event.point);
        }
    }

    CanvasOnMouseUp() {
        return function (event) {
            let segmentCount = this.path.segments.length;

            this.path.simplify(10);

            this.path.fullySelected = true;
        }
    }

    changeXAxis() {

    }

    changeYAxis() {

    }

    render() {
        return (
            <div id='QBSQuerying'>
                <div id='QBSCanvasArea'>
                </div>
                {/*<label id='QBSYAxis'*/}
                       {/*style={{*/}
                           {/*fontSize: '0.8rem',*/}
                           {/*height: '30px',*/}
                           {/*width: width,*/}
                           {/*textAlign: 'center',*/}
                           {/*transform: 'rotate(-90deg) translate(' + -width / 2 + 'px, ' + (-height / 2 + 30 / 2) + 'px)',*/}
                           {/*float: 'left'}}*/}
                       {/*onClick={this.changeYAxis.bind(this)}>y</label>*/}
                {/*<canvas id='QBSSketchPad'*/}
                        {/*style={{*/}
                            {/*width: width - 30,*/}
                            {/*height: height,*/}
                            {/*float: 'right'}}></canvas>*/}
                {/*<div style={{clear: 'both'}}></div>*/}
                {/*<label id='QBSXAxis'*/}
                       {/*style={{*/}
                           {/*fontSize: '0.8rem',*/}
                           {/*width: width,*/}
                           {/*textAlign: 'center'}}*/}
                       {/*onClick={this.changeXAxis.bind(this)}>x</label>*/}
            </div>
        );
    }
}