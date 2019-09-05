import React from 'react';
import TimeTubes from './TimeTubes';
import TimeSelector from './TimeSelector';


export default class TimeTubesHolder extends React.Component{
    constructor(props) {
        super();
        this.id = props.id;
        this.data = props.data;
        this.fileName = this.data.name;
        this.state = {
            width: props.width,
            height: props.height
        }
    }

    render() {
        return (
            <div className='TimeTubesHolder'
                 id={'TimeTubesHolder_' + this.id}>
                <TimeTubes
                    id={this.id}
                    data={this.data}
                    width={this.props.width}
                    height={this.props.height - 100}/>
                <div
                    id={this.divID}
                    className='timeSelector'>
                <TimeSelector
                    id={this.id}
                    divID={'timeSelector_' + this.id}
                    width={this.props.width}/>
                </div>
            </div>
        );
    }
}