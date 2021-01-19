import React from 'react';
import * as d3 from 'd3';
import ClusteringStore from '../Stores/ClusteringStore';
import DataStore from '../Stores/DataStore';
import TimeTubeesStore from '../Stores/TimeTubesStore';
import {tickFormatting, formatValue} from '../lib/2DGraphLib';

export default class ClusteringDetail extends React.Component {
    constructor() {
        super();
        this.margin = {left: 30, right: 10, top: 20, bottom: 20};
        this.paddingCard = 16;
        this.cluster = -1;
        this.state = {
            cluster: -1
        };
    }

    render() {
        let clusterCenterTimeTubes,
            clusterCenterLineCharts,
            datasetDistribution,
            subsequenceLengthDistribution,
            clusterFeatureTable,
            subsequencesOverview;
        clusterCenterTimeTubes = this.clusterCenterTimeTubesView();
        clusterCenterLineCharts = this.clusterCenterLineCharts();
        datasetDistribution = this.datasetDistribution();
        subsequenceLengthDistribution = this.subsequenceLengthDistribution();
        clusterFeatureTable = this.clusterFeatureTable();
        subsequencesOverview = this.subsequencesOverview();
        return (
            <div id='clusteringDetail' className='clusteringPanel'
                style={{height: window.innerHeight - $('#appHeader').height()}}
                ref={mount => {
                    this.mount = mount;
                }}>
                {clusterCenterTimeTubes}
                {clusterCenterLineCharts}
                {/* {datasetDistribution} */}
                {subsequenceLengthDistribution}
                {clusterFeatureTable}
                {subsequencesOverview}
            </div>
        );
    }

    componentDidMount() {
        ClusteringStore.on('showClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.labels = ClusteringStore.getLabels();
            this.subsequences = ClusteringStore.getSubsequences();
            this.ranges = ClusteringStore.getRanges();
            this.datasetsIdx = ClusteringStore.getDatasets();
            this.clusteringScores = ClusteringStore.getClusteringScores();
            this.subsequenceParameters = ClusteringStore.getSubsequenceParameters();
        });
        ClusteringStore.on('showClusterDetails', (cluster) => {
            this.cluster = cluster;
            this.variables = ClusteringStore.getClusteringParameters().variables;//Object.keys(this.clusterCenters[cluster][0]);
            this.variables = this.variables.filter(ele => ele !== 'z')
            this.createVariableLabels();
            this.extractSubsequencesInCluster();
            this.drawClusterCenterLineCharts();
            this.drawSubsequenceLengthHistogram();
            this.drawSparklinesTable();
            this.setState({
                cluster: cluster
            });
        });
    }

    clusterCenterTimeTubesView() {
        return (
            <div id='selectedClusterCenterTimeTubes'
                className='resultAreaElem'>
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

    datasetDistribution() {
        return (
            <div
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

    clusterFeatureTable() {
        let table;
        if (this.state.cluster >= 0) {
            let width = $('#clusteringDetail').width() - this.paddingCard * 2;//this.mount.clientWidth - this.paddingCard * 2;
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
            })
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
        return (
            <div id='subsequencesOverview'
                className='resultAreaElem'>
            </div>
        );
    }

    extractSubsequencesInCluster() {
        this.SSCluster = [];
        this.SSRanges = [];
        this.yMinMax = {};
        this.variables.forEach(function(d) {
            this.yMinMax[d] = [Infinity, -Infinity];
        }.bind(this));
        for (let i = 0; i < this.labels.length; i++) {
            if (typeof(this.labels[i]) === 'object') {
                if (this.labels[i].cluster === this.cluster) {
                    this.SSCluster.push(this.subsequences[i]);
                    this.SSRanges.push(this.ranges[i]);

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
                if (this.labels[i] === this.cluster) {
                    this.SSCluster.push(this.subsequences[i]);
                    this.SSRanges.push(this.ranges[i]);
                    
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
        let clientWidth = $('#clusteringDetail').width() - this.paddingCard * 2;
        // let clientWidth = this.mount.clientWidth - this.paddingCard * 2;
        let lineChartWidth = clientWidth / 2,
            lineChartHeight = clientWidth / 2 * 0.6;

        let svg = d3.select('#selectedClusterCenterLineCharts')
            .append('svg')
            .attr('id', 'clusterCenterLineChartsSVG')
            .attr('width', clientWidth)
            .attr('height', lineChartHeight * Math.ceil(this.variables.length / 2));
        
        for (let i = 0; i < this.variables.length; i++) {
            let xScale = d3.scaleLinear()
                .domain([0, this.clusterCenters[this.cluster].length - 1])
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
                .call(xAxis);
            svg.append('g')
                .attr('transform', 'translate(' + (xPos + this.margin.left) + ',' + 0 + ')')
                .call(yAxis);
            
            // subsequences in the cluster
            for (let j = 0; j < this.SSCluster.length; j++) {
                svg.append('path')
                    .datum(this.SSCluster[j])
                    .attr('fill', 'none')
                    .attr('stroke', 'lightgray')
                    .attr('stroke-width', 0.7)
                    .attr('d', d3.line()
                        .x(function(d, i) {
                            return xScale(i);
                        })
                        .y(function(d) {
                            return yScale(d[this.variables[i]]);
                        }.bind(this))
                        .curve(d3.curveCatmullRom.alpha(1))
                    );
            }

            // cluster center line
            svg.append('path')
                .datum(this.clusterCenters[this.cluster])
                .attr('fill', 'none')
                .attr('stroke', d3.hsl(this.clusterColors[this.cluster][0], this.clusterColors[this.cluster][1], this.clusterColors[this.cluster][2]))
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

    drawSubsequenceLengthHistogram () {
        $('#subsequenceLengthHistogramSVG').remove();


        let clientWidth = $('#clusteringDetail').width() - this.paddingCard * 2;
        // let clientWidth = this.mount.clientWidth - this.paddingCard * 2;
        let height = clientWidth * 0.5;
        
        let svg = d3.select('#subsequenceLengthHistogram')
            .append('svg')
            .attr('id', 'subsequenceLengthHistogramSVG')
            .attr('width', clientWidth)
            .attr('height', height);

        let subsequenceLength = ClusteringStore.getSubsequenceParameters().SSperiod;
        let xScale = d3.scaleLinear()
            .domain(subsequenceLength)
            .range([this.margin.left, clientWidth - this.margin.right]);
        svg.append('g')
            .attr('transform', 'translate(0,' + (height - this.margin.bottom) + ')')
            .call(d3.axisBottom(xScale));

        let subsequencesCluster = [];
        for (let i = 0; i < this.labels.length; i++) {
            let clusterSS = (typeof(this.labels[i]) === 'object')? this.labels[i].cluster: this.labels[i];
            if (clusterSS === this.cluster) {
                subsequencesCluster.push(this.subsequences[i]);
            }
        }
         let histogram = d3.histogram()
            .value(function(d) {return d[d.length - 1].z - d[0].z})
            .domain(subsequenceLength)
            .thresholds(xScale.ticks(10));
        let bins = histogram(subsequencesCluster);
        let yScale = d3.scaleLinear()
            .range([height - this.margin.bottom, this.margin.top])
            .domain([0, d3.max(bins, function(d) {return d.length})]);
        svg.append('g')
            .attr('transform', 'translate(' + this.margin.left + ',0)')
            .call(d3.axisLeft(yScale).ticks(5));
            
        if (this.datasetsIdx.length === 1) {
            let rectColor = TimeTubeesStore.getPlotColor(this.datasetsIdx[0]);
            svg.selectAll('rect')
                .data(bins)
                .enter()
                .append('rect')
                .attr('class', 'SSLengthBar')
                .attr('x', 1)
                .attr('transform', function(d) {
                    return 'translate(' + xScale(d.x0) + ',' + yScale(d.length) + ')'
                })
                .attr('width', function(d) {
                    return xScale(d.x1) - xScale(d.x0) - 1;
                })
                .attr('height', function(d) {
                    return height - this.margin.bottom - yScale(d.length);
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
                rectColors.push(TimeTubeesStore.getPlotColor(this.datasetsIdx[i]));
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

    drawSparklinesTable() {
        $('#subsequenceOverviewTable').remove();
        $('#subsequenceOverviewTableMain').remove();

        let paddingCell = 3;

        let clientWidth = $('#clusteringDetail').width() - this.paddingCard * 2;
        // let clientWidth = this.mount.clientWidth - this.paddingCard * 2;
        let cellWidth = clientWidth / this.variables.length,
            cellHeight = 30;
        let tableHeader = d3.select('#subsequencesOverview')
            .append('table')
            .attr('id', 'subsequenceOverviewTable')
            .attr('class', 'table table-hover sparkTable')
            .attr('width', clientWidth)
            .attr('height', cellHeight);
        let thead = tableHeader.append('thead')
                .attr('width', clientWidth)
                .attr('height', cellHeight);
        let labels = [];
        for (let i = 0; i < this.variables.length; i++) {
            if (this.variableLabels[this.variables[i]].length > 1) {
                labels.push(this.variableLabels[this.variables[i]].join(', '));
            } else {
                labels.push(this.variableLabels[this.variables[i]]);
            }
        }
        thead.append('tr')
            .style('text-align', 'center')
            .style('font-size', '10px')
            .selectAll('th')
            .data(labels)
            .enter()
            .append('th')
            .attr('width', cellWidth)
            .attr('height', cellHeight)
            .text(function(d) {return d});

        let tableMain = d3.select('#subsequencesOverview')
            .append('div')
            .attr('id', 'subsequenceOverviewTableMain')
            .style('overflow', 'auto')
            .style('height', Math.min(clientWidth, cellHeight * this.SSCluster.length))
            .append('table')
            .attr('class', 'table table-hover sparkTable')
            .attr('width', clientWidth)
            .attr('height', Math.min(clientWidth, cellHeight * this.SSCluster.length));//cellHeight * (this.SSCluster.length + 1));
        let tbody = tableMain.append('tbody')
                .attr('width', clientWidth)
                .attr('height', Math.min(clientWidth, cellHeight * this.SSCluster.length) - cellHeight)
                .attr('id', 'subsequenceOverviewTableBody');
        
        let rows = tbody.selectAll('tr')
            .data(this.SSCluster)
            .enter()
            .append('tr');
        let cells = rows.selectAll('td')
            .data(this.variables)
            .enter()
            .append('td')
            .attr('width', cellWidth)
            .attr('height', cellHeight);
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

        let svgWidth = cellWidth - paddingCell * 2,
            svgHeight = cellHeight - paddingCell * 2;

        let xScale = d3.scaleLinear()
            .range([paddingCell, svgWidth - paddingCell])
            .domain(xMinMax);
        let yScales = {}, curves = {};
        for (let i = 0; i < this.variables.length; i++) {
            yScales[this.variables[i]] = d3.scaleLinear()
                .range([svgHeight - paddingCell, paddingCell])
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
        
        let rowCounter = 0;
        let dataColors = {};
        for (let i = 0; i < this.datasetsIdx.length; i++) {
            dataColors[this.datasetsIdx[i]] = TimeTubeesStore.getPlotColor(this.datasetsIdx[i]);
        }
        let sparklinesSVG = rows
            .selectAll('td')
            .append('svg')
            .attr('class', 'spark')
            .attr('id', function(d, i) {
                let idName = 'sparkLineSVG_' + d + '_' + ((i === this.variables.length - 1)? rowCounter++: rowCounter);
                return idName;
            }.bind(this))
            .attr('width', svgWidth)
            .attr('height', svgHeight);
        rowCounter = 0;
        let sparklines = sparklinesSVG
            .append('path')
            .attr('fill', 'none')
            .attr('stroke', function(d, i) {
                return dataColors[this.SSCluster[(i === this.variables.length - 1)? rowCounter++: rowCounter].id]
            }.bind(this))
            .attr('stroke-width', 1.5);
        rowCounter = 0;
        sparklines
            .attr('d', function(d, i) {
                return curves[d](this.SSCluster[(i === this.variables.length - 1)? rowCounter++: rowCounter]);
            }.bind(this));
            
        for (let i = 0; i < sparklinesSVG._groups.length; i++) {
            // iは行数に一致
                // let data = DataStore.getData(this.SSCluster[i].id).data.spatial.slice(this.SSRanges[i][0], this.SSRanges[i][1] + 1);
            for (let j = 0; j < sparklinesSVG._groups[i].length; j++) {
                // jは変数に一致
                let svgId = sparklinesSVG._groups[i][j].id;
                let varTd = svgId.split('_')[1];
                // let data = DataStore.getData(this.SSCluster[SSIdx].id).data.spatial.slice(this.SSRanges[SSIdx][0], this.SSRanges[SSIdx][1] + 1);
                d3.select('#' + svgId)
                    .append('g')
                    .attr('class', 'dataPointsSparkLine')
                    .selectAll('circle')
                    .data(this.SSCluster[i].dataPoints)
                    .enter()
                    .append('circle')
                    .attr('cx', function(d) {
                        let xVal = (d.z - this.SSCluster[i].dataPoints[0].z) / (this.SSCluster[i].dataPoints[this.SSCluster[i].dataPoints.length - 1].z - this.SSCluster[i].dataPoints[0].z) * xMinMax[1];
                        return xScale(xVal);
                    }.bind(this))
                    .attr('cy', function(d) {
                        return yScales[varTd](d[varTd]);
                    }.bind(this))
                    .attr('fill', 'white')
                    .attr('stroke', 'black')
                    .attr('stroke-width', 0.5)
                    .attr('r', 1.2);
            }
        }
        // let dataForSP = observationDataPoints();
        // let dataPoints = sparklines
        //     .selectAll('circle')
        //     .data();

        // function observationDataPoints() {
        //     // 実データと変数から各セルに打つべきデータ点一覧を返す？
        // }
    }

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
