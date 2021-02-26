import React from "react";
import * as d3 from "d3";
import {
	saveClusteringSession,
	getDataFromSessionStorage,
} from "../lib/dataLib";
import DataStore from "../Stores/DataStore";
import TimeTubesStore from "../Stores/TimeTubesStore";
import ClusteringStore from "../Stores/ClusteringStore";
import { isEqual } from "lodash";

export default class ClusteringHistory extends React.Component {
	constructor(props) {
		super();
		this.padding = { left: 10, right: 10, top: 20, bottom: 10 };
		this.timestampWidth = 50;
		this.metaInfoWidth = 50;
		this.barHeight = 60;
		this.clusters = {};
		this.state = {
			sessions: getDataFromSessionStorage("clusteringHistory"),
		};
	}

	render() {
		return (
			<div
				id="clusteringHistory"
				className="clusteringPanel"
				style={{
					height:
						$("#mainFeatureArea").outerHeight(true) -
						$("#clusteringResultsLeftColumnNavTabs").outerHeight(true),
				}}
			>
				<button
					type="button"
					id="saveCurrentClusteringSessionBtn"
					className="btn btn-sm btn-primary"
					onClick={this.saveCurrentClusteringSession().bind(this)}
				>
					Save the clustering results
				</button>
				<div id="clusteringHistoryChart"></div>
			</div>
		);
	}

	componentDidMount() {
		let width = Math.max(
				$("#clusteringResultsLeftColumn").width(),
				$("#mainFeatureArea").outerWidth(true) * 0.2
			),
			parentHeight =
				$("#mainFeatureArea").outerHeight(true) -
				$("#clusteringResultsLeftColumnNavTabs").outerHeight(true);
		let height = parentHeight - $("#saveCurrentClusteringSessionBtn").height();
		this.clusteringHistorySVG = d3
			.select("#clusteringHistoryChart")
			.append("svg")
			.attr("id", "clusteringHistoryChartSVG")
			.attr("width", width)
			.attr("height", height);
		if (Object.keys(this.state.sessions).length > 0) {
			this.divideSSIntoClusters();
			this.drawClusteringHistoryChart();
		}
	}

	componentDidUpdate() {
		let width = Math.max(
				$("#clusteringResultsLeftColumn").width(),
				$("#mainFeatureArea").outerWidth(true) * 0.2
			),
			parentHeight =
				$("#mainFeatureArea").outerHeight(true) -
				$("#clusteringResultsLeftColumnNavTabs").outerHeight(true);
		let height = parentHeight - $("#saveCurrentClusteringSessionBtn").height();
		this.clusteringHistorySVG.attr("width", width).attr("height", height);
		if (Object.keys(this.state.sessions).length > 0) {
			this.divideSSIntoClusters();
			this.updateClusteringHistoryChart();
		}
	}

	divideSSIntoClusters() {
		let sessionIds = Object.keys(this.state.sessions);
		this.clusters = {};
		for (let sessionIdx = 0; sessionIdx < sessionIds.length; sessionIdx++) {
			let sessionId = sessionIds[sessionIdx];
			this.clusters[sessionId] = [];
			for (
				let i = 0;
				i < this.state.sessions[sessionId].clusterCenters.length;
				i++
			) {
				this.clusters[sessionId].push([]);
			}
			for (let i = 0; i < this.state.sessions[sessionId].labels.length; i++) {
				let cluster =
					typeof this.state.sessions[sessionId].labels[i] === "object"
						? this.state.sessions[sessionId].labels[i].cluster
						: this.state.sessions[sessionId].labels[i];
				this.clusters[sessionId][cluster].push(i);
			}
		}
	}

	saveCurrentClusteringSession() {
		return function (d) {
			let sessionInfo = {};
			let options = {
				year: "numeric",
				month: "numeric",
				day: "numeric",
				hour: "numeric",
				minute: "numeric",
				hour12: false,
			};
			sessionInfo.timeStamp = new Date().toLocaleString("en-US", options);
			let datasets = ClusteringStore.getDatasets();
			sessionInfo.datasets = [];
			for (let i = 0; i < datasets.length; i++) {
				sessionInfo.datasets.push(DataStore.getFileName(datasets[i]));
			}
			sessionInfo.clusteringParameters = ClusteringStore.getClusteringParameters();
			sessionInfo.subsequenceParameters = ClusteringStore.getSubsequenceParameters();
			sessionInfo.subsequences = ClusteringStore.getSubsequences();
			sessionInfo.clusterCenters = ClusteringStore.getClusterCenters();
			sessionInfo.labels = ClusteringStore.getLabels();
			sessionInfo.clusteringScores = ClusteringStore.getClusteringScores();
			sessionInfo.resultsCoordinate = ClusteringStore.getResultsCoordinates();
			sessionInfo.SSEClusters = ClusteringStore.getSSEClusters();
			sessionInfo.clusterColors = ClusteringStore.getClusterColors();
			saveClusteringSession(sessionInfo);
			this.setState({
				sessions: getDataFromSessionStorage("clusteringHistory"),
			});
		};
	}

	drawClusteringHistoryChart() {
		if (Object.keys(this.state.sessions).length > 0) {
			let sessionIds = Object.keys(this.state.sessions);
			let maxSSnum = 0;
			for (let key in this.state.sessions) {
				if (maxSSnum < this.state.sessions[key].subsequences.length) {
					maxSSnum = this.state.sessions[key].subsequences.length;
				}
			}
			let width = Math.max(
				$("#clusteringResultsLeftColumn").width(),
				$("#mainFeatureArea").outerWidth(true) * 0.2
			); //,
			// 	parentHeight =
			// 		$("#mainFeatureArea").outerHeight(true) -
			// 		$("#clusteringResultsLeftColumnNavTabs").outerHeight(true);
			// let height =
			// 	parentHeight - $("#saveCurrentClusteringSessionBtn").height();
			let height =
				this.padding.top +
				this.padding.bottom +
				this.barHeight * (sessionIds.length + (sessionIds.length - 1) * 2);
			this.clusteringHistorySVG.attr("width", width).attr("height", height);
			let barWidth =
				(width -
					(this.padding.left +
						this.padding.right +
						this.timestampWidth +
						this.metaInfoWidth)) /
				maxSSnum;
			let clusteringHistoryGroups = this.clusteringHistorySVG.selectAll(
				"g.clusteringHistoryGroup"
			);
			if (sessionIds.length <= clusteringHistoryGroups.size()) {
				clusteringHistoryGroups
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.enter()
					.append("g")
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + sessionId;
					});
			} else {
				clusteringHistoryGroups
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + sessionId;
					})
					.exit()
					.remove();
			}
			for (let sessionIdx = 0; sessionIdx < sessionIds.length; sessionIdx++) {
				let sessionId = sessionIds[sessionIdx];
				let sessionGroup = this.clusteringHistorySVG.select(
					"g.clusteringHistoryGroup_" + sessionId
				);
				for (let i = 0; i < this.clusters[sessionId].length; i++) {
					let color = this.state.sessions[sessionId].clusterColors[i];
					sessionGroup
						.selectAll("rect.clusteringHistoryRect_" + sessionId + "_" + i)
						.data(this.clusters[sessionId][i])
						.enter()
						.append("rect")
						.attr(
							"class",
							"clusteringHistogramRect clusteringHistoryRect_" +
								sessionId +
								"_" +
								i
						)
						.attr(
							"x",
							function (d, idx) {
								let leftShift = 0;
								if (i > 0) {
									this.clusters[sessionId].forEach((d, clusterId) => {
										if (clusterId < i) {
											leftShift += d.length;
										}
									});
								}
								return (
									this.timestampWidth +
									this.padding.left +
									barWidth * (leftShift + idx)
								);
							}.bind(this)
						)
						.attr(
							"y",
							function (d) {
								return this.padding.top + this.barHeight * 3 * sessionIdx;
							}.bind(this)
						)
						.attr("width", barWidth)
						.attr("height", this.barHeight)
						.attr("fill", d3.hsl(color[0], color[1], color[2]));
					let timeStamps = this.state.sessions[sessionId].timeStamp
						.toLocaleString("en-US")
						.split(", ");
					sessionGroup
						.selectAll("text.clusteringHistoryTimeStamps_" + sessionId)
						.data(timeStamps)
						.enter()
						.append("text")
						.attr("class", "clusteringHistoryTimeStamps_" + sessionId)
						.attr("x", 5)
						.attr(
							"y",
							function (d, i) {
								return i === 0
									? this.padding.top +
											this.barHeight * 3 * sessionIdx +
											this.barHeight / 2
									: this.padding.top +
											this.barHeight * 3 * sessionIdx +
											this.barHeight / 2 +
											8;
							}.bind(this)
						)
						.attr("font-size", "0.6rem")
						.attr("text-anchor", "left")
						.attr("fill", "black")
						.text((d) => {
							return d;
						});
				}
				if (sessionIdx > 0) {
					// show correlation between the previous session
					let previousSession = this.state.sessions[sessionIds[sessionIdx - 1]];
					let currentSession = this.state.sessions[sessionId];
					let datasetsEqual = isEqual(
							previousSession.datasets,
							currentSession.datasets
						),
						SSparametersEqual = isEqual(
							previousSession.subsequenceParameters,
							currentSession.subsequenceParameters
						),
						SSEqual = isEqual(
							previousSession.subsequences,
							currentSession.subsequences
						);
					if (datasetsEqual && SSparametersEqual && SSEqual) {
						// case 1: target datasets, subsequence parameters, subsequences are the same
						// (does not care the differences of clustering parameters)
						console.log("SS, parameters, targets are the same");
						$(
							"#clusteringHistoryCorrelationGroup_" +
								sessionIds[sessionIdx - 1] +
								"_" +
								sessionId
						).remove();
						let correlationGroup = this.clusteringHistorySVG
							.append("g")
							.attr("class", "clusteringHistoryCorrelationGroup")
							.attr(
								"id",
								"clusteringHistoryCorrelationGroup_" +
									sessionIds[sessionIdx - 1] +
									"_" +
									sessionId
							);
						for (let ci = 0; ci < this.clusters[sessionId].length; ci++) {
							for (let cj = 0; cj < this.clusters[sessionId][ci].length; cj++) {
								let cDataId =
										currentSession.subsequences[
											this.clusters[sessionId][ci][cj]
										].id,
									cSSId =
										currentSession.subsequences[
											this.clusters[sessionId][ci][cj]
										].idx;
								for (
									let pi = 0;
									pi < this.clusters[sessionIds[sessionIdx - 1]].length;
									pi++
								) {
									for (
										let pj = 0;
										pj < this.clusters[sessionIds[sessionIdx - 1]][pi].length;
										pj++
									) {
										let pDataId =
												previousSession.subsequences[
													this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
												].id,
											pSSId =
												previousSession.subsequences[
													this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
												].idx;
										if (cDataId === pDataId && cSSId === pSSId) {
											let plotColor = TimeTubesStore.getPlotColor(cDataId);
											if (typeof plotColor === "undefined") plotColor = "gray";
											let cXPos, pXPos;
											// how many data points before the cluster ci
											let cLeftShift = 0;
											if (ci > 0) {
												for (let cii = 0; cii < ci; cii++) {
													cLeftShift += this.clusters[sessionId][cii].length;
												}
											}
											// how many data points before the cluster pi
											let pLeftShift = 0;
											if (pi > 0) {
												for (let pii = 0; pii < pi; pii++) {
													pLeftShift += this.clusters[
														sessionIds[sessionIdx - 1]
													][pii].length;
												}
											}
											cXPos =
												this.padding.left +
												this.timestampWidth +
												barWidth * (cLeftShift + cj);
											pXPos =
												this.padding.left +
												this.timestampWidth +
												barWidth * (pLeftShift + pj);
											let correlationPos = [
												{
													x: pXPos,
													y:
														this.padding.top +
														this.barHeight *
															(sessionIdx + 2 * (sessionIdx - 1)),
												},
												{
													x: pXPos + barWidth,
													y:
														this.padding.top +
														this.barHeight *
															(sessionIdx + 2 * (sessionIdx - 1)),
												},
												{
													x: cXPos + barWidth,
													y:
														this.padding.top +
														this.barHeight * (sessionIdx + 2 * sessionIdx),
												},
												{
													x: cXPos,
													y:
														this.padding.top +
														this.barHeight * (sessionIdx + 2 * sessionIdx),
												},
												{
													x: pXPos,
													y:
														this.padding.top +
														this.barHeight *
															(sessionIdx + 2 * (sessionIdx - 1)),
												},
											];
											correlationGroup
												.append("path")
												.datum(correlationPos)
												.attr("class", "clusteringHistoryCorrelationPath")
												.attr(
													"id",
													"clusteringHistoryCorrelationPath_" +
														sessionIds[sessionIdx - 1] +
														"_" +
														sessionId +
														"_" +
														cDataId +
														"_" +
														cSSId
												)
												.attr(
													"d",
													d3
														.line()
														.x(function (d) {
															return d.x;
														})
														.y(function (d) {
															return d.y;
														})
												)
												.attr("fill", plotColor)
												.style("opacity", 0.3);
										}
									}
								}
							}
						}
					} else if (datasetsEqual && SSparametersEqual && !SSEqual) {
						// case 2: subsequences used in the clustering process are different
						console.log("SS are different");
					} else if (!SSParametersEqual) {
						// case 3: different subsequence parameters
						console.log("different SS parameters");
					}
				}
			}
		}
	}

	updateClusteringHistoryChart() {
		if (Object.keys(this.state.sessions).length > 0) {
			let sessionIds = Object.keys(this.state.sessions);
			let maxSSnum = 0;
			for (let key in this.state.sessions) {
				if (maxSSnum < this.state.sessions[key].subsequences.length) {
					maxSSnum = this.state.sessions[key].subsequences.length;
				}
			}
			let width = Math.max(
				$("#clusteringResultsLeftColumn").width(),
				$("#mainFeatureArea").outerWidth(true) * 0.2
			); //,
			// 	parentHeight =
			// 		$("#mainFeatureArea").outerHeight(true) -
			// 		$("#clusteringResultsLeftColumnNavTabs").outerHeight(true);
			// let height =
			// 	parentHeight - $("#saveCurrentClusteringSessionBtn").height();
			let height =
				this.padding.top +
				this.padding.bottom +
				this.barHeight * (sessionIds.length + (sessionIds.length - 1) * 2);
			this.clusteringHistorySVG.attr("width", width).attr("height", height);
			let barWidth =
				(width -
					(this.padding.left +
						this.padding.right +
						this.timestampWidth +
						this.metaInfoWidth)) /
				maxSSnum;
			let clusteringHistoryGroups = this.clusteringHistorySVG.selectAll(
				"g.clusteringHistoryGroup"
			);
			if (sessionIds.length <= clusteringHistoryGroups.size()) {
				clusteringHistoryGroups
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.enter()
					.append("g")
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + sessionId;
					});
			} else {
				clusteringHistoryGroups
					.data(sessionIds)
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + sessionId;
					})
					.exit()
					.remove();
			}
			for (let sessionIdx = 0; sessionIdx < sessionIds.length; sessionIdx++) {
				let sessionId = sessionIds[sessionIdx];
				let sessionGroup = this.clusteringHistorySVG.select(
					"clusteringHistoryGroup_" + sessionId
				);
				if (sessionGroup.size() <= 0) {
					sessionGroup = this.clusteringHistorySVG
						.append("g")
						.attr("id", "clusteringHistoryGroup_" + sessionId);
				}
				for (let i = 0; i < this.clusters[sessionId].length; i++) {
					if (
						sessionGroup
							.selectAll("rect.clusteringHistoryRect_" + sessionId + "_" + i)
							.size() > 0
					) {
						sessionGroup
							.selectAll("rect.clusteringHistoryRect_" + sessionId + "_" + i)
							.attr(
								"x",
								function (d, idx) {
									let leftShift = 0;
									if (i > 0) {
										this.clusters[sessionId].forEach((d, clusterId) => {
											if (clusterId < i) {
												leftShift += d.length;
											}
										});
									}
									return (
										this.timestampWidth +
										this.padding.left +
										barWidth * (leftShift + idx)
									);
								}.bind(this)
							)
							.attr(
								"y",
								function (d) {
									return this.padding.top + this.barHeight * 3 * sessionIdx;
								}.bind(this)
							)
							.attr("width", barWidth)
							.attr("height", this.barHeight);
						sessionGroup
							.selectAll("text.clusteringHistoryTimeStamps_" + sessionId)
							.attr(
								"y",
								function (d, i) {
									return i === 0
										? this.padding.top +
												this.barHeight * 3 * sessionIdx +
												this.barHeight / 2
										: this.padding.top +
												this.barHeight * 3 * sessionIdx +
												this.barHeight / 2 +
												8;
								}.bind(this)
							);
					} else {
						let color = this.state.sessions[sessionId].clusterColors[i];
						sessionGroup
							.selectAll("rect.clusteringHistoryRect_" + sessionId + "_" + i)
							.data(this.clusters[sessionId][i])
							.enter()
							.append("rect")
							.attr(
								"class",
								"clusteringHistogramRect clusteringHistoryRect_" +
									sessionId +
									"_" +
									i
							)
							.attr(
								"x",
								function (d, idx) {
									let leftShift = 0;
									if (i > 0) {
										this.clusters[sessionId].forEach((d, clusterId) => {
											if (clusterId < i) {
												leftShift += d.length;
											}
										});
									}
									return (
										this.timestampWidth +
										this.padding.left +
										barWidth * (leftShift + idx)
									);
								}.bind(this)
							)
							.attr(
								"y",
								function (d) {
									return this.padding.top + this.barHeight * 3 * sessionIdx;
								}.bind(this)
							)
							.attr("width", barWidth)
							.attr("height", this.barHeight)
							.attr("fill", d3.hsl(color[0], color[1], color[2]));
						let timeStamps = this.state.sessions[sessionId].timeStamp
							.toLocaleString("en-US")
							.split(", ");
						sessionGroup
							.selectAll("text.clusteringHistoryTimeStamps_" + sessionId)
							.data(timeStamps)
							.enter()
							.append("text")
							.attr("class", "clusteringHistoryTimeStamps_" + sessionId)
							.attr("x", 5)
							.attr(
								"y",
								function (d, i) {
									return i === 0
										? this.padding.top +
												this.barHeight * 3 * sessionIdx +
												this.barHeight / 2
										: this.padding.top +
												this.barHeight * 3 * sessionIdx +
												this.barHeight / 2 +
												8;
								}.bind(this)
							)
							.attr("font-size", "0.6rem")
							.attr("text-anchor", "left")
							.attr("fill", "black")
							.text((d) => {
								return d;
							});
						if (sessionIdx > 0) {
							let previousSession = this.state.sessions[
								sessionIds[sessionIdx - 1]
							];
							let currentSession = this.state.sessions[sessionId];
							let datasetsEqual = isEqual(
									previousSession.datasets,
									currentSession.datasets
								),
								SSparametersEqual = isEqual(
									previousSession.subsequenceParameters,
									currentSession.subsequenceParameters
								),
								SSEqual = isEqual(
									previousSession.subsequences,
									currentSession.subsequences
								);
							if (datasetsEqual && SSparametersEqual && SSEqual) {
								// case 1: target datasets, subsequence parameters, subsequences are the same
								if (
									$(
										"#clusteringHistoryCorrelationGroup_" +
											sessionIds[sessionIdx - 1] +
											"_" +
											sessionId
									).length > 0
								) {
									let correlationGroup = d3.select(
										"#clusteringHistoryCorrelationGroup_" +
											sessionIds[sessionIdx - 1] +
											"_" +
											sessionId
									);
                                    for (let ci = 0; ci < this.clusters[sessionId].length; ci++) {
                                        for (let cj = 0; cj < this.clusters[sessionId][ci].length; cj++) {
                                            let cDataId =
                                                    currentSession.subsequences[
                                                        this.clusters[sessionId][ci][cj]
                                                    ].id,
                                                cSSId =
                                                    currentSession.subsequences[
                                                        this.clusters[sessionId][ci][cj]
                                                    ].idx;
                                            for (
                                                let pi = 0;
                                                pi < this.clusters[sessionIds[sessionIdx - 1]].length;
                                                pi++
                                            ) {
                                                for (
                                                    let pj = 0;
                                                    pj < this.clusters[sessionIds[sessionIdx - 1]][pi].length;
                                                    pj++
                                                ) {
                                                    let pDataId =
                                                            previousSession.subsequences[
                                                                this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                            ].id,
                                                        pSSId =
                                                            previousSession.subsequences[
                                                                this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                            ].idx;
                                                    if (cDataId === pDataId && cSSId === pSSId) {
                                                        let plotColor = TimeTubesStore.getPlotColor(cDataId);
                                                        if (typeof plotColor === "undefined") plotColor = "gray";
                                                        let cXPos, pXPos;
                                                        // how many data points before the cluster ci
                                                        let cLeftShift = 0;
                                                        if (ci > 0) {
                                                            for (let cii = 0; cii < ci; cii++) {
                                                                cLeftShift += this.clusters[sessionId][cii].length;
                                                            }
                                                        }
                                                        // how many data points before the cluster pi
                                                        let pLeftShift = 0;
                                                        if (pi > 0) {
                                                            for (let pii = 0; pii < pi; pii++) {
                                                                pLeftShift += this.clusters[
                                                                    sessionIds[sessionIdx - 1]
                                                                ][pii].length;
                                                            }
                                                        }
                                                        cXPos =
                                                            this.padding.left +
                                                            this.timestampWidth +
                                                            barWidth * (cLeftShift + cj);
                                                        pXPos =
                                                            this.padding.left +
                                                            this.timestampWidth +
                                                            barWidth * (pLeftShift + pj);
                                                        let correlationPos = [
                                                            {
                                                                x: pXPos,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight *
                                                                        (sessionIdx + 2 * (sessionIdx - 1)),
                                                            },
                                                            {
                                                                x: pXPos + barWidth,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight *
                                                                        (sessionIdx + 2 * (sessionIdx - 1)),
                                                            },
                                                            {
                                                                x: cXPos + barWidth,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight * (sessionIdx + 2 * sessionIdx),
                                                            },
                                                            {
                                                                x: cXPos,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight * (sessionIdx + 2 * sessionIdx),
                                                            },
                                                            {
                                                                x: pXPos,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight *
                                                                        (sessionIdx + 2 * (sessionIdx - 1)),
                                                            },
                                                        ];
                                                        correlationGroup
                                                            .select('#clusteringHistoryCorrelationPath_' +
                                                                sessionIds[sessionIdx - 1] +
                                                                "_" +
                                                                sessionId +
                                                                "_" +
                                                                cDataId +
                                                                "_" +
                                                                cSSId
                                                            )
                                                            .attr(
                                                                "d",
                                                                d3
                                                                    .line()
                                                                    .x(function (d) {
                                                                        return d.x;
                                                                    })
                                                                    .y(function (d) {
                                                                        return d.y;
                                                                    })
                                                            )
                                                            .attr("fill", plotColor)
                                                            .style("opacity", 0.3);

                                                    }
                                                }
                                            }
                                        }
                                    }
								} else {
									let correlationGroup = this.clusteringHistorySVG
										.append("g")
										.attr("class", "clusteringHistoryCorrelationGroup")
										.attr(
											"id",
											"clusteringHistoryCorrelationGroup_" +
												sessionIds[sessionIdx - 1] +
												"_" +
												sessionId
										);
                                    for (let ci = 0; ci < this.clusters[sessionId].length; ci++) {
                                        for (let cj = 0; cj < this.clusters[sessionId][ci].length; cj++) {
                                            let cDataId =
                                                    currentSession.subsequences[
                                                        this.clusters[sessionId][ci][cj]
                                                    ].id,
                                                cSSId =
                                                    currentSession.subsequences[
                                                        this.clusters[sessionId][ci][cj]
                                                    ].idx;
                                            for (
                                                let pi = 0;
                                                pi < this.clusters[sessionIds[sessionIdx - 1]].length;
                                                pi++
                                            ) {
                                                for (
                                                    let pj = 0;
                                                    pj < this.clusters[sessionIds[sessionIdx - 1]][pi].length;
                                                    pj++
                                                ) {
                                                    let pDataId =
                                                            previousSession.subsequences[
                                                                this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                            ].id,
                                                        pSSId =
                                                            previousSession.subsequences[
                                                                this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                            ].idx;
                                                    if (cDataId === pDataId && cSSId === pSSId) {
                                                        let plotColor = TimeTubesStore.getPlotColor(cDataId);
                                                        if (typeof plotColor === "undefined") plotColor = "gray";
                                                        let cXPos, pXPos;
                                                        // how many data points before the cluster ci
                                                        let cLeftShift = 0;
                                                        if (ci > 0) {
                                                            for (let cii = 0; cii < ci; cii++) {
                                                                cLeftShift += this.clusters[sessionId][cii].length;
                                                            }
                                                        }
                                                        // how many data points before the cluster pi
                                                        let pLeftShift = 0;
                                                        if (pi > 0) {
                                                            for (let pii = 0; pii < pi; pii++) {
                                                                pLeftShift += this.clusters[
                                                                    sessionIds[sessionIdx - 1]
                                                                ][pii].length;
                                                            }
                                                        }
                                                        cXPos =
                                                            this.padding.left +
                                                            this.timestampWidth +
                                                            barWidth * (cLeftShift + cj);
                                                        pXPos =
                                                            this.padding.left +
                                                            this.timestampWidth +
                                                            barWidth * (pLeftShift + pj);
                                                        let correlationPos = [
                                                            {
                                                                x: pXPos,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight *
                                                                        (sessionIdx + 2 * (sessionIdx - 1)),
                                                            },
                                                            {
                                                                x: pXPos + barWidth,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight *
                                                                        (sessionIdx + 2 * (sessionIdx - 1)),
                                                            },
                                                            {
                                                                x: cXPos + barWidth,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight * (sessionIdx + 2 * sessionIdx),
                                                            },
                                                            {
                                                                x: cXPos,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight * (sessionIdx + 2 * sessionIdx),
                                                            },
                                                            {
                                                                x: pXPos,
                                                                y:
                                                                    this.padding.top +
                                                                    this.barHeight *
                                                                        (sessionIdx + 2 * (sessionIdx - 1)),
                                                            },
                                                        ];
                                                        correlationGroup
                                                            .append("path")
                                                            .datum(correlationPos)
                                                            .attr("class", "clusteringHistoryCorrelationPath")
                                                            .attr(
                                                                "id",
                                                                "clusteringHistoryCorrelationPath_" +
                                                                    sessionIds[sessionIdx - 1] +
                                                                    "_" +
                                                                    sessionId +
                                                                    "_" +
                                                                    cDataId +
                                                                    "_" +
                                                                    cSSId
                                                            )
                                                            .attr(
                                                                "d",
                                                                d3
                                                                    .line()
                                                                    .x(function (d) {
                                                                        return d.x;
                                                                    })
                                                                    .y(function (d) {
                                                                        return d.y;
                                                                    })
                                                            )
                                                            .attr("fill", plotColor)
                                                            .style("opacity", 0.3);
                                                    }
                                                }
                                            }
                                        }
                                    }
								}
							}
						}
					}
				}
			}
		}
	}
}
