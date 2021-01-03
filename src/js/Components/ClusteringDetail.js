import React from 'react';
import * as d3 from 'd3';
import ClusteringStore from '../Stores/ClusteringStore';
import DataStore from '../Stores/DataStore';
import TimeTubeesStore from '../Stores/TimeTubesStore';

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
        ClusteringStore.on('showClusterDetails', (cluster) => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.labels = ClusteringStore.getLabels();
            this.subsequences = ClusteringStore.getSubsequences();
            this.cluster = cluster;
            this.variables = Object.keys(this.clusterCenters[cluster][0]);
            this.datasets = ClusteringStore.getDatasets();
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
            let width = this.mount.clientWidth - this.paddingCard * 2;
            table = (
                <table id='clusterFeatureTable'
                    className='table table-hover'
                    style={{width: width}}>
                    <tbody>
                        <tr>
                            <td style={{width: width / 2}}>Subsequence number</td>
                            <td style={{width: width / 2}}>{this.SSCluster.length}</td>
                        </tr>
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
        for (let i = 0; i < this.labels.length; i++) {
            if (typeof(this.labels[i]) === 'object') {
                if (this.labels[i].cluster === this.cluster) {
                    this.SSCluster.push(this.subsequences[i]);
                }
            } else {
                if (this.labels[i] === this.cluster) {
                    this.SSCluster.push(this.subsequences[i]);
                }
            }
        }
    }

    createVariableLabels() {
        let variables = {};
        let targets = ClusteringStore.getDatasets();
        for (let i = 0; i < targets.length; i++) {
            let lookup = DataStore.getData(targets[i]).data.lookup;
            for (let key in lookup) {
                if (!(key in variables)) {
                    variables[key] = lookup[key];
                } else {
                    for (let j = 0; j < lookup[key].length; j++) {
                        if (variables[key].indexOf(lookup[key][j]) < 0) {
                            variables[key].push(lookup[key][j]);
                        }
                    }
                }
            }
        }
        this.variableLabels = variables;
    }

    drawClusterCenterLineCharts() {
        $('#clusterCenterLineChartsSVG').remove();

        let clientWidth = this.mount.clientWidth - this.paddingCard * 2;
        console.log(this.mount.clientWidth, clientWidth);
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
            let yMinMax = d3.extent(this.clusterCenters[this.cluster], d => d[this.variables[i]]);
            let yScale = d3.scaleLinear()
                .domain(yMinMax)
                .range([lineChartHeight * Math.floor(i / 2) + lineChartHeight - this.margin.bottom, lineChartHeight * Math.floor(i / 2) + this.margin.top]);

            let xAxis = d3.axisBottom(xScale).ticks(5);
            let yAxis = d3.axisLeft(yScale).ticks(5);
            
            let xPos = lineChartWidth * (i % 2),
                yPos = lineChartHeight * Math.floor(i / 2);
            svg.append('g')
                .attr('transform', 'translate(' + 0 + ',' + (yPos + lineChartHeight - this.margin.bottom) + ')')
                .call(xAxis);
            svg.append('g')
                .attr('transform', 'translate(' + (xPos + this.margin.left) + ',' + 0 + ')')
                .call(yAxis);
            
            svg.append('path')
                .datum(this.clusterCenters[this.cluster])
                .attr('fill', 'none')
                .attr('stroke', d3.hsl(this.clusterColors[this.cluster][0], this.clusterColors[this.cluster][1], this.clusterColors[this.cluster][2]))
                .attr('stroke-width', 1.5)
                .attr('d', d3.line()
                    .x(function(d, i) {
                        return xScale(i)
                    }.bind(this))
                    .y(function(d) {
                        return yScale(d[this.variables[i]]);
                    }.bind(this))
                    .curve(d3.curveCatmullRom)
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
                .attr('font-size', '10px')
                .attr('text-anchor', 'middle')
                .text(label);
        }
    }

    drawSubsequenceLengthHistogram () {
        $('#subsequenceLengthHistogramSVG').remove();


        let clientWidth = this.mount.clientWidth - this.paddingCard * 2;
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
            if (this.labels[i] === this.cluster) {
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
            
        if (this.datasets.length === 1) {
            let rectColor = TimeTubeesStore.getPlotColor(this.datasets[0]);
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
        } else if (this.datasets.length > 1) {
            let binsStack = [];
            for (let i = 0; i < bins.length; i++) {
                let stackTmp = {};
                for (let j = 0; j < this.datasets.length; j++) {
                    stackTmp[this.datasets[j]] = 0;
                }
                for (let j = 0; j < bins[i].length; j++) {
                    stackTmp[bins[i][j].id]++;
                }
                binsStack.push(stackTmp);
            }
            let stack = d3.stack()
                .keys(this.datasets);
            let rectColors = [];
            for (let i = 0; i < this.datasets.length; i++) {
                rectColors.push(TimeTubeesStore.getPlotColor(this.datasets[i]));
            }
            let series = stack(binsStack);
            console.log(series);
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
        let clientWidth = this.mount.clientWidth - this.paddingCard * 2;
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
            .attr('width', clientWidth)
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
                .attr('width', clientWidth);
        
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
        let xMinMax = [0, this.SSCluster[0].length - 1];
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
            .range([paddingCell, cellWidth - paddingCell])
            .domain(xMinMax);
        let yScales = {}, curves = {};
        for (let i = 0; i < this.variables.length; i++) {
            yScales[this.variables[i]] = d3.scaleLinear()
                .range([cellHeight - paddingCell, paddingCell])
                .domain(yMinMax[this.variables[i]])
                .nice();
            curves[this.variables[i]] = d3.line()
                .x(function(d, i) {
                    return xScale(i);
                })
                .y(function(d) {
                    return yScales[this.variables[i]](d[this.variables[i]]);
                }.bind(this))
                .curve(d3.curveCatmullRom);
        }
        
        let rowCounterColor = 0, rowCounter = 0;
        let dataColors = {};
        for (let i = 0; i < this.datasets.length; i++) {
            dataColors[this.datasets[i]] = TimeTubeesStore.getPlotColor(this.datasets[i]);
        }
        let sparklines = rows
            .selectAll('td')
            .append('svg')
            .attr('class', 'spark')
            .attr('width', cellWidth - paddingCell * 2)
            .attr('height', cellHeight - paddingCell * 2)
            .append('path')
            .attr('fill', 'none')
            .attr('stroke', function(d, i) {
                return dataColors[this.SSCluster[(i === this.variables.length - 1)? rowCounterColor++: rowCounterColor].id]
            }.bind(this))
            .attr('stroke-width', 1.5)
            .attr('d', function(d, i) {
                return curves[d](this.SSCluster[(i === this.variables.length - 1)? rowCounter++: rowCounter]);
            }.bind(this));
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
