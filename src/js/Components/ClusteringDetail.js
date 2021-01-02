import React from 'react';
import * as d3 from 'd3';
import ClusteringStore from '../Stores/ClusteringStore';
import DataStore from '../Stores/DataStore';

export default class ClusteringDetail extends React.Component {
    constructor() {
        super();
        this.margin = {left: 30, right: 10, top: 20, bottom: 20};
        this.cluster = -1;
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
        subsequencesOverview = this.subsequencesOverview;
        return (
            <div id='clusteringDetail' className='clusteringPanel'
                ref={mount => {
                    this.mount = mount;
                }}>
                clustering detail
                {clusterCenterTimeTubes}
                {clusterCenterLineCharts}
                {datasetDistribution}
                {subsequenceLengthDistribution}
                {clusterFeatureTable}
                {subsequencesOverview}
            </div>
        );
    }

    componentDidMount() {
        ClusteringStore.on('showClusterDetails', (cluster) => {
            console.log(cluster);
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.cluster = cluster;
            this.variables = Object.keys(this.clusterCenters[cluster][0]);
            this.createVariableLabels();
            this.drawClusterCenterLineCharts();
        });
    }

    clusterCenterTimeTubesView() {
        return (
            <div id='selectedClusterCenterTimeTubes'>
            </div>
        );
    }

    clusterCenterLineCharts() {
        return (
            <div id='selectedClusterCenterLineCharts'>
                cluster center line charts
            </div>
        );
    }

    datasetDistribution() {
        return (
            <div>
                dataset distribution
            </div>
        );
    }

    subsequenceLengthDistribution() {
        return (
            <div>
                subsequenceLengthDistribution
            </div>
        );
    }

    clusterFeatureTable() {
        return (
            <div>
                cluster feature
            </div>
        );
    }

    subsequencesOverview() {
        return (
            <div>
                subsequences
            </div>
        );
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
        // すでにグラフがあったら全て削除
        $('#clusterCenterLineChartsSVG').remove();

        let clientWidth = this.mount.clientWidth,
            clientHeight = this.mount.clientHeight;
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
}
