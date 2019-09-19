import React from 'react';
import paper from 'paper';
import * as d3 from 'd3';

export default class QueryBySketch extends React.Component{
    constructor(props) {
        super();
        // make a complete lookup table for x/y axis selection of the sketch pad
        let lookupList = {};
        props.lookup.forEach(function (e) {
           for (let key in e) {
               if (!lookupList[key]) {
                   lookupList[key] = e[key];
               } else {
                   e[key].forEach(function (ee) {
                       if (lookupList[key].indexOf(ee) < 0) {
                           lookupList[key].push(ee);
                       }
                   });
               }
           }
        });
        this.margin = {"bottom": 20, "left": 20 };
        this.state = {
            xItem: props.xItem,
            yItem: props.yItem,
            xItemonPanel: props.xItem,
            yItemonPanel: props.yItem,
            lookup: lookupList,
            size: 0,
            selector: 'pen'
        }
        this.path = null;
        this.selectedCurve = null;
        this.selectedHandle = null;
        this.selectedPoint = null;
    }

    componentDidMount() {
        this.initCanvas();
        this.initSketchMenu();
    }

    initCanvas() {
        let outerSize = $('#QBSQuerying').width();
        this.setState({
            size: outerSize
        });
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
            .style('top', outerSize - this.margin.bottom + 'px');
        this.xAxisText = this.xAxis
            .append('text')
            .attr('class', 'axisLabel')
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7rem')
            .text(this.state.lookup[this.state.xItem])
            .on('click', this.CanvasXLabelOnClick().bind(this));

        this.yAxis = parentArea
            .append('g')
            .attr('class', 'y_axis')
            .style('position', 'absolute');
        this.yAxis
            .style('left', this.margin.left / 2 + 'px')
            .style('top', outerSize / 2 + 'px');
        this.yAxisText = this.yAxis
            .append('text')
            .attr('class', 'axisLabel')
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7rem')
            .text(this.state.lookup[this.state.yItem])
            .on('click', this.CanvasYLabelOnClick().bind(this));

        this.tool = new paper.Tool();
        this.tool.onMouseMove = this.CanvasOnMouseMove().bind(this);
        this.tool.onMouseDown = this.CanvasOnMouseDown().bind(this);
        this.tool.onMouseDrag = this.CanvasOnMouseDrag().bind(this);
        this.tool.onMouseUp = this.CanvasOnMouseUp().bind(this);
    }

    initSketchMenu() {
        return (
            <form className='selector featureRow' onChange={this.switchSelector.bind(this)}>
                <div className="form-check form-check-inline">
                    <input
                        type="radio"
                        name="QBSSelector"
                        value="pen"
                        checked={this.state.selector === 'pen'} readOnly/>
                    <label className="form-check-label" htmlFor="pen">Pen</label>
                </div>
                <div className="form-check form-check-inline">
                    <input
                        type="radio"
                        name="QBSSelector"
                        value="addPoint"
                        checked={this.state.selector === 'addPoint'} readOnly/>
                    <label className="form-check-label" htmlFor="addPoint">Add points</label>
                </div>
                <div className="form-check form-check-inline">
                    <input
                        type="radio"
                        name="QBSSelector"
                        value="eraser"
                        checked={this.state.selector === 'eraser'} readOnly/>
                    <label className="form-check-label" htmlFor="eraser">Eraser</label>
                </div>
                <div className="form-check form-check-inline">
                    <input
                        type="radio"
                        name="QBSSelector"
                        value="controlPoint"
                        checked={this.state.selector === 'controlPoint'} readOnly/>
                    <label className="form-check-label" htmlFor="controlPoint">Control point</label>
                </div>
            </form>
        );
    }
    
    CanvasOnMouseMove() {
        return function (event) {

        }
    }

    CanvasOnMouseDown() {
        return function (event) {
            let hitResult;
            switch (this.state.selector) {
                case 'pen':
                    if (this.path) {
                        this.path.remove();
                    }

                    this.path = new paper.Path({
                        segments: [event.point],
                        strokeColor: 'black',
                        strokeWidth: 5
                    });
                    break;
                case 'addPoint':
                    hitResult = null;
                    hitResult = this.path.hitTest(event.point, {fill: true, stroke: true, tolerance: 5});
                    if (hitResult) {
                        let curve = hitResult.location.curve;
                        this.path.insert(curve.segment2.index, new paper.Point(event.point.x, event.point.y))
                    }
                    break;
                case 'eraser':
                    hitResult = null;
                    hitResult = this.path.hitTest(event.point, {segments: true, tolerance: 5});
                    if (hitResult) {
                        this.path.removeSegment(hitResult.segment.index);
                    }
                    break;
                case 'controlPoint':
                    hitResult = null;
                    // Hit test on path for handles:
                    hitResult = this.path.hitTest(event.point, {handles: true, tolerance: 5});
                    if (hitResult) {
                        if (hitResult.type == 'handle-in') {
                            this.selectedHandle = hitResult.segment.handleIn;
                        } else if (hitResult.type == 'handle-out') {
                            this.selectedHandle = hitResult.segment.handleOut;
                        }
                    }
                    // if no handles were hit, hit test on points (segments)
                    if (this.selectedHandle == null) {
                        hitResult = this.path.hitTest(event.point, {segments: true, tolerance: 5});
                        if (hitResult) {
                            this.selectedPoint = hitResult.segment;
                        }
                    }
                    break;
            }
        }
    }

    CanvasOnMouseDrag() {
        return function (event) {
            if (this.state.selector === 'pen') {
                this.path.add(event.point);
            } else if (this.state.selector === 'controlPoint') {
                if (this.selectedHandle) {
                    this.selectedHandle.x += event.delta.x;
                    this.selectedHandle.y += event.delta.y;
                }
                if (this.selectedPoint) {
                    this.selectedPoint.point.x += event.delta.x;
                    this.selectedPoint.point.y += event.delta.y;
                }
            }
        }
    }

    CanvasOnMouseUp() {
        return function (event) {
            if (this.state.selector === 'pen') {
                let segmentCount = this.path.segments.length;
                this.path.simplify(10);
            } else if (this.state.selector === 'controlPoint') {
                this.selectedHandle = null;
                this.selectedPoint = null;
            }
        }
    }

    CanvasXLabelOnClick() {
        return function () {
            let panel = d3.select('#changeXAxisPanel_SketchPad');
            if (panel.style('visibility') === 'visible') {
                panel
                    .transition()
                    .duration(50)
                    .style('visibility', 'hidden');
                this.setState({
                    xItemonPanel: this.state.xItem
                });
            } else {
                let divHeight = document.getElementById('changeXAxisPanel_SketchPad').clientHeight;
                let divWidth = document.getElementById('changeXAxisPanel_SketchPad').clientWidth;
                panel
                    .style('transform', 'translate(' + (this.state.size / 2 - divWidth / 2) + 'px,' + (this.state.size - divHeight - this.margin.bottom) + 'px)')
                    .style('visibility', 'visible');
            }
        }
    }

    CanvasYLabelOnClick() {
        return function () {
            let panel = d3.select('#changeYAxisPanel_SketchPad');
            if (panel.style('visibility') === 'visible') {
                panel
                    .transition()
                    .duration(50)
                    .style('visibility', 'hidden');
                this.setState({
                    xItemonPanel: this.state.xItem
                });
            } else {
                let divHeight = document.getElementById('changeYAxisPanel_SketchPad').clientHeight;
                let divWidth = document.getElementById('changeYAxisPanel_SketchPad').clientWidth;
                panel
                    .style('transform', 'translate(' + (this.margin.left + 10) + 'px,' + (this.state.size / 2 - divHeight / 2) + 'px)')
                    .style('visibility', 'visible');
            }
        }
    }

    onSelectXItem(e) {
        this.setState({xItemonPanel: e.target.value});
    }

    onSelectYItem(e) {
        this.setState({yItemonPanel: e.target.value});
    }

    changeXAxis() {
        this.setState({
            xItem: this.state.xItemonPanel
        });
        if (this.xAxisText) {
            this.xAxisText
                .text(this.state.lookup[this.state.xItemonPanel]);
        }
        d3.select('#changeXAxisPanel_SketchPad')
            .transition()
            .duration(50)
            .style('visibility', 'hidden');
    }

    changeYAxis() {
        this.setState({
            yItem: this.state.yItemonPanel
        });
        if (this.yAxisText) {
            this.yAxisText
                .text(this.state.lookup[this.state.yItemonPanel]);
        }
        d3.select('#changeYAxisPanel_SketchPad')
            .transition()
            .duration(50)
            .style('visibility', 'hidden');
    }

    switchSelector() {
        let selectedSelector = $('input[name=QBSSelector]:checked').val();
        this.setState({
            selector: selectedSelector
        });
        if (selectedSelector !== 'pen') {
            this.path.fullySelected = true;
        }
    }

    axisSelectionPanel() {
        let xItems = [], yItems = [];
        for (let key in this.state.lookup) {
            let label = '';
            if (this.state.lookup[key].length > 1) {
                label = this.state.lookup[key].join(',');
            } else {
                label = this.state.lookup[key];
            }
            if (label.indexOf('JD') < 0) {
                xItems.push(
                    <div className='form-check' key={label}>
                        <input
                            type='radio'
                            name='selectXAxis_SketchPad'
                            value={key}
                            checked={this.state.xItemonPanel === key}
                            onChange={this.onSelectXItem.bind(this)}/>
                        <label
                            className="form-check-label"
                            key={label}>
                            {label}
                        </label>
                    </div>
                );
                yItems.push(
                    <div className='form-check' key={label}>
                        <input
                            type='radio'
                            name='selectYAxis_SketchPad'
                            value={key}
                            checked={this.state.yItemonPanel === key}
                            onChange={this.onSelectYItem.bind(this)}/>
                        <label
                            className="form-check-label"
                            key={label}>
                            {label}
                        </label>
                    </div>
                );
            } else {
                xItems.unshift(
                    <div className='form-check' key={label}>
                        <input
                            type='radio'
                            name='selectXAxis_SketchPad'
                            value={key}
                            checked={this.state.xItemonPanel === key}
                            onChange={this.onSelectXItem.bind(this)}/>
                        <label
                            className="form-check-label"
                            key={label}>
                            {label}
                        </label>
                    </div>
                );
                yItems.unshift(
                    <div className='form-check' key={label}>
                        <input
                            type='radio'
                            name='selectYAxis_SketchPad'
                            value={key}
                            checked={this.state.yItemonPanel === key}
                            onChange={this.onSelectYItem.bind(this)}/>
                        <label
                            className="form-check-label"
                            key={label}>
                            {label}
                        </label>
                    </div>
                );
            }
        }
        let xPanel = (
            <div
                className='overlayPanel'
                id='changeXAxisPanel_SketchPad'
                style={{visibility: 'hidden', textAlign: 'center', zIndex: '101'}}>
                <h6>Change x axis</h6>
                <div
                    id='changeXAxisItem_SketchPad'
                    style={{float: 'left', textAlign: 'left'}}>
                    <form id='changeXAxisForm_SketchPad'>
                        {xItems}
                    </form>
                </div>
                <button className="btn btn-secondary btn-sm"
                        id={'changeXAxisBtn_SketchPad'}
                        onClick={this.changeXAxis.bind(this)}>Done</button>
            </div>
        );
        let yPanel = (
            <div
                className='overlayPanel'
                id='changeYAxisPanel_SketchPad'
                style={{visibility: 'hidden', textAlign: 'center', zIndex: '102'}}>
                <h6>Change y axis</h6>
                <div
                    id='changeYAxisItem_SketchPad'
                    style={{float: 'left', textAlign: 'left'}}>
                    <form id='changeYAxisForm_SketchPad'>
                        {yItems}
                    </form>
                </div>
                <button className="btn btn-secondary btn-sm"
                        id={'changeXAxisBtn_SketchPad'}
                        onClick={this.changeYAxis.bind(this)}>Done</button>
            </div>
        );
        return {x: xPanel, y: yPanel};
    }

    render() {
        let axisSelection = this.axisSelectionPanel();
        return (
            <div id='QBSQuerying'>
                <div id='QBSCanvasArea'>
                    {axisSelection.x}
                    {axisSelection.y}
                </div>
                <div id='QBSSketchMenuArea'>
                    {this.initSketchMenu()}
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