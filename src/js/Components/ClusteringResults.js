import React from "react";
import ClusteringTimeline from "../Components/ClusteringTimeline";
import ClusteringOverview from "../Components/ClusteringOverview";
import ClusteringProcess from "../Components/ClusteringProcess";
import ClusteringSubsequenceComparison from "../Components/ClusteringSubsequenceComparison";
import ClusteringHistory from '../Components/ClusteringHistory';
import ClusteringDetails from "../Components/ClusteringDetail";

export default class ClusteringResults extends React.Component {
	constructor(props) {
		super();
		this.clusteringMethod = "kmeans";
		this.subsequences = [];
		this.clusterCenters = [];
		this.labels = [];
		this.resultsSVGTmp = [];
	}

	render() {
		return (
			<div
				id="clusteringResults"
				className="clusteringPanel"
				style={{
					height: window.innerHeight - $("#appHeader").outerHeight(true),
				}}
			>
				<div id="clusteringResultsLeftColumn">
					<ul className="nav nav-tabs" id="clusteringResultsLeftColumnNavTabs">
						<li className="nav-item">
							<a
                                id='filteringProcessNavLink'
								className="nav-link active"
								data-toggle="tab"
								href="#filteringProcessTab"
							>
								Filtering process
							</a>
						</li>
						<li className="nav-item">
							<a
                                id='subsequenceComparisonNavLink'
								className="nav-link"
								data-toggle="tab"
								href="#subsequenceComparisonTab"
							>
								Comparison
							</a>
						</li>
						<li className="nav-item">
							<a
                                id='clusteringHistoryNavLink'
								className="nav-link"
								data-toggle="tab"
								href="#clusteringHistoryTab"
							>
								History
							</a>
						</li>
					</ul>
					<div
						id="clusteringResultsLeftColumnTabContent"
						className="tab-content"
					>
						<div className="tab-pane fade show active" id="filteringProcessTab">
							<ClusteringProcess />
						</div>
						<div className="tab-pane fade" id="subsequenceComparisonTab">
							<ClusteringSubsequenceComparison />
						</div>
						<div className="tab-pane fade" id="clusteringHistoryTab">
							<ClusteringHistory />
						</div>
					</div>
				</div>
				<div id="clusteringResultsOverview">
					<ClusteringTimeline />
					<ClusteringOverview />
				</div>
				<ClusteringDetails />
				{/* <div id='clusteringLineCharts'>

                </div> */}
				<div
					className="tooltip clusteringResults"
					id="tooltipClusteringResults"
					style={{ display: "none" }}
				>
					<canvas
						id="tooltipClusteringResultsSubsequencesTTView"
						width="150"
						height="150"
						style={{ width: "150px", height: "150px" }}
					></canvas>
					<div id="tooltipClusteringResultsTable"></div>
				</div>
                <div className="tooltip"
                    id='tooltipFeatureHeatmap'
					style={{ display: "none" }}>
                </div>
				<div className="popover fade show bs-popover-right" 
					id='sessionDetailInfo'
					x-placement="right"
					style={{ display: "none" }}>
					<div className="arrow" style={{top: '24px'}}></div>
					<h3 className='popover-header'
						id='sessionDetailPopoverTitle'></h3>
					<div className='popover-body'
						id='sessionDetailPopoverBody'></div>
				</div>
			</div>
		);
	}

	componentDidMount() {
		// ClusteringStore.on('showClusteringResults', () => {
		//     toggleExtractionMenu('none');
		//     $('#clusteringResults').css('width', '100%');
		// });
	}

	// drawClusteringResultsTmp() {
	//     let lineChartWidth = 200,
	//         lineChartHeight = 50;
	//     let variables = Object.keys(this.clusterCenters[0][0]);
	//     variables = variables.filter(ele => ele !== 'z');
	//     this.lineChartArea = d3.select('#clusteringLineCharts');
	//     for (let i = 0; i < this.clusterCenters.length; i++) {
	//         this.lineChartArea
	//             .selectAll('svg.cluteringResultsSVG')
	//             .append('svg')
	//             .attr('id', 'clusteringResultsSVG_' + i)
	//             .attr('class', 'cluteringResultsSVG')
	//             .attr('width', lineChartWidth * 2)
	//             .attr('height', lineChartHeight * Math.ceil(variables.length / 2));
	//     }
	//     this.xScale = d3.scaleLinear()
	//         .domain([0, 30])
	//         .range([0, lineChartWidth]);
	//     this.yScale = d3.scaleLinear()
	//         .domain([-2, 2])
	//         .range([0, lineChartHeight]);

	//     for (let i = 0; i < this.clusterCenters.length; i++) {
	//         let svgArea = d3.select('#clusteringResultsSVG_' + i);
	//         variables.forEach(function(key, idx) {
	//             for (let j = 0; j < this.clusters[i].length; j++) {
	//                 svgArea.append('path')
	//                     .datum(this.subsequences[this.clusters[i][j]])
	//                     .attr('fill', 'none')
	//                     .attr('stroke', 'gray')
	//                     .attr('class', 'clusterMembers')
	//                     .style('opacity', 0.7)
	//                     .attr('d', d3.line()
	//                         .x(function(data, dataIdx) {
	//                             return this.xScale(dataIdx);
	//                         }.bind(this))
	//                         .y(function(data) {
	//                             return this.yScale(data[key])
	//                         }.bind(this))
	//                     )
	//                     .attr('transform', 'translate(' + lineChartWidth * (idx % 2) + ',' + lineChartHeight * Math.floor(idx / 2) + ')');
	//             }
	//             svgArea.append('path')
	//                 .datum(this.clusterCenters[i])
	//                 .attr('fill', 'none')
	//                 .attr('stroke', 'red')
	//                 .attr('stroke-width', 1.5)
	//                 .attr('id', 'clusterCenterLine_' + i)
	//                 .attr('d', d3.line()
	//                     .x(function(data, dataIdx) {
	//                         return this.xScale(dataIdx);
	//                     }.bind(this))
	//                     .y(function(data) {
	//                         return this.yScale(data[key])
	//                     }.bind(this))
	//                 )
	//                 .attr('transform', 'translate(' + lineChartWidth * (idx % 2) + ',' + lineChartHeight * Math.floor(idx / 2) + ')');
	//         }.bind(this));
	//     }
	// }

	// divideSSintoClusters() {
	//     this.clusters = [];
	//     for (let i = 0; i < this.clusterCenters.length; i++) {
	//         this.clusters.push([]);
	//     }
	//     if (typeof(this.labels[0]) !== 'object') {
	//         for (let i = 0; i < this.labels.length; i++) {
	//             this.clusters[this.labels[i]].push(i);
	//         }
	//     } else {
	//         for (let i = 0; i < this.labels.length; i++) {
	//             this.clusters[this.labels[i].cluster].push(i);
	//         }
	//     }
	// }
}
