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
        this.data = DataStore.getData(this.id);
        this.width = 500;
        this.height = 350;
        this.xMinMax = [0, 0];
        this.yMinMax = [0, 0];
        this.state = {
            xItem: props.xItem,
            yItem: props.yItem
        };
        this.drawScatterplots(this.data);
    }


    componentWillMount() {
        TimeTubesStore.on('updateFocus', (id) => {
            if (id === this.id) {
                let zpos = TimeTubesStore.getFocused(this.id);
                this.highlightCurrentPlot(zpos);
            }
        });
        ScatterplotsStore.on('resetScatterplots',  (id) => {
            if (id === this.id) {
                this.reset();
            }
        });
        TimeTubesStore.on('updateCurrentPos', (id, zpos) => {
            if (id === this.id) {
                this.updateCurrentPos(zpos);
            }
        });
        TimeTubesStore.on('changePlotColor', (id) => {
            if (id === this.id) {
                this.changePlotColor(TimeTubesStore.getPlotColor(id));
            }
        });
    }

    drawScatterplots(data) {
        let id = this.id;
        let parentArea = d3.select('#scatterplots_' + this.id);
        console.log('scatterplots' + parentArea)
        let elem = parentArea
            .append('div')
            .attr('id', this.divID);
        let outerWidth = this.width, outerHeight = this.height;
        let width = outerWidth - this.margin.left - this.margin.right;
        let height = outerHeight - this.margin.top - this.margin.bottom;

        // Pan and zoom
        this.zoom = d3.zoom()
            .scaleExtent([.5, 20])
            .extent([[0, 0], [width, height]])
            .on("zoom", zoomed.bind(this));

        this.sp = elem
            .append('svg')
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

        let xLabel = d3.axisBottom(this.xScale)
            .ticks(10)
            .tickSize(-height);
        let xAxis = this.sp.append("g")
            .attr("class", "x_axis " + this.divID)
            .attr("transform", "translate(" + this.margin.left + ',' + (this.margin.top + height) + ")")
            .call(xLabel);
        d3.selectAll('g.x_axis.' + this.divID)
            .append('text')
            .attr('class', 'axisLabel ' + this.divID)
            .attr('x', width / 2)
            .attr('y', this.margin.bottom / 2 + 10)
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .text(this.data.data.lookup[xItem]);

        // Draw y axis
        this.yScale = d3.scaleLinear()
            .domain([this.data.data.meta.min[yItem], this.data.data.meta.max[yItem]])
            .nice()
            .range([height, 0]);
        this.yMinMax = this.yScale.domain();
        let yLabel = d3.axisLeft(this.yScale)
            .ticks(5)
            .tickSize(-width)
            .tickFormat(function (d) {
                return d.toExponential(0);
            });
        let yAxis = this.sp.append("g")
            .attr("class", "y_axis "+ this.divID)
            .attr("transform", "translate(" + this.margin.left + ',' + this.margin.top + ")")
            .call(yLabel);
        d3.selectAll('g.y_axis.' + this.divID)
            .append('text')
            .attr('class', 'axisLabel ' + this.divID)
            .attr('x', -height / 2)
            .attr('y', -this.margin.left / 2 - 10)
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .text(this.data.data.lookup[yItem]);

        let tooltip = d3.select('#scatterplots_' + this.id)
            .append('div')
            .attr('class', 'tooltip ' + this.divID)
            .style('opacity', 0);

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
            .style('opacity', 0);
        let lineV = this.sp.append('path')
            .attr('d', line(curLineV))
            .attr('stroke', 'orange')
            .attr("fill", "none")
            .attr('class', 'currentLineV ' + this.divID + ' scatterplots' + this.id)
            .style('opacity', 0);

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
            xAxis.call(xLabel.scale(new_xScale));
            yAxis.call(yLabel.scale(new_yScale));

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
                        .style('opacity', 0);
                } else {
                    lineH.transition()
                        .duration(0)
                        .attr('transform', "translate(" + this.margin.left + "," + cy + ")")
                        .style('opacity', 0.75);
                }
                if (cx <= 0 || width <= cx) {
                    lineV
                        .attr('transform', "translate(" + cx + "," + this.margin.top + ")")
                        .style('opacity', 0);
                } else {
                    lineV.transition()
                        .duration(0)
                        .attr('transform', "translate(" + cx + "," + this.margin.top + ")")
                        .style('opacity', 0.75);
                }
            }
        }
        function spMouseOver(d) {
            d3.select(this)
                .attr('stroke-width', 1)
                .attr('stroke', 'black');
            tooltip.transition()
                .duration(50)
                .style('opacity', 0.75);
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
                .style("opacity", 0);
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
    }

    highlightCurrentPlot(zpos) {
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
            let margin = { "top": 10, "bottom": 30, "right": 30, "left": 60 };
            let circle = d3.select(this);
            let lineClass = circle.attr('class').split(' ')[1]; // scatterplots0_0
            let currentLineH = d3.selectAll('.currentLineH.' + lineClass);
            let currentLineV = d3.selectAll('.currentLineV.' + lineClass);
            currentLineH
                .transition()
                .duration(0)
                .style('opacity', 0.75)
                .attr('transform', 'translate(' + margin.left + ',' + (circle.attr('cy')) + ')');
            currentLineV
                .transition()
                .duration(0)
                .style('opacity', 0.75)
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
                .style('opacity', 0);
            currentLineV
                .transition()
                .duration(0)
                .style('opacity', 0.75)
                .attr('transform', 'translate(' + (new_xScale(JD)) + ',' + this.margin.top + ')');
        } else if (this.state.yItem === 'z') {
            let new_yScale = d3.scaleLinear()
                .domain([this.yMinMax[0], this.yMinMax[1]])
                .range([0, this.height - this.margin.top - this.margin.bottom]);
            let JD = zpos + this.data.data.spatial[0].z;
            let currentLineH = d3.selectAll('.currentLineH.' + this.divID + '.scatterplots' + this.id);
            let currentLineV = d3.selectAll('.currentLineV.' + this.divID + '.scatterplots' + this.id);
            currentLineV
                .style('opacity', 0);
            currentLineH
                .transition()
                .duration(0)
                .style('opacity', 0.75)
                .attr('transform', 'translate(' + this.margin.left + ',' + (new_yScale(JD)) + ')');
        }
    }

    changePlotColor(color) {
        d3.selectAll('circle')
            .attr('fill', color);
    }

    reset() {
        this.sp.transition()
            .duration(500)
            .call(this.zoom.transform, d3.zoomIdentity);
    }

    render() {
        return (
            <div>
            </div>
        );
    }
}