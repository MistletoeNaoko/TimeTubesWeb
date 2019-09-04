import React from 'react';
import TimeTubesHolder from './TimeTubesHolder';
import ScatterplotsHolder from './ScatterplotsHolder';
import TimeTubesStore from '../Stores/TimeTubesStore';

export default class DataColumn extends React.Component{
    constructor(props) {
        super();
        this.id = props.id;
        this.data = props.data;
        this.fileName = this.data.name;
        this.state = {
            width: props.width,
            heightTT: props.heightTT,
            heightSP: props.heightSP
        }
    }

    render() {
        return (
            <div className='dataColumn outerContainer col-sm'
                 id={'dataColumn_' + this.id}
                 style={{padding:'unset'}}>
                <TimeTubesHolder
                    id={this.id}
                    data={this.data}
                    width={this.props.width}
                    height={this.props.heightTT}/>
                <ScatterplotsHolder
                    id={this.id}
                    data={this.data}
                    width={this.props.width}
                    height={this.props.heightSP}/>
            </div>
        );
    }
}