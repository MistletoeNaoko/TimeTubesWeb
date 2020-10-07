import React from 'react';
import * as domActions from '../lib/domActions';
import {formatValue} from '../lib/2DGraphLib';
import {resizeExtractionResultsArea} from '../Actions/AppAction';
import * as FeatureAction from '../Actions/FeatureAction';
import * as d3 from 'd3';
import {isEqual} from 'lodash';
import FeatureStore from '../Stores/FeatureStore';
import DataStore from '../Stores/DataStore';

export default class ResultSummary extends React.Component {
    constructor(props) {
        super();
        this.id = props.id;
        this.fileName = DataStore.getFileName(this.id);
        this.thumbnail = props.thumbnail;
        this.result = props.result;
        // this.period = props.period;
        // this.distance = props.distance;
        this.rank = props.rank;
        // this.path = props.path;
        this.ignored = FeatureStore.getIgnored();
        this.lookup = DataStore.getData(this.id).data.lookup;
        this.variables = [];
        // relative position on the result summary panel
        this.clickedX = null;
        this.clickedY = null;
        // flag to identify whether the action is click or mousedown
        this.moved = false;
        if (this.ignored) {
            for (let key in this.lookup) {
                if (this.ignored.indexOf(key) < 0 && key !== 'z') {
                    this.variables.push(key);
                }
            }
        }
    }

    componentDidMount() {
        // append image to the imageHolder
        let canvas = document.getElementById('resultSummaryCanvas_' + this.rank);
        let ctx = canvas.getContext('2d');
        let size = Math.min(this.thumbnail.height, this.thumbnail.width);
        let px = this.thumbnail.width / 2 - size / 2,
            py = this.thumbnail.height / 2 - size / 2;
        this.thumbnail.onload = function() {
            ctx.drawImage(
                this.thumbnail,
                px, py,
                size, size,
                0, 0,
                300, 150);// why 300? the width of canvas seems to be 300px
        }.bind(this);

        document.getElementById('resultSummary_' + this.rank).addEventListener('mousedown', this.onMouseDownOnResultSummary.bind(this), false);

        FeatureStore.on('focusResultFromTimeline', (result) => {
            let flag = false;
            // check the focused result is the same with this result
            if (result.V !== undefined && this.result.flares) {
                for (let i = 0; i < this.result.flares.length; i++) {
                    if (isEqual(this.result.flares[i], result)) {
                        flag = true;
                        break;
                    }
                }
            } else {
                if (isEqual(this.result, result)) {
                    flag = true;
                }
            }
            // if they are same, highlight a result summary panel
            if (flag) {
                d3.select('#resultSummary_' + this.rank)
                    .transition()
                    .duration(300)
                    .style('border', '1px solid #d23430')
                    .transition()
                    .duration(1000)
                    .style('border', '1px solid rgba(223, 215, 202, 0.75)');
            }
        });

        FeatureStore.on('selectResultFromTimeline', (result) => {
            let flag = false;
            // check the focused result is the same with this result
            if (result.V !== undefined && this.result.flares) {
                for (let i = 0; i < this.result.flares.length; i++) {
                    if (isEqual(this.result.flares[i], result)) {
                        flag = true;
                        break;
                    }
                }
            } else {
                if (isEqual(this.result, result)) {
                    flag = true;
                }
            }
            // if they are same, highlight a result summary panel and show detail
            if (flag) {
                d3.select('#resultSummary_' + this.rank)
                    .transition()
                    .duration(300)
                    .style('border', '1px solid #d23430')
                    .transition()
                    .duration(1000)
                    .style('border', '1px solid rgba(223, 215, 202, 0.75)');

                this.showDetails();
            }
        });
    }

    showFileName() {
        return (
            <div style={{wordWrap: 'anywhere'}}>
                <label>
                    {this.fileName}
                </label>
            </div>
        );
    }

    showThumbnail() {
        return (
            <canvas
                id={'resultSummaryCanvas_' + this.rank}
                className='resultSummaryCanvas'>
            </canvas>
        );
    }

    showPeriod() {
        if (this.result.period) {
            return (
                <div className='row'>
                    <div className='col4'>
                        <label>Period</label>
                    </div>
                    <div className='col'>
                        {Math.floor(this.result.start)} - {Math.ceil(this.result.start + this.result.period)}
                    </div>
                </div>
            );
        } else {
            return (
                <div className='row'>
                    <div className='col4'>
                        <label>JD</label>
                    </div>
                    <div className='col'>
                        {Math.floor(this.result.start)}
                    </div>
                </div>
            );
        }
    }

    showDistance() {
        if (!isNaN(this.result.distance)) {
            return (
                <div className='row'>
                    <div className='col4'>
                        <label>Distance</label>
                    </div>
                    <div className='col'>
                        {formatValue(this.result.distance)}
                    </div>
                </div>
            );
        } else if (!isNaN(this.result.V)) {
            return (
                <div className='row'>
                    <div className='col4'>
                        <label>Intensity</label>
                    </div>
                    <div className='col'>
                        {formatValue(this.result.V)}
                    </div>
                </div>
            );
        } else if (!isNaN(this.result.angle)) {
            return (
                <div className='row'>
                    <div className='col4'>
                        <label>Angle</label>
                    </div>
                    <div className='col'>
                        {formatValue(this.result.angle)}
                    </div>
                </div>
            );
        }
    }

    showDetails() {
        if ($('#resultDetailArea').css('display') === 'none') {
            domActions.toggleExtractionDetailPanel();
        }
        let canvas = document.getElementById('detailThumbnailCanvas');
        let size = $('#extractionDetailThumbnail').width();
        $('#detailThumbnailCanvas').width(size);
        $('#detailThumbnailCanvas').height(size);
        let ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        let square = Math.min(this.thumbnail.height, this.thumbnail.width);
        let px = this.thumbnail.width / 2 - square / 2,
            py = this.thumbnail.height / 2 - square / 2;
        // TODO: the size of the image is converted into 300 * 150
        ctx.drawImage(
            this.thumbnail,
            px, py,
            square, square,
            0, 0,
            300, 150
        );
        $('#extractionDetailLC').height(size);
    }

    onMouseDownOnResultSummary(event) {
        this.moved = false;
        let elem = document.getElementById('resultSummaryHolder_' + this.rank);
        elem.classList.add('drag');
        let child = document.getElementById('resultSummary_' + this.rank);
        this.clickedX = event.pageX - child.offsetLeft;
        this.clickedY = event.pageY - child.offsetTop;
    
        document.body.addEventListener('mousemove', this.onMouseMoveOnResultSummary.bind(this), false);
        // TODO: To avoid unexpected behaviors related to fact-guided querying, the following code is temporally commented out.
        // document.body.addEventListener('mouseleave', this.onMouseUpFromResultSummary.bind(this), false);
        elem.addEventListener('mouseup', this.onMouseUpFromResultSummary.bind(this), false);
    }
    
    onMouseMoveOnResultSummary(event) {
        this.moved = true;
        let drag = document.getElementsByClassName('drag')[0];
        if (drag) {
            drag.style.position = 'absolute';
            event.preventDefault();
    
            drag.style.top = event.pageY - this.clickedY + 'px';
            drag.style.left = event.pageX - this.clickedX + 'px';


            let mode = FeatureStore.getMode();
            switch (mode) {
                case 'AE':
                    // do nothing
                    break;
                case 'QBE':
                    let selectedTimeSlice = $('#selectedTimeSliceView');
                    let selectedTimeSlicePos = selectedTimeSlice.offset(),
                        selectedTimeSliceWidth = selectedTimeSlice.width(),
                        selectedTimeSliceHeight = selectedTimeSlice.height();
                    
                    if ((selectedTimeSlicePos.left <= event.pageX && event.pageX <= selectedTimeSlicePos.left + selectedTimeSliceWidth)
                    && (selectedTimeSlicePos.top <= event.pageY && event.pageY <= selectedTimeSlicePos.top + selectedTimeSliceHeight)) {
                        let overlayPanel = $('#selectedTimeSliceView > .overlayHidingPanel');
                        overlayPanel.css('display', 'block');
                        overlayPanel.css('width', Math.min(selectedTimeSliceWidth, selectedTimeSliceHeight));
                        overlayPanel.css('height', Math.min(selectedTimeSliceWidth, selectedTimeSliceHeight));
                    }
                    break;
                case 'QBS':
                    let sketchPad = $('#QBSSketchPad');
                    let sketchPadPos = sketchPad.offset(),
                        sketchPadWidth = sketchPad.width(),
                        sketchPadHeight = sketchPad.innerHeight();

                    if ((sketchPadPos.left <= event.pageX && event.pageX <= sketchPadPos.left + sketchPadWidth)
                    && (sketchPadPos.top <= event.pageY && event.pageY <= sketchPadPos.top + sketchPadHeight)) {
                        let overlayPanel = $('#QBSCanvasArea > .overlayHidingPanel');
                        overlayPanel.css('display', 'block');
                        overlayPanel.css('width', Math.min(sketchPadWidth, sketchPadHeight));
                        overlayPanel.css('height', Math.min(sketchPadWidth, sketchPadHeight));
                    }
                    break;
            }

        }
    }
    
    onMouseUpFromResultSummary(event) {
        document.body.removeEventListener('mousemove', this.onMouseMoveOnResultSummary.bind(this), false);

        let drag = document.getElementsByClassName('drag')[0];
        if (drag) {
            drag.removeEventListener('mouseup', this.onMouseUpFromResultSummary.bind(this), false);
            drag.classList.remove('drag');
            drag.style.position = 'static';
        }

        if (this.moved) {
            let mode = FeatureStore.getMode();
            // judge whether the result summary panel is on the selectedTimeSlice view/sketch pad
            // if not, move it to the original position and change the position style to static
            switch (mode) {
                case 'AE':
                    // drag.style.position = 'static';
                    // TODO: show alert
                    break;
                case 'QBE':
                    $('#selectedTimeSliceView > .overlayHidingPanel').css('display', 'none');
                    let selectedTimeSlice = $('#selectedTimeSliceView');
                    let selectedTimeSlicePos = selectedTimeSlice.offset(),
                        selectedTimeSliceWidth = selectedTimeSlice.width(),
                        selectedTimeSliceHeight = selectedTimeSlice.height();
                    if (selectedTimeSlicePos) {
                        if ((selectedTimeSlicePos.left <= event.pageX && event.pageX <= selectedTimeSlicePos.left + selectedTimeSliceWidth)
                        && (selectedTimeSlicePos.top <= event.pageY && event.pageY <= selectedTimeSlicePos.top + selectedTimeSliceHeight)) {
                            // convert the result into a new query
                            if ($('#QBESourceMain').css('display') === 'none') {
                                domActions.toggleSourcePanel();
                                resizeExtractionResultsArea();
                            }
                            FeatureAction.convertResultIntoQuery(this.result.id, [this.result.start, this.result.start + this.result.period], this.ignored);
                            if ($('#resultDetailArea').css('display') === 'block') {
                                domActions.toggleExtractionDetailPanel();
                            }
                            if (FeatureStore.getSource() !== this.result.id) {
                                FeatureAction.updateSource(this.result.id);
                            }
                        }
                    }
                    break;
                case 'QBS':
                    $('#QBSCanvasArea > .overlayHidingPanel').css('display', 'none');
                    let sketchPad = $('#QBSSketchPad');
                    let sketchPadPos = sketchPad.offset(),
                        sketchPadWidth = sketchPad.width(),
                        sketchPadHeight = sketchPad.innerHeight();
                    if (sketchPadPos) {
                        if ((sketchPadPos.left <= event.pageX && event.pageX <= sketchPadPos.left + sketchPadWidth)
                        && (sketchPadPos.top <= event.pageY && event.pageY <= sketchPadPos.top + sketchPadHeight)) {
                            // convert the result into a new query
                            FeatureAction.convertResultIntoQuery(this.result.id, [this.result.start, this.result.start + this.result.period], this.ignored);
                            if ($('#resultDetailArea').css('display') === 'block') {
                                domActions.toggleExtractionDetailPanel();
                            }
                        }
                    }
                    break;
            }
            // move it to the original position
            this.moveToOriginalPos();
            this.moved = false;
        } else {
            this.showDetails();
            // set up a line chart for comparison between query and time slice
            let width = $('#extractionDetailLC').width();
            let height = 200;
            FeatureAction.updateSelectedResult(this.result, width, height);
        }
    }

    moveToOriginalPos() {
        let nextResult = $('#resultSummaryHolder_' + (this.rank + 1));
        if (nextResult) {
            nextResult.before($('#resultSummaryHolder_' + this.rank));
        } else {
            let previousResult = $('#resultSummaryHolder_' + (this.rank - 1));
            previousResult.after($('#resultSummaryHolder_' + this.rank));
        }
    }
    

    render() {
        return (
            <div 
                className='resultSummary'
                id={'resultSummary_' + this.rank}>
                {this.showFileName()}
                {this.showThumbnail()}
                <div
                    className='container'
                    style={{paddingLeft: '0px', paddingRight: '0px'}}>
                    {this.showPeriod()}
                    {this.showDistance()}
                </div>
            </div>
        );
    }
}
