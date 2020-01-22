import React from 'react';
import * as d3 from 'd3';
import {tickFormatting} from '../lib/2DGraphLib';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as FeatureAction from '../Actions/FeatureAction';
import AppStore from '../Stores/AppStore';
import DataStore from '../Stores/DataStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import ScatterplotsStore from '../Stores/ScatterplotsStore';
import FeatureStore from '../Stores/FeatureStore';

d3.selection.prototype.moveToFront =
    function() {
        return this.each(function(){this.parentNode.appendChild(this);});
    };

export default class ScatterplotsQBE extends React.Component{
    constructor(props) {
        super();
        this.margin = { "top": 10, "bottom": 30, "right": 10, "left": 50 };
        this.id = props.id;
        this.divID = props.divID;
        this.SPID = 'QBE_SP_Selector';
        this.data = DataStore.getData(this.id);
        let timeRange = ScatterplotsStore.getTimeRange(this.id);
        if (typeof timeRange === 'undefined') {
            this.timeRange = [this.data.data.meta.min.z, this.data.data.meta.max.z];
        } else {
            this.timeRange = timeRange;
        }
        this.slicedData = this.data.data.spatial;
        this.xMinMax = [0, 0];
        this.yMinMax = [0, 0];
        this.selectedPeriod = [-1, -1];
        this.selector = 'selectRegion';
        this.state = {
            yItem: props.yItem,
            yItemonPanel: props.yItem,
            width: props.width,
            height: Math.max(props.height, 200)
        };
    }

    componentDidMount() {
        this.initalizeElements();
        this.computeRange(this.state.yItem);
        this.drawScatterplots();

        TimeTubesStore.on('updateFocus', (id, zpos, flag) => {
            // when flag is true, change the color of the plot
            if (id === this.id) {
                if (flag)
                    this.highlightCurrentPlot(zpos)
                else
                    this.updateCurrentPos(zpos);
            }
        });
        TimeTubesStore.on('changePlotColor', (id) => {
            if (id === this.id) {
                this.changePlotColor(TimeTubesStore.getPlotColor(id));
            }
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            if (mode === 'QBE' && FeatureStore.getSource() !== 'default') {
                this.setState({
                    width: this.props.width,
                    height: Math.max(this.props.height, 200)
                });
            }
        });
        FeatureStore.on('updateSelectedPeriod', () => {
            if (FeatureStore.getMode() === 'QBE' && Number(FeatureStore.getSource()) === this.id) {
                this.selectedPeriod = FeatureStore.getSelectedPeriod();
                this.highlightSelectedTimePeriod();
                this.spBrusher
                    .call(this.brush.move, [this.xScale(this.selectedPeriod[0]), this.xScale(this.selectedPeriod[1])]);
            }
        });
        FeatureStore.on('convertResultIntoQuery', (id, period, ignored) => {
            if (FeatureStore.getMode() === 'QBE' && Number(id) === this.id) {
                this.selectedPeriod = FeatureStore.getSelectedPeriod();
                this.highlightSelectedTimePeriod();
                this.spBrusher
                    .call(this.brush.move, [this.xScale(this.selectedPeriod[0]), this.xScale(this.selectedPeriod[1])]);
            }            
        });
        FeatureStore.on('switchQBESelectorSP', (selector) => {
            if (selector === 'reset') {
                this.resetScatterplots();
            } else {
                this.selector = selector;
                this.switchMouseInteraction();
            }
        });
        FeatureStore.on('resetSelection', () => {
            this.resetSelection();
        });
        FeatureStore.on('selectTimeInterval', (id, val) => {
            if (FeatureStore.getMode() === 'QBE' && Number(id) === this.id) {
                this.selectedPeriod = FeatureStore.getSelectedPeriod();
                this.highlightSelectedTimePeriod();
                this.spBrusher
                    .call(this.brush.move, [this.xScale(this.selectedPeriod[0]), this.xScale(this.selectedPeriod[1])]);
            }
        });
    }

    initalizeElements() {
        this.zoom = d3.zoom()
            .scaleExtent([.05, 10]);
        this.sp = d3.select('#' + this.divID)
            .append('svg')
            .attr('id', this.SPID)
            .attr('class', 'scatterplot scatterplots' + this.id + ' ' + this.divID);
        this.xScale = d3.scaleLinear();
        this.xScaleTmp = this.xScale;
        this.xAxis = this.sp.append("g")
            .attr("class", "x_axis " + this.divID);
        this.xAxisText = d3.selectAll('g.x_axis.' + this.divID)
            .append('text')
            .attr('class', 'axisLabel ' + this.divID)
            .attr('fill', 'black')
            .attr('text-anchor', 'middle');
        this.yScale = d3.scaleLinear();
        this.yScaleTmp = this.yScale;
        this.yAxis = this.sp.append("g")
            .attr("class", "y_axis "+ this.divID)
            .attr("transform", "translate(" + this.margin.left + ',' + this.margin.top + ")");
        this.yAxisText = d3.selectAll('g.y_axis.' + this.divID)
            .append('text')
            .attr('class', 'axisLabel ' + this.divID)
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle');

        // tooltip
        this.tooltip = d3.select('#' + this.divID)//'#scatterplots_' + this.id)
            .append('div')
            .attr('class', 'tooltip ' + this.divID)
            .attr('id', 'tooltip_' + this.SPID)
            .style('opacity', 0.75)
            .style('visibility', 'hidden');

        this.line = d3.line()
            .x(function(d){ return d[0]; })
            .y(function(d){ return d[1]; });
        this.lineH = this.sp.append('path')
            .attr('stroke', 'orange')
            .attr("fill", "none")
            .attr('class', 'currentLineH ' + this.divID + ' scatterplots' + this.id)
            .style('opacity', 0.75)
            .style('visibility', 'hidden');
        this.lineV = this.sp.append('path')
            .attr('stroke', 'orange')
            .attr("fill", "none")
            .attr('class', 'currentLineV ' + this.divID + ' scatterplots' + this.id)
            .style('opacity', 0.75)
            .style('visibility', 'hidden');
        this.clip = this.sp.append("defs").append("clipPath")
            .attr("id", "clipScatterplots_" + this.SPID)
            .append("rect");
        this.point_g = this.sp.append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('clip-path', 'url(#clipScatterplots_' + this.SPID + ')')
            .classed('points_g', true);

        let yItem = this.state.yItem;
        this.points = this.point_g
            .selectAll("circle")
            .data(this.slicedData)
            .enter()
            .append("circle")
            .select(function (d) {
                return ('z' in d && yItem in d) ? this: null;
            })
            .attr('opacity', 0.7)
            .attr('stroke-width', 0.5)
            .attr('stroke', 'dimgray')
            .attr("r", 4)
            .attr('class', this.divID + ' scatterplots' + this.id);
        this.brush = d3.brushX();
        this.spBrusher = this.sp
            .append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('clip-path', 'url(#clipScatterplots_' + this.SPID + ')')
            .attr('class', 'brush');

        
        let outerWidth = this.props.width, outerHeight = Math.max(this.props.height, 200);
        this.setState({
            width: outerWidth,
            height: outerHeight
        });
    }

    drawScatterplots() {
        let SPID = this.SPID;
        let margin = this.margin;
        let outerWidth = this.state.width, outerHeight = this.state.height;
        let width = outerWidth - this.margin.left - this.margin.right;
        let height = outerHeight - this.margin.top - this.margin.bottom;
        let yItem = this.state.yItem;

        // Pan and zoom
        this.zoom
            .extent([[0, 0], [width, height]])
            .on("zoom", this.zoomed().bind(this));

        this.sp
            .attr('width', outerWidth)
            .attr('height', outerHeight)
            .call(this.zoom)
            .on("dblclick.zoom", null)
            .on('mousedown.zoom', null);
            
        this.brush
            .extent([[0, 0], [width, height]])
            .on('start brush', this.brushed().bind(this))
            .on('end', this.brushedEnd().bind(this));
        this.spBrusher
            .call(this.brush)
            // .call(this.brush.move, [this.xScale(this.selectedPeriod[0]), this.xScale(this.selectedPeriod[1])]);

        // Draw x axis
        this.xScale
            .domain(this.xMinMax)
            .nice()
            .range([0, width]);
        this.xScaleTmp = this.xScale;
        this.xMinMax = this.xScale.domain();

        this.xLabel = d3.axisBottom(this.xScale)
            .ticks(10)
            .tickSize(-height)
            .tickFormat(tickFormatting);
        this.xAxis
            .attr("transform", "translate(" + this.margin.left + ',' + (this.margin.top + height) + ")")
            .call(this.xLabel);
        this.xAxisText
            .attr('x', width / 2)
            .attr('y', this.margin.bottom / 2 + 10)
            .text(this.data.data.lookup.z);

        // Draw y axis
        this.yScale
            .domain(this.yMinMax)
            .nice()
            .range([height, 0]);
        this.yScaleTmp = this.yScale;
        this.yMinMax = this.yScale.domain();
        this.yLabel = d3.axisLeft(this.yScale)
            .ticks(5)
            .tickSize(-width)
            .tickFormat(tickFormatting);
        this.yAxis
            .call(this.yLabel);
        this.yAxisText
            .attr('x', -height / 2)
            .attr('y', -this.margin.left / 2 - 10)
            .text(this.data.data.lookup[yItem])
            .on('click', spYLabelClick.bind(this))
            .on('mouseover', spYLabelMouseOver)
            .on('mouseout', spYLabelMouseOut);


        let curLineH = [[0, this.margin.top], [width, this.margin.top]];
        let curLineV = [[this.margin.left, 0], [this.margin.left, height]];
        this.lineH
            .attr('d', this.line(curLineH));
        this.lineV
            .attr('d', this.line(curLineV));

        // create a clipping region
        this.clip
            .attr("width", width)
            .attr("height", height);

        // Draw data points
        if (!this.data.data.merge) {
            let plotColor = TimeTubesStore.getPlotColor(this.id);
            this.points
                .attr("cx", function(d) { return this.xScale(d.z); }.bind((this)))
                .attr("cy", function(d) { return this.yScale(d[yItem]); }.bind((this)))
                .attr("fill", plotColor)//d3.rgb(color[0], color[1], color[2]))
                .on('mouseover', this.spMouseOver())
                .on('mouseout', this.spMouseOut())
                // .on('click', spClick)
                .on('dblclick', this.spDblClick());
        } else {
            let idNameLookup = {};
            let fileNames = this.data.name.split(',');
            let plotColors = [];
            for (let i = 0; i < fileNames.length; i++) {
                let id = DataStore.getIdFromName(fileNames[i]);
                idNameLookup[fileNames[i]] = i;
                let eachNames = fileNames[i].split('+');
                if (eachNames.length > 1) {
                    for (let j = 0; j < eachNames.length; j++) {
                        idNameLookup[eachNames[j]] = i;
                    }
                }
                plotColors.push(TimeTubesStore.getPlotColor(id));
            }
            this.points
                .attr("cx", function(d) { return this.xScale(d.z); }.bind((this)))
                .attr("cy", function(d) { return this.yScale(d[yItem]); }.bind((this)))
                .attr("fill", function (d) {
                    return plotColors[idNameLookup[d.source]];
                })//d3.rgb(color[0], color[1], color[2]))
                .on('mouseover', this.spMouseOver())
                .on('mouseout', this.spMouseOut())
                // .on('click', spClick)
                .on('dblclick', this.spDblClick());
        }
        function spYLabelClick() {
            //    show a panel with choices for axis on scatterplots
            let panel = d3.select('#changeYAxisPanel_' + SPID);
            if (panel.style('visibility') === 'visible') {
                panel
                    .transition()
                    .duration(50)
                    .style('visibility', 'hidden');
                this.setState({
                    yItemonPanel: this.state.yItem
                });
            } else {
                let divHeight = document.getElementById('changeXAxisPanel_' + SPID).clientHeight;
                let divWidth = document.getElementById('changeXAxisPanel_' + SPID).clientWidth;
                panel
                    .style('transform', 'translate(' + (margin.left) + 'px,' + (height / 2 + margin.top - divHeight / 2) + 'px)')
                    .style('visibility', 'visible');
            }
        }
        function spYLabelMouseOver() {
        //    change the font color of the y label
            d3.select(this)
                .style('fill', 'orange');
        }
        function spYLabelMouseOut() {
            //    change the font color of the y label
            d3.select(this)
                .style('fill', 'black');
        }
    }

    zoomed() {
        return function() {
            // if a time interval is selected, move the selection rectangle according to the changes of the graph
            let width = this.state.width - this.margin.left - this.margin.right,
                height = this.state.height - this.margin.top - this.margin.bottom;

            let yItem = this.state.yItem;

            let new_xScale = d3.event.transform.rescaleX(this.xScale);
            let new_yScale = d3.event.transform.rescaleY(this.yScale);
            this.xScaleTmp = new_xScale;
            this.yScaleTmp = new_yScale;
            this.xMinMax = new_xScale.domain();
            this.yMinMax = new_yScale.domain();
            // update axes
            this.xAxis.call(this.xLabel.scale(new_xScale));
            this.yAxis.call(this.yLabel.scale(new_yScale));

            this.points
                .attr('cx', function(d) {return new_xScale(d.z)})
                .attr('cy', function(d) {return new_yScale(d[yItem])});

            this.spBrusher
                .call(this.brush.move, [new_xScale(this.selectedPeriod[0]), new_xScale(this.selectedPeriod[1])]);

            let current = d3.select('circle.current.' + this.divID);

            if (current._groups[0][0]) {
                let cx = current.attr('cx'), cy = current.attr('cy');
                if (cy <= 0 || height <= cy) {
                    this.lineH
                        .attr('transform', "translate(" + this.margin.left + "," + cy + ")")
                        .style('visibility', 'hidden');
                } else {
                    this.lineH.transition()
                        .duration(0)
                        .attr('transform', "translate(" + this.margin.left + "," + cy + ")")
                        .style('visibility', 'visible');
                }
                if (cx <= 0 || width <= cx) {
                    this.lineV
                        .attr('transform', "translate(" + cx + "," + this.margin.top + ")")
                        .style('visibility', 'hidden');
                } else {
                    this.lineV.transition()
                        .duration(0)
                        .attr('transform', "translate(" + cx + "," + this.margin.top + ")")
                        .style('visibility', 'visible');
                }
            }
        }
    }

    brushed() {
        return function() {
            let s = d3.event.selection || this.xScaleTmp.range;
            let xRange = s.map(this.xScaleTmp.invert, this.xScaleTmp);
            this.selectedPeriod = xRange;
        }
    }

    brushedEnd() {
        return function() {
            if (FeatureStore.getMode() === 'QBE' && Number(FeatureStore.getSource()) === this.id) {
                let previousPeriod = FeatureStore.getSelectedPeriod();
                // use subtractions to deal with the uncertainties of float number
                if (Math.abs(previousPeriod[0] - this.selectedPeriod[0]) > 0.00001 || Math.abs(previousPeriod[1] - this.selectedPeriod[1]) > 0.00001) {
                    FeatureAction.selectPeriodfromSP(this.selectedPeriod);
                    if (this.selectedPeriod[1] - this.selectedPeriod[0] > 0) {
                        this.highlightSelectedTimePeriod();
                        this.timeRange = [this.selectedPeriod[0] - 10, this.selectedPeriod[1] + 10];
                        this.updateTimeRange();
                    } else {
                        this.resetSelection();
                        this.timeRange = [this.data.data.meta.min.z, this.data.data.meta.max.z];
                        this.updateTimeRange();
                    }
                }
            } //else if (this.selectedPeriod[1] - this.selectedPeriod[0] === 0) {
            //     FeatureAction.resetSelection();
            //     this.resetSelection();
            // }
        }
    }

    spMouseOver() {
        let tooltip = this.tooltip,
            data = this.data,
            yItem = this.state.yItem;
        return function(d) {
            d3.select(this)
                .attr('stroke-width', 1)
                .attr('stroke', 'black');
            tooltip.transition()
                .duration(50)
                .style('visibility', 'visible');
            tooltip.html(
                '<i>' + data.data.lookup.z + '</i>' + ': ' + d.z + '<br/>' +
                '<i>' + data.data.lookup[yItem] + '</i>' + ': ' + d[yItem]
            )
                .style('left', (d3.event.pageX + 20) + 'px')
                .style('top', (d3.event.pageY - 30) + 'px');
        }
    }

    spMouseOut() {
        let tooltip = this.tooltip;
        return function(d) {
            let selected = d3.select(this);
            if (selected.style('fill') !== d3.color('red').toString()) {
                selected
                    .attr('stroke-width', 0.5)
                    .attr('stroke', 'dimgray');
                // if focused plot is not currently focused in TimeTubes
                if (selected.attr('class').indexOf('current') < 0) {
                    selected
                        .attr('stroke-width', 0.5)
                        .attr('stroke', 'dimgray');
                } else {
                    selected
                        .attr('stroke', 'orange')
                        .attr('stroke-width', 1);
                }
            }
            tooltip.transition()
                .duration(150)
                .style("visibility", 'hidden');
        }
    }

    spDblClick() {
        let id = this.id;
        return function(d) {
            TimeTubesAction.searchTime(id, d.z);
        }
    }

    resetScatterplots() {
        let width = this.state.width - this.margin.left - this.margin.right,
            height = this.state.height - this.margin.top - this.margin.bottom;
        // initialize graph ranges
        this.timeRange = [this.data.data.meta.min.z, this.data.data.meta.max.z];
        this.updateTimeRange();

        // initialize zoom
        this.zoom = d3.zoom()
            .scaleExtent([.05, 10])
            .extent([
                [0, 0], 
                [width, height]
            ])
            .on("zoom", this.zoomed().bind(this));
        switch (this.selector) {
            case 'selectRegion':
                this.sp
                    .call(this.zoom)
                    .call(this.zoom.transform, d3.zoomIdentity)
                    .on("dblclick.zoom", null)
                    .on('mousedown.zoom', null);
                break;
            case 'move':
                this.sp
                    .call(this.zoom)
                    .call(this.zoom.transform, d3.zoomIdentity)
                    .on("dblclick.zoom", null);
                break;
            default:
                break;
        }
    }

    highlightCurrentPlot(zpos) {
        let margin = this.margin;
        let divID = this.divID;
        let JD = zpos + this.data.data.spatial[0].z;
        let sps = d3.selectAll('svg.' + divID);//.scatterplots' + this.id);
        let yItem = this.state.yItem;
        sps.each(function (d) {
            let sp = d3.select(this);
            let plots = sp.selectAll('circle');
            let spId = sp.attr('class').split(' '); // scatterplot scatterplots0 scatterplots0_0
            plots
                .attr('stroke-width', 0.5)
                .attr('stroke', 'dimgray')
                .attr('class', spId[1] + ' ' + spId[2]);
            let currentPlots = plots.filter(function (d) {
                return d.z === JD && yItem in d;
            });
            if (currentPlots._groups.length > 0) {
                currentPlots
                    .attr('stroke', 'orange')
                    .attr('stroke-width', 1)
                    .attr('class', spId[1] + ' ' + spId[2] + ' current')
                    .moveToFront()
                    .each(moveLines);
            }
        });
        function moveLines(d) {
            // plot (circle) has only one class named like 'scatterplots0_0'
            let circle = d3.select(this);
            let lineClass = circle.attr('class').split(' ')[1]; // scatterplots0_0
            let sp = d3.select('svg.' + divID);
            let currentLineH = sp.selectAll('.currentLineH');
            let currentLineV = sp.selectAll('.currentLineV');
            currentLineH
                .transition()
                .duration(0)
                .style('visibility', 'visible')
                .attr('transform', 'translate(' + margin.left + ',' + (circle.attr('cy')) + ')');
            currentLineV
                .transition()
                .duration(0)
                .style('visibility', 'visible')
                .attr('transform', 'translate(' + circle.attr('cx') + ',' + margin.top + ')');
        }
    }

    updateCurrentPos(zpos) {
        let width = this.state.width - this.margin.left - this.margin.right;
        let new_xScale = d3.scaleLinear()
            .domain([this.xMinMax[0], this.xMinMax[1]])
            .range([0, width]);
        let JD = zpos + this.data.data.spatial[0].z;
        this.lineH
            .style('visibility', 'hidden');
        this.lineV
            .transition()
            .duration(0)
            .style('visibility', 'visible')
            .attr('transform', 'translate(' + (new_xScale(JD)) + ',' + this.margin.top + ')');
    }

    changePlotColor(color) {
        d3.select('#' + this.divID)
            .selectAll('circle')
            .attr('fill', color);
    }

    onSelectYItem(e) {
        this.setState({yItemonPanel: e.target.value});
    }

    onClickYAxisDone(e) {
        this.setState({
            yItem: this.state.yItemonPanel
        });
        this.computeRange(this.state.yItemonPanel);
        this.updateScatterplots(this.state.yItemonPanel);

        // change the label of the y axis
        this.yAxisText
            .text(this.data.data.lookup[this.state.yItemonPanel]);

        // make the y axis change panel hidden
        d3.select('#changeYAxisPanel_' + this.SPID)
            .transition()
            .duration(50)
            .style('visibility', 'hidden');
    }

    computeRange(yItem) {
        // this.data.data.spatial has all observation index by x, y, z, etc.
        this.slicedData = this.data.data.spatial.filter(function (d) {
            return (this.timeRange[0] <= d.z) && (d.z <= this.timeRange[1]);
        }.bind(this));
        this.xMinMax = this.timeRange;
        this.yMinMax = d3.extent(this.slicedData, function (d) {
            return d[yItem];
        });
    }

    updateScatterplots(yItem) {
        // update domain
        this.xScale
            .domain(this.xMinMax)
            .nice();
        this.yScale
            .domain(this.yMinMax)
            .nice();
        this.xMinMax = this.xScale.domain();
        this.yMinMax = this.yScale.domain();

        // update all circles
        this.points.remove();
        if (!this.data.data.merge) {
            let plotColor = TimeTubesStore.getPlotColor(this.id);
            this.points = this.point_g
                .selectAll("circle")
                .data(this.slicedData)
                .enter()
                .append('circle')
                .attr('cx', function(d) { return this.xScale(d.z); }.bind((this)))
                .attr('cy', function(d) { return this.yScale(d[yItem]); }.bind((this)))
                .select(function (d) {
                    return ('z' in d && yItem in d) ? this: null;
                })
                .attr("fill", plotColor)//d3.rgb(color[0], color[1], color[2]))
                .attr('opacity', 0.7)
                .attr('stroke-width', 0.5)
                .attr('stroke', 'dimgray')
                .attr("r", 4)
                .attr('class', this.divID + ' scatterplots' + this.id)
                .on('mouseover', this.spMouseOver())
                .on('mouseout', this.spMouseOut())
                // .on('click', spClick)
                .on('dblclick', this.spDblClick());
        } else {
            let idNameLookup = {};
            let fileNames = this.data.name.split(',');
            let plotColors = [];
            for (let i = 0; i < fileNames.length; i++) {
                let id = DataStore.getIdFromName(fileNames[i]);
                idNameLookup[fileNames[i]] = i;
                let eachNames = fileNames[i].split('+');
                if (eachNames.length > 1) {
                    for (let j = 0; j < eachNames.length; j++) {
                        idNameLookup[eachNames[j]] = i;
                    }
                }
                plotColors.push(TimeTubesStore.getPlotColor(id));
            }
            this.points = this.point_g
                .selectAll("circle")
                .data(this.slicedData)
                .enter()
                .append('circle')
                .attr('cx', function(d) { return this.xScale(d.z); }.bind((this)))
                .attr('cy', function(d) { return this.yScale(d[yItem]); }.bind((this)))
                .select(function (d) {
                    return (z in d && yItem in d) ? this: null;
                })
                .attr("fill", function (d) {
                    return plotColors[idNameLookup[d.source]];
                })//d3.rgb(color[0], color[1], color[2]))
                .attr('opacity', 0.7)
                .attr('stroke-width', 0.5)
                .attr('stroke', 'dimgray')
                .attr("r", 4)
                .attr('class', this.divID + ' scatterplots' + this.id)
                .on('mouseover', this.spMouseOver())
                .on('mouseout', this.spMouseOut())
                // .on('click', spClick)
                .on('dblclick', this.spDblClick());
        }

        this.xAxis
            .call(this.xLabel.scale(this.xScale));
        this.yAxis
            .call(this.yLabel.scale(this.yScale));
    }

    highlightSelectedTimePeriod() {
        // change the color of plots in the selectedTimePeriod
        let period = this.selectedPeriod;
        this.points
            .attr('stroke', 'dimgray')
            .attr('stroke-width', 0.5);
        this.points
            .select(function (d) {
                return (period[0] <= d.z && d.z <= period[1]) ? this: null;
            })
            .attr('stroke', '#d23430')
            .attr('stroke-width', 1);
    }

    updateTimeRange() {
        let width = this.state.width - this.margin.left - this.margin.right,
            height = this.state.height - this.margin.top - this.margin.bottom;
        this.computeRange(this.state.yItem);
        this.xScale
            .domain(this.xMinMax)
            .nice();
        this.xScaleTmp = this.xScale;
        this.xMinMax = this.xScale.domain();
        this.xLabel = d3.axisBottom(this.xScale)
            .ticks(10)
            .tickSize(-height)
            .tickFormat(tickFormatting);
        this.xAxis
            .transition()
            .duration(500)
            .call(this.xLabel.scale(this.xScale));
        this.yScale
            .domain(this.yMinMax)
            .nice();
        this.yScaleTmp = this.yScale;
        this.yMinMax = this.yScale.domain();
        this.yLabel = d3.axisLeft(this.yScale)
            .ticks(5)
            .tickSize(-width)
            .tickFormat(tickFormatting);
        this.yAxis
            .transition()
            .duration(500)
            .call(this.yLabel.scale(this.yScale));
        this.points
            .attr("cx", function(d) { return this.xScale(d.z); }.bind((this)))
            .attr("cy", function(d) { return this.yScale(d[this.state.yItem]); }.bind((this)));
        this.spBrusher
            .call(this.brush.move, [this.xScale(this.selectedPeriod[0]), this.xScale(this.selectedPeriod[1])]);
    }

    resetSelection() {
        this.selectedPeriod = [-1, -1];
        this.points
            .attr('stroke', 'dimgray')
            .attr('stroke-width', 0.5);
    }

    switchMouseInteraction() {
        let width = this.state.width - this.margin.left - this.margin.right,
            height = this.state.height - this.margin.top - this.margin.bottom;
        this.zoom = d3.zoom()
            .scaleExtent([.05, 10])
            .extent([
                [0, 0], 
                [width, height]
            ])
            .on("zoom", this.zoomed().bind(this));
        switch (this.selector) {
            case 'selectRegion':
                this.sp
                    .call(this.zoom)
                    .on("dblclick.zoom", null)
                    .on('mousedown.zoom', null);
                this.spBrusher
                    .attr('class', 'brush')
                    .call(this.brush);
                break;
            case 'move':
                this.sp
                    .call(this.zoom)
                    .on("dblclick.zoom", null);
                this.spBrusher.on(".brush", null);
                break;
            default:
                break;
        }
    }

    render() {
        if (AppStore.getMenu() === 'feature' && d3.selectAll('svg#' + this.SPID).size() > 0) {
            this.drawScatterplots();
        }
        let yItems = [];
        let lookup = this.data.data.lookup;
        for (let key in lookup) {
            let label = '';
            if (lookup[key].length > 1) {
                label = lookup[key].join(',');
            } else {
                label = lookup[key];
            }
            if (label.indexOf('JD') < 0) {
                yItems.push(
                    <div className="form-check" key={label}>
                        <input type='radio' name={"selectYAxisForm_" + this.SPID} value={key} checked={this.state.yItemonPanel === key} onChange={this.onSelectYItem.bind(this)}/>
                        <label className="form-check-label" htmlFor="inlineCheckbox1" key={label}>{label}</label>
                    </div>);
            } else {
                yItems.unshift(
                    <div className="form-check" key={label}>
                        <input type='radio' name={"selectYAxisForm_" + this.SPID} value={key} checked={this.state.yItemonPanel === key} onChange={this.onSelectYItem.bind(this)}/>
                        <label className="form-check-label" htmlFor="inlineCheckbox1" key={label}>{label}</label>
                    </div>);
            }
        }
        
        return (
            <div id={'scatterplotsSelectors_' + this.SPID}>
                <div className='overlayPanel'
                     id={'changeYAxisPanel_' + this.SPID}
                     style={{visibility: 'hidden', textAlign: 'center'}}>
                    <h6>Change y axis</h6>
                    <div id={'changeYAxisItem_' + this.SPID}
                         style={{float: 'left', textAlign: 'left'}}>
                        <form id={"selectYAxisForm_" + this.SPID}>
                            {yItems}
                        </form>
                    </div>
                    <button className="btn btn-primary btn-sm"
                            id={'changeYAxisBtn_' + this.SPID}
                            onClick={this.onClickYAxisDone.bind(this)}>Done</button>
                </div>
            </div>
        );
    }

}
