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
        this.state = {
            xItem: props.xItem,
            yItem: props.yItem
        };
        this.drawScatterplots(this.data);
    }


    componentWillMount() {
        TimeTubesStore.on('updateFocus', (id, zpos) => {
            if (id === this.id) {
                this.highlightCurrentPlot(zpos);
            }
        });
        ScatterplotsStore.on('resetScatterplots',  (id) => {
            console.log('resetScatter')
            if (id === this.id) {
                this.reset();
            }
        });
    }

    drawScatterplots(data) {
        let id = this.id;
        let parentArea = d3.select('#scatterplots_' + this.id);
        let elem = parentArea
            .append('div')
            .attr('id', this.divID);
        let outerWidth = 500, outerHeight = 350;
        let width = outerWidth - this.margin.left - this.margin.right;
        let height = outerHeight - this.margin.top - this.margin.bottom;

        // Pan and zoom
        this.zoom = d3.zoom()
            .scaleExtent([.5, 20])
            .extent([[0, 0], [width, height]])
            .on("zoom", zoomed);

        this.sp = elem
            .append('svg')
            .attr('width', outerWidth)
            .attr('height', outerHeight)
            .attr('class', 'scatterplot scatterplots' + this.id + ' ' + this.divID)
            .call(this.zoom);
        let xItem = this.state.xItem, yItem = this.state.yItem;
        // Draw x axis
        let xScale = d3.scaleLinear()
            .domain([this.data.data.meta.min[xItem], this.data.data.meta.max[xItem]])
            .range([0, width]);
        let xLabel = d3.axisBottom(xScale)
            .ticks(10)
            .tickSize(-height);
        let xAxis = this.sp.append("g")
            .attr("class", "x_axis " + this.divID)
            .attr("transform", "translate(" + this.margin.left + ', ' + (this.margin.top + height) + ")")
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
        let yScale = d3.scaleLinear()
            .domain([this.data.data.meta.min[yItem], this.data.data.meta.max[yItem]])
            .range([height, 0]);
        let yLabel = d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(-width)
            .tickFormat(function (d) {
                return d.toExponential(0);
            });
        let yAxis = this.sp.append("g")
            .attr("class", "y_axis "+ this.divID)
            .attr("transform", "translate(" + this.margin.left + ', ' + this.margin.top + ")")
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
            .attr("id", "clip")
            .append("rect")
            .attr("width", width)
            .attr("height", height);

        // Draw data points
        let point_g = this.sp.append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('clip-path', 'url(#clip)')
            .classed('points_g', true);
        let points = point_g
            .selectAll("circle")
            .data(this.data.data.spatial)
            .enter()
            .append("circle")
            .select(function (d) {
                return (xItem in d && yItem in d) ? this: null;
            })
            .attr("cx", function(d) { return xScale(d[xItem]); })
            .attr("cy", function(d) { return yScale(d[yItem]); })
            .attr("fill", 'gray')//d3.rgb(color[0], color[1], color[2]))
            .attr('opacity', 0.7)
            .attr('stroke-width', 0.5)
            .attr('stroke', 'dimgray')
            .attr("r", 4)
            .attr('class', this.divID)
            .on('mouseover', spMouseOver)
            .on('mouseout', spMouseOut)
            // .on('click', spClick)
            .on('dblclick', spDblClick);

        function zoomed() {
            let margin = { "top": 10, "bottom": 30, "right": 30, "left": 60 };
            // create new scale ojects based on event
            let new_xScale = d3.event.transform.rescaleX(xScale);
            let new_yScale = d3.event.transform.rescaleY(yScale);
            // update axes
            xAxis.call(xLabel.scale(new_xScale));
            yAxis.call(yLabel.scale(new_yScale));

            points
                .attr('cx', function(d) {return new_xScale(d[xItem])})
                .attr('cy', function(d) {return new_yScale(d[yItem])});

            let current = d3.select('circle.current');
            if (current._groups[0][0]) {
                let cx = current.attr('cx'), cy = current.attr('cy');
                if (cy <= 0 || height <= cy) {
                    lineH
                        .attr('transform', "translate(" + margin.left + "," + cy + ")")
                        .style('opacity', 0);
                } else {
                    lineH.transition()
                        .duration(0)
                        .attr('transform', "translate(" + margin.left + "," + cy + ")")
                        .style('opacity', 0.75);
                }
                if (cx <= 0 || width <= cx) {
                    lineV
                        .attr('transform', "translate(" + cx + "," + margin.top + ")")
                        .style('opacity', 0);
                } else {
                    lineV.transition()
                        .duration(0)
                        .attr('transform', "translate(" + cx + "," + margin.top + ")")
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
        let sps = d3.selectAll('.scatterplots' + this.id);

        sps.selectAll('circle')
            .attr('stroke-width', 0.5)
            .attr('stroke', 'dimgray')
            .attr('class', this.divID);
        let currentPlot = sps.selectAll('circle').filter(function (d) {
            return d.z === JD;
        });
        currentPlot
            .attr('stroke', 'orange')
            .attr('stroke-width', 1)
            .attr('class', this.divID + ' current')
            .moveToFront()
            .each(moveLines);
        function moveLines(d) {
            // plot (circle) has only one class named like 'scatterplots0_0'
            let margin = { "top": 10, "bottom": 30, "right": 30, "left": 60 };
            let circle = d3.select(this);
            let lineClass = circle.attr('class').split(' ')[0];
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