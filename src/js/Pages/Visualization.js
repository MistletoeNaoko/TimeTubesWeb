import React from 'react';
import Controllers from '../Components/Controllers';
import DataColumn from '../Components/DataColumn';
import DataStore from '../Stores/DataStore';

// a page for the main visualization
export default class Visualization extends React.Component{
    constructor() {
        super();
        // let width = $(window).width() / DataStore.getDataNum();// * 0.95;
        // let height = $(window).height() - $('#appHeader').height() - $('#tubeControllers').height();
        // let heightTT = Math.ceil(height * 0.6) + 100;
        // let heightSP = height - heightTT;
        this.state = {
            data: DataStore.getAllData(),
            width: $(window).width(),
            heightTT: ($(window).height() / 2),
            heightSP: ($(window).height() / 2)
        }
    }

    componentDidMount() {   
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
        let width = this.state.width;
        let heightTT = this.state.heightTT;
        let heightSP = this.state.heightSP;
        let dataNum = DataStore.getDataNum();
        if (dataNum > 0) {
            if (dataNum <= 3) {
                width = window.innerWidth / dataNum;// * 0.95;
            } else {
                width = Math.ceil(window.innerWidth / 3);
            }
            let height = $(window).height() - $('#appHeader').outerHeight() - $('#tubeControllers').outerHeight();
            heightTT = Math.ceil(height * 0.6) + 100;
            heightSP = height - heightTT;
        }
        // When new file is loaded, new DataColumn will be created,
        const dataColumns = datasets.map((data) => {
            return <DataColumn
                key={data.id}
                id={data.id}
                data={data.data}
                width={width}
                heightTT={heightTT}
                heightSP={heightSP}
            />;
        });
        return (
            <div className='contents' id='mainVisArea'>
                <Controllers/>
                <div id='dataColumns'
                     className='container'
                     style={{
                         display: 'inline-block',
                         maxWidth: '100%',
                         width: '100vw',
                         padding: 'unset',
                         overflowX: 'scroll',
                         overflowY: 'hidden'}}>
                    <div style={{margin: 'unset'}}>
                        {dataColumns}
                    </div>
                </div>
            </div>
        );
    }
}
