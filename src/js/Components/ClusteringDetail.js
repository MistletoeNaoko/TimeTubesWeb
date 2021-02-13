import React from 'react';
import * as d3 from 'd3';
import {selectMenu, resizeExtractionResultsArea, showExtractionSourcePanel} from '../Actions/AppAction';
import * as domActions from '../lib/domActions';
import {showTimeTubesOfTimeSlice} from '../Actions/TimeTubesAction';
import {convertResultIntoQuery, updateSource} from '../Actions/FeatureAction';
import * as ClusteringAction from '../Actions/ClusteringAction';
import ClusteringStore from '../Stores/ClusteringStore';
import DataStore from '../Stores/DataStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import FeatureStore from '../Stores/FeatureStore';
import {tickFormatting, formatValue} from '../lib/2DGraphLib';

d3.selection.prototype.moveToFront =
    function() {
        return this.each(function(){this.parentNode.appendChild(this);});
    };
export default class ClusteringDetail extends React.Component {
    constructor() {
        super();
        this.margin = {left: 30, right: 10, top: 20, bottom: 20};
        this.paddingCard = 16;
        this.areaPadding = {left: 16, right: 16, top: 8, bottom: 8};
        this.queryMode;
        this.clickedX;
        this.clickedY;
        this.clusterCenters;
        this.clusterColors;
        this.subsequences;
        this.datasetsIdx;
        this.labels;
        this.clusteringScores;
        this.subsequenceParameters;
        this.variables;
        this.selectedTrIdx = -1;
        this.onMouseMoveSubsequenceDetailTrFnc = this.onMouseMoveSubsequenceDetailTr().bind(this);
        this.onMouseUpSubsequenceDetailTrFnc = this.onMouseUpSubsequenceDetailTr().bind(this);
        this.state = {
            cluster: -1
        };
    }

    render() {
        let clusterCenterTimeTubes,
            clusterCenterLineCharts,
            subsequenceLengthDistribution,
            clustersTemporalDistribution,
            clusterFeatureTable,
            subsequencesOverview;
        clusterCenterTimeTubes = this.clusterCenterTimeTubesView();
        clusterCenterLineCharts = this.clusterCenterLineCharts();
        subsequenceLengthDistribution = this.subsequenceLengthDistribution();
        clustersTemporalDistribution = this.clustersTemporalDistribution();
        clusterFeatureTable = this.clusterFeatureTable();
        subsequencesOverview = this.subsequencesOverview();
        return (
            <div id='clusteringDetail' className='clusteringPanel'
                style={{height: window.innerHeight - $('#appHeader').outerHeight(true)}}
                ref={mount => {
                    this.mount = mount;
                }}>
                {clusterCenterTimeTubes}
                {clusterCenterLineCharts}
                {subsequenceLengthDistribution}
                {clustersTemporalDistribution}
                {clusterFeatureTable}
                {subsequencesOverview}
            </div>
        );
    }

    componentDidMount() {
        $('#selectedClusterCenterTimeTubesCanvas').css('width', $('#clusteringDetail').width());
        $('#selectedClusterCenterTimeTubesCanvas').css('height', $('#clusteringDetail').width());
        ClusteringStore.on('showClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.labels = ClusteringStore.getLabels();
            this.subsequences = ClusteringStore.getSubsequences();
            // this.ranges = ClusteringStore.getRanges();
            this.datasetsIdx = ClusteringStore.getDatasets();
            this.clusteringScores = ClusteringStore.getClusteringScores();
            this.subsequenceParameters = ClusteringStore.getSubsequenceParameters();
            this.clearCanvas();
            this.setState({
                cluster: -1
            });
        });
        ClusteringStore.on('showClusterDetails', (cluster) => {
            this.variables = ClusteringStore.getClusteringParameters().variables;//Object.keys(this.clusterCenters[cluster][0]);
            this.variables = this.variables.filter(ele => ele !== 'z');
            this.createVariableLabels();
            this.extractSubsequencesInCluster(cluster);
            $('#selectedClusterCenterName').text('Cluster ' + cluster)
            this.setState({
                cluster: cluster
            });
        });
        ClusteringStore.on('updateClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.labels = ClusteringStore.getLabels();
            this.subsequences = ClusteringStore.getSubsequences();
            this.clusteringScores = ClusteringStore.getClusteringScores();
            this.extractSubsequencesInCluster(-1);
            this.clearCanvas();
            this.setState({
                cluster: -1
            });
        });
        ClusteringStore.on('resetClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.labels = ClusteringStore.getLabels();
            this.subsequences = ClusteringStore.getSubsequences();
            this.clusteringScores = ClusteringStore.getClusteringScores();
            this.extractSubsequencesInCluster(-1);
            this.clearCanvas();
            this.setState({
                cluster: -1
            });
        });
        ClusteringStore.on('updateSSSelection', () => {
            this.showSSStatus();
        });
    }

    componentWillUnmount() {
        let parent = document.getElementById('clusteringDetail');
        if (parent) {
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
        }
    }

    componentDidUpdate() {
        // this.extractSubsequencesInCluster();
        this.drawClusterCenterLineCharts();
        this.drawSubsequenceLengthHistogram();
        this.drawClustersTemporalDistributionHistogram();
        this.drawSparklinesTable();
        this.showSSStatus();
    }

    clusterCenterTimeTubesView() {
        return (
            <div id='selectedClusterCenterTimeTubes'
                className='resultAreaElem'>
                    <h5 id='selectedClusterCenterName'
                        style={{textAlign: 'center'}}></h5>
                <canvas id='selectedClusterCenterTimeTubesCanvas'
                    width='500'
                    height='500'></canvas>
            </div>
        );
    }

    clusterCenterLineCharts() {
        return (
            <div id='selectedClusterCenterLineCharts'
                className='resultAreaElem'>
            </div>
        );
    }

    subsequenceLengthDistribution() {
        return (
            <div id='subsequenceLengthHistogram'
                className='resultAreaElem'>
            </div>
        );
    }

    clustersTemporalDistribution() {
        return (
            <div id='clustersTemporalDistributionHistogram'
                className='resultAreaElem'>
            </div>
        );
    }

    clearCanvas() {
        let canvas = document.getElementById('selectedClusterCenterTimeTubesCanvas');
        let context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
    }

    clusterFeatureTable() {
        let table;
        if (this.state.cluster >= 0) {
            let parentEle = $('#clusteringDetail');
            let paddingLeft = Number(parentEle.css('padding-left').slice(0, -2)),
                paddingRight = Number(parentEle.css('padding-right').slice(0, -2));
            let width = parentEle.width() - paddingLeft - paddingRight - this.paddingCard * 2;//this.mount.clientWidth - this.paddingCard * 2;
            let aveDataPointNum = 0, avePeriod = 0, aveDataValues = {};
            this.variables.forEach(key => {
                aveDataValues[key] = 0;
            })
            for (let i = 0; i < this.SSCluster.length; i++) {
                aveDataPointNum += this.SSCluster[i].dataPoints.length;
                avePeriod += (this.SSCluster[i].dataPoints[this.SSCluster[i].dataPoints.length - 1].z - this.SSCluster[i].dataPoints[0].z);
                if (this.subsequenceParameters.normalize === false) {
                    for (let j = 0; j < this.SSCluster[i].dataPoints.length; j++) {
                        this.variables.forEach(key => {
                            aveDataValues[key] += this.SSCluster[i].dataPoints[j][key];
                        });
                    }
                }
            }
            this.variables.forEach(key => {
                aveDataValues[key] /= aveDataPointNum;
            });
            aveDataPointNum /= this.SSCluster.length;
            avePeriod /= this.SSCluster.length;

            let aveDataValuesTable = [];
            if (this.subsequenceParameters.normalize === false) {
                this.variables.forEach(key => {
                    aveDataValuesTable.push(
                        <tr key={key}>
                            <td style={{width: width / 2}}>Average of {this.variableLabels[key]}</td>
                            <td className='clusterFeaturesValues'
                                style={{width: width / 2}}>{formatValue(aveDataValues[key])}</td>
                        </tr>
                    )
                });
            }
            table = (
                <table id='clusterFeatureTable'
                    className='table table-hover'
                    style={{width: width, marginBottom: 'unset'}}>
                    <tbody>
                        <tr>
                            <td style={{width: width / 2}}>Member number</td>
                            <td className='clusterFeaturesValues'
                                style={{width: width / 2}}>{this.SSCluster.length}</td>
                        </tr>
                        <tr>
                            <td style={{width: width / 2}}>Cluster radius</td>
                            <td className='clusterFeaturesValues'
                                style={{width: width / 2}}>{formatValue(this.clusteringScores.clusterRadiuses[this.state.cluster])}</td>
                        </tr>
                        <tr>
                            <td style={{width: width / 2}}>Average data point number</td>
                            <td className='clusterFeaturesValues'
                                style={{width: width / 2}}>{formatValue(aveDataPointNum)}</td>
                        </tr>
                        <tr>
                            <td style={{width: width / 2}}>Average period</td>
                            <td className='clusterFeaturesValues'
                                style={{width: width / 2}}>{formatValue(avePeriod)}</td>
                        </tr>
                        {aveDataValuesTable}
                        {/* <tr>
                            <td style={{width: width / 2}}></td>
                            <td style={{width: width / 2}}></td>
                        </tr> */}
                    </tbody>
                </table>
            );
        }
        return (
            <div id='clusterFeature'
                className='resultAreaElem'>
                {table}
            </div>
        );
    }

    subsequencesOverview() {
        if (this.state.cluster >= 0) {
            let paddingCell = 3, checkCellWidth = 30;
            let parentEle = $('#clusteringDetail');
            let paddingLeft = Number(parentEle.css('padding-left').slice(0, -2)),
                paddingRight = Number(parentEle.css('padding-right').slice(0, -2));
            let tableWidth = parentEle.width() - paddingLeft - paddingRight - this.paddingCard * 2;
            let tableHeight = tableWidth;//(this.mount.clientHeight - $('#filteringProcessSummary').height()) / 2
            let cellWidth = (tableWidth - checkCellWidth) / this.variables.length,
                cellHeight = 30;
            let labels = [];
            labels.push('');
            for (let i = 0; i < this.variables.length; i++) {
                if (this.variableLabels[this.variables[i]].length > 1) {
                    labels.push(this.variableLabels[this.variables[i]].join(', '));
                } else {
                    labels.push(this.variableLabels[this.variables[i]]);
                }
            }
            let headerItems = [];
            for (let i = 0; i < labels.length; i++) {
                headerItems.push(
                    <th key={i} 
                        id={(i === 0)? 'subsequencesOverviewTableTh_checkbox': 'subsequencesOverviewTableTh_' + this.variables[i - 1]}
                        style={{width: (i === 0)? checkCellWidth: cellWidth, height: cellHeight}}>
                        {labels[i]}
                    </th>
                );
            }
            let tableHeader = (
                <thead style={{width: tableWidth, height: cellHeight}}
                    id='subsequencesOverviewTableHeader'>
                    <tr style={{textAlign: 'center', fontSize: '10px'}}>
                        {headerItems}
                    </tr>
                </thead>
            );
            let trItems = [];
            for (let i = 0; i < this.SSCluster.length; i++) {
                let tdItems = [];
                let dataId = this.SSCluster[i].id;
                let SSId = this.SSCluster[i].idx;
                tdItems.push(
                    <td key='checkbox' style={{textAlign: 'center', width: checkCellWidth, height: cellHeight}}>
                        <input 
                            type="checkbox" 
                            className={'subsequenceDetailCheckbox'} 
                            name='subsequenceSelector'
                            id={'selectSSDetail_' + dataId + '_' + SSId}
                            onClick={this.onClickSSSelector().bind(this)}/>
                    </td>);
                for (let j = 0; j < this.variables.length; j++) {
                    tdItems.push(
                        <td
                            key={this.variables[j]}
                            id={'subsequenceDetailTd_' + dataId + '_' + SSId + '_' + this.variables[j]}
                            style={{width: cellWidth, height: cellHeight}}>
                        </td>);
                }
                trItems.push(
                    <tr id={'subsequenceDetailTr_' + dataId + '_' + SSId}
                        className='subsequenceDetailTr'
                        key={'subsequenceDetailTr_' + dataId + '_' + SSId}
                        style={{width: tableWidth, height: cellHeight}}
                        onMouseOver={this.onMouseOverSubsequenceDetailTr().bind(this)}
                        onMouseOut={this.onMouseOutSubsequenceDetailTr().bind(this)}
                        onMouseDown={this.onMouseDownSubsequenceDetailTr().bind(this)}
                        onDoubleClick={this.onDoubleClickSubsequenceDetailTr().bind(this)}>
                        {tdItems}
                    </tr>);
            }
            return (
                <div id='subsequencesOverview'
                    className='resultAreaElem'>
                    <table id='subsequencesOverviewTable'
                        className='table table-hover sparkTable'
                        style={{width: tableWidth}}>
                        {tableHeader}
                        <tbody id='subsequencesOverviewTableBody'>
                            {trItems}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    extractSubsequencesInCluster(cluster) {
        this.SSCluster = [];
        // this.SSRanges = [];
        this.yMinMax = {};
        if (cluster >= 0) {
            this.variables.forEach(function(d) {
                this.yMinMax[d] = [Infinity, -Infinity];
            }.bind(this));
            for (let i = 0; i < this.labels.length; i++) {
                if (typeof(this.labels[i]) === 'object') {
                    if (this.labels[i].cluster === cluster) {
                        this.SSCluster.push(this.subsequences[i]);
                        // this.SSRanges.push(this.ranges[i]);

                        for (let j = 0; j < this.subsequences[i].length; j++) {
                            this.variables.forEach(function(d) {
                                if (this.subsequences[i][j][d] < this.yMinMax[d][0]) {
                                    this.yMinMax[d][0] = this.subsequences[i][j][d];
                                }
                                if (this.yMinMax[d][1] < this.subsequences[i][j][d]) {
                                    this.yMinMax[d][1] = this.subsequences[i][j][d];
                                }
                            }.bind(this));
                        }
                    }
                } else {
                    if (this.labels[i] === cluster) {
                        this.SSCluster.push(this.subsequences[i]);
                        // this.SSRanges.push(this.ranges[i]);
                        
                        for (let j = 0; j < this.subsequences[i].length; j++) {
                            this.variables.forEach(function(d) {
                                if (this.subsequences[i][j][d] < this.yMinMax[d][0]) {
                                    this.yMinMax[d][0] = this.subsequences[i][j][d];
                                }
                                if (this.yMinMax[d][1] < this.subsequences[i][j][d]) {
                                    this.yMinMax[d][1] = this.subsequences[i][j][d];
                                }
                            }.bind(this));
                        }
                    }
                }
            }
        }
    }

    createVariableLabels() {
        let variableLabels = {};
        for (let i = 0; i < this.datasetsIdx.length; i++) {
            let lookup = DataStore.getData(this.datasetsIdx[i]).data.lookup;
            for (let key in lookup) {
                if (!(key in variableLabels)) {
                    variableLabels[key] = lookup[key];
                } else {
                    for (let j = 0; j < lookup[key].length; j++) {
                        if (variableLabels[key].indexOf(lookup[key][j]) < 0) {
                            variableLabels[key].push(lookup[key][j]);
                        }
                    }
                }
            }
        }
        this.variableLabels = variableLabels;
    }

    drawClusterCenterLineCharts() {
        $('#clusterCenterLineChartsSVG').remove();
        if (this.state.cluster >= 0) { 
            let parentEle = $('#clusteringDetail');
            let paddingLeft = Number(parentEle.css('padding-left').slice(0, -2)),
                paddingRight = Number(parentEle.css('padding-right').slice(0, -2));
            let clientWidth = parentEle.width() - paddingLeft - paddingRight - this.paddingCard * 2;
            let lineChartWidth = clientWidth / 2,
                lineChartHeight = clientWidth / 2 * 0.6;

            let svg = d3.select('#selectedClusterCenterLineCharts')
                .append('svg')
                .attr('id', 'clusterCenterLineChartsSVG')
                .attr('width', clientWidth)
                .attr('height', lineChartHeight * Math.ceil(this.variables.length / 2));
            
            for (let i = 0; i < this.variables.length; i++) {
                let xScale = d3.scaleLinear()
                    .domain([0, this.clusterCenters[this.state.cluster].length - 1])
                    .range([lineChartWidth * (i % 2) + this.margin.left, lineChartWidth * (i % 2) + lineChartWidth - this.margin.right]);
                // let yMinMax = d3.extent(this.clusterCenters[this.cluster], d => d[this.variables[i]]);
                let yScale = d3.scaleLinear()
                    .domain(this.yMinMax[this.variables[i]])
                    .range([lineChartHeight * Math.floor(i / 2) + lineChartHeight - this.margin.bottom, lineChartHeight * Math.floor(i / 2) + this.margin.top]);

                let xAxis = d3.axisBottom(xScale).ticks(5);
                let yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(tickFormatting);
                
                let xPos = lineChartWidth * (i % 2),
                    yPos = lineChartHeight * Math.floor(i / 2);
                svg.append('g')
                    .attr('transform', 'translate(' + 0 + ',' + (yPos + lineChartHeight - this.margin.bottom) + ')')
                    .call(xAxis)
                    .selectAll('text')
                    .attr('font-size', '0.5rem');
                svg.append('g')
                    .attr('transform', 'translate(' + (xPos + this.margin.left) + ',' + 0 + ')')
                    .call(yAxis)
                    .selectAll('text')
                    .attr('font-size', '0.5rem');
                
                // subsequences in the cluster
                for (let j = 0; j < this.SSCluster.length; j++) {
                    svg.append('path')
                        .datum(this.SSCluster[j])
                        .attr('fill', 'none')
                        .attr('stroke', 'lightgray')
                        .attr('stroke-width', 0.7)
                        .attr('class', 'clusterMemberLineChart_' + this.SSCluster[j].id + '_' + this.SSCluster[j].idx)
                        .attr('id', 'clusterMemberLineChart_' + this.SSCluster[j].id + '_' + this.SSCluster[j].idx + '_' + this.variables[i])
                        .attr('d', d3.line()
                            .x(function(d, idx) {
                                return xScale(idx);
                            })
                            .y(function(d) {
                                return yScale(d[this.variables[i]]);
                            }.bind(this))
                            .curve(d3.curveCatmullRom.alpha(1))
                        );
                }

                // cluster center line
                svg.append('path')
                    .datum(this.clusterCenters[this.state.cluster])
                    .attr('fill', 'none')
                    .attr('stroke', d3.hsl(this.clusterColors[this.state.cluster][0], this.clusterColors[this.state.cluster][1], this.clusterColors[this.state.cluster][2]))
                    .attr('stroke-width', 1.5)
                    .attr('d', d3.line()
                        .x(function(d, i) {
                            return xScale(i);
                        })
                        .y(function(d) {
                            return yScale(d[this.variables[i]]);
                        }.bind(this))
                        .curve(d3.curveCatmullRom.alpha(1))
                    );
                let label = '';
                if (this.variableLabels[this.variables[i]].length > 1) {
                    label = this.variableLabels[this.variables[i]].join(', ');
                } else {
                    label = this.variableLabels[this.variables[i]];
                }
                svg.append('text')
                    .attr('x', xPos + lineChartWidth / 2)
                    .attr('y', yPos + this.margin.top / 2)
                    .attr('fill', 'black')
                    .attr('font-size', '0.5rem')
                    .attr('text-anchor', 'middle')
                    .text(label);
            }
        }
    }

    drawSubsequenceLengthHistogram () {
        $('#subsequenceLengthHistogramSVG').remove();

        if (this.state.cluster >= 0) { 
            let parentEle = $('#clusteringDetail');
            let paddingLeft = Number(parentEle.css('padding-left').slice(0, -2)),
                paddingRight = Number(parentEle.css('padding-right').slice(0, -2));
            let clientWidth = parentEle.width() - paddingLeft - paddingRight - this.paddingCard * 2;
            let height = clientWidth * 0.35;
            let svgPadding = {left: 30, right: 10, top: 15, bottom: 20};
            
            let svg = d3.select('#subsequenceLengthHistogram')
                .append('svg')
                .attr('id', 'subsequenceLengthHistogramSVG')
                .attr('width', clientWidth)
                .attr('height', height);

            let subsequenceLength = ClusteringStore.getSubsequenceParameters().SSperiod;
            let xScale = d3.scaleLinear()
                .domain(subsequenceLength)
                .range([svgPadding.left, clientWidth - svgPadding.right]);
            svg.append('g')
                .attr('transform', 'translate(0,' + (height - svgPadding.bottom) + ')')
                .call(d3.axisBottom(xScale))
                .selectAll('text')
                .attr('font-size', '0.5rem');

            let subsequencesCluster = [];
            for (let i = 0; i < this.labels.length; i++) {
                let clusterSS = (typeof(this.labels[i]) === 'object')? this.labels[i].cluster: this.labels[i];
                if (clusterSS === this.state.cluster) {
                    subsequencesCluster.push(this.subsequences[i]);
                }
            }
            let histogram = d3.histogram()
                .value(function(d) {return d[d.length - 1].z - d[0].z})
                .domain(subsequenceLength)
                .thresholds(xScale.ticks(10));
            let bins = histogram(subsequencesCluster);
            let yScale = d3.scaleLinear()
                .range([height - svgPadding.bottom, svgPadding.top])
                .domain([0, d3.max(bins, function(d) {return d.length})]);
            svg.append('g')
                .attr('transform', 'translate(' + svgPadding.left + ',0)')
                .call(d3.axisLeft(yScale).ticks(5))
                .selectAll('text')
                .attr('font-size', '0.5rem');
                
            svg.append('text')
                .attr('x', clientWidth / 2)
                .attr('y', svgPadding.top / 2)
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .attr('text-anchor', 'middle')
                .text('Subsequence length');

            if (this.datasetsIdx.length === 1) {
                let rectColor = TimeTubesStore.getPlotColor(this.datasetsIdx[0]);
                svg.selectAll('rect')
                    .data(bins)
                    .enter()
                    .append('rect')
                    .attr('class', 'SSLengthBar')
                    .attr('id', function(d) {return 'SSLengthBar_' + d.x0})
                    .attr('x', 1)
                    .attr('transform', function(d) {
                        return 'translate(' + xScale(d.x0) + ',' + yScale(d.length) + ')'
                    })
                    .attr('width', function(d) {
                        return xScale(d.x1) - xScale(d.x0) - 1;
                    })
                    .attr('height', function(d) {
                        return height - svgPadding.bottom - yScale(d.length);
                    }.bind(this))
                    .attr('fill', rectColor);
            } else if (this.datasetsIdx.length > 1) {
                let binsStack = [];
                for (let i = 0; i < bins.length; i++) {
                    let stackTmp = {};
                    for (let j = 0; j < this.datasetsIdx.length; j++) {
                        stackTmp[this.datasetsIdx[j]] = 0;
                    }
                    for (let j = 0; j < bins[i].length; j++) {
                        stackTmp[bins[i][j].id]++;
                    }
                    binsStack.push(stackTmp);
                }
                let stack = d3.stack()
                    .keys(this.datasetsIdx);
                let rectColors = [];
                for (let i = 0; i < this.datasetsIdx.length; i++) {
                    rectColors.push(TimeTubesStore.getPlotColor(this.datasetsIdx[i]));
                }
                let series = stack(binsStack);
                let groups = svg.selectAll('g.stackedBarGroup')
                    .data(series)
                    .enter()
                    .append('g')
                    .attr('class', 'stackedBarGroup')
                    .style('fill', function(d, i) {
                        return rectColors[i];
                    });
                groups.selectAll('rect')
                    .data(function(d) {
                        return d;
                    })
                    .enter()
                    .append('rect')
                    .attr('x', function(d, i) {
                        return xScale(bins[i].x0);
                    }) 
                    .attr('y', function(d, i) {
                        return yScale(d[1])
                    })
                    .attr('width', function(d, i) {
                        return xScale(bins[i].x1) - xScale(bins[i].x0) - 1;
                    })
                    .attr('height', function(d) {
                        return (yScale(d[0]) - yScale(d[1]))
                    }.bind(this));
            }
        }
    }

    drawClustersTemporalDistributionHistogram() {
        $('#clustersTemporalDistributionHistogramSVG').remove();

        if (this.state.cluster >= 0) {
            let clusterBefore = [],
                clusterAfter = [];
            for (let i = 0; i < this.clusterCenters.length; i++) {
                clusterBefore.push(0);
                clusterAfter.push(0);
            }
            if (typeof(this.labels[0]) === 'object') {
                for (let i = 0; i < this.labels.length; i++) {
                    if (this.labels[i].cluster === this.state.cluster) {
                        if (i - 1 >= 0) {
                            clusterBefore[this.labels[i - 1].cluster]++;
                        }
                        if (i + 1 < this.labels.length) {
                            clusterAfter[this.labels[i + 1].cluster]++;
                        }
                    }
                }
            } else {
                for (let i = 0; i < this.labels.length; i++) {
                    if (this.labels[i] === this.state.cluster) {
                        if (i - 1 >= 0) {
                            clusterBefore[this.labels[i - 1]]++;
                        }
                        if (i + 1 < this.labels.length) {
                            clusterAfter[this.labels[i + 1]]++;
                        }
                    }
                }
            }
            let maxCount = d3.max([d3.max(clusterBefore), d3.max(clusterAfter)]);

            let parentEle = $('#clusteringDetail');
            let paddingLeft = Number(parentEle.css('padding-left').slice(0, -2)),
                paddingRight = Number(parentEle.css('padding-right').slice(0, -2));
            let clientWidth = parentEle.width() - paddingLeft - paddingRight - this.paddingCard * 2;
            let histogramWidth = clientWidth / 2,
                histogramHeight = clientWidth / 2 * 0.6;
            let svgPadding = {left: 20, right: 10, top: 15, bottom: 20};

            let svg = d3.select('#clustersTemporalDistributionHistogram')
                .append('svg')
                .attr('id', 'clustersTemporalDistributionHistogramSVG')
                .attr('width', clientWidth)
                .attr('height', histogramHeight);
            
            // draw axes
            let xScale = d3.scaleLinear()
                .domain([0 - 0.5, this.clusterCenters.length - 1 + 0.5])
                .range([svgPadding.left, histogramWidth - svgPadding.right]);
            svg.append('g')
                .attr('id', 'clusterBeforeHistogramAxisX')
                .attr('transform', 'translate(0,' + (histogramHeight - svgPadding.bottom) + ')')
                .call(d3.axisBottom(xScale).ticks(this.clusterCenters.length))
                .selectAll('text')
                .attr('font-size', '0.5rem');
            svg.append('g')
                .attr('id', 'clusterAfterHistogramAxisX')
                .attr('transform', 'translate(' + histogramWidth + ',' + (histogramHeight - svgPadding.bottom) + ')')
                .call(d3.axisBottom(xScale).ticks(this.clusterCenters.length))
                .selectAll('text')
                .attr('font-size', '0.5rem');
            let yScale = d3.scaleLinear()
                .domain([0, maxCount])
                .range([histogramHeight- svgPadding.bottom, svgPadding.top]);
            svg.append('g')
                .attr('id', 'clusterBeforeHistogramAxisY')
                .attr('transform', 'translate(' + svgPadding.left + ',0)')
                .call(d3.axisLeft(yScale).ticks(maxCount <= 5? maxCount: Math.floor(maxCount / 3)))
                .selectAll('text')
                .attr('font-size', '0.5rem');
            svg.append('g')
                .attr('id', 'clusterAfterHistogramAxisY')
                .attr('transform', 'translate(' + (histogramWidth + svgPadding.left) + ',0)')
                .call(d3.axisLeft(yScale).ticks(maxCount <= 5? maxCount: Math.floor(maxCount / 3)))
                .selectAll('text')
                .attr('font-size', '0.5rem');

            // draw rects
            let rectWidth = (histogramWidth - svgPadding.left - svgPadding.right) / this.clusterCenters.length;
            svg.append('g')
                .attr('id', 'clusterBeforeHistogramRects')
                .selectAll('rect')
                .data(clusterBefore)
                .enter()
                .append('rect')
                .attr('id', function(d, i) {
                    return 'clusterBeforeHistogramRects_' + i
                })
                .attr('x', 1)
                .attr('transform', function(d, i) {
                    return 'translate(' + xScale(i - 0.5) + ',' + yScale(d) + ')';
                })
                .attr('width', rectWidth - 1)
                .attr('height', function(d, i) {
                    return histogramHeight - svgPadding.bottom - yScale(d);
                })
                .attr('fill', function(d, i) {
                    return d3.hsl(this.clusterColors[i][0], this.clusterColors[i][1], this.clusterColors[i][2]);
                }.bind(this));
            svg.append('g')
                .attr('id', 'clusterAfterHistogramRects')
                .selectAll('rect')
                .data(clusterAfter)
                .enter()
                .append('rect')
                .attr('id', function(d, i) {
                    return 'clusterAfterHistogramRects_' + i
                })
                .attr('x', 1)
                .attr('transform', function(d, i) {
                    return 'translate(' + (histogramWidth + xScale(i - 0.5)) + ',' + yScale(d) + ')';
                })
                .attr('width', rectWidth - 1)
                .attr('height', function(d, i) {
                    return histogramHeight - svgPadding.bottom - yScale(d);
                })
                .attr('fill', function(d, i) {
                    return d3.hsl(this.clusterColors[i][0], this.clusterColors[i][1], this.clusterColors[i][2]);
                }.bind(this));

            // draw chart name
            svg.append('text')
                .attr('x', histogramWidth / 2)
                .attr('y', svgPadding.top / 2)
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .attr('text-anchor', 'middle')
                .text('Before Cluster ' + this.state.cluster);
            
            svg.append('text')
                .attr('x', histogramWidth + histogramWidth / 2)
                .attr('y', svgPadding.top / 2)
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .attr('text-anchor', 'middle')
                .text('After Cluster ' + this.state.cluster);
        }
    }

    drawSparklinesTable() {
        $('#subsequencesOverviewTable svg').remove();

        if (this.state.cluster >= 0) {
            let paddingCell = 3, paddingSVG = 1, checkCellWidth = 30;
            let parentEle = $('#clusteringDetail');
            let paddingLeft = Number(parentEle.css('padding-left').slice(0, -2)),
                paddingRight = Number(parentEle.css('padding-right').slice(0, -2));
            let tableWidth = parentEle.width() - paddingLeft - paddingRight - this.paddingCard * 2;
            let cellWidth = (tableWidth - checkCellWidth) / this.variables.length,
                cellHeight = 30;
            let svgWidth = cellWidth - paddingCell * 2,
                svgHeight = cellHeight - paddingCell * 2;

            let xMinMax = [0, ClusteringStore.getSubsequenceParameters().isometryLen];
            let yMinMax = {};
            for (let i = 0; i < this.variables.length; i++) {
                yMinMax[this.variables[i]] = [Infinity, -Infinity];
                for (let j = 0; j < this.SSCluster.length; j++) {
                    for (let k = 0; k < this.SSCluster[j].length; k++) {
                        if (this.SSCluster[j][k][this.variables[i]] < yMinMax[this.variables[i]][0]) {
                            yMinMax[this.variables[i]][0] = this.SSCluster[j][k][this.variables[i]];
                        }
                        if (yMinMax[this.variables[i]][1] < this.SSCluster[j][k][this.variables[i]]) {
                            yMinMax[this.variables[i]][1] = this.SSCluster[j][k][this.variables[i]];
                        }
                    }
                }
            }

            let xScale = d3.scaleLinear()
                .range([paddingSVG, svgWidth - paddingSVG])
                .domain(xMinMax);
            let yScales = {}, curves = {};
            for (let i = 0; i < this.variables.length; i++) {
                yScales[this.variables[i]] = d3.scaleLinear()
                    .range([svgHeight - paddingSVG, paddingSVG])
                    .domain(yMinMax[this.variables[i]])
                    .nice();
                curves[this.variables[i]] = d3.line()
                    .x(function(d, i) {
                        return xScale(i);
                    })
                    .y(function(d) {
                        return yScales[this.variables[i]](d[this.variables[i]]);
                    }.bind(this))
                    .curve(d3.curveCatmullRom.alpha(1));
            }
            
            let dataColors = {};
            for (let i = 0; i < this.datasetsIdx.length; i++) {
                dataColors[this.datasetsIdx[i]] = TimeTubesStore.getPlotColor(this.datasetsIdx[i]);
            }
            // update the height of the table accroding to the number of cluster members
            for (let i = 0; i < this.variables.length; i++) {
                d3.select('#subsequencesOverviewTableTh_' + this.variables[i])
                    .attr('width', cellWidth);
            }
            d3.select('#subsequencesOverviewTable')
                .attr('height', Math.min(tableWidth, cellHeight * (this.SSCluster.length + 1)));
            d3.select('#subsequencesOverviewTableBody')
                .attr('height', Math.min(tableWidth, cellHeight * this.SSCluster.length));
            for (let i = 0; i < this.SSCluster.length; i++) {
                let dataId = this.SSCluster[i].id,
                    SSId = this.SSCluster[i].idx;
                for (let j = 0; j < this.variables.length; j++) {
                    let svg = d3.select('#subsequenceDetailTd_' + dataId + '_' + SSId + '_' + this.variables[j])
                        .append('svg')
                        .attr('id', 'subsequenceDetailSVG_' + dataId + '_' + SSId + '_' + this.variables[j])
                        .attr('class', 'spark')
                        .attr('width', svgWidth)
                        .attr('height', svgHeight);
                    let sparklineGroup = svg.append('g');
                    let sparkline = sparklineGroup 
                        .datum(this.SSCluster[i])
                        .append('path')
                        .attr('fill', 'none')
                        .attr('stroke', dataColors[this.SSCluster[i].id])
                        .attr('stroke-width', 1.5)
                        .attr('d', function(d, i) {
                            return curves[this.variables[j]](d)
                        }.bind(this));
                    sparklineGroup 
                        .selectAll('circle')
                        .data(this.SSCluster[i].dataPoints)
                        .enter()
                        .append('circle')
                        .attr('cx', function(d) {
                            let xVal = (d.z - this.SSCluster[i].dataPoints[0].z) 
                            / (this.SSCluster[i].dataPoints[this.SSCluster[i].dataPoints.length - 1].z - this.SSCluster[i].dataPoints[0].z) 
                            * xMinMax[1];
                            return xScale(xVal);
                        }.bind(this))
                        .attr('cy', function(d) {
                            return yScales[this.variables[j]](d[this.variables[j]]);
                        }.bind(this))
                        .attr('fill', 'white')
                        .attr('stroke', 'black')
                        .attr('stroke-width', 0.5)
                        .attr('r', 1.2);
                }
            }
        }
    }

    showSSStatus() {
        // 現在選択されてるSSにチェック、selectedSSをClusteringProcessと共有？
        // updatedSSを参照して、追加されたSSがあれば背景色を緑にする
        let selectedSS = ClusteringStore.getSelectedSS(),
            updatedSS = ClusteringStore.getUpdatedSS();
        for (let dataId in selectedSS) {
            for (let i = 0; i < selectedSS[dataId].length; i++) {
                let SSId = selectedSS[dataId][i];
                let checkbox = $('#selectSSDetail_' + dataId + '_' + SSId);
                if (checkbox.length > 0) {
                    checkbox.prop('checked', true);
                } 
            }
        }
        for (let dataId in updatedSS) {
            for (let i = 0; i < updatedSS[dataId].length; i++) {
                let SSId = updatedSS[dataId][i].idx;
                let tr = $('#subsequenceDetailTr_' + dataId + '_' + SSId);
                if (tr.length > 0) {
                    if (updatedSS[dataId][i].status === 'add') {
                        tr.addClass('table-success');
                    } else if (updatedSS[dataId][i].status === 'remove') {
                        tr.addClass('table-danger');
                    }
                } 
            }
        }
    }

    onClickSSSelector() {
        return function(d) {
            let targetId = d.target.id;
            if (targetId) {
                let targetEle = targetId.split('_');
                let dataId = targetEle[1],
                    SSId = Number(targetEle[2]);

                let selectedSS = ClusteringStore.getSelectedSS(),
                    updatedSS = ClusteringStore.getUpdatedSS();
                
                let currentState = $('#' + d.target.id).prop('checked');
                if (currentState) {
                    // add to selectedSS, remove from updatedSS
                    if (selectedSS[dataId].indexOf(SSId) < 0) {
                        selectedSS[dataId].push(SSId);
                        d3.select('#subsequenceDetailTr_' + dataId + '_' + SSId)
                            .classed('table-danger', false);
                    }
                    for (let i = 0; i < updatedSS[dataId].length; i++) {
                        if (updatedSS[dataId][i].idx === SSId) {
                            updatedSS[dataId].splice(i, 1);
                            break;
                        }
                    }
                } else {
                    // remove from selectedSS, add to updatedSS
                    selectedSS[dataId].splice(selectedSS[dataId].indexOf(SSId), 1);
                    updatedSS[dataId].push({
                        idx: SSId,
                        status: 'remove'
                    });
                    d3.select('#subsequenceDetailTr_' + dataId + '_' + SSId)
                        .classed('table-danger', true);
                }
                ClusteringAction.updateSSSelection(selectedSS, updatedSS);
            }
        };
    }

    onMouseOverSubsequenceDetailTr() {
        return function(d) {
            // show detail information of the subsequence on the tooltip
            let targetId = d.target.id;
            if (targetId) {
                let tooltip = $('#tooltipClusteringResults'),
                    tooltipTable = $('#tooltipClusteringResultsTable');
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
                let silhouette = this.clusteringScores.silhouetteSS[i];
                tooltipTable.html('<table><tbody><tr><td>File name</td><td class="tooltipTableValues">' + fileName + '</td></tr>' +
                    '<tr><td>Period</td><td class="tooltipTableValues">' + period[0] + '-' + period[1] + '</td></tr>' +
                    '<tr><td>Data points number</td><td class="tooltipTableValues">' + dataPointNum + '</td></tr>' +
                    '<tr><td>Silhouette coefficient</td><td class="tooltipTableValues">' + formatValue(silhouette) + '</td></tr></tbody></table>');
                let mouseX = document.body.clientWidth - d.clientX + 5;
                let mouseY = d.clientY- tooltip.height() -  5;
                tooltip.css({
                    right: mouseX + 'px',
                    bottom: 'unset',
                    left: 'unset',
                    top: mouseY + 'px'
                });
                tooltip.css('display', 'block');


                let beforeAfter = [undefined, undefined];
                if (i - 1 >= 0) {
                    if (this.subsequences[i - 1].id === this.subsequences[i].id) {
                        beforeAfter[0] = typeof(this.labels[i - 1]) === 'object'? this.labels[i - 1].cluster: this.labels[i - 1];
                    }
                }
                if (i + 1 < this.labels.length) {
                    if (this.subsequences[i].id === this.subsequences[i + 1].id) {
                        beforeAfter[1] = typeof(this.labels[i + 1]) === 'object'? this.labels[i + 1].cluster: this.labels[i + 1];
                    }
                }
                domActions.highlightCorrespondingElemInClusteringResults(dataId, SSId, period, beforeAfter);
                ClusteringAction.showTTViewOfSelectedSSClusteringResults(Number(dataId), period);
                // // highlight histogram
                // d3.select('#SSLengthBar_' + Math.floor(period[1] - period[0]))
                //     .attr('stroke', 'black')
                //     .attr('stroke-width', 1.5);

                // // highlight histogram for clusters before/after the selected cluster 
                // if (i - 1 >= 0) {
                //     if (typeof(this.labels[i - 1]) === 'object') {
                //         d3.select('#clusterBeforeHistogramRects_' + this.labels[i - 1].cluster)
                //             .attr('stroke', 'black')
                //             .attr('stroke-width', 1.5);
                //     } else {
                //         d3.select('#clusterBeforeHistogramRects_' + this.labels[i - 1])
                //             .attr('stroke', 'black')
                //             .attr('stroke-width', 1.5);
                //     }
                // }
                // if (i + 1 < this.labels.length) {
                //     if (typeof(this.labels[i + 1]) === 'object') {
                //         d3.select('#clusterAfterHistogramRects_' + this.labels[i + 1].cluster)
                //             .attr('stroke', 'black')
                //             .attr('stroke-width', 1.5);
                //     } else {
                //         d3.select('#clusterAfterHistogramRects_' + this.labels[i + 1])
                //             .attr('stroke', 'black')
                //             .attr('stroke-width', 1.5);
                //     }
                // }

                // // highlight cluster center line chart
                // d3.selectAll('.clusterMemberLineChart_' + dataId + '_' + SSId)
                //     .attr('stroke', '#f26418');

                // // highlight a subsequence in the timeline
                // d3.select('#clusterLine_' + dataId + '_' + SSId)
                //     .attr('stroke', 'black')
                //     .attr('stroke-width', 1.5)
                //     .moveToFront();

                // // highlight sparklines in the filtering process panel
                // if ($('#subsequenceTr_' + dataId + '_' + SSId).length) {
                //     d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                //         .classed('table-active', true);
                // }
                // if ($('#updatedSubsequenceTr_' + dataId + '_' + SSId).length) {
                //     d3.select('#updatedSubsequenceTr_' + dataId + '_' + SSId)
                //         .classed('table-active', true);
                // }
            }
        };
    }

    onMouseOutSubsequenceDetailTr() {
        return function(d) {
            let targetId = d.target.id;
            if (targetId) {
                let targetEle = targetId.split('_');
                let dataId = targetEle[1],
                    SSId = Number(targetEle[2]);
                // hide the tooltip
                $('#tooltipClusteringResults').css('display', 'none');
                
                domActions.removeHighlightCorrespondingElemInClusteringResults(dataId, SSId);
                // // remove stroke from histogram
                // d3.selectAll('.SSLengthBar')
                //     .attr('stroke-width', 0);

                // // remove stroke from histogram for clusters before/after the selected cluster
                // d3.selectAll('#clusterBeforeHistogramRects rect')
                //     .attr('stroke-width', 0);
                // d3.selectAll('#clusterAfterHistogramRects rect')
                //     .attr('stroke-width', 0);

                // // make a highlighted path in cluster center line chart lightgray
                // d3.selectAll('.clusterMemberLineChart_' + dataId + '_' + SSId)
                //     .attr('stroke', 'lightgray');

                // // remove highlight from the timeline
                // d3.select('#clusterLine_' + dataId + '_' + SSId)
                //     .attr('stroke-width', 0);

                // // highlight sparklines in the filtering process panel
                // if ($('#subsequenceTr_' + dataId + '_' + SSId).length) {
                //     d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                //         .classed('table-active', false);
                // }
                // if ($('#updatedSubsequenceTr_' + dataId + '_' + SSId).length) {
                //     d3.select('#updatedSubsequenceTr_' + dataId + '_' + SSId)
                //         .classed('table-active', false);
                // }
            }
        };
    }

    onMouseDownSubsequenceDetailTr() {
        return function(d) {
            this.queryMode = FeatureStore.getMode();
            if (this.queryMode === 'QBE' || this.queryMode === 'QBS' || ($('#subsequenceComparisonNavLink').length > 0 && $('#subsequenceComparisonNavLink').hasClass('active'))) {
                let targetIdElem = d.target.id.split('_');
                let elem = document.getElementById('subsequenceDetailTr_' + targetIdElem[1] + '_' + targetIdElem[2]);
                if (elem){
                    elem.classList.add('drag');
                    this.clickedX = elem.offsetLeft;//d.pageX// - elem.offsetLeft;
                    this.clickedY = elem.offsetTop;//d.pageY// - elem.offsetTop;
                    this.selectedTrId = elem.id;
                    this.selectedTrIdx = elem.rowIndex;
                    document.body.addEventListener('mousemove', this.onMouseMoveSubsequenceDetailTrFnc, false);
                    document.body.addEventListener('mouseup', this.onMouseUpSubsequenceDetailTrFnc, false);
                }
            }
        };
    }

    onMouseMoveSubsequenceDetailTr() {
        return function(d) {
            let drag = document.getElementsByClassName('drag')[0];
            if (drag) {
                drag.style.position = 'absolute';
                d.preventDefault();
                drag.style.top = d.pageY - this.clickedY + 'px';
                drag.style.left = d.pageX - this.clickedX - drag.clientWidth / 2 - $('#extractionMenu').width() + 'px';

                if ($('#subsequenceComparisonNavLink').length > 0 && $('#subsequenceComparisonNavLink').hasClass('active')) {
                    let subsequenceComparisonPanel = $('#subsequenceComparisonTab');
                    let subsequenceComparisonPanelPos = subsequenceComparisonPanel.offset(),
                        subsequenceComparisonPanelWidth = subsequenceComparisonPanel.width()
                        - Number($('#clusteringSubsequenceComparison').css('padding-left').replace('px', ''))
                        - Number($('#clusteringSubsequenceComparison').css('padding-right').replace('px', '')),
                        subsequenceComparisonPanelHeight = subsequenceComparisonPanel.height();
                    if ((subsequenceComparisonPanelPos.left <= d.pageX && d.pageX <= subsequenceComparisonPanelPos.left + subsequenceComparisonPanelWidth)
                    && (subsequenceComparisonPanelPos.top <= d.pageY && d.pageY <= subsequenceComparisonPanelPos.top + subsequenceComparisonPanelHeight)) {
                        let overlayPanel = $('#clusteringSubsequenceComparison > .overlayHidingPanel');
                        overlayPanel.css('display', 'block');
                        overlayPanel.css('width', subsequenceComparisonPanelWidth);
                        overlayPanel.css('height', subsequenceComparisonPanelHeight);
                    }
                } else {
                    switch(this.queryMode) {
                        case 'QBE':
                            let selectedTimeSlice = $('#selectedTimeSliceView');
                            let selectedTimeSlicePos = selectedTimeSlice.offset(),
                                selectedTimeSliceWidth = selectedTimeSlice.width(),
                                selectedTimeSliceHeight = selectedTimeSlice.height();
                            
                            if ((selectedTimeSlicePos.left <= d.pageX && d.pageX <= selectedTimeSlicePos.left + selectedTimeSliceWidth)
                            && (selectedTimeSlicePos.top <= d.pageY && d.pageY <= selectedTimeSlicePos.top + selectedTimeSliceHeight)) {
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

                            if ((sketchPadPos.left <= d.pageX && d.pageX <= sketchPadPos.left + sketchPadWidth)
                            && (sketchPadPos.top <= d.pageY && d.pageY <= sketchPadPos.top + sketchPadHeight)) {
                                let overlayPanel = $('#QBSCanvasArea > .overlayHidingPanel');
                                overlayPanel.css('display', 'block');
                                overlayPanel.css('width', Math.min(sketchPadWidth, sketchPadHeight));
                                overlayPanel.css('height', Math.min(sketchPadWidth, sketchPadHeight));
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
        };
    }

    onMouseUpSubsequenceDetailTr() {
        return function(d) {
            document.body.removeEventListener('mousemove', this.onMouseMoveSubsequenceDetailTrFnc, false);
            document.body.removeEventListener('mouseup', this.onMouseUpSubsequenceDetailTrFnc, false);

            let drag = document.getElementsByClassName('drag')[0];
            if (drag) {
                drag.classList.remove('drag');
                drag.style.position = 'static';
            }

            let targetEle = this.selectedTrId.split('_');
            let dataId = targetEle[1];
            let SSId = Number(targetEle[2]);
            let period = [0, 0];
            for (let i = 0; i < this.SSCluster.length; i++) {
                if (this.SSCluster[i].id === dataId && this.SSCluster[i].idx === SSId) {
                    period[0] = this.SSCluster[i].dataPoints[0].z;
                    period[1] = this.SSCluster[i].dataPoints[this.SSCluster[i].dataPoints.length - 1].z;
                    break;
                }
            }

            if ($('#subsequenceComparisonNavLink').length > 0 && $('#subsequenceComparisonNavLink').hasClass('active')) {
                let overlayPanel = $('#clusteringSubsequenceComparison > .overlayHidingPanel');
                overlayPanel.css('display', 'none');
                let subsequenceComparisonPanel = $('#subsequenceComparisonTab');
                let subsequenceComparisonPanelPos = subsequenceComparisonPanel.offset(),
                    subsequenceComparisonPanelWidth = subsequenceComparisonPanel.width()
                    - Number($('#clusteringSubsequenceComparison').css('padding-left').replace('px', ''))
                    - Number($('#clusteringSubsequenceComparison').css('padding-right').replace('px', '')),
                    subsequenceComparisonPanelHeight = subsequenceComparisonPanel.height();
                if ((subsequenceComparisonPanelPos.left <= d.pageX && d.pageX <= subsequenceComparisonPanelPos.left + subsequenceComparisonPanelWidth)
                && (subsequenceComparisonPanelPos.top <= d.pageY && d.pageY <= subsequenceComparisonPanelPos.top + subsequenceComparisonPanelHeight)) {
                    // create new canvas on clustering comparison panel
                    ClusteringAction.showSelectedSubsequenceInComparisonPanel(Number(dataId), period, SSId);
                }
            } else {
                switch(this.queryMode) {
                    case 'QBE':
                        $('#selectedTimeSliceView > .overlayHidingPanel').css('display', 'none');
                        let selectedTimeSlice = $('#selectedTimeSliceView');
                        let selectedTimeSlicePos = selectedTimeSlice.offset(),
                            selectedTimeSliceWidth = selectedTimeSlice.width(),
                            selectedTimeSliceHeight = selectedTimeSlice.height();
                        if (selectedTimeSlicePos) {
                            if ((selectedTimeSlicePos.left <= d.pageX && d.pageX <= selectedTimeSlicePos.left + selectedTimeSliceWidth)
                            && (selectedTimeSlicePos.top <= d.pageY && d.pageY <= selectedTimeSlicePos.top + selectedTimeSliceHeight)) {
                                // convert the result into a new query
                                convertResultIntoQuery(Number(dataId), period, this.variables);
                                if (FeatureStore.getSource() !== dataId) {
                                    let promise = Promise.resolve();
                                    promise
                                        .then(function() {
                                            showExtractionSourcePanel(dataId);
                                            domActions.toggleSourcePanel(true);
                                            resizeExtractionResultsArea();
                                        }).then(function() {
                                            updateSource(dataId);
                                        });
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
                            if ((sketchPadPos.left <= d.pageX && d.pageX <= sketchPadPos.left + sketchPadWidth)
                            && (sketchPadPos.top <= d.pageY && d.pageY <= sketchPadPos.top + sketchPadHeight)) {
                                // convert the result into a new query
                                convertResultIntoQuery(Number(dataId), period, this.variables);
                            }
                        }
                        break;
                }
            }
            this.moveToOriginalPos();
            this.selectedTrId = undefined;
            this.selectedTrIdx = undefined;
        };
    }

    moveToOriginalPos() {
        let previousRowId = document.getElementById('subsequencesOverviewTable').rows[this.selectedTrIdx - 1].id;
        if (previousRowId) {
            $('#' + previousRowId).after($('#' + this.selectedTrId));
        } else {
            let nextRowId = document.getElementById('subsequencesOverviewTable').rows[this.selectedTrIdx + 1].id;
            $('#' + nextRowId).before($('#' + this.selectedTrId));
        }
        // if (previousRow) {
        //     previousRow.insertAfter(document.getElementById(trId));
        // } else {
        //     let nextResult = document.getElementById('subsequencesOverviewTable').rows[this.selectedTrIdx + 1];
        //     nextResult.insertBefore(document.getElementById(trId));
        // }
        // let nextResult = $('#resultSummaryHolder_' + (this.rank + 1));
        // if (nextResult) {
        //     nextResult.before($('#resultSummaryHolder_' + this.rank));
        // } else {
        //     let previousResult = $('#resultSummaryHolder_' + (this.rank - 1));
        //     previousResult.after($('#resultSummaryHolder_' + this.rank));
        // }
    }

    onDoubleClickSubsequenceDetailTr() {
        return function(d) {
            // jump to TimeTubes view
            let targetId = d.target.id;
            if (targetId) {
                let targetEle = targetId.split('_');
                let dataId = targetEle[1],
                    SSId = Number(targetEle[2]);
                let data;
                for (let i = 0; i < this.subsequences.length; i++) {
                    if (this.subsequences[i].id === dataId && this.subsequences[i].idx === SSId) {
                        data = this.subsequences[i];
                        break;
                    }
                }
                $('#tooltipClusteringResults').css('display', 'none');
                selectMenu('visualization');
                showTimeTubesOfTimeSlice(Number(dataId), [data.dataPoints[0].z, data.dataPoints[data.dataPoints.length - 1].z]);
            }
        };
    }
    // drawSparklinesTableTmp() {
    //     $('#subsequenceOverviewTable').remove();
    //     $('#subsequenceOverviewTableMain').remove();

    //     if (this.state.cluster >= 0) {
    //         let paddingCell = 3;
    //         let clientWidth = $('#clusteringDetail').width() - this.paddingCard * 2;
    //         let clientHeight = $('#clusteringDetail').width() - this.paddingCard * 2;
    //         let cellWidth = clientWidth / this.variables.length,
    //             cellHeight = 30;
    //         let tableHeader = d3.select('#subsequencesOverview')
    //             .append('table')
    //             .attr('id', 'subsequenceOverviewTable')
    //             .attr('class', 'table table-hover sparkTable')
    //             .attr('width', clientWidth)
    //             .attr('height', clientHeight);
    //         let thead = tableHeader.append('thead')
    //                 .attr('width', clientWidth)
    //                 .attr('height', cellHeight);
    //         let labels = [];
    //         for (let i = 0; i < this.variables.length; i++) {
    //             if (this.variableLabels[this.variables[i]].length > 1) {
    //                 labels.push(this.variableLabels[this.variables[i]].join(', '));
    //             } else {
    //                 labels.push(this.variableLabels[this.variables[i]]);
    //             }
    //         }
    //         thead.append('tr')
    //             .style('text-align', 'center')
    //             .style('font-size', '10px')
    //             .selectAll('th')
    //             .data(labels)
    //             .enter()
    //             .append('th')
    //             .attr('width', cellWidth)
    //             .attr('height', cellHeight)
    //             .text(function(d) {return d});

    //         let tableMain = d3.select('#subsequencesOverview')
    //             .append('div')
    //             .attr('id', 'subsequenceOverviewTableMain')
    //             .style('overflow', 'auto')
    //             .style('height', Math.min(clientWidth, cellHeight * this.SSCluster.length))
    //             .append('table')
    //             .attr('class', 'table table-hover sparkTable')
    //             .attr('width', clientWidth)
    //             .attr('height', Math.min(clientWidth, cellHeight * this.SSCluster.length));//cellHeight * (this.SSCluster.length + 1));
    //         let tbody = tableMain.append('tbody')
    //                 .attr('width', clientWidth)
    //                 .attr('height', Math.min(clientWidth, cellHeight * this.SSCluster.length) - cellHeight)
    //                 .attr('id', 'subsequenceOverviewTableBody');
            
    //         let rows = tbody.selectAll('tr')
    //             .data(this.SSCluster)
    //             .enter()
    //             .append('tr');
    //         let cells = rows.selectAll('td')
    //             .data(this.variables)
    //             .enter()
    //             .append('td')
    //             .attr('width', cellWidth)
    //             .attr('height', cellHeight);
    //         let xMinMax = [0, ClusteringStore.getSubsequenceParameters().isometryLen];
    //         let yMinMax = {};
    //         for (let i = 0; i < this.variables.length; i++) {
    //             yMinMax[this.variables[i]] = [Infinity, -Infinity];
    //             for (let j = 0; j < this.SSCluster.length; j++) {
    //                 for (let k = 0; k < this.SSCluster[j].length; k++) {
    //                     if (this.SSCluster[j][k][this.variables[i]] < yMinMax[this.variables[i]][0]) {
    //                         yMinMax[this.variables[i]][0] = this.SSCluster[j][k][this.variables[i]];
    //                     }
    //                     if (yMinMax[this.variables[i]][1] < this.SSCluster[j][k][this.variables[i]]) {
    //                         yMinMax[this.variables[i]][1] = this.SSCluster[j][k][this.variables[i]];
    //                     }
    //                 }
    //             }
    //         }

    //         let svgWidth = cellWidth - paddingCell * 2,
    //             svgHeight = cellHeight - paddingCell * 2;

    //         let xScale = d3.scaleLinear()
    //             .range([paddingCell, svgWidth - paddingCell])
    //             .domain(xMinMax);
    //         let yScales = {}, curves = {};
    //         for (let i = 0; i < this.variables.length; i++) {
    //             yScales[this.variables[i]] = d3.scaleLinear()
    //                 .range([svgHeight - paddingCell, paddingCell])
    //                 .domain(yMinMax[this.variables[i]])
    //                 .nice();
    //             curves[this.variables[i]] = d3.line()
    //                 .x(function(d, i) {
    //                     return xScale(i);
    //                 })
    //                 .y(function(d) {
    //                     return yScales[this.variables[i]](d[this.variables[i]]);
    //                 }.bind(this))
    //                 .curve(d3.curveCatmullRom.alpha(1));
    //         }
            
    //         let rowCounter = 0;
    //         let dataColors = {};
    //         for (let i = 0; i < this.datasetsIdx.length; i++) {
    //             dataColors[this.datasetsIdx[i]] = TimeTubeesStore.getPlotColor(this.datasetsIdx[i]);
    //         }
    //         let sparklinesSVG = rows
    //             .selectAll('td')
    //             .append('svg')
    //             .attr('class', 'spark')
    //             .attr('id', function(d, i) {
    //                 let idName = 'sparkLineSVG_' + d + '_' + ((i === this.variables.length - 1)? rowCounter++: rowCounter);
    //                 return idName;
    //             }.bind(this))
    //             .attr('width', svgWidth)
    //             .attr('height', svgHeight);
    //         rowCounter = 0;
    //         let sparklines = sparklinesSVG
    //             .append('path')
    //             .attr('fill', 'none')
    //             .attr('stroke', function(d, i) {
    //                 return dataColors[this.SSCluster[(i === this.variables.length - 1)? rowCounter++: rowCounter].id]
    //             }.bind(this))
    //             .attr('stroke-width', 1.5);
    //         rowCounter = 0;
    //         sparklines
    //             .attr('d', function(d, i) {
    //                 return curves[d](this.SSCluster[(i === this.variables.length - 1)? rowCounter++: rowCounter]);
    //             }.bind(this));
                
    //         for (let i = 0; i < sparklinesSVG._groups.length; i++) {
    //             // iは行数に一致
    //                 // let data = DataStore.getData(this.SSCluster[i].id).data.spatial.slice(this.SSRanges[i][0], this.SSRanges[i][1] + 1);
    //             for (let j = 0; j < sparklinesSVG._groups[i].length; j++) {
    //                 // jは変数に一致
    //                 let svgId = sparklinesSVG._groups[i][j].id;
    //                 let varTd = svgId.split('_')[1];
    //                 // let data = DataStore.getData(this.SSCluster[SSIdx].id).data.spatial.slice(this.SSRanges[SSIdx][0], this.SSRanges[SSIdx][1] + 1);
    //                 d3.select('#' + svgId)
    //                     .append('g')
    //                     .attr('class', 'dataPointsSparkLine')
    //                     .selectAll('circle')
    //                     .data(this.SSCluster[i].dataPoints)
    //                     .enter()
    //                     .append('circle')
    //                     .attr('cx', function(d) {
    //                         let xVal = (d.z - this.SSCluster[i].dataPoints[0].z) / (this.SSCluster[i].dataPoints[this.SSCluster[i].dataPoints.length - 1].z - this.SSCluster[i].dataPoints[0].z) * xMinMax[1];
    //                         return xScale(xVal);
    //                     }.bind(this))
    //                     .attr('cy', function(d) {
    //                         return yScales[varTd](d[varTd]);
    //                     }.bind(this))
    //                     .attr('fill', 'white')
    //                     .attr('stroke', 'black')
    //                     .attr('stroke-width', 0.5)
    //                     .attr('r', 1.2);
    //             }
    //         }
    //     }
    //     // let dataForSP = observationDataPoints();
    //     // let dataPoints = sparklines
    //     //     .selectAll('circle')
    //     //     .data();

    //     // function observationDataPoints() {
    //     //     // 実データと変数から各セルに打つべきデータ点一覧を返す？
    //     // }
    // }

    // drawClusterFeatureTable() {
    //     $('#clusterFeatureTable').remove();

    //     let clientWidth = this.mount.clientWidth;
    //     let cellHeight = 30;
    //     let table = d3.select('#clusterFeature')
    //         .append('table')
    //         .attr('class', 'table table-hover')
    //         .attr('id', 'clusterFeatureTable')
    //         .attr('width', clientWidth);
    //     let tbody = table.append('tbody')
    //         .attr('width', clientWidth);

    //     // subsequence number
    //     let SSnumRow = tbody.append('tr')
    //         .attr('height'. cellHeight)
    //         // .append('td')
    //         // .attr('width', clientWidth / 2)
    //         // .text('subsequence number')
    //         // .append('td')
    //         // .attr('width', clientWidth / 2)
    //         // .text(this.SSCluster.length);
    // }
}
