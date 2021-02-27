import React from "react";
import * as d3 from "d3";
import {
	saveClusteringSession,
	getDataFromSessionStorage,
	removeClusteringSession,
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
		this.symbolGenerator = d3.symbol().size(50);
		this.state = {
			sessions: getDataFromSessionStorage("clusteringHistory"),
		};
	}

	render() {
		return (
			<div id="clusteringHistory" className="clusteringPanel">
				<button
					type="button"
					id="saveCurrentClusteringSessionBtn"
					className="btn btn-sm btn-primary"
					onClick={this.saveCurrentClusteringSession().bind(this)}
				>
					Save the clustering results
				</button>
				<div
					id="clusteringHistoryChart"
					style={{
						height:
							$("#mainFeatureArea").outerHeight(true) -
							$("#clusteringResultsLeftColumnNavTabs").outerHeight(true),
					}}
				></div>
			</div>
		);
	}

	componentDidMount() {
		let width = Math.max(
				$("#clusteringResultsLeftColumn").width(),
				$("#mainFeatureArea").outerWidth(true) * 0.2
			) * 0.95,
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
			) * 0.95,
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
			sessionInfo.datasets = {};
			for (let i = 0; i < datasets.length; i++) {
                sessionInfo.datasets[datasets[i]] = DataStore.getFileName(datasets[i]);
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
			) * 0.95; //,
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
			let clusteringHistoryGroups = $("g.clusteringHistoryGroup");
			//  = this.clusteringHistorySVG.selectAll(
			// 	"g.clusteringHistoryGroup"
			// );
			if (sessionIds.length > clusteringHistoryGroups.length) {
				this.clusteringHistorySVG
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.enter()
					.append("g")
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + d;
					});
			} else if (sessionIds.length < clusteringHistoryGroups.length) {
				this.clusteringHistorySVG
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + d;
					})
					.exit()
					.remove();
			} else if (sessionIds.length === clusteringHistoryGroups.length) {
				this.clusteringHistorySVG
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.enter()
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + d;
					});
			}
			for (let sessionIdx = 0; sessionIdx < sessionIds.length; sessionIdx++) {
				let sessionId = sessionIds[sessionIdx];
				let sessionGroup = this.clusteringHistorySVG.select(
					"#clusteringHistoryGroup_" + sessionId
				);
				sessionGroup
					.append("text")
					.attr("x", width - this.padding.right - 5)
					.attr("y", this.padding.top + this.barHeight * 3 * sessionIdx)
					.attr("id", "removeClusteringSession_" + sessionId)
					.attr("class", "removeClusteringSession")
					.attr("text-anchor", "middle")
					.text("x")
					.on("click", this.removeClusteringSession().bind(this));
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
                    let previousDatasets = Object.keys(previousSession.datasets).map(d => {return previousSession.datasets[d]}).sort((a, b) => a - b),
                        currentDatasets = Object.keys(currentSession.datasets).map(d => {return currentSession.datasets[d]}).sort((a, b) => a - b);
					let datasetsEqual = isEqual(
							previousDatasets,
							currentDatasets
						),
						SSparametersEqual = false,
						SSEqual = isEqual(
							previousSession.subsequences,
							currentSession.subsequences
						);
					if (
						previousSession.subsequenceParameters.filtering.indexOf(
							"dataDrivenSlidingWindow"
						) ===
							currentSession.subsequenceParameters.filtering.indexOf(
								"dataDrivenSlidingWindow"
							) &&
						isEqual(
							previousSession.subsequenceParameters.SSperiod,
							currentSession.subsequenceParameters.SSperiod
						)
					) {
						SSparametersEqual = true;
					}
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
								let cDataName =
                                    currentSession.datasets[
                                        currentSession.subsequences[
                                                this.clusters[sessionId][ci][cj]
                                            ].id
                                    ],
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
										let pDataName =
                                            previousSession.datasets[
												previousSession.subsequences[
													this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
												].id
                                            ],
											pSSId =
												previousSession.subsequences[
													this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
												].idx;
										if (cDataName === pDataName && cSSId === pSSId) {
											let plotColor = TimeTubesStore.getPlotColor(DataStore.getIdFromName(cDataName));
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
														cDataName +
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
						// SSids coincides between previous session and current session
						let added = [],
							removed = [];
						// check added SS
						for (let i = 0; i < currentSession.subsequences.length; i++) {
							let addedFlag = true;
							for (let j = 0; j < previousSession.subsequences.length; j++) {
								if (
                                    previousSession.datasets[previousSession.subsequences[j].id] ===
                                    currentSession.datasets[currentSession.subsequences[i].id] &&
									previousSession.subsequences[j].idx ===
									currentSession.subsequences[i].idx
								) {
									addedFlag = false;
									break;
								}
							}
							if (addedFlag) added.push(i);
						}
						// check removed SS
						for (let i = 0; i < previousSession.subsequences.length; i++) {
							let removedFlag = true;
							for (let j = 0; j < currentSession.subsequences.length; j++) {
								if (
                                    previousSession.datasets[previousSession.subsequences[i].id] ===
                                    currentSession.datasets[currentSession.subsequences[j].id] &&
									previousSession.subsequences[i].idx ===
									currentSession.subsequences[j].idx
								) {
									removedFlag = false;
									break;
								}
							}
							if (removedFlag) removed.push(i);
						}
						if (added.length > 0) {
							let addedMarks = this.clusteringHistorySVG
								.select("#clusteringHistoryGroup_" + sessionId)
								.append("g")
								.attr("class", "addedMarksGroup");
							addedMarks
								.selectAll("path.addedMark")
								.data(added)
								.enter()
								.append("path")
								.attr("class", "addedMark")
								.attr(
									"d",
									function (d) {
										this.symbolGenerator.type(d3["symbolTriangle"]);
										return this.symbolGenerator();
									}.bind(this)
								)
								.attr("fill", "#93c54b")
								.style(
									"transform",
									function (d) {
										let cluster =
											typeof currentSession.labels[d] === "object"
												? currentSession.labels[d].cluster
												: currentSession.labels[d];
										let leftShift = 0;
										for (let i = 0; i < cluster; i++) {
											leftShift += this.clusters[sessionId][i].length;
										}
										let orderInCluster = this.clusters[sessionId][
											cluster
										].indexOf(d);
										return (
											"translate(" +
											(this.padding.left +
												this.timestampWidth +
												(leftShift + orderInCluster) * barWidth +
												barWidth / 2) +
											"px," +
											(this.padding.top +
												this.barHeight * (sessionIdx + 2 * sessionIdx) -
												5) +
											"px) rotate(180deg)"
										);
									}.bind(this)
								);
						}
						if (removed.length > 0) {
							let removedMarks = this.clusteringHistorySVG
								.select("#clusteringHistoryGroup_" + sessionIds[sessionIdx - 1])
								.append("g")
								.attr("class", "removedMarksGroup");
							removedMarks
								.selectAll("path.removedMark")
								.data(removed)
								.enter()
								.append("path")
								.attr("class", "removedMark")
								.attr(
									"d",
									function (d) {
										this.symbolGenerator.type(d3["symbolTriangle"]);
										return this.symbolGenerator();
									}.bind(this)
								)
								.attr("fill", "#d9534f")
								.style(
									"transform",
									function (d) {
										let cluster =
											typeof previousSession.labels[d] === "object"
												? previousSession.labels[d].cluster
												: previousSession.labels[d];
										let leftShift = 0;
										for (let i = 0; i < cluster; i++) {
											leftShift += this.clusters[sessionIds[sessionIdx - 1]][i]
												.length;
										}
										let orderInCluster = this.clusters[
											sessionIds[sessionIdx - 1]
										][cluster].indexOf(d);
										return (
											"translate(" +
											(this.padding.left +
												this.timestampWidth +
												(leftShift + orderInCluster) * barWidth +
												barWidth / 2) +
											"px," +
											(this.padding.top +
												this.barHeight *
													(sessionIdx +
														2 * (sessionIdx - 1 > 0 ? sessionIdx - 1 : 0)) +
												5) +
											"px)"
										);
									}.bind(this)
								);
						}
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
								let cDataName =
                                    currentSession.datasets[
                                        currentSession.subsequences[
                                                this.clusters[sessionId][ci][cj]
                                            ].id
                                    ],
									cSSId =
										currentSession.subsequences[
											this.clusters[sessionId][ci][cj]
										].idx;
								if (added.indexOf(this.clusters[sessionId][ci][cj]) < 0) {
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
											if (
												removed.indexOf(
													this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
												) < 0
											) {
												// show correlations
												let pDataName =
                                                    previousSession.datasets[
                                                        previousSession.subsequences[
                                                            this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                        ].id
                                                    ],
													pSSId =
														previousSession.subsequences[
															this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
														].idx;
												if (cDataName === pDataName && cSSId === pSSId) {
                                                    let plotColor = TimeTubesStore.getPlotColor(DataStore.getIdFromName(cDataName));
													if (typeof plotColor === "undefined")
														plotColor = "gray";
													let cXPos, pXPos;
													// how many data points before the cluster ci
													let cLeftShift = 0;
													if (ci > 0) {
														for (let cii = 0; cii < ci; cii++) {
															cLeftShift += this.clusters[sessionId][cii]
																.length;
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
															    cDataName +
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
					} else if (!datasetsEqual && SSparametersEqual && !SSEqual) {
						// case 3: datasets are different (SS id coincides)
                        // check whether the previous session and current session use the same dataset
                        let overlappingFile;
                        for (let i = 0; i < previousSession.datasets.length; i++) {
                            
                        }

					} else if (!SSParametersEqual) {
						// case 4: different subsequence parameters
						console.log("different SS parameters");
                        // just show the session bar
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
			) * 0.95; //,
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
			let clusteringHistoryGroups = $("g.clusteringHistoryGroup");
			//  = this.clusteringHistorySVG.selectAll(
			// 	"g.clusteringHistoryGroup"
			// );
			if (sessionIds.length > clusteringHistoryGroups.length) {
				this.clusteringHistorySVG
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.enter()
					.append("g")
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + d;
					});
			} else if (sessionIds.length < clusteringHistoryGroups.length) {
				this.clusteringHistorySVG
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + d;
					})
					.exit()
					.remove();
			} else if (sessionIds.length === clusteringHistoryGroups.length) {
				this.clusteringHistorySVG
					.selectAll("g.clusteringHistoryGroup")
					.data(sessionIds)
					.enter()
					.attr("class", "clusteringHistoryGroup")
					.attr("id", (d) => {
						return "clusteringHistoryGroup_" + d;
					});
			}
			for (let sessionIdx = 0; sessionIdx < sessionIds.length; sessionIdx++) {
				let sessionId = sessionIds[sessionIdx];
				let sessionGroup = this.clusteringHistorySVG.select(
					"#clusteringHistoryGroup_" + sessionId
				);
				if ($("#removeClusteringSession_" + sessionId).length > 0) {
					d3.select("#removeClusteringSession_" + sessionId)
						.attr("x", width - this.padding.right - 5)
						.attr("y", this.padding.top + this.barHeight * 3 * sessionIdx);
				} else {
					sessionGroup
						.append("text")
						.attr("id", "removeClusteringSession_" + sessionId)
						.attr("class", "removeClusteringSession")
						.attr("x", width - this.padding.right - 5)
						.attr("y", this.padding.top + this.barHeight * 3 * sessionIdx)
						.attr("text-anchor", "middle")
						.text("x")
						.on("click", this.removeClusteringSession().bind(this));
				}
				for (let i = 0; i < this.clusters[sessionId].length; i++) {
					if (
						sessionGroup
							.selectAll("rect.clusteringHistoryRect_" + sessionId + "_" + i)
							.size() > 0
					) {
						// if history bar charts are already illustrated
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
					}
					if (sessionIdx > 0) {
						let previousSession = this.state.sessions[sessionIds[sessionIdx - 1]];
                        let currentSession = this.state.sessions[sessionId];
                        let datasetsEqual = isEqual(
                                previousSession.datasets,
                                currentSession.datasets
                            ),
                            SSparametersEqual = false,
                            SSEqual = isEqual(
                                previousSession.subsequences,
                                currentSession.subsequences
                            );
                        if (
                            previousSession.subsequenceParameters.filtering.indexOf(
                                "dataDrivenSlidingWindow"
                            ) ===
                                currentSession.subsequenceParameters.filtering.indexOf(
                                    "dataDrivenSlidingWindow"
                                ) &&
                            isEqual(
                                previousSession.subsequenceParameters.SSperiod,
                                currentSession.subsequenceParameters.SSperiod
                            )
                        ) {
                            SSparametersEqual = true;
                        }
						if (datasetsEqual && SSparametersEqual && SSEqual) {
							// case 1: target datasets, subsequence parameters, subsequences are the same
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
								for (
									let cj = 0;
									cj < this.clusters[sessionId][ci].length;
									cj++
								) {
									let cDataName =
                                            currentSession.datasets[
                                                currentSession.subsequences[
                                                        this.clusters[sessionId][ci][cj]
                                                    ].id
                                            ],
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
											let pDataName =
                                                    previousSession.datasets[
                                                        previousSession.subsequences[
                                                            this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                        ].id
                                                    ],
												pSSId =
													previousSession.subsequences[
														this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
													].idx;
											if (cDataName === pDataName && cSSId === pSSId) {
                                                let plotColor = TimeTubesStore.getPlotColor(DataStore.getIdFromName(cDataName));
												if (typeof plotColor === "undefined")
													plotColor = "gray";
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
															cDataName +
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
                            this.clusteringHistorySVG
                                .select("#clusteringHistoryGroup_" + sessionId)
                                .selectAll('.addedMarksGroup')
                                .remove();
                            this.clusteringHistorySVG
                                .select("#clusteringHistoryGroup_" + sessionIds[sessionIdx - 1])
                                .selectAll('.removedMarksGroup')
                                .remove();
                            // case 2: subsequences used in the clustering process are different
                            // SSids coincides between previous session and current session
                            let added = [],
                                removed = [];
                            // check added SS
                            for (let i = 0; i < currentSession.subsequences.length; i++) {
                                let addedFlag = true;
                                for (let j = 0; j < previousSession.subsequences.length; j++) {
                                    if (
                                        previousSession.datasets[previousSession.subsequences[j].id] ===
                                        currentSession.datasets[currentSession.subsequences[i].id] &&
                                        previousSession.subsequences[j].idx ===
                                        currentSession.subsequences[i].idx
                                    ) {
                                        addedFlag = false;
                                        break;
                                    }
                                }
                                if (addedFlag) added.push(i);
                            }
                            // check removed SS
                            for (let i = 0; i < previousSession.subsequences.length; i++) {
                                let removedFlag = true;
                                for (let j = 0; j < currentSession.subsequences.length; j++) {
                                    if (
                                        previousSession.datasets[previousSession.subsequences[i].id] ===
                                        currentSession.datasets[currentSession.subsequences[j].id] &&
                                        previousSession.subsequences[i].idx ===
                                        currentSession.subsequences[j].idx
                                    ) {
                                        removedFlag = false;
                                        break;
                                    }
                                }
                                if (removedFlag) removed.push(i);
                            }
                            if (added.length > 0) {
                                let addedMarks = this.clusteringHistorySVG
                                    .select("#clusteringHistoryGroup_" + sessionId)
                                    .append("g")
                                    .attr("class", "addedMarksGroup");
                                addedMarks
                                    .selectAll("path.addedMark")
                                    .data(added)
                                    .enter()
                                    .append("path")
                                    .attr("class", "addedMark")
                                    .attr(
                                        "d",
                                        function (d) {
                                            this.symbolGenerator.type(d3["symbolTriangle"]);
                                            return this.symbolGenerator();
                                        }.bind(this)
                                    )
                                    .attr("fill", "#93c54b")
                                    .style(
                                        "transform",
                                        function (d) {
                                            let cluster =
                                                typeof currentSession.labels[d] === "object"
                                                    ? currentSession.labels[d].cluster
                                                    : currentSession.labels[d];
                                            let leftShift = 0;
                                            for (let i = 0; i < cluster; i++) {
                                                leftShift += this.clusters[sessionId][i].length;
                                            }
                                            let orderInCluster = this.clusters[sessionId][
                                                cluster
                                            ].indexOf(d);
                                            return (
                                                "translate(" +
                                                (this.padding.left +
                                                    this.timestampWidth +
                                                    (leftShift + orderInCluster) * barWidth +
                                                    barWidth / 2) +
                                                "px," +
                                                (this.padding.top +
                                                    this.barHeight * (sessionIdx + 2 * sessionIdx) -
                                                    5) +
                                                "px) rotate(180deg)"
                                            );
                                        }.bind(this)
                                    );
                            }
                            if (removed.length > 0) {
                                let removedMarks = this.clusteringHistorySVG
                                    .select("#clusteringHistoryGroup_" + sessionIds[sessionIdx - 1])
                                    .append("g")
                                    .attr("class", "removedMarksGroup");
                                removedMarks
                                    .selectAll("path.removedMark")
                                    .data(removed)
                                    .enter()
                                    .append("path")
                                    .attr("class", "removedMark")
                                    .attr(
                                        "d",
                                        function (d) {
                                            this.symbolGenerator.type(d3["symbolTriangle"]);
                                            return this.symbolGenerator();
                                        }.bind(this)
                                    )
                                    .attr("fill", "#d9534f")
                                    .style(
                                        "transform",
                                        function (d) {
                                            let cluster =
                                                typeof previousSession.labels[d] === "object"
                                                    ? previousSession.labels[d].cluster
                                                    : previousSession.labels[d];
                                            let leftShift = 0;
                                            for (let i = 0; i < cluster; i++) {
                                                leftShift += this.clusters[sessionIds[sessionIdx - 1]][i]
                                                    .length;
                                            }
                                            let orderInCluster = this.clusters[
                                                sessionIds[sessionIdx - 1]
                                            ][cluster].indexOf(d);
                                            return (
                                                "translate(" +
                                                (this.padding.left +
                                                    this.timestampWidth +
                                                    (leftShift + orderInCluster) * barWidth +
                                                    barWidth / 2) +
                                                "px," +
                                                (this.padding.top +
                                                    this.barHeight *
                                                        (sessionIdx +
                                                            2 * (sessionIdx - 1 > 0 ? sessionIdx - 1 : 0)) +
                                                    5) +
                                                "px)"
                                            );
                                        }.bind(this)
                                    );
                            }
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
                                    let cDataName =
                                            currentSession.datasets[
                                                currentSession.subsequences[
                                                        this.clusters[sessionId][ci][cj]
                                                    ].id
                                            ],
                                        cSSId =
                                            currentSession.subsequences[
                                                this.clusters[sessionId][ci][cj]
                                            ].idx;
                                    if (added.indexOf(this.clusters[sessionId][ci][cj]) < 0) {
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
                                                if (
                                                    removed.indexOf(
                                                        this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                    ) < 0
                                                ) {
                                                    // show correlations
                                                    let pDataName =
                                                            previousSession.datasets[
                                                                previousSession.subsequences[
                                                                    this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                                ].id
                                                            ],
                                                        pSSId =
                                                            previousSession.subsequences[
                                                                this.clusters[sessionIds[sessionIdx - 1]][pi][pj]
                                                            ].idx;
                                                    if (cDataName === pDataName && cSSId === pSSId) {
                                                        let plotColor = TimeTubesStore.getPlotColor(DataStore.getIdFromName(cDataName));
                                                        if (typeof plotColor === "undefined")
                                                            plotColor = "gray";
                                                        let cXPos, pXPos;
                                                        // how many data points before the cluster ci
                                                        let cLeftShift = 0;
                                                        if (ci > 0) {
                                                            for (let cii = 0; cii < ci; cii++) {
                                                                cLeftShift += this.clusters[sessionId][cii]
                                                                    .length;
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
                                                                    cDataName +
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
                        } else if (!datasetsEqual && SSparametersEqual && !SSEqual) {
                            // case 3: datasets are different
                        } else if (!SSParametersEqual) {
                            // case 4: different subsequence parameters
                            console.log("different SS parameters");
                        }
					}
				}
			}
		}
	}

	removeClusteringSession() {
		return function (d) {
			let targetId = d3.event.target.id;
			if (targetId) {
				let sessionIds = Object.keys(this.state.sessions);
				let targetEle = targetId.split("_");
				let cSessionIdx = sessionIds.indexOf(targetEle[1]);
				$("#clusteringHistoryGroup_" + targetEle[1]).remove();
				if (cSessionIdx > 0 && cSessionIdx < sessionIds.length - 1) {
					// the selected session is inbetween sessions
					$(
						"#clusteringHistoryCorrelationGroup_" +
							sessionIds[cSessionIdx - 1] +
							"_" +
							targetEle[1]
					).remove();
					$(
						"#clusteringHistoryCorrelationGroup_" +
							targetEle[1] +
							"_" +
							sessionIds[cSessionIdx + 1]
					).remove();
				} else if (cSessionIdx === 0 && sessionIds.length >= 2) {
					// the first session is removed
					$(
						"#clusteringHistoryCorrelationGroup_" +
							targetEle[1] +
							"_" +
							sessionIds[cSessionIdx + 1]
					).remove();
				} else if (
					cSessionIdx === sessionIds.length - 1 &&
					sessionIds.length >= 2
				) {
					// the last session is removed
					$(
						"#clusteringHistoryCorrelationGroup_" +
							sessionIds[cSessionIdx - 1] +
							"_" +
							targetEle[1]
					).remove();
				}
				removeClusteringSession(targetEle[1]);
				this.setState({
					sessions: getDataFromSessionStorage("clusteringHistory"),
				});
			}
		};
	}
}
