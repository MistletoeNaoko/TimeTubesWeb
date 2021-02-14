import React from "react";
import DataStore from '../Stores/DataStore';

export default class ClusteringSubsequenceView extends React.Component {
	constructor(props) {
		super();
		this.cardPadding = 4;
	}

	render() {
		let canvasWidth =
			$("#clusteringSubsequenceComparison").width() -
			Number(
				$("#clusteringSubsequenceComparison")
					.css("padding-left")
					.replace("px", "")
			) -
			Number(
				$("#clusteringSubsequenceComparison")
					.css("padding-right")
					.replace("px", "")
			) -
			this.cardPadding * 2;
		return (
			<div className="card border-light mb-1" style={{ maxWidth: "20rem" }}>
				<div className="card-header cardHeaderSubsequenceComparison">
					<div className="hamburger"
                        onMouseDown={this.onMouseDownSubsequenceView().bind(this)}>
						<div></div>
						<div></div>
						<div></div>
					</div>
                    <span className='subsequenceComparisonViewFileName'>
					    {DataStore.getFileName(this.props.dataId)}
                    </span>
                    <span className='subsequenceComparisonViewPeriod'>
                        {this.props.period[0]}&ndash;{this.props.period[1]}
                    </span>
					<button
						type="button"
						className="ml-2 mb-1 close"
						// data-dismiss="toast"
                        aria-label="Close"
                        onClick={this.onClickCloseSubsequenceView().bind(this)}
					>
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div className="card-body cardBodySubsequenceComparison">
					<canvas
						className="subsequenceComparisonCanvas"
						id={"subsequenceComparisonCanvas_" + this.props.SSId}
						width="500"
						height="500"
						style={{ width: canvasWidth, height: canvasWidth }}
					></canvas>
				</div>
			</div>
		);
    }
    
    onClickCloseSubsequenceView() {
        return (
            function(d) {

            }
        );
    }

    onMouseDownSubsequenceView() {
        return (
            function(d) {

            }
        );
    }
}
