import React from 'react';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';

export default class Details extends React.Component{
    constructor() {
        super();
        this.state = {
            id: DataStore.getTailID(),
            fileName: DataStore.getFileName(DataStore.getTailID()),
            currentVal: DataStore.getValues(-1, 0),
            checked: true
        };
    }

    componentWillMount() {
        // ToDo: at first file uploading, following 'upload' code cannot catch event emitter
        DataStore.on('upload', (arg1) => {
            if (this.state.id === -1) {
                this.setState({
                    id: arg1,
                    fileName: DataStore.getFileName(arg1),
                    currentVal: DataStore.getValues(0, 0),
                    checked: false
                });
            }
        });
        DataStore.on('updateDetail', (arg1, arg2) => {
            if (this.state.id === arg1) {
                this.setState({

                    currentVal: DataStore.getValues(arg1, arg2)
                });
            }
        });

        TimeTubesStore.on('updateChecked', (arg1) => {
            if (this.state.id === arg1) {
                this.setState({
                    checked: !this.state.checked
                });
            }
        });
    }

    onChangeCheckbox(id) {
        TimeTubesAction.updateChecked(id);
        // this.setState({
        //     checked: !this.state.checked
        // });

        // let checked = this.state.checked;
        // checked[id] = !checked[id];
        // this.setState({
        //     checked: checked
        // });
    }

    render() {
        let cur = this.state.currentVal;
        let detail = '';
        for (let i = 0; i < cur.keys.length; i++) {
            let val;
            if (cur.keys[i] === 'JD' || cur.keys[i] === 'V-J') {
                val = cur.vals[i].toFixed(3);
            } else if (cur.keys[i] === 'Flx(V)') {
                val = cur.vals[i].toExponential(2);
            } else {
                val = cur.vals[i].toFixed(4);
            }
            detail += cur.keys[i] + ': ' + val + '\n';
        }
        return (
            <div>
                <div style={{position: 'absolute', color: 'white', top: '0px', left: '0px', zIndex:'11', fontSize: '0.8rem'}}>
                    <label>
                        <input type='checkbox' name='selectView' key={this.state.id} value={this.state.id} checked={this.state.checked} onChange={this.onChangeCheckbox.bind(this, this.state.id)}/>
                        {this.state.fileName}
                    </label>
                    {/*{this.state.fileName}*/}
                </div>
                <div style={{position: 'absolute', color: 'white', right: '0px', bottom: '0px', whiteSpace: 'pre-line', zIndex:'10', fontSize: '0.8rem'}}>
                    {detail}
                </div>
                {/*<ul>{this.state.currentVal}</ul>*/}
            </div>
        )
    }
}