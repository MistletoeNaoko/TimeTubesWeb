import React from 'react';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
// import CameraStore from '../Stores/CameraStore';
import Controllers from './Controllers';
// import Details from './Details';
import TimeTubes from './TimeTubes';
import ScatterplotsHolder from './ScatterplotsHolder';
import DataStore from '../Stores/DataStore';

export default class Page1 extends React.Component{
    constructor() {
        super();
        this.state = {
            data: DataStore.getAllData()
        }
    }

    componentWillMount() {
        DataStore.on('upload', () => {
            // add new data & create new TimeTubes view
            this.setState({
                data: DataStore.getAllData()
            });
        });
    }

    render() {
        const datasets = this.state.data;
        // When new file is loaded, new TimeTubes view will be created,
        const TimeTubesList = datasets.map((data) => {
            return <TimeTubes
                key={data.id}
                id={data.id}
                data={data.data}
                // name={data.name}
                // data={data.data}
                // spatial={data.spatial}
                // metadata={data.metadata}
            />;
        });
        const scatterplotsList = datasets.map((data) => {
            return <ScatterplotsHolder
                key={data.id}
                id={data.id}
                data={data.data}
                />;
        });
        let width = window.innerWidth;
        return (
            <div className="container-fluid">
                <div className="row">
                    <div className="col-md-2" id='Controllers'>
                        <Controllers/>
                    </div>
                    <div className="col-md-10" id='TimeTubesViewports'>
                        {TimeTubesList}
                    </div>
                </div>
                <div className="row" id='scatterplotsArea' style={{whiteSpace: 'pre-line'}}>
                    {scatterplotsList}
                </div>
            </div>
        );
    }
}