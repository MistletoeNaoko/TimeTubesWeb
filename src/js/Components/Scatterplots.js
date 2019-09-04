import React from 'react';
import * as d3 from 'd3';
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
        this.width = 500;
        this.height = 350;
        this.xMinMax = [0, 0];
        this.yMinMax = [0, 0];
        this.state = {
            xItem: props.xItem,
            yItem: props.yItem,
            xItemonPanel: props.xItem,
            yItemonPanel: props.yItem
        };
    }


    componentWillMount() {
        TimeTubesStore.on('updateFocus', (id, zpos, flag) => {
            // when flag is true, change the color of the plot
            if (id === this.id) {
                if (flag)
                    this.highlightCurrentPlot(zpos)
                else
                    this.updateCurrentPos(zpos);
            }
        });
        ScatterplotsStore.on('resetScatterplots',  (id) => {
            if (id === this.id) {
                this.reset();
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
            }
        });
    }

    componentDidMount() {
        this.drawScatterplots(this.data);
        // let xAxisPanel = document.getElementById("selectXAxisForm_" + this.SPID);
        // let yAxisPanel = document.getElementById("selectYAxisForm_" + this.SPID);
        // let xItems = xAxisPanel["selectXAxisForm_" + this.SPID];
        // let yItems = yAxisPanel["selectYAxisForm_" + this.SPID];
        // let currentX = this.data.data.lookup[this.state.xItem];
        // let currentY = this.data.data.lookup[this.state.yItem];
        // for (let i = 0; i < xItems.length; i++) {
        //     if (currentX.indexOf(xItems[i].value) >= 0) {
        //         xItems[i].checked = true;
        //     }
        // }
        // for (let i = 0; i < yItems.length; i++) {
        //     if (currentY.indexOf(yItems[i].value) >= 0) {
        //         yItems[i].checked = true;
        //     }
        // }
    }

    drawScatterplots(data) {
        let id = this.id;
        let SPID = this.SPID;
        let divID = this.divID;
        let margin = this.margin;
        // let parentArea = d3.select('#scatterplots_' + this.id);
        // let elem = parentArea
        //     .append('div')
        //     .attr('id', this.divID);
        // let elem = d3.select('#' + this.divID);
        let outerWidth = this.width, outerHeight = this.height;
        let width = outerWidth - this.margin.left - this.margin.right;
        let height = outerHeight - this.margin.top - this.margin.bottom;

        // Pan and zoom
        this.zoom = d3.zoom()
            .scaleExtent([.5, 20])
            .extent([[0, 0], [width, height]])
            .on("zoom", zoomed.bind(this));

        this.sp = d3.select('#' + this.divID)
            .append('svg')
            .attr('id', 'scatterplotsSVG_' + this.SPID)
            .attr('width', outerWidth)
            .attr('height', outerHeight)
            .attr('class', 'scatterplot scatterplots' + this.id + ' ' + this.divID)
            .call(this.zoom)
            .on("dblclick.zoom", null);
        let xItem = this.state.xItem, yItem = this.state.yItem;
        // Draw x axis
        this.xScale = d3.scaleLinear()
            .domain([this.data.data.meta.min[xItem], this.data.data.meta.max[xItem]])
            .nice()
            .range([0, width]);
        this.xMinMax = this.xScale.domain();

        this.xLabel = d3.axisBottom(this.xScale)
            .ticks(10)
            .tickSize(-height);
        this.xAxis = this.sp.append("g")
            .attr("class", "x_axis " + this.divID)
            .attr("transform", "translate(" + this.margin.left + ',' + (this.margin.top + height) + ")")
            .call(this.xLabel);
        d3.selectAll('g.x_axis.' + this.divID)
            .append('text')
            .attr('class', 'axisLabel ' + this.divID)
            .attr('x', width / 2)
            .attr('y', this.margin.bottom / 2 + 10)
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .text(this.data.data.lookup[xItem])
            .on('click', spXLabelClick.bind(this))
            .on('mouseover', spXLabelMouseOver)
            .on('mouseout', spXLabelMouseOut);

        // Draw y axis
        this.yScale = d3.scaleLinear()
            .domain([this.data.data.meta.min[yItem], this.data.data.meta.max[yItem]])
            .nice()
            .range([height, 0]);
        this.yMinMax = this.yScale.domain();
        this.yLabel = d3.axisLeft(this.yScale)
            .ticks(5)
            .tickSize(-width)
            .tickFormat(function (d) {
                return d.toExponential(0);
            });
        this.yAxis = this.sp.append("g")
            .attr("class", "y_axis "+ this.divID)
            .attr("transform", "translate(" + this.margin.left + ',' + this.margin.top + ")")
            .call(this.yLabel);
        d3.selectAll('g.y_axis.' + this.divID)
            .append('text')
            .attr('class', 'axisLabel ' + this.divID)
            .attr('x', -height / 2)
            .attr('y', -this.margin.left / 2 - 10)
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .text(this.data.data.lookup[yItem])
            .on('click', spYLabelClick.bind(this))
            .on('mouseover', spYLabelMouseOver)
            .on('mouseout', spYLabelMouseOut);

        // tooltip
        let tooltip = d3.select('#scatterplots_' + this.id)
            .append('div')
            .attr('class', 'tooltip ' + this.divID)
            .style('opacity', 0.75)
            .style('visibility', 'hidden');

        // the panels for changing the item of each axis
        // let changeXAxisPanel = d3.select('#scatterplots_' + this.id)
        //     .append('div')
        //     .attr('class', 'tooltip')
        //     .attr('id', 'changeXAxisPanel_' + this.id)
        //     .style('opacity', 0);
        // let changeXAxisPanel = d3.select('#scatterplots_' + this.id)
        //     .append('div')
        //     .attr('class', 'tooltip')
        //     .attr('id', 'changeYAxisPanel_' + this.id)
        //     .style('opacity', 0);

        let curLineH = [[0, this.margin.top], [width, this.margin.top]];
        let curLineV = [[this.margin.left, 0], [this.margin.left, height]];
        let line = d3.line()
            .x(function(d){ return d[0]; })
            .y(function(d){ return d[1]; });
        let lineH = this.sp.append('path')
            .attr('d', line(curLineH))
            .attr('stroke', 'orange')
            .attr("fill", "none")
            .attr('class', 'currentLineH ' + this.divID + ' scatterplots' + this.id)
            .style('opacity', 0.75)
            .style('visibility', 'hidden');
        let lineV = this.sp.append('path')
            .attr('d', line(curLineV))
            .attr('stroke', 'orange')
            .attr("fill", "none")
            .attr('class', 'currentLineV ' + this.divID + ' scatterplots' + this.id)
            .style('opacity', 0.75)
            .style('visibility', 'hidden');

        this.sp.append("rect")
            .attr("width", width)
            .attr("height", height)
            .style("fill", "none")
            .style("pointer-events", "all")
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

        // create a clipping region
        this.sp.append("defs").append("clipPath")
            .attr("id", "clipScatterplots")
            .append("rect")
            .attr("width", width)
            .attr("height", height);

        // Draw data points
        let points;
        if (!this.data.data.merge) {
            let plotColor = TimeTubesStore.getPlotColor(this.id);
            let point_g = this.sp.append('g')
                .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
                .attr('clip-path', 'url(#clipScatterplots)')
                .classed('points_g', true);
            points = point_g
                .selectAll("circle")
                .data(this.data.data.spatial)
                .enter()
                .append("circle")
                .select(function (d) {
                    return (xItem in d && yItem in d) ? this: null;
                })
                .attr("cx", function(d) { return this.xScale(d[xItem]); }.bind((this)))
                .attr("cy", function(d) { return this.yScale(d[yItem]); }.bind((this)))
                .attr("fill", plotColor)//d3.rgb(color[0], color[1], color[2]))
                .attr('opacity', 0.7)
                .attr('stroke-width', 0.5)
                .attr('stroke', 'dimgray')
                .attr("r", 4)
                .attr('class', this.divID + ' scatterplots' + this.id)
                .on('mouseover', spMouseOver)
                .on('mouseout', spMouseOut)
                // .on('click', spClick)
                .on('dblclick', spDblClick);
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
            let point_g = this.sp.append('g')
                .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
                .attr('clip-path', 'url(#clip)')
                .classed('points_g', true);
            points = point_g
                .selectAll("circle")
                .data(this.data.data.spatial)
                .enter()
                .append("circle")
                .select(function (d) {
                    return (xItem in d && yItem in d) ? this: null;
                })
                .attr("cx", function(d) { return this.xScale(d[xItem]); }.bind((this)))
                .attr("cy", function(d) { return this.yScale(d[yItem]); }.bind((this)))
                .attr("fill", function (d) {
                    return plotColors[idNameLookup[d.source]];
                })//d3.rgb(color[0], color[1], color[2]))
                .attr('opacity', 0.7)
                .attr('stroke-width', 0.5)
                .attr('stroke', 'dimgray')
                .attr("r", 4)
                .attr('class', this.divID + ' scatterplots' + this.id)
                .on('mouseover', spMouseOver)
                .on('mouseout', spMouseOut)
                // .on('click', spClick)
                .on('dblclick', spDblClick);
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

            this.xMinMax = new_xScale.domain();
            this.yMinMax = new_yScale.domain();
            // update axes
            this.xAxis.call(this.xLabel.scale(new_xScale));
            this.yAxis.call(this.yLabel.scale(new_yScale));

            points
                .attr('cx', function(d) {return new_xScale(d[xItem])})
                .attr('cy', function(d) {return new_yScale(d[yItem])});

            // if (lineH) {
            //     lineH.attr('transform', 'translate(' + this.margin.left + ',' + new_yScale(lineHPos) + ')');
            // }
            // if (lineV) {
            //     lineV.attr('transform', 'translate(' + new_xScale(lineVPos) + ',' + this.margin.top + ')');
            // }
            let current = d3.select('circle.current.' + this.divID);

            if (current._groups[0][0]) {
                let cx = current.attr('cx'), cy = current.attr('cy');
                if (cy <= 0 || height <= cy) {
                    lineH
                        .attr('transform', "translate(" + this.margin.left + "," + cy + ")")
                        .style('visibility', 'hidden');
                } else {
                    lineH.transition()
                        .duration(0)
                        .attr('transform', "translate(" + this.margin.left + "," + cy + ")")
                        .style('visibility', 'visible');
                }
                if (cx <= 0 || width <= cx) {
                    lineV
                        .attr('transform', "translate(" + cx + "," + this.margin.top + ")")
                        .style('visibility', 'hidden');
                } else {
                    lineV.transition()
                        .duration(0)
                        .attr('transform', "translate(" + cx + "," + this.margin.top + ")")
                        .style('visibility', 'visible');
                }
            }
        }
        function spMouseOver(d) {
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
        function spMouseOut(d) {
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
        // function spClick(d) {
        //     let curColor = d3.color(d3.select(this).style('fill'));
        //     if (curColor.r === color[0] && curColor.g === color[1] && curColor.b === color[2]) {
        //         d3.selectAll('circle')
        //             .attr('fill', d3.rgb(color[0], color[1], color[2]))
        //             .attr('stroke-width', 0.5)
        //             .attr('stroke', 'dimgray');
        //         d3.select(this)
        //             .attr('fill', 'red')
        //             .attr('stroke-width', 1)
        //             .attr('stroke', 'black')
        //             .moveToFront();
        //         let datainfo = '<table class="table_values">';
        //         for  (let key in d) {
        //             datainfo += '<tr>' +
        //                 '<td class="label_values"><i>' +
        //                 key +
        //                 '</i></td>' +
        //                 '<td class="current_values">' +
        //                 d[key] +
        //                 '</td></tr>';
        //         }
        //         datainfo += '</table>';
        //         detail.innerHTML = datainfo;
        //     } else {
        //         d3.select(this)
        //             .attr('fill', d3.rgb(color[0], color[1], color[2]))
        //             .attr('stroke-width', 0.5)
        //             .attr('stroke', 'dimgray');
        //     }
        // }
        function spDblClick(d, i) {
            TimeTubesAction.searchTime(id, d.z);
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

    // differences between highlightCurrentPlot and updateCurrentPos
    // highlightCurrentPlot: Use only when the currently focued plot on TimeTubes coincides with the observation
    //      change the color of the plot and move the current lines
    // updateCurrentPos: Use only when the currently focued plot on TimeTubes locates between observations
    //      move the current lines

    highlightCurrentPlot(zpos) {
        let margin = this.margin;
        let JD = zpos + this.data.data.spatial[0].z;
        let sps = d3.selectAll('svg.scatterplots' + this.id);
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
            let currentLineH = d3.selectAll('.currentLineH.' + lineClass);
            let currentLineV = d3.selectAll('.currentLineV.' + lineClass);
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
        if (this.state.xItem === 'z') {
            let new_xScale = d3.scaleLinear()
                .domain([this.xMinMax[0], this.xMinMax[1]])
                .range([0, this.width - this.margin.left - this.margin.right]);
            let JD = zpos + this.data.data.spatial[0].z;
            let currentLineH = d3.selectAll('.currentLineH.' + this.divID + '.scatterplots' + this.id);
            let currentLineV = d3.selectAll('.currentLineV.' + this.divID + '.scatterplots' + this.id);
            currentLineH
                .style('visibility', 'hidden');
            currentLineV
                .transition()
                .duration(0)
                .style('visibility', 'visible')
                .attr('transform', 'translate(' + (new_xScale(JD)) + ',' + this.margin.top + ')');
        } else if (this.state.yItem === 'z') {
            let new_yScale = d3.scaleLinear()
                .domain([this.yMinMax[0], this.yMinMax[1]])
                .range([0, this.height - this.margin.top - this.margin.bottom]);
            let JD = zpos + this.data.data.spatial[0].z;
            let currentLineH = d3.selectAll('.currentLineH.' + this.divID + '.scatterplots' + this.id);
            let currentLineV = d3.selectAll('.currentLineV.' + this.divID + '.scatterplots' + this.id);
            currentLineV
                .style('visibility', 'hidden');
            currentLineH
                .transition()
                .duration(0)
                .style('visibility', 'visible')
                .attr('transform', 'translate(' + this.margin.left + ',' + (new_yScale(JD)) + ')');
        }
    }

    changePlotColor(color) {
        d3.selectAll('circle')
            .attr('fill', color);
    }

    onSelectXItem(e) {
        this.setState({xItemonPanel: e.target.value});
    }

    onSelectYItem(e) {
        this.setState({yItemonPanel: e.target.value});
    }

    onClickXAxisDone(e) {
        this.setState({
            xItem: this.state.xItemonPanel
        });
        let min = this.data.data.meta.min[this.state.xItemonPanel];
        let max = this.data.data.meta.max[this.state.xItemonPanel];
        // update the domain of the y axis
        this.xScale
            .domain([min, max])
            .nice();

        // move all plots to the new positions
        this.sp.selectAll('circle')
            .data(this.data.data.spatial)
            .transition()
            .duration(1000)
            .attr('cx', function (d) {
                return this.xScale(d[this.state.xItemonPanel]);
            }.bind((this)))
            .attr('cy', function (d) {
                return this.yScale(d[this.state.yItem]);
            }.bind((this)));

        // update how to show ticks
        if (Math.max(Math.abs(Math.log10(min)), Math.abs(Math.log10(max))) >= 3) {
            this.xLabel
                .tickFormat(function (d) {
                return d.toExponential(0);
                });
        } else {
            this.xLabel
                .tickFormat(function (d) {
                    return d;
                });
        }

        // change ticks on the x axis
        this.xAxis
            .transition()
            .duration(100)
            .call(this.xLabel.scale(this.xScale));
        // change the label of the x axis
        d3.select('g.x_axis.' + this.divID)
            .select('text.axisLabel.' + this.divID)
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
        let min = this.data.data.meta.min[this.state.yItemonPanel];
        let max = this.data.data.meta.max[this.state.yItemonPanel];
        // update the domain of the y axis
        this.yScale
            .domain([this.data.data.meta.min[this.state.yItemonPanel], this.data.data.meta.max[this.state.yItemonPanel]])
            .nice();

        // move all plots to the new positions
        this.sp.selectAll('circle')
            .data(this.data.data.spatial)
            .transition()
            .duration(1000)
            .attr('cx', function (d) {
                return this.xScale(d[this.state.xItem]);
            }.bind((this)))
            .attr('cy', function (d) {
                return this.yScale(d[this.state.yItemonPanel]);
            }.bind((this)));

        // update how to show ticks
        if (Math.max(Math.abs(Math.log10(min)), Math.abs(Math.log10(max))) >= 3) {
            this.yLabel
                .tickFormat(function (d) {
                    return d.toExponential(0);
                });
        } else {
            this.yLabel
                .tickFormat(function (d) {
                    return d;
                });
        }

        // change ticks on the x axis
        this.yAxis
            .transition()
            .duration(100)
            .call(this.yLabel.scale(this.yScale));
        // change the label of the y axis
        d3.select('g.y_axis.' + this.divID)
            .select('text.axisLabel.' + this.divID)
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
                {/*<svg id={'scatterplotsSVG_' + this.SPID}></svg>*/}
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
                    <button className="btn btn-secondary btn-sm"
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
                    <button className="btn btn-secondary btn-sm"
                            id={'changeYAxisBtn_' + this.SPID}
                            onClick={this.onClickYAxisDone.bind(this)}>Done</button>
                </div>
            </div>
        );
    }
}