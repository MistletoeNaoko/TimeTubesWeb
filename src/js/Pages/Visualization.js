import React from 'react';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import Controllers from '../Components/Controllers';
import DataColumn from '../Components/DataColumn';
// import Details from './Details';
import TimeTubes from '../Components/TimeTubes';
import Feature from '../Components/Feature';
import ScatterplotsHolder from '../Components/ScatterplotsHolder';
import DataStore from '../Stores/DataStore';

// a page for the main visualization
export default class Visualization extends React.Component{
    constructor() {
        super();
        let width = $(window).width() / DataStore.getDataNum();// * 0.95;
        let height = $(window).height() - $('#appHeader').height() - $('#tubeControllers').height()
        let heightTT = Math.ceil(height * 0.6) + 100;
        let heightSP = height - heightTT;
        this.state = {
            data: DataStore.getAllData(),
            width: width,
            heightTT: heightTT,
            heightSP: heightSP
        }
    }

    componentWillMount() {
        DataStore.on('upload', () => {
            // add new data & create new TimeTubes view
            this.setState({
                data: DataStore.getAllData(),
                width: $(window).width() / DataStore.getDataNum()
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
        // When new file is loaded, new DataColumn will be created,
        const dataColumns = datasets.map((data) => {
            return <DataColumn
                key={data.id}
                id={data.id}
                data={data.data}
                width={this.state.width}
                heightTT={this.state.heightTT}
                heightSP={this.state.heightSP}
            />;
        });
        // const TimeTubesList = datasets.map((data) => {
        //     return <TimeTubes
        //         key={data.id}
        //         id={data.id}
        //         data={data.data}
        //     />;
        // });
        // const scatterplotsList = datasets.map((data) => {
        //     return <ScatterplotsHolder
        //         key={data.id}
        //         id={data.id}
        //         data={data.data}
        //         />;
        // });
        return (
            <div className='maincontainer' id='maincontainer'>
                <div className='contents' id='mainVisArea'>
                    <Controllers/>
                    <div id='dataColumns'
                         className='container'
                         style={{display: 'inline-block', minWidth: '100%', padding: 'unset'}}>
                        <div className='row'
                             style={{margin: 'unset'}}>
                            {dataColumns}
                        </div>
                    </div>
                </div>
                {/*<div className='right'>*/}
                    {/*<div id='Feature'>*/}
                        {/*<Feature/>*/}
                    {/*</div>*/}
                    {/*<button*/}
                        {/*className='collapseBtn btn-collapse'*/}
                        {/*id='collapseFeature'*/}
                        {/*data-toggle="sidebar"*/}
                        {/*onClick={this.collapseFeature.bind(this)}>*/}
                        {/*☰</button>*/}
                {/*</div>*/}
            </div>
        );
    }
}