import React from 'react';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
// import CameraStore from '../Stores/CameraStore';
import Controllers from './Controllers';
// import Details from './Details';
import TimeTubes from './TimeTubes';
import Feature from './Feature';
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

    collapseSidebar() {
        $('#Controllers').toggle("slow");
    }

    collapseFeature() {
        $('#Feature').toggle('slow');
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
            <div className='maincontainer' id='maincontainer'>
                <div className='contents' id='mainVisArea'>
                    <div className='row'>
                    <div id='Controllers'>
                        <Controllers/>
                    </div>
                    <button
                        className='collapseBtn btn-collapse'
                        id='collapseSidebar'
                        data-toggle="sidebar"
                        onClick={this.collapseSidebar.bind(this)}>
                        ☰</button>
                    <div id='TimeTubesViewports'>
                        {TimeTubesList}
                    </div>
                    </div>
                    <div className='row' id='scatterplotsArea'  style={{whiteSpace: 'pre-line'}}>
                        {scatterplotsList}
                    </div>
                </div>
                <div className='right'>
                    <div id='Feature'>
                        <Feature/>
                    </div>
                    <button
                        className='collapseBtn btn-collapse'
                        id='collapseFeature'
                        data-toggle="sidebar"
                        onClick={this.collapseFeature.bind(this)}>
                        ☰</button>
                </div>
            </div>
        );
    }
}