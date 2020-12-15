import { over } from 'lodash';
import React from 'react';
import {performClustering} from '../lib/subsequenceClustering';
import DataStore from '../Stores/DataStore';

export default class Clustering extends React.Component {
    constructor(props) {
        super();
    }    

    render() {
        return (
            <div id='clusteringSetting' className='controllersElem featureArea'>
                <button className="btn btn-primary btn-sm"
                    type="button"
                    id='runAutomaticExtractionBtn'
                    style={{float: 'right'}}
                    onClick={this.clickRunButton.bind(this)}>Run</button>
            </div>
        )
    }

    clickRunButton() {
        let data = DataStore.getData(0),
            clusteringParameters = {
                method: 'kmeans',
                clusterNum: 5,
                distanceMetric: 'DTWD',
                window: 0,
            },
            SSperiod = [20, 30],
            isometryLen = 30,
            overlappingTh = 70,
            variables = ['x', 'y', 'V', 'H'];
        performClustering(data, clusteringParameters, SSperiod, isometryLen, overlappingTh, variables);
    }
}
