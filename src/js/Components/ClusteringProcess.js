import React from 'react';
import * as d3 from 'd3';
import * as ClusteringAction from '../Actions/ClusteringAction';
import ClusteringStore from '../Stores/ClusteringStore';
import DataStore from '../Stores/DataStore';
d3.selection.prototype.moveToFront =
    function() {
        return this.each(function(){this.parentNode.appendChild(this);});
    };
export default class ClusteringProcess extends React.Component {
    constructor() {
        super();
        this.margin = {left: 10, right: 10, top: 10, bottom: 20};
        this.areaPadding = {left: 16, right: 16, top: 8, bottom: 8};
        this.steps = [];
        this.filteringProcess = {};
        this.yMinMax = {};
        this.filteringStepColors = [
            '#284a6c',
            '#7b7971',
            '#80b139',
            '#1d95c6',
            '#f26418',
            '#d23430'
        ];
        this.filteringNames = {
            normalSlidingWindow: 'Normal sliding window',
            dataDrivenSlidingWindow: 'Data-driven sliding window',
            sameStartingPoint: 'Same starting data point',
            overlappingDegree: 'Overlapping degree'
        };
        this.state = {
            subsequencesFilteringProcess: [],
            selectedProcess: ''
        };
    }

    componentDidMount() {
        ClusteringStore.on('showClusteringResults', () => {
            this.filteringProcess = ClusteringStore.getFilteringProcess();
            this.steps = Object.keys(this.filteringProcess);
            this.steps = this.steps.filter(ele => ele !== 'subsequences');
            this.steps.sort(function(a, b) {
                let aSSNum = 0;
                for (let key in this.filteringProcess[a]) { 
                    aSSNum += this.filteringProcess[a][key].length;
                }
                let bSSNum = 0;
                for (let key in this.filteringProcess[b]) { 
                    bSSNum += this.filteringProcess[b][key].length;
                }
                return (aSSNum < bSSNum? 1: -1);
            }.bind(this));
            this.datasetsIdx = ClusteringStore.getDatasets();
            this.variables = ClusteringStore.getClusteringParameters().variables;
            this.variables = this.variables.filter(ele => ele !== 'z');
            this.createVariableLabels();
            this.filteringSummary();
        });
        ClusteringStore.on('showFilteringStep', (selectedProcess) => {
            // this.showSubsequencesInTheSelectedStep(selectedProcess);
            this.setState({
                selectedProcess: selectedProcess
            })
        });
    }

    componentDidUpdate() {
        // この時点でテーブルは生成されてるから、それにd3を使ってグラフを描く
        this.drawSparklinesOfSubsequencesInTheSelectedStep();
    }

    render() {
        let subsequencesTable;
        if (this.state.selectedProcess !== '') {
            subsequencesTable = this.subsequencesInTheSelectedStepTable();
        }
        return (
            <div id="clusteringProcess"
                className='clusteringPanel'
                ref={mount => {
                    this.mount = mount;
                }}>
                <div id='filteringProcessSummary'
                    className='resultAreaElem'>
                    <svg id='filteringProcessSummarySVG'></svg>
                </div>
                <div id='SSFilteringStep'
                    className='resultAreaElem'>
                    Subsequences in the selected filtering step
                    {subsequencesTable}
                </div>
                <div id='selectedSSList'
                    className='resultAreaElem'>
                    Newly selected subsequences
                </div>
                <div id='updateClusteringControllers'
                    className='resultAreaElem'></div>
            </div>
        );
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

    filteringSummary() {
        $('#filteringProcessSummarySVG').children().remove();

        let svgWidth = this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
        let triangleSideLength = svgWidth - this.margin.left - this.margin.right;
        let triangleHeight = Math.sqrt(3) * triangleSideLength / 2;
        let svgHeight = triangleHeight * this.steps.length / (this.steps.length + 1) + this.margin.top + this.margin.bottom;
        let deltaX = 0.5 * triangleSideLength / (this.steps.length + 1),
            deltaY = triangleHeight / (this.steps.length + 1);
        let labelWidth = 50,
            labelHeight = 20;
        let svg = d3.select('#filteringProcessSummarySVG')
            .attr('height', svgHeight)
            .attr('width', svgWidth);
        
        for (let i = 0; i < this.steps.length; i++) {
            let topWidth = triangleSideLength * (this.steps.length + 1 - i) / (this.steps.length + 1),
                bottomWidth = triangleSideLength * (this.steps.length + 1 - i - 1) / (this.steps.length + 1);
            let trapezoidPos = [
                {x: deltaX * i, y: deltaY * i},
                {x: deltaX * (i + 1), y: deltaY * (i + 1)},
                {x: deltaX * (i + 1) + bottomWidth, y: deltaY * (i + 1)},
                {x: deltaX * i + topWidth, y: deltaY * i},
                {x: deltaX * i, y: deltaY * i}
            ];
            let trapezoidGroup = svg.append('g')
                .attr('class', 'filteringTrapezoidGroup');
            if (i !== 0) {
                trapezoidGroup
                    .on('click', onClickTrapezoid);
            }
            trapezoidGroup.append('path')
                .datum(trapezoidPos)
                .attr('class', 'filteringTrapezoid')
                .attr('id', 'filteringTrapezoid_' + this.steps[i])
                .attr('d', d3.line()
                    .x(function(d) {return d.x;})
                    .y(function(d) {return d.y;})
                )
                .attr('fill', this.filteringStepColors[i])
                .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
            trapezoidGroup.append('text')
                .attr('x', svgWidth / 2)
                .attr('y', deltaY * i + deltaY / 2 + this.margin.top)
                .text(this.filteringNames[this.steps[i]])
                .attr('fill', 'white')
                .attr('text-anchor', 'middle')
                .attr('text-weight', 'bold')
                .attr('height', deltaY)
                .attr('width', bottomWidth)
                .attr('class', 'filteringProcessLabel');
        }
        for (let i = 0; i < this.steps.length; i++) {
            let SSnum = 0;
            for (let key in this.filteringProcess[this.steps[i]]) {
                SSnum += this.filteringProcess[this.steps[i]][key].length;
            }
            let filteredSSNumLabel = svg.append('g')
                .attr('class', 'filteredSSLabelGroup');
                // .on('mouseover', mouseOverFilteredSSNum)
                // .on('mouseout', mouseOutFilteredSSNum)
                // .on('click', onClickFilteredSSNumber);
            filteredSSNumLabel
                .append('rect')
                .attr('x', svgWidth / 2 - labelWidth / 2)
                .attr('y', deltaY * (i + 1) - labelHeight / 2 + this.margin.top)
                .attr('width', labelWidth)
                .attr('height', labelHeight)
                .attr('fill', 'white')
                .attr('class', 'filteredSSRect');
            filteredSSNumLabel
                .append('text')
                .attr('x', svgWidth / 2)
                .attr('y', deltaY * (i + 1) + 6 + this.margin.top) // 6 is an adjustment value for aligning text vertically
                .text(SSnum)
                .attr('fill', '#3e3f3a')
                .attr('text-anchor', 'middle')
                .attr('class', 'filteredSSNumber')
                .attr('font-size', '1rem');
        }
        function onClickTrapezoid() {
            let path = $('path', this),
                text = $('text', this);
            let fillColor = path.attr('fill'),
                textColor = text.attr('fill');
            if (fillColor === 'white') {
                path.attr('fill', textColor)
                    .attr('stroke-width', 0);
                text.attr('fill', 'white');
            } else {
                let trapezoidGroups = $(this).parent()
                    .children('g.filteringTrapezoidGroup');
                for (let i = 0; i < trapezoidGroups.length; i++) {
                    let pathChild = trapezoidGroups[i].children[0],
                        textChild = trapezoidGroups[i].children[1];
                    if ($(pathChild).attr('fill') === 'white') {
                        $(pathChild).attr('fill', $(textChild).attr('fill'))
                            .attr('stroke-width', 0);
                        $(textChild).attr('fill', 'white');
                    }
                }
                text.attr('fill', fillColor);
                path.attr('fill', 'white')
                    .attr('stroke', fillColor)
                    .attr('stroke-width', '1.5px');
                let selectedProcess = path.attr('id').split('_')[1];
                ClusteringAction.showFilteringStep(selectedProcess);
            }
        }
        // function onClickFilteredSSNumber() {
        //     let rect = $('rect', this),
        //         text = $('text', this);
        //     if (rect.attr('fill') === 'white' || rect.attr('fill') === '#f8f5f0') {
        //         rect.attr('fill', '#3e3f3a');
        //         text.attr('fill', 'white');
        //     } else {
        //         rect.attr('fill', 'white');
        //         text.attr('fill', '#3e3f3a');
        //     }
        // }
        // function mouseOverFilteredSSNum() {
        //     // let rect = $('rect', this);
        //     // if (rect.attr('fill') !== '#3e3f3a') {
        //     //     $('rect', this).attr('fill', '#f8f5f0');
        //     // }
        // }
        // function mouseOutFilteredSSNum() {
        //     // $('rect', this).attr('fill', 'white');
        // }
    }

    subsequencesInTheSelectedStepTable() {
        let previousStep = this.steps[this.steps.indexOf(this.state.selectedProcess) - 1];

        let paddingCell = 3, checkCellWidth = 30;
        let tableWidth = this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
        let tableHeight = (this.mount.clientHeight - $('#filteringProcessSummary').height()) / 2
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
                <th key={i} style={{width: (i === 0)? checkCellWidth: cellWidth, height: cellHeight}}>
                    {labels[i]}
                </th>
            );
        }
        let tableHeader = (
            <thead style={{width: tableWidth, height: cellHeight}}
                id='subsequencesFilteringProcessTableHeader'>
                <tr style={{textAlign: 'center', fontSize: '10px'}}>
                    {headerItems}
                </tr>
            </thead>
        );
        let trItems = [];
        this.yMinMax = {};
        for (let i = 0; i < this.variables.length; i++) {
            this.yMinMax[this.variables[i]] = [Infinity, -Infinity];
        }
        for (let dataId in this.filteringProcess[previousStep]) {
            for (let i = 0; i < this.filteringProcess[previousStep][dataId].length; i++) {
                let tdItems = [];
                tdItems.push(
                    <td key='checkbox' style={{textAlign: 'center', width: checkCellWidth, height: cellHeight}}>
                        <input type="checkbox" className={'subsequenceCheckbox'} name='subsequenceSelector'/>
                    </td>);
                for (let j = 0; j < this.variables.length; j++) {
                    tdItems.push(
                        <td
                            key={this.variables[j]}
                            id={'subsequenceTd_' + dataId + '_' + i + '_' + this.variables[j]}
                            style={{width: cellWidth, height: cellHeight}}>
                            {/* <svg className='spark'
                                style={{width: cellWidth - paddingCell * 2, height: cellHeight - paddingCell * 2}}></svg> */}
                        </td>);
                    for (let k = 0; k < this.filteringProcess.subsequences[dataId][i].length; k++) {
                        if (this.filteringProcess.subsequences[dataId][i][k][this.variables[j]] < this.yMinMax[this.variables[j]][0]) {
                            this.yMinMax[this.variables[j]][0] = this.filteringProcess.subsequences[dataId][i][k][this.variables[j]];
                        }
                        if (this.yMinMax[this.variables[j]][1] < this.filteringProcess.subsequences[dataId][i][k][this.variables[j]]) {
                            this.yMinMax[this.variables[j]][1] = this.filteringProcess.subsequences[dataId][i][k][this.variables[j]];
                        }
                    }
                }
                trItems.push(
                    <tr key={'subsequenceTr_' + dataId + '_' + i}
                        style={{width: tableWidth, height: cellHeight}}>
                        {tdItems}
                    </tr>);
            }
        }
        return (
            <table id='subsequencesFilteringProcessTable'
                className='table table-hover sparkTable'
                style={{width: tableWidth, height: tableHeight}}>
                {tableHeader}
                <tbody id='subsequencesFilteringProcessTableBody'
                    style={{height: tableHeight - cellHeight}}>
                    {trItems}
                </tbody>
            </table>
        )
    }

    // showSubsequencesInTheSelectedStep(selectedProcess) {
    //     $('#subsequencesInTheSelectedStepTable').remove();

    //     let paddingCell = 3, checkCellWidth = 30;
    //     let tableWidth = this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
    //     let tableHeight = (this.mount.clientHeight - $('#filteringProcessSummary').height()) / 2
    //     let cellWidth = (tableWidth - checkCellWidth) / this.variables.length,
    //         cellHeight = 30;
    //     let table = d3.select('#SSFilteringStep')
    //         .append('table')
    //         .attr('id', 'subsequencesInTheSelectedStepTable')
    //         .attr('class', 'table table-hover sparkTable')
    //         .attr('width', tableWidth)
    //         .attr('height', tableHeight);
    //     let thead = table.append('thead')
    //         .attr('width', tableWidth)
    //         .attr('height', tableHeight);
    //     let labels = [];
    //     labels.push('');
    //     for (let i = 0; i < this.variables.length; i++) {
    //         if (this.variableLabels[this.variables[i]].length > 1) {
    //             labels.push(this.variableLabels[this.variables[i]].join(', '));
    //         } else {
    //             labels.push(this.variableLabels[this.variables[i]]);
    //         }
    //     }
    //     thead.append('tr')
    //         .style('text-align', 'center')
    //         .style('font-size', '10px')
    //         .selectAll('th')
    //         .data(labels)
    //         .enter()
    //         .append('th')
    //         .attr('width', function(d, i) {
    //             if (i === 0) return checkCellWidth;
    //             else return cellWidth;
    //         })
    //         .attr('height', cellHeight)
    //         .text(function(d) {return d});
    //     let tbody = table.append('tbody')
    //         .attr('width', tableWidth)
    //         .attr('height', tableHeight);
    //     let previousStep = this.steps[this.steps.indexOf(selectedProcess) - 1];
    //     for (let key in this.filteringProcess[previousStep]) {
    //         for (let i = 0; i < this.filteringProcess[previousStep][key].length; i++) {

    //         }
    //     }
    // }

    drawSparklinesOfSubsequencesInTheSelectedStep() {
        $('#subsequencesFilteringProcessTable svg').remove();

        let selectedStepIdx = this.steps.indexOf(this.state.selectedProcess);
        let previousStep = this.steps[this.steps.indexOf(this.state.selectedProcess) - 1];

        let paddingCell = 3, checkCellWidth = 30, paddingSVG = 1;
        let tableWidth = this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
        let cellWidth = (tableWidth - checkCellWidth) / this.variables.length,
            cellHeight = 30;
        let svgWidth = cellWidth - paddingCell * 2,
            svgHeight = cellHeight - paddingCell * 2;

        let xScale = d3.scaleLinear()
            .range([paddingSVG, svgWidth - paddingSVG])
            .domain([0, ClusteringStore.getSubsequenceParameters().isometryLen]);
        let yScales = {}, curves = {};
        for (let i = 0; i < this.variables.length; i++) {
            yScales[this.variables[i]] = d3.scaleLinear()
                .range([svgHeight - paddingSVG, paddingSVG])
                .domain(this.yMinMax[this.variables[i]])
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
        for (let dataId in this.filteringProcess[previousStep]) {
            for (let i = 0; i < this.filteringProcess[previousStep][dataId].length; i++) {
                let data = this.filteringProcess.subsequences[dataId][this.filteringProcess[previousStep][dataId][i]];
                for (let j = 0; j < this.variables.length; j++) {
                    // td's id is ('subsequenceTd_' + dataId + '_' + i + '_' + this.variables[j])
                    let svg = d3.select('#subsequenceTd_' + dataId + '_' + i + '_' + this.variables[j])
                        .append('svg')
                        .attr('id', 'subsequenceSVG_' + dataId + '_' + i + '_' + this.variables[j])
                        .attr('class', 'spark')
                        .attr('width', svgWidth)
                        .attr('height', svgHeight);
                    let strokeColor = (
                        this.filteringProcess[this.state.selectedProcess][dataId].indexOf(this.filteringProcess[previousStep][dataId][i]) < 0
                        ? this.filteringStepColors[selectedStepIdx - 1]: this.filteringStepColors[selectedStepIdx]
                        );
                    let sparkline = svg
                        .datum(data)
                        .append('path')
                        .attr('fill', 'none')
                        .attr('stroke', strokeColor)
                        .attr('stroke-width', 1.5);
                    sparkline
                        .attr('d', function(d, i) {
                            return curves[this.variables[j]](d);
                        }.bind(this));
                }
                
            }
        }
    }
}
