import React from 'react';
import * as d3 from 'd3';
import {reperformClustering} from '../lib/subsequenceClustering';
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
        this.updateSparklineTableFlag = false;
        this.updataUpdatedSSSparklineTableFlag = false;
        this.filteringStepColors = [
            // '#284a6c',
            // '#7b7971',
            // '#80b139',
            // '#1d95c6',
            // '#f26418',
            // '#d23430'
            // '#284a6c',
            // // '#366391',
            // '#447db6',
            // // '#6696c6',
            // '#8cb0d4',
            // // '#b1c9e2',
            // '#d6e3f0'
            d3.interpolateYlGnBu(1),
            d3.interpolateYlGnBu(0.8),
            d3.interpolateYlGnBu(0.6),
            d3.interpolateYlGnBu(0.4),
            d3.interpolateYlGnBu(0.2)
        ];
        this.filteringNames = {
            normalSlidingWindow: 'Normal sliding window',
            dataDrivenSlidingWindow: 'Data-driven sliding window',
            sameStartingPoint: 'Same starting data point',
            overlappingDegree: 'Overlapping degree'
        };
        this.state = {
            subsequencesFilteringProcess: [],
            selectedProcess: '',
            selectedSS: {},
            updatedSS: {}
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
            let selectedSS = {}, updatedSS = {};
            for (let dataId in this.filteringProcess.subsequences) {
                selectedSS[dataId] = [];
                updatedSS[dataId] = [];
            }
            for (let dataId in this.filteringProcess[this.steps[this.steps.length - 1]]) {
                for (let i = 0; i < this.filteringProcess[this.steps[this.steps.length - 1]][dataId].length; i++) {
                    selectedSS[dataId].push(this.filteringProcess[this.steps[this.steps.length - 1]][dataId][i]);
                }
            }
            this.createVariableLabels();
            this.filteringSummary();
            this.setState({
                selectedSS: selectedSS,
                updatedSS: updatedSS
            });
        });
        ClusteringStore.on('showFilteringStep', (selectedProcess) => {
            // this.showSubsequencesInTheSelectedStep(selectedProcess);
            this.updateSparklineTableFlag = true;
            this.setState({
                selectedProcess: selectedProcess
            })
        });
    }

    componentDidUpdate() {
        // この時点でテーブルは生成されてるから、それにd3を使ってグラフを描く
        this.drawSparklinesOfSubsequencesInTheSelectedStep();
        this.checkCurrentlySelectedSS();
        this.drawSparklinesOfUpdatedSubsequences();
    }

    render() {
        let subsequencesTable;
        let updatedTable;
        if (this.state.selectedProcess !== '') {
            subsequencesTable = this.subsequencesInTheSelectedStepTable();
            updatedTable = this.updatedSubsequencesTable();
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
                    <h6>Subsequences in the selected filtering step</h6>
                    {subsequencesTable}
                </div>
                <div id='selectedSSList'
                    className='resultAreaElem'>
                    <h6>Subsequences that will be <span style={{color: '#80b139'}}>added</span>/<span style={{color: '#d9534f'}}>removed</span></h6>
                    {updatedTable}
                </div>
                <div id='updateClusteringControllers'
                    className='resultAreaElem' style={{float: 'right'}}>
                    <button type="button" 
                        className="btn btn-sm btn-primary" 
                        style={{float: 'right'}}
                        onClick={this.onClickRunClusteringAgainButton().bind(this)}>
                        Run again
                    </button>
                    <button type="button" 
                        className="btn btn-sm btn-primary" 
                        style={{float: 'right'}}
                        onClick={this.onClickClearButton().bind(this)}>
                        Clear
                    </button>
                </div>
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

        let svgWidth = $('#clusteringProcess').width() - this.areaPadding.left - this.areaPadding.right;//this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
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
        let tableWidth = $('#clusteringProcess').width() - this.areaPadding.left - this.areaPadding.right;//this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
        let tableHeight = (this.mount.clientHeight - $('#filteringProcessSummary').height()) / 2;//(this.mount.clientHeight - $('#filteringProcessSummary').height()) / 2
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
                let SSId = this.filteringProcess[previousStep][dataId][i];
                tdItems.push(
                    <td key='checkbox' style={{textAlign: 'center', width: checkCellWidth, height: cellHeight}}>
                        <input 
                            type="checkbox" 
                            className={'subsequenceCheckbox'} 
                            name='subsequenceSelector'
                            id={'selectSSFilteringProcess_' + dataId + '_' + SSId}
                            onClick={this.onClickSSSelector().bind(this)}/>
                    </td>);
                for (let j = 0; j < this.variables.length; j++) {
                    tdItems.push(
                        <td
                            key={this.variables[j]}
                            id={'subsequenceTd_' + dataId + '_' + SSId + '_' + this.variables[j]}
                            style={{width: cellWidth, height: cellHeight}}>
                            {/* <svg className='spark'
                                style={{width: cellWidth - paddingCell * 2, height: cellHeight - paddingCell * 2}}></svg> */}
                        </td>);
                    for (let k = 0; k < this.filteringProcess.subsequences[dataId][SSId].length; k++) {
                        if (this.filteringProcess.subsequences[dataId][SSId][k][this.variables[j]] < this.yMinMax[this.variables[j]][0]) {
                            this.yMinMax[this.variables[j]][0] = this.filteringProcess.subsequences[dataId][SSId][k][this.variables[j]];
                        }
                        if (this.yMinMax[this.variables[j]][1] < this.filteringProcess.subsequences[dataId][SSId][k][this.variables[j]]) {
                            this.yMinMax[this.variables[j]][1] = this.filteringProcess.subsequences[dataId][SSId][k][this.variables[j]];
                        }
                    }
                }
                trItems.push(
                    <tr id={'subsequenceTr_' + dataId + '_' + SSId}
                        key={'subsequenceTr_' + dataId + '_' + SSId}
                        style={{width: tableWidth, height: cellHeight}}
                        onMouseOver={this.onMouseOverFilteringStepSSRow().bind(this)}
                        onMouseOut={this.onMouseOutFilteringStepSSRow().bind(this)}>
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

    updatedSubsequencesTable() {
        let paddingCell = 3, checkCellWidth = 30;
        let tableWidth = $('#clusteringProcess').width() - this.areaPadding.left - this.areaPadding.right;
        let tableHeight = (this.mount.clientHeight - $('#filteringProcessSummary').height()) * 0.3;
        // let tableWidth = this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
        // let tableHeight = (this.mount.clientHeight - $('#filteringProcessSummary').height()) * 0.3;
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
                id='updatedSubsequencesTableHeader'>
                <tr style={{textAlign: 'center', fontSize: '10px'}}>
                    {headerItems}
                </tr>
            </thead>
        );

        let trItems = [];
        for (let dataId in this.state.updatedSS) {
            for (let i = 0; i < this.state.updatedSS[dataId].length; i++) {
                let tdItems = [];
                let SSId = this.state.updatedSS[dataId][i].idx;
                tdItems.push(
                    <td key='checkbox' style={{textAlign: 'center', width: checkCellWidth, height: cellHeight}}>
                        <input 
                            type="checkbox" 
                            className={'subsequenceCheckbox'} 
                            name='subsequenceSelector'
                            id={'selectUpdatedSSFilteringProcess_' + dataId + '_' + SSId}
                            onClick={this.onClickUpdatedSSSelector().bind(this)}
                            />
                    </td>);
                for (let j = 0; j < this.variables.length; j++) {
                    tdItems.push(
                        <td
                            key={this.variables[j]}
                            id={'updatedSubsequenceTd_' + dataId + '_' + SSId + '_' + this.variables[j]}
                            style={{width: cellWidth, height: cellHeight}}>

                        </td>
                    );
                }
                trItems.push(
                    <tr id={'updatedSubsequenceTr_' + dataId + '_' + SSId}
                        key={'updatedSubsequenceTr_' + dataId + '_' + SSId}
                        style={{width: tableWidth, height: cellHeight}}
                        // onMouseOver={this.onMouseOverFilteringStepSSRow().bind(this)}
                        // onMouseOut={this.onMouseOutFilteringStepSSRow().bind(this)}>
                        >
                        {tdItems}
                    </tr>
                );
            }
        }

        return (
            <table id='updatedSubsequencesTable'
                className='table table-hover sparkTable'
                style={{width: tableWidth}}>
                {tableHeader}
                <tbody id='updatedSubsequencesTableBody'>
                    {trItems}
                </tbody>
            </table>
        );
    }

    onClickSSSelector() {
        return function(d) {
            let targetId = d.target.id;
            if (targetId) {
                let targetIdEle = targetId.split('_');
                let dataId = targetIdEle[1],
                    SSId = Number(targetIdEle[2]);

                let currentState = $('#' + d.target.id).prop('checked');
                let SSInClustering = this.filteringProcess[this.steps[this.steps.length - 1]][dataId].indexOf(SSId) < 0? false: true;

                if (currentState) {
                    // add a row to updatedSubsequencesTable
                    let newSelectedSS = this.state.selectedSS;
                    newSelectedSS[dataId].push(SSId);
                    let newUpdatedSS = this.state.updatedSS;
                    if (SSInClustering) {
                        // cancel removing SS from clustering
                        for (let i = 0; i < newUpdatedSS[dataId].length; i++) {
                            if (newUpdatedSS[dataId][i].idx === SSId) {
                                newUpdatedSS[dataId].splice(i, 1);
                                d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                                    .classed('table-danger', false);
                                break;
                            }
                        }
                    } else {
                        newUpdatedSS[dataId].push({idx: SSId, status: 'add'});
                        d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                            .classed('table-success', true);
                    }

                    this.updataUpdatedSSSparklineTableFlag = true;
                    this.setState({
                        selectedSS: newSelectedSS,
                        updatedSS: newUpdatedSS
                    });
                } else {
                    // remove a row from updatedSubsequencesTable
                    let newSelectedSS = this.state.selectedSS;
                    newSelectedSS[dataId].splice(newSelectedSS[dataId].indexOf(SSId), 1);
                    let newUpdatedSS = this.state.updatedSS;
                    if (SSInClustering) {
                        // this SS is removed from clustering
                        newUpdatedSS[dataId].push({idx: SSId, status: 'remove'});
                        d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                            .classed('table-danger', true);
                    } else {
                        // cancel the addition of SS
                        for (let i = 0; i < newUpdatedSS[dataId].length; i++) {
                            if (newUpdatedSS[dataId][i].idx === SSId) {
                                newUpdatedSS[dataId].splice(i, 1);
                                d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                                    .classed('table-success', false);
                                break;
                            }
                        }
                    }

                    this.updataUpdatedSSSparklineTableFlag = true;
                    this.setState({
                        selectedSS: newSelectedSS,
                        updatedSS: newUpdatedSS
                    });
                }
            }
        };
    }

    onClickUpdatedSSSelector() {
        return function(d) {
            let targetId = d.target.id;
            if (targetId) {
                let targetIdEle = targetId.split('_');
                let dataId = targetIdEle[1],
                    SSId = Number(targetIdEle[2]);

                let currentState = $('#' + d.target.id).prop('checked');
                let SSInClustering = this.filteringProcess[this.steps[this.steps.length - 1]][dataId].indexOf(SSId) < 0? false: true;

                if (currentState) {
                    // add a row to updatedSubsequencesTable
                    let newSelectedSS = this.state.selectedSS;
                    newSelectedSS[dataId].push(SSId);
                    let newUpdatedSS = this.state.updatedSS;
                    if (SSInClustering) {
                        // cancel removing SS from clustering
                        for (let i = 0; i < newUpdatedSS[dataId].length; i++) {
                            if (newUpdatedSS[dataId][i].idx === SSId) {
                                newUpdatedSS[dataId].splice(i, 1);
                                d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                                    .classed('table-danger', false);
                                break;
                            }
                        }
                    } else {
                        newUpdatedSS[dataId].push({idx: SSId, status: 'add'});
                        d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                            .classed('table-success', true);
                    }

                    this.updataUpdatedSSSparklineTableFlag = true;
                    this.setState({
                        selectedSS: newSelectedSS,
                        updatedSS: newUpdatedSS
                    });
                } else {
                    // remove a row from updatedSubsequencesTable
                    let newSelectedSS = this.state.selectedSS;
                    newSelectedSS[dataId].splice(newSelectedSS[dataId].indexOf(SSId), 1);
                    let newUpdatedSS = this.state.updatedSS;
                    if (SSInClustering) {
                        // this SS is removed from clustering
                        newUpdatedSS[dataId].push({idx: SSId, status: 'remove'});
                        d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                            .classed('table-danger', true);
                    } else {
                        // cancel the addition of SS
                        for (let i = 0; i < newUpdatedSS[dataId].length; i++) {
                            if (newUpdatedSS[dataId][i].idx === SSId) {
                                newUpdatedSS[dataId].splice(i, 1);
                                d3.select('#subsequenceTr_' + dataId + '_' + SSId)
                                    .classed('table-success', false);
                                break;
                            }
                        }
                    }

                    this.updataUpdatedSSSparklineTableFlag = true;
                    this.setState({
                        selectedSS: newSelectedSS,
                        updatedSS: newUpdatedSS
                    });
                }
            }
        };
    }

    onClickRunClusteringAgainButton() {
        return function() {
            let subsequences = [];
            for (let dataId in this.state.selectedSS) {
                for (let i = 0; i < this.state.selectedSS[dataId].length; i++) {
                    subsequences.push(this.filteringProcess.subsequences[dataId][this.state.selectedSS[dataId][i]]);
                }
            }
            let clusteringParameters = ClusteringStore.getClusteringParameters();
            let dataLen = ClusteringStore.getSubsequenceParameters().isometryLen;
            let [clusterCenters, labels, clusteringScores] = reperformClustering(subsequences, clusteringParameters, dataLen);
            ClusteringAction.updateClusteringResults(subsequences, clusterCenters, labels, clusteringScores, this.state.updatedSS);
        };
    }

    onClickClearButton() {
        return function() {
            ClusteringAction.resetClusteringResults();
        };
    }

    onMouseOverFilteringStepSSRow() {
        return function(d) {
            let targetId = d.target.id;
            if (targetId) {
                let targetIdEle = targetId.split('_');
                let dataId = targetIdEle[1],
                    SSId = Number(targetIdEle[2]);
                let xMinMax = this.xScale.domain();
                // show data points on sparklines
                let data = this.filteringProcess.subsequences[dataId][SSId];
                for (let i = 0; i < this.variables.length; i++) {
                    let svg = d3.select('#subsequenceSVG_' + dataId + '_' + SSId + '_' + this.variables[i]);
                    svg.select('g')
                        .selectAll('circle')
                        .data(data.dataPoints)
                        .enter()
                        .append('circle')
                        .attr('cx', function(d) {
                            let xVal = (d.z - data.dataPoints[0].z) 
                                / (data.dataPoints[data.dataPoints.length - 1].z - data.dataPoints[0].z) * xMinMax[1];
                            return this.xScale(xVal);
                        }.bind(this))
                        .attr('cy', function(d) {
                            return this.yScales[this.variables[i]](d[this.variables[i]]);
                        }.bind(this))
                        .attr('fill', 'white')
                        .attr('stroke', 'black')
                        .attr('stroke-width', 0.5)
                        .attr('r', 1.2);
                }
            }
        };
    }

    onMouseOutFilteringStepSSRow() {
        return function(d) {
            // remove data points on sparklines
            let targetId = d.target.id;
            if (targetId) {
                let targetIdEle = targetId.split('_');
                let dataId = targetIdEle[1],
                    SSId = targetIdEle[2];
                for (let i = 0; i < this.variables.length; i++) {
                    let svg = d3.select('#subsequenceSVG_' + dataId + '_' + SSId + '_' + this.variables[i]);
                    svg.select('g')
                        .selectAll('circle')
                        .remove();
                }
            }
        };
    }

    drawSparklinesOfSubsequencesInTheSelectedStep() {
        if (this.state.selectedProcess && this.updateSparklineTableFlag) {
            $('#subsequencesFilteringProcessTable svg').remove();

            let selectedStepIdx = this.steps.indexOf(this.state.selectedProcess);
            let previousStep = this.steps[this.steps.indexOf(this.state.selectedProcess) - 1];

            let paddingCell = 3, checkCellWidth = 30, paddingSVG = 1;
            let tableWidth = $('#clusteringProcess').width() - this.areaPadding.left - this.areaPadding.right;
            // let tableWidth = this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
            let cellWidth = (tableWidth - checkCellWidth) / this.variables.length,
                cellHeight = 30;
            let svgWidth = cellWidth - paddingCell * 2,
                svgHeight = cellHeight - paddingCell * 2;

            let xMinMax = [0, ClusteringStore.getSubsequenceParameters().isometryLen];
            let xScale = d3.scaleLinear()
                .range([paddingSVG, svgWidth - paddingSVG])
                .domain(xMinMax);
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
            this.xScale = xScale;
            this.yScales = yScales;
            this.curves = curves;
            for (let dataId in this.filteringProcess[previousStep]) {
                for (let i = 0; i < this.filteringProcess[previousStep][dataId].length; i++) {
                    let SSId = this.filteringProcess[previousStep][dataId][i];
                    let data = this.filteringProcess.subsequences[dataId][SSId];
                    for (let j = 0; j < this.variables.length; j++) {
                        // td's id is ('subsequenceTd_' + dataId + '_' + this.filteringProcess[previousStep][dataId][i] + '_' + this.variables[j])
                        // this.filteringProcess[previousStep][dataId][i] is data's index in this.filteringProcess.subsequences
                        let svg = d3.select('#subsequenceTd_' + dataId + '_' + SSId + '_' + this.variables[j])
                            .append('svg')
                            .attr('id', 'subsequenceSVG_' + dataId + '_' + SSId + '_' + this.variables[j])
                            .attr('class', 'spark')
                            .attr('width', svgWidth)
                            .attr('height', svgHeight);
                        let strokeColor = (
                            this.filteringProcess[this.state.selectedProcess][dataId].indexOf(SSId) < 0
                            ? this.filteringStepColors[selectedStepIdx - 1]: this.filteringStepColors[selectedStepIdx]
                            );
                        let sparklineGroup = svg.append('g');
                        let sparkline = sparklineGroup
                            .datum(data)
                            .append('path')
                            .attr('fill', 'none')
                            .attr('stroke', strokeColor)
                            .attr('stroke-width', 1.5);
                        sparkline
                            .attr('d', function(d, i) {
                                return curves[this.variables[j]](d);
                            }.bind(this));
                        // sparklineGroup
                        //     .selectAll('circle')
                        //     .data(data.dataPoints)
                        //     .enter()
                        //     .append('circle')
                        //     .attr('cx', function(d) {
                        //         let xVal = (d.z - data.dataPoints[0].z) 
                        //             / (data.dataPoints[data.dataPoints.length - 1].z - data.dataPoints[0].z) * xMinMax[1];
                        //         return xScale(xVal);
                        //     })
                        //     .attr('cy', function(d) {
                        //         return yScales[this.variables[j]](d[this.variables[j]]);
                        //     }.bind(this))
                        //     .attr('fill', 'white')
                        //     .attr('stroke', 'black')
                        //     .attr('stroke-width', 0.5)
                        //     .attr('r', 1.2);
                    }
                    
                }
            }
            this.updateSparklineTableFlag = false;
        }
    }

    drawSparklinesOfUpdatedSubsequences() {
        if (this.state.selectedProcess && this.updataUpdatedSSSparklineTableFlag) {
            $('#updatedSubsequencesTable svg').remove();

            let selectedStepIdx = this.steps.indexOf(this.state.selectedProcess);
            let previousStep = this.steps[this.steps.indexOf(this.state.selectedProcess) - 1];

            let paddingCell = 3, checkCellWidth = 30, paddingSVG = 1;
            let tableWidth = $('#clusteringProcess').width() - this.areaPadding.left - this.areaPadding.right;
            // let tableWidth = this.mount.clientWidth - this.areaPadding.left - this.areaPadding.right;
            let cellWidth = (tableWidth - checkCellWidth) / this.variables.length,
                cellHeight = 30;
            let svgWidth = cellWidth - paddingCell * 2,
                svgHeight = cellHeight - paddingCell * 2;

            for (let dataId in this.state.updatedSS) {
                for (let i = 0; i < this.state.updatedSS[dataId].length; i++) {
                    let SSId = this.state.updatedSS[dataId][i].idx;
                    let data = this.filteringProcess.subsequences[dataId][SSId];
                    for (let j = 0; j < this.variables.length; j++) {
                        let trClass = (this.state.updatedSS[dataId][i].status === 'add')? 'table-success': 'table-danger';
                        d3.select('#updatedSubsequenceTr_' + dataId + '_' + SSId)
                            .classed(trClass, true);
                        let svg = d3.select('#updatedSubsequenceTd_' + dataId + '_' + SSId + '_' + this.variables[j])
                            .append('svg')
                            .attr('id', 'updateSubsequenceSVG_' + dataId + '_' + SSId + '_' + this.variables[j])
                            .attr('class', 'spark')
                            .attr('width', svgWidth)
                            .attr('height', svgHeight);
                        let strokeColor = (
                            this.filteringProcess[this.state.selectedProcess][dataId].indexOf(SSId) < 0
                            ? this.filteringStepColors[selectedStepIdx - 1]: this.filteringStepColors[selectedStepIdx]
                            );
                        let sparklineGroup = svg.append('g');
                        let sparkline = sparklineGroup
                            .datum(data)
                            .append('path')
                            .attr('fill', 'none')
                            .attr('stroke', strokeColor)
                            .attr('stroke-width', 1.5);
                        sparkline
                            .attr('d', function(d, i) {
                                return this.curves[this.variables[j]](d);
                            }.bind(this));
                    }
                }
            }

            this.updataUpdatedSSSparklineTableFlag = false;
        }
    }

    checkCurrentlySelectedSS() {
        if (this.state.selectedProcess) {
            // for (let dataId in this.filteringProcess[this.steps[this.steps.length - 1]]) {
            //     for (let i = 0; i < this.filteringProcess[this.steps[this.steps.length - 1]][dataId].length; i++) {
            //         let SSId = this.filteringProcess[this.steps[this.steps.length - 1]][dataId][i];
            //         $('#selectSSFilteringProcess_' + dataId + '_' + SSId).prop('checked', true);
            //     }
            // }
            // reset checked
            $('.subsequenceCheckbox').prop('checked', false);
            for (let dataId in this.state.selectedSS) {
                for (let i = 0; i < this.state.selectedSS[dataId].length; i++) {
                    $('#selectSSFilteringProcess_' + dataId + '_' + this.state.selectedSS[dataId][i]).prop('checked', true);
                    if ($('#selectUpdatedSSFilteringProcess_' + dataId + '_' + this.state.selectedSS[dataId][i]).length) {
                        $('#selectUpdatedSSFilteringProcess_' + dataId + '_' + this.state.selectedSS[dataId][i]).prop('checked', true);
                    }
                }
            }
        }
    }
}
