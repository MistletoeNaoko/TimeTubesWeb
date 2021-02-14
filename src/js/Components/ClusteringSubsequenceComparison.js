import React from "react";
import Sortable from 'sortablejs';
import ClusteringSubsequenceView from "../Components/ClusteringSubsequenceView";
import ClusteringStore from '../Stores/ClusteringStore';

export default class ClusteringSubsequenceComparison extends React.Component {
	constructor(props) {
		super();
		this.state = {
			selectedSubsequences: [],
		};
	}

	render() {
		let subsequenceViews = [];
		for (let i = 0; i < this.state.selectedSubsequences.length; i++) {
			subsequenceViews.push(
				<ClusteringSubsequenceView
					key={i}
					idx={i}
					dataId={this.state.selectedSubsequences[i].id}
                    period={this.state.selectedSubsequences[i].period}
                    SSId={this.state.selectedSubsequences[i].SSId}
				/>
			);
		}
		return (
			<div
				id="clusteringSubsequenceComparison"
				className="clusteringPanel"
				style={{
					height:
						window.innerHeight -
						$("#appHeader").outerHeight(true) -
						$("#clusteringResultsLeftColumnNavTabs").outerHeight(true),
				}}
			>
				<div className="overlayHidingPanel"></div>
				{subsequenceViews}
			</div>
		);
	}

	componentDidMount() {
        let ele = document.getElementById('clusteringSubsequenceComparison');
        let sortable = Sortable.create(ele, {
            handle: '.hamburger',
            animation: 150
        });
		ClusteringStore.on(
			"showSelectedSubsequenceInComparisonPanel",
			(id, period, SSId) => {
				let subsequences = this.state.selectedSubsequences;
				subsequences.push({
					id: id,
                    period: period,
                    SSId: SSId
				});
				this.setState({
					selectedSubsequences: subsequences,
				});
			}
		);
	}
}
