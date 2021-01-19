import React from 'react';
import * as d3 from 'd3';
import {resizeExtractionResultsArea} from '../Actions/AppAction';
import DataStore from '../Stores/DataStore';
import ClusteringStore from '../Stores/ClusteringStore';
import AppStore from '../Stores/AppStore';

export default class ClusteringTimeline extends React.Component {
    constructor() {
        super();
        this.margin = {left: 20, right: 20};
        this.datasets = [];
        this.custerCenters = [];
        this.subsequences = [];
        this.labels = [];
        this.clusters = [];
        this.clusterColors = [];
        this.timelines = [];
        this.xScales = [];
        this.xLabels = [];
        this.xAxes = [];
    }

    render() {
        return (
            <div id='clusteringTimeline'
                className='resultAreaElem'
                ref={mount => {
                    this.mount = mount;
                }}>
            </div>
        );
    }

    componentDidMount() {
        ClusteringStore.on('showClusteringResults', () => {
            console.log('show clustering results')
            this.datasets = ClusteringStore.getDatasets();
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.labels = ClusteringStore.getLabels();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.divideDataIntoCluster();
            this.drawTimelines();
        });
        AppStore.on('resizeExtractionResultsArea', () => {
            console.log('resize clustering timeline')
            this.resizeTimelines();
        });
    }

    divideDataIntoCluster() {
        this.clusters = [];
        for (let i = 0; i < this.clusterCenters.length; i++) {
            this.clusters.push([]);
        }
        for (let i = 0; i < this.labels.length; i++) {
            if (typeof(this.labels[i]) === 'object') {
                this.clusters[this.labels[i].cluster].push(i);
            } else {
                this.clusters[this.labels[i]].push(i);
            }
        }
    }

    drawTimelines() {
        // TODO: それまでにタイムラインが描かれていたら削除
        if (this.timelines.length > 0) {
            $('#clusteringTimelineArea').remove();
            this.timelines = [];
            this.xScales = [];
            this.xLabels = [];
            this.xAxes = [];
        }

        let clientWidth = this.mount.clientWidth - (this.margin.left + this.margin.right),//this.mount.clientWidth,
            width = clientWidth - (this.margin.left + this.margin.right),//this.mount.clientWidth - this.margin.left - this.margin.right,
            fileNameWidth = 100;
        let widthTimeline = width - fileNameWidth,
            height = 40;
        
        let timelineArea = d3.select('#clusteringTimeline')
            .append('div')
            .attr('id', 'clusteringTimelineArea');
        for (let i = 0; i < this.datasets.length; i++) {
            let data = DataStore.getData(this.datasets[i]);
            let timeline = timelineArea.append('svg')
                .attr('id', 'clusteringTimelineSVG_' + this.datasets[i])
                .attr('class', 'clusteringTimelineSVG')
                .attr('width', clientWidth)
                .attr('height', 40);
            let fileName = timeline
                .append('text')
                .attr('x', 0)
                .attr('y', height / 2)
                .attr('id', 'clusteringTimeline_' + this.datasets[i])
                .attr('text-anchor', 'left')
                .style('font-size', '10px')
                .text(data.name)
                .on('click', expandTimeline().bind(this));
                // .on('click', function(data,idx,elem) {
                //     console.log(data, idx, elem, elem[0].id)
                // });//this.expandTimeline());
            let xScale = d3.scaleLinear()
                .domain([data.data.meta.min.z, data.data.meta.max.z])
                .nice()
                .range([0, widthTimeline]);
            let xLabel = d3.axisBottom(xScale)
                .ticks(10)
                .tickSize(10);
            let xAxis = timeline.append('g')
                .attr('class', 'x-axis')// clusteringTimelineXAxis_' + this.datasets[i])
                .attr('id', 'clusteringTimelineXAxis_' + this.datasets[i])
                .attr('transform', 'translate(' + (this.margin.left + fileNameWidth) + ',' + (height / 2 - 5) + ')')
                .call(xLabel);
            this.timelines.push(timeline);
            this.xScales.push(xScale);
            this.xLabels.push(xLabel);
            this.xAxes.push(xAxis);
        }
        // labelsとsubsequencesのzの値に応じて幅20の半透明の線を引いていく
        for (let i = 0; i < this.clusters.length; i++) {
            for (let j = 0; j < this.datasets.length; j++) {
                let clusterLines = this.timelines[j]
                    .selectAll('line.clusterLine_' + this.datasets[j] + '_' + i)
                    .data(this.clusters[i].filter(function(d) {
                        return Number(this.subsequences[d].id) === this.datasets[j]
                    }.bind(this)))
                    .enter()
                    .append('line')
                    .attr('class', 'clusterLine_' + this.datasets[j] + ' clusterLine_' + this.datasets[j] + '_' + i)
                    .attr('x1', function(d) {
                        return this.xScales[j](this.subsequences[d][0].z);
                    }.bind(this))
                    .attr('y1', height / 2 - 5)
                    .attr('x2', function(d) {
                        return this.xScales[j](this.subsequences[d][this.subsequences[d].length - 1].z);
                    }.bind(this))
                    .attr('y2', height / 2 - 5)
                    .attr('stroke', d3.hsl(this.clusterColors[i][0], this.clusterColors[i][1], this.clusterColors[i][2]))
                    .attr('stroke-width', 20)
                    .attr('opacity', 0.5)
                    .attr('transform', 'translate(' + (this.margin.left + fileNameWidth) + ',0)');
            }
        }
        function expandTimeline() {
            return function(data, idx, elem) {
                // show a timeline for each cluster
                let dataId = Number(elem[0].id.split('_')[1]);
                if (Number(this.timelines[dataId].attr('height')) === height) {
                    // expand
                    this.timelines[dataId]
                        .transition()
                        .duration(1000)
                        .attr('height', height * this.clusterCenters.length);
                    for (let i = 0; i < this.clusterCenters.length; i++) {
                        if (i !== 0) {
                            let axis = this.timelines[dataId].append('g')
                                .attr('class', 'x-axis clusteringTimelineXAxis_' + dataId)
                                .attr('id', 'clusteringTimelineXAxis_' + dataId + '_' + i)
                                .attr('transform', 'translate(' + (this.margin.left + fileNameWidth) + ',' + (height / 2 - 5) + ')')
                                .transition()
                                .duration(1000)
                                .attr('transform', 'translate(' + (this.margin.left + fileNameWidth) + ',' + (height * i + height / 2 - 5) + ')')
                                .call(this.xLabels[dataId]);
                        }
                        this.timelines[dataId]
                            .selectAll('line.clusterLine_' + dataId + '_' + i)
                            .transition()
                            .duration(1000)
                            .attr('transform', 'translate('　+ (this.margin.left + fileNameWidth) + ',' + (height * i) + ')');
                    }
                } else {
                    // collapse
                    this.timelines[dataId]
                        .selectAll('line.clusterLine_' + dataId)
                        .transition()
                        .duration(1000)
                        .attr('transform', 'translate('　+ (this.margin.left + fileNameWidth) + ',0)');
                    d3.selectAll('.clusteringTimelineXAxis_' + dataId)
                        .transition()
                        .duration(1000)
                        .attr('translate(' +  + (this.margin.left + fileNameWidth) + ',' + (height / 2 - 5) + ')');
                    d3.selectAll('.clusteringTimelineXAxis_' + dataId)
                        .transition()
                        .delay(1000)
                        .remove();
                    this.timelines[dataId]
                        .transition()
                        .duration(1000)
                        .attr('height', height);
                }
                setTimeout(function() {
                    resizeExtractionResultsArea();
                }, 1000);
            };
        }
    }

    resizeTimelines() {
        let clientWidth = this.mount.clientWidth - (this.margin.left + this.margin.right),
            width = clientWidth - (this.margin.left + this.margin.right),
            fileNameWidth = 100;
        let widthTimeline = width - fileNameWidth,
            height = 40;

        for (let i = 0; i < this.datasets.length; i++) {
            this.timelines[i]
                .attr('width', clientWidth);
            this.xScales[i]
                .range([0, widthTimeline]);
            this.xLabels[i] = d3.axisBottom(this.xScales[i])
                .ticks(10)
                .tickSize(10);
            this.xAxes[i]
                .call(this.xLabels[i]);
            d3.selectAll('.x-axis.clusteringTimelineXAxis_' + this.datasets[i])
                .call(this.xLabels[i]);
            for (let j = 0; j < this.clusters.length; j++) {
                d3.selectAll('line.clusterLine_' + this.datasets[i] + '_' + j)
                    .attr('x1', function(d) {
                        return this.xScales[i](this.subsequences[d][0].z);
                    }.bind(this))
                    .attr('x2', function(d) {
                        return this.xScales[i](this.subsequences[d][this.subsequences[d].length - 1].z);
                    }.bind(this));
            }
        }
    }
}
