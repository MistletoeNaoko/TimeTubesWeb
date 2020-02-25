import React from 'react';
import * as d3 from 'd3';
import * as FeatureAction from '../Actions/FeatureAction';
import * as domActions from '../lib/domActions';
import {formatValue} from '../lib/2DGraphLib';
import AppStore from '../Stores/AppStore';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';

d3.selection.prototype.moveToFront =
    function() {
        return this.each(function(){this.parentNode.appendChild(this);});
    };

export default class ResultTimeline extends React.Component {
    constructor(props) {
        super();
        // this.id = props.id;
        // this.results = props.results;
        this.data = DataStore.getData(props.id);
        this.margin = {left: 20, right: 20};
        // this.height = props.height;
        // this.width = 0;
        this.state = {
            id: props.id,
            results: props.results,
            importedResults: [],
            // data: DataStore.getData(props.id),
            height: props.height,
            width: 0
        };

        this.resultsVQ = null;
        this.resultsFlare = null;
        this.resultsRotation = null;
        this.resultsAnomaly = null;
    }

    render() {
        // if (document.getElementById('resultTimeline_' + this.state.id)) {
        //     if ($('#resultTimelineArea_' + this.state.id).width() > 200) {
        //         this.updateTimeline();
        //     }
        // }
        return (
            <div
                id={'resultTimeline_' + this.state.id}
                className='timeline'>
            </div>
        );
    }

    componentDidMount() {
        this.initializeTimeline();
        this.setUpTimeline();

        FeatureStore.on('updateShownResults', (results) => {
            this.updateTimeline();
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            this.setState({
                width: $('#resultTimelineArea_' + this.state.id).width()
            });
            this.resizeTimeLine();
        });
        AppStore.on('resizeExtractionResultsArea', () => {
            this.setState({
                width: $('#resultTimelineArea_' + this.state.id).width()
            });
            this.resizeTimeLine();
        });
        FeatureStore.on('recoverQuery', (query) => {
            if (FeatureStore.getMode() === 'QBE' && this.state.results.length > 0) {
                this.setState({
                    width: Math.max($('#resultTimelineArea_' + this.state.id).width(), 400)
                });
                this.resizeTimeLine();
            }
        });
        FeatureStore.on('importResultsFromFile', (results) => {
            let fileName = DataStore.getFileName(this.state.id);
            let importedResults = results.filter(result => result.fileName === fileName);
            this.setState({
                importedResults: importedResults
            });
            this.overlapImportedResults(importedResults);
        });
    }

    componentWillUnmount() {
        let parent = document.getElementById('resultTimeline_' + this.state.id);
        if (parent) {
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
            parent.parentNode.removeChild(parent);
        }
    }

    initializeTimeline() {
        this.svg = d3.select('#resultTimeline_' + this.state.id)
            .append('svg')
            .attr('id', 'resultTimelineSVG_' + this.state.id);
        this.xScale = d3.scaleLinear()
            .domain([this.data.data.meta.min.z, this.data.data.meta.max.z]);
        this.xAxis = this.svg
            .append('g')
            .attr('class', 'x-axis');

        this.tooltip = d3.select('#resultTimeline_' + this.state.id)
            .append('div')
            .attr('class', 'tooltip')
            .attr('id', 'tooltipResultTimeline_' + this.state.id)
            .style('opacity', 0.75)
            .style('visibility', 'hidden');
    }

    updateTimeline() {
        // this.id = this.props.id;
        // this.results = this.props.results;
        this.data = DataStore.getData(this.props.id);
        // this.height = this.props.height;
        this.setState({
            id: this.props.id,
            results: this.props.results,
            height: this.props.height
        });

        this.resultsVQ = null;
        this.resultsFlare = null;
        this.resultsRotation = null;
        this.resultsAnomaly = null;

        this.setUpTimeline();
    }

    setUpTimeline() {
        let parentArea = $('#resultTimelineArea_' + this.state.id);
        let outerWidth = parentArea.width(), outerHeight = this.state.height;
        // this.width = outerWidth;
        this.setState({
            width: outerWidth
        });
        let width = outerWidth - this.margin.left - this.margin.right,
            height = outerHeight;// - margin.top - margin.bottom;

        this.svg
            .attr('width', outerWidth)
            .attr('height', outerHeight);
        
        this.xScale
            .domain([this.data.data.meta.min.z, this.data.data.meta.max.z])
            .nice()
            .range([0, width]);

        this.xLabel = d3.axisBottom(this.xScale)
            .ticks(10)
            .tickSize(10);

        this.xAxis
            .attr('transform', 'translate(' + this.margin.left + ',' + (height / 2 - 5) + ')')
            .call(this.xLabel);


        let resultsVQ = this.state.results.filter(d => d.distance !== undefined);
        let resultsRotation = this.state.results.filter(d => d.angle);
        let resultsFlare = [];
        this.state.results.forEach(d => {
            if (d.V) {
                resultsFlare = resultsFlare.concat(d);
            } else if (d.flares) {
                resultsFlare = resultsFlare.concat(d.flares);
            }
        });
        let resultsAnomaly = this.state.results.filter(d => d.anomalyDegree);

        this.svg
            .selectAll('line.resultsVQ')
            // .data()//resultsVQ)
            // .exit()
            .remove();
        this.svg
            .selectAll('line.resultsRotation')
            // .data(resultsRotation)
            // .exit()
            .remove();
        this.svg
            .selectAll('circle.resultsFlare')
            // .data(resultsFlare)
            // .exit()
            .remove();
        this.svg
            .selectAll('circle.resultsAnomaly')
            // .data(resultsAnomaly)
            // .exit()
            .remove();

        if (resultsVQ.length > 0) {
            this.resultsVQ = this.svg
                .selectAll('line.resultsVQ')
                .data(resultsVQ)
                .enter()
                .append('line')
                .attr('class', 'resultsVQ')
                .attr('x1', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('y1', height / 2 - 5)
                .attr('x2', function(d) {
                    return this.xScale(d.start + d.period);
                }.bind(this))
                .attr('y2', height / 2 - 5)
                .attr('stroke', '#1d95c6')
                .attr('stroke-width', 20)
                .attr('opacity', 0.5)
                .attr('transform', 'translate(' + this.margin.left + ',0)')
                .on('mouseover', this.timelineMouseOver())
                .on('mouseout', this.timelineMouseOut())
                .on('click', this.timelineClick());
        }
        if (resultsRotation.length > 0) {
            this.resultsRotation = this.svg
                .selectAll('line.resultsRotation')
                .data(resultsRotation)
                .enter()
                .append('line')
                .attr('class', 'resultsRotation')
                .attr('x1', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('y1', height / 2 - 5)
                .attr('x2', function(d) {
                    return this.xScale(d.start + d.period);
                }.bind(this))
                .attr('y2', height / 2 - 5)
                .attr('stroke', '#80b139')
                .attr('stroke-width', 20)
                .attr('opacity', 0.5)
                .attr('transform', 'translate(' + this.margin.left + ',0)')
                .on('mouseover', this.timelineMouseOver())
                .on('mouseout', this.timelineMouseOut())
                .on('click', this.timelineClick());
        }
        if (resultsFlare.length > 0) {
            this.resultsFlare = this.svg
                .selectAll('circle.resultsFlare')
                .data(resultsFlare)
                .enter()
                .append('circle')
                .attr('class', 'resultsFlare')
                .attr('cx', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('cy', height / 2 - 5)
                .attr('r', 10)
                .attr('fill', '#f26418')
                .attr('opacity', 0.5)
                .attr('transform', 'translate(' + this.margin.left + ',0)')
                .on('mouseover', this.timelineMouseOver())
                .on('mouseout', this.timelineMouseOut())
                .on('click', this.timelineClick());
        }
        if (resultsAnomaly.length > 0) {
            this.resultsAnomaly = this.svg
                .selectAll('circle.resultsAnomaly')
                .data(resultsAnomaly)
                .enter()
                .append('circle')
                .attr('class', 'resultsAnomaly')
                .attr('cx', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('cy', height / 2 - 5)
                .attr('r', 10)
                .attr('fill', '#d23430')
                .attr('opacity', 0.5)
                .attr('transform', 'translate(' + this.margin.left + ',0)')
                .on('mouseover', this.timelineMouseOver())
                .on('mouseout', this.timelineMouseOut())
                .on('click', this.timelineClick());
        }
    }

    resizeTimeLine() {
        let parentArea = $('#resultTimelineArea_' + this.state.id);
        let outerWidth = parentArea.width();
        let margin = {left: 20, right: 20};
        let width = outerWidth - this.margin.left - this.margin.right;

        this.svg
            .attr('width', outerWidth);

        this.xScale
            .range([0, width]);

        this.xLabel = d3.axisBottom(this.xScale)
            .ticks(10)
            .tickSize(10);


        this.xAxis
            .call(this.xLabel);

        if (this.resultsVQ) {
            this.resultsVQ
                .attr('x1', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('x2', function(d) {
                    return this.xScale(d.start + d.period);
                }.bind(this));
        }
        if (this.resultsRotation) {
            this.resultsRotation
                .attr('x1', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('x2', function(d) {
                    return this.xScale(d.start + d.period);
                }.bind(this));
        }
        if (this.resultsFlare) {
            this.resultsFlare
                .attr('cx', function(d) {
                    return this.xScale(d.start);
                }.bind(this));
        }
        if (this.resultsAnomaly) {
            this.resultsAnomaly
                .attr('cx', function(d) {
                    return this.xScale(d.start);
                }.bind(this));
        }
    }

    overlapImportedResults(results) {

        this.svg
            .selectAll('.importedResults')
            .remove();
    
        let resultsVQ = results.filter(d => d.distance !== undefined);
        let resultsRotation = results.filter(d => d.angle);
        let resultsFlare = [];
        results.forEach(d => {
            if (d.V) {
                resultsFlare = resultsFlare.concat(d);
            } else if (d.flares) {
                resultsFlare = resultsFlare.concat(d.flares);
            }
        });
        let resultsAnomaly = results.filter(d => d.anomalyDegree);

        if (resultsVQ.length > 0) {
            this.svg
                .selectAll('line.resultsVQ.importedResults')
                .data(resultsVQ)
                .enter()
                .append('line')
                .attr('class', 'resultsVQ importedResults')
                .attr('x1', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('y1', this.state.height / 2 - 5)
                .attr('x2', function(d) {
                    return this.xScale(d.start + d.period);
                }.bind(this))
                .attr('y2', this.state.height / 2 - 5)
                .attr('stroke', '#1d33c6')
                .attr('stroke-width', 20)
                .attr('opacity', 0.5)
                .attr('transform', 'translate(' + this.margin.left + ',0)')
                .on('mouseover', this.timelineImportedResultsMouseOver())
                .on('mouseout', this.timelineImportedReusltsMouseOut());
                // .on('click', this.timelineClick());
        }
        if (resultsRotation.length > 0) {
            this.svg
                .selectAll('line.resultsRotation.importedResults')
                .data(resultsRotation)
                .enter()
                .append('line')
                .attr('class', 'resultsRotation importedResults')
                .attr('x1', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('y1', this.state.height / 2 - 5)
                .attr('x2', function(d) {
                    return this.xScale(d.start + d.period);
                }.bind(this))
                .attr('y2', this.state.height / 2 - 5)
                .attr('stroke', '#b1a639')
                .attr('stroke-width', 20)
                .attr('opacity', 0.5)
                .attr('transform', 'translate(' + this.margin.left + ',0)')
                .on('mouseover', this.timelineImportedResultsMouseOver())
                .on('mouseout', this.timelineImportedReusltsMouseOut());
        }
        if (resultsFlare.length > 0) {
            this.svg
                .selectAll('circle.resultsFlare.importedResults')
                .data(resultsFlare)
                .enter()
                .append('circle')
                .attr('class', 'resultsFlare importedResults')
                .attr('cx', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('cy', this.state.height / 2 - 5)
                .attr('r', 10)
                .attr('fill', '#f2d118')
                .attr('opacity', 0.5)
                .attr('transform', 'translate(' + margin.left + ',0)')
                .on('mouseover', this.timelineImportedResultsMouseOver())
                .on('mouseout', this.timelineImportedReusltsMouseOut());
        }
        if (resultsAnomaly.length > 0) {
            this.svg
                .selectAll('circle.resultsAnomaly.importedResults')
                .data(resultsAnomaly)
                .enter()
                .append('circle')
                .attr('class', 'resultsAnomaly importedResults')
                .attr('cx', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('cy', this.state.height / 2 - 5)
                .attr('r', 10)
                .attr('fill', '#f2d118')
                .attr('opacity', 0.5)
                .attr('transform', 'translate(' + this.margin.left + ',0)')
                .on('mouseover', this.timelineImportedResultsMouseOver())
                .on('mouseout', this.timelineImportedReusltsMouseOut());
        }
    }

    timelineMouseOver() {
        let tooltip = this.tooltip;//d3.select('#resultTimelineTooltip');
        let xScale = this.xScale;
        let width = this.svg.attr('width');
        return function(d) {
            let selected = d3.select(this);
            if (selected.attr('stroke')) {
                selected
                    .attr('stroke', '#284a6c')
                    .moveToFront();
            } else if (selected.attr('fill')) {
                selected
                    .attr('fill', '#284a6c')
                    .moveToFront();
            }
            tooltip
                .transition()
                .duration(50)
                .style('visibility', 'visible');
            // tooltip will show details of the selected result
            let contents = '';
            for (let key in d) {
                if (key !== 'id' && key !== 'start' && key !== 'period' && key !== 'flares' && key !== 'path') {
                    let value = d[key];
                    if (typeof(d[key]) === 'object') {
                        value = '(';
                        for (let dataKey in d[key]) {
                            value += formatValue(d[key][dataKey]) + ', ';
                        }
                        value = value.slice(0, value.length - 2);
                        value += ')';
                    } else if (typeof(d[key]) === 'number') {
                        value = formatValue(d[key]);
                    }
                    contents += '<tr><td>' + domActions.transformCamelToSentence(key) + '</td>' +
                                '<td>' + value + '</td></tr>';
                }
            }
            if (xScale(d.start) < width / 2) {
                tooltip.html('<table><tbody>' + contents + '</tbody></table>')
                    .style('left', (xScale(d.start) + 50) + 'px')
                    .style('top', 10 + 'px');
            } else {
                let tooltipWidth = Number(tooltip.style('width').slice(0, -2));
                tooltip.html('<table><tbody>' + contents + '</tbody></table>')
                    .style('left', (xScale(d.start) - tooltipWidth + 20) + 'px')
                    .style('top', 10 + 'px');
            }
            // highlight the corresponding result summary
            FeatureAction.focusResultfromTimeline(d);
        };
    }

    timelineImportedResultsMouseOver() {
        let tooltip = this.tooltip;
        let xScale = this.xScale;
        let width = this.svg.attr('width');
        return function(d) {
            let selected = d3.select(this);
            if (selected.attr('stroke')) {
                selected
                    .attr('stroke', '#28286c')
                    .moveToFront();
            } else if (selected.attr('fill')) {
                selected
                    .attr('fill', '#28286c')
                    .moveToFront();
            }
            tooltip
                .transition()
                .duration(50)
                .style('visibility', 'visible');
            let contents = '';
            for (let key in d) {
                if (key !== 'fileName' && key !== 'path') {
                    let value = d[key];
                    if (Array.isArray(d[key])) {
                        value = d[key].join(', ');
                    } else if (typeof(d[key]) === 'object') {
                        value = '(';
                        for (let dataKey in d[key]) {
                            value += formatValue(d[key][dataKey]) + ', ';
                        }
                        value = value.slice(0, value.length - 2);
                        value += ')';
                    } else if (typeof(d[key]) === 'number') {
                        value = formatValue(d[key]);
                    }
                    contents += '<tr><td>' + domActions.transformCamelToSentence(key) + '</td>' +
                                '<td>' + value + '</td></tr>';
                }
            }

            if (xScale(d.start) < width / 2) {
                tooltip.html('<table><tbody>' + contents + '</tbody></table>')
                    .style('left', (xScale(d.start) + 50) + 'px')
                    .style('top', 10 + 'px');
            } else {
                let tooltipWidth = Number(tooltip.style('width').slice(0, -2));
                tooltip.html('<table><tbody>' + contents + '</tbody></table>')
                    .style('left', (xScale(d.start) - tooltipWidth + 20) + 'px')
                    .style('top', 10 + 'px');
            }
        };
    }

    timelineMouseOut() {
        let tooltip = this.tooltip;//d3.select('#resultTimelineTooltip');
        return function(d) {
            let selected = d3.select(this);
            if (d.distance) {
                selected
                    .attr('stroke', '#1d95c6');
            } else if (d.angle) {
                selected
                    .attr('stroke', '#80b139');
            } else if (d.V) {
                selected
                    .attr('fill', '#f26418');
            } else if (d.anomalyDegree) {
                selected
                    .attr('fill', '#d23430');
            }
            tooltip
                .transition()
                .duration(100)
                .style('visibility', 'hidden');
        }
    }

    timelineImportedReusltsMouseOut() {
        let tooltip = this.tooltip;//d3.select('#resultTimelineTooltip');
        return function(d) {
            let selected = d3.select(this);
            if (d.distance) {
                selected
                    .attr('stroke', '#1d33c6');
            } else if (d.angle) {
                selected
                    .attr('stroke', '#b1a639');
            } else if (d.V) {
                selected
                    .attr('fill', '#f2d118');
            } else if (d.anomalyDegree) {
                selected
                    .attr('fill', '#f2d118');
            }
            tooltip
                .transition()
                .duration(100)
                .style('visibility', 'hidden');
        }
    }

    timelineClick() {
        return function(d) {
            // highlight the corresponding result summary and show the detail of the result
            FeatureAction.selectResultFromTimeline(d);
        }
    }
}
