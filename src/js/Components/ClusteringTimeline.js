import React from 'react';
import * as d3 from 'd3';
import {resizeExtractionResultsArea} from '../Actions/AppAction';
import {showClusterDetails} from '../Actions/ClusteringAction';
import DataStore from '../Stores/DataStore';
import ClusteringStore from '../Stores/ClusteringStore';
import AppStore from '../Stores/AppStore';

d3.selection.prototype.moveToFront =
    function() {
        return this.each(function(){this.parentNode.appendChild(this);});
    };
export default class ClusteringTimeline extends React.Component {
    constructor() {
        super();
        this.margin = {left: 20, right: 20};
        this.datasets = [];
        this.custerCenters = [];
        this.subsequences = [];
        this.labels = [];
        this.dataIdxInCluster = [];
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
            this.datasets = ClusteringStore.getDatasets();
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.labels = ClusteringStore.getLabels();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.divideDataIntoCluster();
            this.drawTimelines();
        });
        ClusteringStore.on('updateClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.labels = ClusteringStore.getLabels();
            this.divideDataIntoCluster();
            this.drawTimelines();
        });
        ClusteringStore.on('resetClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.labels = ClusteringStore.getLabels();
            this.divideDataIntoCluster();
            this.drawTimelines();
        });
        AppStore.on('resizeExtractionResultsArea', () => {
            this.resizeTimelines();
        });
    }

    componentWillUnmount() {
        let parent = document.getElementById('clusteringTimeline');
        if (parent) {
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
        }
    }

    divideDataIntoCluster() {
        this.dataIdxInCluster = [];
        for (let i = 0; i < this.clusterCenters.length; i++) {
            this.dataIdxInCluster.push([]);
        }
        for (let i = 0; i < this.labels.length; i++) {
            if (typeof(this.labels[i]) === 'object') {
                this.dataIdxInCluster[this.labels[i].cluster].push(i);
            } else {
                this.dataIdxInCluster[this.labels[i]].push(i);
            }
        }
    }

    drawTimelines() {
        // TODO: それまでにタイムラインが描かれていたら削除
        // if (this.timelines.length > 0) {
            $('#clusteringTimelineArea').remove();
            this.timelines = [];
            this.xScales = [];
            this.xLabels = [];
            this.xAxes = [];
        // }

        let clientWidth = $('#clusteringResultsOverview').width() - (this.margin.left + this.margin.right),//this.mount.clientWidth,
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
        for (let i = 0; i < this.dataIdxInCluster.length; i++) {
            for (let j = 0; j < this.datasets.length; j++) {
                let clusterLines = this.timelines[j]
                    .selectAll('line.clusterLine_' + this.datasets[j] + '_' + i)
                    .data(this.dataIdxInCluster[i].filter(function(d) {
                        return Number(this.subsequences[d].id) === this.datasets[j]
                    }.bind(this)))
                    .enter()
                    .append('rect')
                    .attr('class', 'clusterLine_' + this.datasets[j] + ' clusterLine_' + this.datasets[j] + '_' + i)
                    .attr('id', function(d) {
                        return 'clusterLine_' + this.datasets[j] + '_' + this.subsequences[d].idx;
                    }.bind(this))
                    .attr('x', function(d) {
                        return this.xScales[j](this.subsequences[d][0].z);
                    }.bind(this))
                    .attr('y', 5)
                    .attr('width', function(d) {
                        return this.xScales[j](this.subsequences[d][this.subsequences[d].length - 1].z) - this.xScales[j](this.subsequences[d][0].z);
                    }.bind(this))
                    .attr('height', 20)
                    .attr('fill', d3.hsl(this.clusterColors[i][0], this.clusterColors[i][1], this.clusterColors[i][2]))
                    .attr('opacity', 0.5)
                    .attr('transform', 'translate(' + (this.margin.left + fileNameWidth) + ',0)')
                    .on('mouseover', this.onMouseOverClusterLine().bind(this))
                    .on('mouseout', this.onMouseOutClusterLine().bind(this))
                    .on('click', this.onClickClusterLine().bind(this));
                    // .append('line')
                    // .attr('class', 'clusterLine_' + this.datasets[j] + ' clusterLine_' + this.datasets[j] + '_' + i)
                    // .attr('x1', function(d) {
                    //     return this.xScales[j](this.subsequences[d][0].z);
                    // }.bind(this))
                    // .attr('y1', height / 2 - 5)
                    // .attr('x2', function(d) {
                    //     return this.xScales[j](this.subsequences[d][this.subsequences[d].length - 1].z);
                    // }.bind(this))
                    // .attr('y2', height / 2 - 5)
                    // .attr('stroke', d3.hsl(this.clusterColors[i][0], this.clusterColors[i][1], this.clusterColors[i][2]))
                    // .attr('stroke-width', 20)
                    // .attr('opacity', 0.5)
                    // .attr('transform', 'translate(' + (this.margin.left + fileNameWidth) + ',0)');
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
                            .selectAll('rect.clusterLine_' + dataId + '_' + i)
                            .transition()
                            .duration(1000)
                            .attr('transform', 'translate('　+ (this.margin.left + fileNameWidth) + ',' + (height * i) + ')');
                    }
                } else {
                    // collapse
                    this.timelines[dataId]
                        .selectAll('rect.clusterLine_' + dataId)
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

    onMouseOverClusterLine() {
        return function(d) {
            // show tooltip
            let targetId = d3.event.target.id;
            if (targetId) {
                let tooltip = $('#tooltipClusteringResults');
                let targetEle = targetId.split('_');
                let dataId = targetEle[1],
                    SSId = Number(targetEle[2]);
                let data;
                let i = 0;
                for (i = 0; i < this.subsequences.length; i++) {
                    if (this.subsequences[i].id === dataId && this.subsequences[i].idx === SSId) {
                        data = this.subsequences[i];
                        break;
                    }
                }
                // show detail information of the subsequence
                let fileName = DataStore.getFileName(dataId);
                let period = [data.dataPoints[0].z, data.dataPoints[data.dataPoints.length - 1].z];
                let dataPointNum = data.dataPoints.length;
                let mouseX = d3.event.clientX + 5;
                let mouseY = d3.event.clientY + 5;//$(window).scrollTop() + d.clientY + 2;
                tooltip.html('<table><tbody><tr><td>File name</td><td class="tooltipTableValues">' + fileName + '</td></tr>' +
                    '<tr><td>Period</td><td class="tooltipTableValues">' + period[0] + '-' + period[1] + '</td></tr>' +
                    '<tr><td>Data points number</td><td class="tooltipTableValues">' + dataPointNum + '</td></tr></tbody></table>');
                tooltip.css({
                    left: mouseX + 'px',
                    top: mouseY + 'px',
                    right: 'unset',
                    bottom: 'unset'
                });
                tooltip.css('display', 'block');

                // highlight SS on the timeline
                d3.select('#' + targetId)
                    .attr('stroke', 'black')
                    .attr('stroke-width', 1.5)
                    .moveToFront();

                // highlight the clustering detail panel if the currently focused cluster is the cluster of the selected SS
                if ($('#subsequenceDetailTr_' + dataId + '_' + SSId).length > 0) {
                    // highlight cluster center line chart
                    d3.selectAll('.clusterMemberLineChart_' + dataId + '_' + SSId)
                        .attr('stroke', '#f26418');
                    // highlight histogram
                    d3.select('#SSLengthBar_' + Math.floor(period[1] - period[0]))
                        .attr('stroke', 'black')
                        .attr('stroke-width', 1.5);
                    // highlight sparkline
                    d3.select('#subsequenceDetailTr_' + dataId + '_' + SSId)
                        .classed('table-active', true);
                }

                // highlight sparklines in the filtering process panel
                if ($('#subsequenceTr_' + dataId + '_' + SSId).length) {
                    d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                        .classed('table-active', true);
                }
                if ($('#updatedSubsequenceTr_' + dataId + '_' + SSId).length) {
                    d3.select('#updatedSubsequenceTr_' + dataId + '_' + SSId)
                        .classed('table-active', true);
                }
            }
        };    
    }

    onMouseOutClusterLine() {
        return function(d) {
            // hide tooltip
            let targetId = d3.event.target.id;
            if (targetId) {
                let targetEle = targetId.split('_');
                let dataId = targetEle[1],
                    SSId = Number(targetEle[2]);
                // hide the tooltip
                $('#tooltipClusteringResults').css('display', 'none');
                
                // remove highlight from timeline
                d3.select('#' + targetId)
                    .attr('stroke-width', 0);

                // remove highlights from clustering detail panel if the currently focued cluster coincides with the selected SS's cluster
                if ($('#subsequenceDetailTr_' + dataId + '_' + SSId).length > 0) {
                    // remove highlight from cluster center line chart
                    d3.selectAll('.clusterMemberLineChart_' + dataId + '_' + SSId)
                        .attr('stroke', 'lightgray');
                    // remove highlight from histogram
                    d3.selectAll('.SSLengthBar')
                        .attr('stroke-width', 0);
                    // remove highlight from sparkline
                    d3.select('#subsequenceDetailTr_' + dataId + '_' + SSId)
                        .classed('table-active', false);
                }

                // remove highlight sparklines in the filtering process panel
                if ($('#subsequenceTr_' + dataId + '_' + SSId).length) {
                    d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                        .classed('table-active', false);
                }
                if ($('#updatedSubsequenceTr_' + dataId + '_' + SSId).length) {
                    d3.select('#updatedSubsequenceTr_' + dataId + '_' + SSId)
                        .classed('table-active', false);
                }
            }
        };
    }

    onClickClusterLine() {
        return function(d) {
            // show the cluster which the selected SS belongs to
            if (d3.event.target) {
                let targetClass = d3.event.target.classList[1];
                let targetEle = targetClass.split('_');
                let clusterNum = Number(targetEle[2]);
                showClusterDetails(clusterNum);
            }
        };
    }

    resizeTimelines() {
        let clientWidth = $('#clusteringResultsOverview').width() - (this.margin.left + this.margin.right),
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
            for (let j = 0; j < this.dataIdxInCluster.length; j++) {
                d3.selectAll('rect.clusterLine_' + this.datasets[i] + '_' + j)
                    .attr('x', function(d) {
                        return this.xScales[i](this.subsequences[d][0].z);
                    }.bind(this))
                    .attr('width', function(d) {
                        return this.xScales[i](this.subsequences[d][this.subsequences[d].length - 1].z) - this.xScales[i](this.subsequences[d][0].z);
                    }.bind(this));
                    // .attr('x1', function(d) {
                    //     return this.xScales[i](this.subsequences[d][0].z);
                    // }.bind(this))
                    // .attr('x2', function(d) {
                    //     return this.xScales[i](this.subsequences[d][this.subsequences[d].length - 1].z);
                    // }.bind(this));
            }
        }
    }
}
