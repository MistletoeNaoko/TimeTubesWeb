import React from 'react';
import * as d3 from 'd3';
import {tickFormatting} from '../lib/2DGraphLib';
import {getDataFromLocalStorage} from '../lib/dataLib';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import DataStore from '../Stores/DataStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import ScatterplotsStore from '../Stores/ScatterplotsStore';

d3.selection.prototype.moveToFront =
    function() {
        return this.each(function(){this.parentNode.appendChild(this);});
    };

export default class Scatterplots extends React.Component{
    constructor(props) {
        super();
        this.margin = { "top": 10, "bottom": 30, "right": 30, "left": 60 };
        this.id = props.id;
        this.divID = props.divID;
        this.SPID = props.id + '_' + props.divID.split('_')[1];  // e.g. 0_1
        this.data = DataStore.getData(this.id);
        let timeRange = ScatterplotsStore.getTimeRange(this.id);
        if (typeof timeRange === 'undefined') {
            this.timeRange = [this.data.data.meta.min.z, this.data.data.meta.max.z];
        } else {
            this.timeRange = timeRange;
        }
        this.slicedData = this.data.data.spatial.filter(function (d) {
            return (props.xItem in d && props.yItem in d);
        });
        this.xMinMax = [0, 0];
        this.yMinMax = [0, 0];
        let comments = getDataFromLocalStorage('privateComment');
        this.commentsList = [];
        for (let key in comments) {
            if (comments[key].fileName === this.data.name) {
                let tmp = {};
                tmp.id = key;
                for (let keyinComment in comments[key]) {
                    tmp[keyinComment] = comments[key][keyinComment];
                }
                this.commentsList.push(tmp);
            }
        }
        this.state = {
            xItem: props.xItem,
            yItem: props.yItem,
            xItemonPanel: props.xItem,
            yItemonPanel: props.yItem,
            width: props.width,
            height: Math.max(props.height, 200)
        };
    }

    componentDidMount() {
        this.initalizeElements();
        this.computeRange(this.state.xItem, this.state.yItem);
        this.drawScatterplots();

        DataStore.on('updatePrivateComment', () => {
            let currentCommentNum = this.commentsList.length;
            let comments = getDataFromLocalStorage('privateComment');
            this.commentsList = [];
            for (let key in comments) {
                if (comments[key].fileName === this.data.name) {
                    let tmp = {};
                    tmp.id = key;
                    for (let keyinComment in comments[key]) {
                        tmp[keyinComment] = comments[key][keyinComment];
                    }
                    this.commentsList.push(tmp);
                }
            }
            if (this.commentsList.length < currentCommentNum) {
                // delete extra triangles
                this.commentMarks = this.commentMarks_g
                    .selectAll('path')
                    .data(this.commentsList);
                this.commentMarks.exit().remove();
            } else {
                // add path
                let now = this.commentMarks_g
                    .selectAll('path')
                    .data(this.commentsList);
                let enter = now.enter().append('path')
                    .attr('d', function(d) {
                        this.symbolGenerator.type(d3['symbolTriangle']);
                        return this.symbolGenerator();
                    }.bind(this));
                this.commentMarks = enter.merge(now);
            }
            this.updateScatterplots();
        });
        TimeTubesStore.on('updateFocus', (id, zpos, flag) => {
            // when flag is true, change the color of the plot
            if (id === this.id) {
                if (flag)
                    this.highlightCurrentPlot(zpos)
                else
                    this.updateCurrentPos(zpos);
            }
        });
        // TimeTubesStore.on('updateCurrentPos', (id, zpos) => {
        //     if (id === this.id) {
        //         this.updateCurrentPos(zpos);
        //     }
        // });
        TimeTubesStore.on('changePlotColor', (id) => {
            if (id === this.id) {
                this.changePlotColor(TimeTubesStore.getPlotColor(id));
            } else if (this.data.data.merge) {
                if (this.data.data.name.indexOf(DataStore.getData(id).data.name) >= 0) {
                    this.changePlotColorMerge(DataStore.getData(id).data.name, TimeTubesStore.getPlotColor(id));
                }
            }
        });
        TimeTubesStore.on('showRotationCenter', (id, period, center) => {
            if (id === this.id) {
                this.updateCurrentPos(period[0] - this.data.data.spatial[0].z);
            }
        });
        TimeTubesStore.on('showTimeTubesOfTimeSlice', (id, period) => {
            if (id === this.id) {
                this.updateCurrentPos(period[0] - this.data.data.spatial[0].z);
            }
        });
        TimeTubesStore.on('searchTime', (id, dst) => {
            if (id === this.id) {
                this.highlightCurrentPlot(dst - this.data.data.spatial[0].z);
            }
        });
        ScatterplotsStore.on('resetScatterplots',  (id) => {
            if (id === this.id) {
                this.reset();
            }
        });
        ScatterplotsStore.on('updateTimeRange', (id, range) => {
            if (id === this.id) {
                this.timeRange = range;
                this.computeRange(this.state.xItem, this.state.yItem);
                this.updateScatterplots(this.state.xItem, this.state.yItem);
            }
        });
    }

    initalizeElements() {
        this.zoom = d3.zoom()
            .scaleExtent([.5, 20]);
        this.sp = d3.select('#' + this.divID)
            .append('svg')
            .attr('id', 'scatterplotsSVG_' + this.SPID)
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

        // let xItem = this.state.xItem, yItem = this.state.yItem;
        this.points = this.point_g
            .selectAll("circle")
            .data(this.slicedData)
            .enter()
            .append("circle")
            // .select(function (d) {
            //     return (xItem in d && yItem in d) ? this: null;
            // })
            .attr('opacity', 0.7)
            .attr('stroke-width', 0.5)
            .attr('stroke', 'dimgray')
            .attr("r", 4)
            .attr('class', this.divID + ' scatterplots' + this.id);

        this.commentMarks_g = this.sp.append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('clip-path', 'url(#clipScatterplots_' + this.SPID + ')')
            .classed('comments_g', true);
        this.symbolGenerator = d3.symbol().size(50);
        this.commentMarks = this.commentMarks_g
            .selectAll('path')
            .data(this.commentsList)
            .enter()
            .append('path')
            .attr('d', function(d) {
                this.symbolGenerator.type(d3['symbolTriangle']);
                return this.symbolGenerator();
            }.bind(this));
    }

    drawScatterplots() {
        let id = this.id;
        let SPID = this.SPID;
        let divID = this.divID;
        let margin = this.margin;
        let data = this.data;
        let outerWidth = this.props.width, outerHeight = Math.max(this.props.height, 200);
        let width = outerWidth - this.margin.left - this.margin.right;
        let height = outerHeight - this.margin.top - this.margin.bottom;
        let xItem = this.state.xItem, yItem = this.state.yItem;
        let tooltip = this.tooltip;

        // Pan and zoom
        this.zoom
            .extent([[0, 0], [width, height]])
            .on("zoom", zoomed.bind(this));

        this.sp
            .attr('width', outerWidth)
            .attr('height', outerHeight)
            .call(this.zoom)
            .on("dblclick.zoom", null);

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
            .text(this.data.data.lookup[xItem])
            .on('click', spXLabelClick.bind(this))
            .on('mouseover', spXLabelMouseOver)
            .on('mouseout', spXLabelMouseOut);

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
                .attr("cx", function(d) { return this.xScale(d[xItem]); }.bind(this))
                .attr("cy", function(d) { return this.yScale(d[yItem]); }.bind(this))
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
                .attr("cx", function(d) { return this.xScale(d[xItem]); }.bind((this)))
                .attr("cy", function(d) { return this.yScale(d[yItem]); }.bind((this)))
                .attr("fill", function (d) {
                    return plotColors[idNameLookup[d.source]];
                })//d3.rgb(color[0], color[1], color[2]))
                .on('mouseover', this.spMouseOver())
                .on('mouseout', this.spMouseOut())
                // .on('click', spClick)
                .on('dblclick', this.spDblClick());
        }

        // draw commentmarkers
        if (this.state.xItem === 'z' || this.state.yItem === 'z') {
            this.commentMarks
                .attr('transform', function(d) {
                    return 'translate(' + this.xScale(d.start) + ', 6)';
                }.bind(this))
                .attr('fill', function(d) {
                    return d.labelColor.replace('0x', '#');
                });
        }

        function zoomed() {
            // create new scale ojects based on event
            // let lineHPos, lineVPos;
            // if (lineH || lineV) {
            //     let currentXScale = d3.scaleLinear()
            //         .domain([this.xMinMax[0], this.xMinMax[1]])
            //         .range([0, this.width - this.margin.left - this.margin.right]);
            //     let currentYScale = d3.scaleLinear()
            //         .domain([this.yMinMax[0], this.yMinMax[1]])
            //         .range([0, this.height - this.margin.top - this.margin.bottom]);
            //     let pos = lineH.attr('transform').split('translate(')[1].split(')')[0];
            //     if (pos.indexOf(' ') >= 0) {
            //         lineVPos = Number(pos.split(', ')[0]);  // x
            //         lineHPos = Number(pos.split(', ')[1]);  // y
            //     } else {
            //         lineVPos = Number(pos.split(',')[0]);  // x
            //         lineHPos = Number(pos.split(',')[1]);  // y
            //     }
            //     lineVPos = currentXScale.invert(lineVPos);  // x
            //     lineHPos = currentYScale.invert(lineHPos);  // y
            // }

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
                .attr('cx', function(d) {return new_xScale(d[xItem])})
                .attr('cy', function(d) {return new_yScale(d[yItem])});

            // draw commentmarkers
            if (this.state.xItem === 'z' || this.state.yItem === 'z') {
                this.commentMarks
                    .attr('transform', function(d) {
                        return 'translate(' + new_xScale(d.start) + ', 6)';
                    })
                    .attr('fill', function(d) {
                        return d.labelColor.replace('0x', '#');
                    });
            }

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
        function spXLabelClick() {
        //    show a panel with choices for axis on scatterplots
            let panel = d3.select('#changeXAxisPanel_' + SPID);
            if (panel.style('visibility') === 'visible') {
                panel
                    .transition()
                    .duration(50)
                    .style('visibility', 'hidden');
                this.setState({
                    xItemonPanel: this.state.xItem
                });
            } else {
                let divHeight = document.getElementById('changeXAxisPanel_' + SPID).clientHeight;
                let divWidth = document.getElementById('changeXAxisPanel_' + SPID).clientWidth;
                panel
                    .style('transform', 'translate(' + (width / 2 + margin.left - divWidth / 2) + 'px,' + (height + margin.top - divHeight) + 'px)')
                    .style('visibility', 'visible');
            }
        }
        function spXLabelMouseOver() {
        //    change the font color of the x label
            d3.select(this)
                .style('fill', 'orange');
        }
        function spXLabelMouseOut() {
            //    change the font color of the x label
            d3.select(this)
                .style('fill', 'black');
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

    spMouseOver() {
        let tooltip = this.tooltip,
            data = this.data,
            xItem = this.state.xItem,
            yItem = this.state.yItem;
        return function(d) {
            d3.select(this)
                .attr('stroke-width', 1)
                .attr('stroke', 'black');
            tooltip.transition()
                .duration(50)
                .style('visibility', 'visible');
            tooltip.html(
                '<i>' + data.data.lookup[xItem] + '</i>' + ': ' + d[xItem] + '<br/>' +
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

    // differences between highlightCurrentPlot and updateCurrentPos
    // highlightCurrentPlot: Use only when the currently focued plot on TimeTubes coincides with the observation
    //      change the color of the plot and move the current lines
    // updateCurrentPos: Use only when the currently focued plot on TimeTubes locates between observations
    //      move the current lines

    highlightCurrentPlot(zpos) {
        let margin = this.margin;
        let divID = this.divID;
        let JD = zpos + this.data.data.spatial[0].z;
        let sps = d3.selectAll('svg.' + divID);//.scatterplots' + this.id);
        let xItem = this.state.xItem, yItem = this.state.yItem;
        sps.each(function (d) {
            let sp = d3.select(this);
            let plots = sp.selectAll('circle');
            let spId = sp.attr('class').split(' '); // scatterplot scatterplots0 scatterplots0_0
            plots
                .attr('stroke-width', 0.5)
                .attr('stroke', 'dimgray')
                .attr('class', spId[1] + ' ' + spId[2]);
            let currentPlots = plots.filter(function (d) {
                return d.z === JD && xItem in d && yItem in d;
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
        let currentHeight = this.sp.attr('height');
        if (this.state.xItem === 'z') {
            let new_xScale = d3.scaleLinear()
                .domain([this.xMinMax[0], this.xMinMax[1]])
                .range([0, this.props.width - this.margin.left - this.margin.right]);
            let JD = zpos + this.data.data.spatial[0].z;
            this.lineH
                .style('visibility', 'hidden');
            this.lineV
                .transition()
                .duration(0)
                .style('visibility', 'visible')
                .attr('transform', 'translate(' + (new_xScale(JD)) + ',' + this.margin.top + ')');
        } else if (this.state.yItem === 'z') {
            let new_yScale = d3.scaleLinear()
                .domain([this.yMinMax[0], this.yMinMax[1]])
                .range([0, currentHeight - this.margin.top - this.margin.bottom]);
            let JD = zpos + this.data.data.spatial[0].z;
            this.lineV
                .style('visibility', 'hidden');
            this.lineH
                .transition()
                .duration(0)
                .style('visibility', 'visible')
                .attr('transform', 'translate(' + this.margin.left + ',' + (new_yScale(JD)) + ')');
        }
    }

    changePlotColor(color) {
        d3.select('#' + this.divID)
            .selectAll('circle')
            .attr('fill', function(d) {
                return color;
            });
    }

    changePlotColorMerge(sourceName, color) {
        d3.select('#' + this.divID)
            .selectAll('circle')
            .filter(function(d) {
                return sourceName.indexOf(d.source) >= 0;
            })
            .attr('fill', color);
    }

    onSelectXItem(e) {
        this.setState({xItemonPanel: e.target.value});
    }

    onSelectYItem(e) {
        this.setState({yItemonPanel: e.target.value});
    }

    computeRange(xItem, yItem) {
        // this.data.data.spatial has all observation index by x, y, z, etc.
        this.slicedData = this.data.data.spatial.filter(function (d) {
            return (xItem in d && yItem in d) && ((this.timeRange[0] <= d.z) && (d.z <= this.timeRange[1]));
        }.bind(this));
        this.xMinMax = d3.extent(this.slicedData, function (d) {
            return d[xItem];
        });
        this.yMinMax = d3.extent(this.slicedData, function (d) {
            return d[yItem];
        });
    }

    updateScatterplots(xItem, yItem) {
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
        // this.points.remove();
        if (!this.data.data.merge) {
            let plotColor = TimeTubesStore.getPlotColor(this.id);
            let currentPlotNum = this.points._groups[0].length;
            if (currentPlotNum <= this.slicedData.length) {
                let now = this.point_g
                    .selectAll("circle")
                    .data(this.slicedData);
                let enter = now
                    .enter()
                    .append('circle');
                this.points = enter.merge(now);
                this.points
                    .attr('cx', function(d) { 
                        return this.xScale(d[xItem]); 
                    }.bind(this))
                    .attr('cy', function(d) { 
                        return this.yScale(d[yItem]); 
                    }.bind(this))
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
                this.points = this.point_g
                    .selectAll("circle")
                    .data(this.slicedData)
                    .attr('cx', function(d) { 
                        return this.xScale(d[xItem]); 
                    }.bind(this))
                    .attr('cy', function(d) { 
                        return this.yScale(d[yItem]); 
                    }.bind(this))
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
                this.points.exit().remove();
            }
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
                .attr('cx', function(d) { return this.xScale(d[xItem]); }.bind((this)))
                .attr('cy', function(d) { return this.yScale(d[yItem]); }.bind((this)))
                .select(function (d) {
                    return (xItem in d && yItem in d) ? this: null;
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

        
        // draw commentmarkers
        if (this.state.xItem === 'z' || this.state.yItem === 'z') {
            this.commentMarks
                .attr('transform', function(d) {
                    return 'translate(' + this.xScale(d.start) + ', 6)';
                }.bind(this))
                .attr('fill', function(d) {
                    return d.labelColor.replace('0x', '#');
                });
        }
    }

    onClickXAxisDone(e) {
        this.setState({
            xItem: this.state.xItemonPanel
        });

        this.computeRange(this.state.xItemonPanel, this.state.yItem);
        this.updateScatterplots(this.state.xItemonPanel, this.state.yItem);

        // change the label of the x axis
        this.xAxisText
            .text(this.data.data.lookup[this.state.xItemonPanel]);

        // make the x axis change panel hidden
        d3.select('#changeXAxisPanel_' + this.SPID)
            .transition()
            .duration(50)
            .style('visibility', 'hidden');
    }

    onClickYAxisDone(e) {
        this.setState({
            yItem: this.state.yItemonPanel
        });
        this.computeRange(this.state.xItem, this.state.yItemonPanel);
        this.updateScatterplots(this.state.xItem, this.state.yItemonPanel);

        // change the label of the y axis
        this.yAxisText
            .text(this.data.data.lookup[this.state.yItemonPanel]);

        // make the y axis change panel hidden
        d3.select('#changeYAxisPanel_' + this.SPID)
            .transition()
            .duration(50)
            .style('visibility', 'hidden');
    }

    reset() {
        this.sp.transition()
            .duration(500)
            .call(this.zoom.transform, d3.zoomIdentity);
    }

    render() {
        if (d3.selectAll('svg#scatterplotsSVG_' + this.SPID).size() > 0) {
            this.drawScatterplots();
        }
        let xItems = [], yItems = [];
        let lookup = this.data.data.lookup;
        for (let key in lookup) {
            let label = '';
            if (lookup[key].length > 1) {
                label = lookup[key].join(',');
            } else {
                label = lookup[key];
            }
            if (label.indexOf('JD') < 0) {
                xItems.push(
                    <div className="form-check" key={label}>
                        <input type='radio' name={"selectXAxisForm_" + this.SPID} value={key} checked={this.state.xItemonPanel === key} onChange={this.onSelectXItem.bind(this)}/>
                        <label className="form-check-label" htmlFor="inlineCheckbox1" key={label}>{label}</label>
                    </div>);
                yItems.push(
                    <div className="form-check" key={label}>
                        <input type='radio' name={"selectYAxisForm_" + this.SPID} value={key} checked={this.state.yItemonPanel === key} onChange={this.onSelectYItem.bind(this)}/>
                        <label className="form-check-label" htmlFor="inlineCheckbox1" key={label}>{label}</label>
                    </div>);
            } else {
                xItems.unshift(
                    <div className="form-check" key={label}>
                        <input type='radio' name={"selectXAxisForm_" + this.SPID} value={key} checked={this.state.xItemonPanel === key} onChange={this.onSelectXItem.bind(this)}/>
                        <label className="form-check-label" htmlFor="inlineCheckbox1" key={label}>{label}</label>
                    </div>);
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
                     id={'changeXAxisPanel_' + this.SPID}
                     style={{visibility: 'hidden', textAlign: 'center'}}>
                    <h6>Change x axis</h6>
                    <div id={'changeXAxisItem_' + this.SPID}
                         style={{float: 'left', textAlign: 'left'}}>
                        <form id={"selectXAxisForm_" + this.SPID}>
                            {xItems}
                        </form>
                    </div>
                    <button className="btn btn-primary btn-sm"
                            id={'changeXAxisBtn_' + this.SPID}
                            onClick={this.onClickXAxisDone.bind(this)}>Done</button>
                </div>
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
