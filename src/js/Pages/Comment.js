import React from 'react';
import * as dataLib from '../lib/dataLib';
import * as DataAction from '../Actions/DataAction';
import AppStore from '../Stores/AppStore';

export default class Comment extends React.Component {
    constructor() {
        super();

        this.state = {
            privateComments: dataLib.getDataFromLocalStorage('privateComment')
        };
        AppStore.on('selectMenu', (menu) => {
            if (menu === 'comment') {
                this.setState({
                    privateComments: dataLib.getDataFromLocalStorage('privateComment')
                });
            }
        });
    }

    componentDidMount() {
        $('#privateCommentTable').tablesorter();
    }

    privateCommentListTr() {
        let table = [];
        if (this.state.privateComments) {
            for (let i = 0; i < this.state.privateComments.length; i++) {
                table.push(
                    <tr key={i} className='privateCommentBody' id={this.state.privateComments[i].id}>
                        <td style={{textAlign: 'center'}}>
                            <input type="checkbox" className={this.state.privateComments[i].id + ' selectComment'} name='privateCommentSelector'/>
                        </td>
                        <td>{this.state.privateComments[i].timeStamp.toLocaleString('en-US')}</td>
                        <td>{this.state.privateComments[i].fileName}</td>
                        <td>{this.state.privateComments[i].start}</td>
                        <td>{this.state.privateComments[i].comment}</td>
                        <td>{this.state.privateComments[i].userName}</td>
                        {/* <td>
                            <button
                                className='btn btn-primary btn-sm'
                                type='button'
                                id={this.state.privateComments[i].id + ' editCommentBtn'}
                                onClick={this.editPrivateComment}
                                style={{float: 'left'}}>
                                Edit
                            </button>
                            <button
                                className='btn btn-primary btn-sm'
                                type='button'
                                id={this.state.privateComments[i].id + ' deleteCommentBtn'}
                                style={{float: 'left'}}
                                onClick={this.deletePrivateComment.bind(this)}>
                                Delete
                            </button>
                        </td> */}
                    </tr>
                );
            }
        }
        return table;
    }

    privateCommentListHeader() {
        return (
            <thead>
                <tr id='privateCommentHeader'>
                    <th className='col-1'>Select</th>
                    <th className='col-2 num' value='timeStamp'>Date (GMT)</th>
                    <th className='col-2 case' value='fileName'>File name</th>
                    <th className='col-1 num' value='start'>JD</th>
                    <th className='col-4' value='comment'>Comment</th>
                    <th className='col-2 case' value='userName'>User name</th>
                    {/* <th className='col-1'>Edit</th> */}
                </tr>
            </thead>
        )
    }

    getSelectedPrivateComment() {
        let checked = $('input[name=privateCommentSelector]:checked');
        let checkedIds = [];
        for (let i = 0; i < checked.length; i++) {
            checkedIds.push($(checked[i]).attr('class').split(' ')[0]);
        }
        return checkedIds;
    }

    editPrivateComment() {

    }

    deletePrivateComment(e) {
        let selectedIds = this.getSelectedPrivateComment();
        for (let i = 0; i < selectedIds.length; i++) {
            dataLib.deletePrivateComment(selectedIds[i]);
        }
        // update table
        this.setState({
            privateComments: dataLib.getDataFromLocalStorage('privateComment')
        });
        DataAction.updatePrivateComment();
    }

    exportPrivateComment() {
        dataLib.exportPrivateComment(this.getSelectedPrivateComment());
    }

    selectAllPrivateComment() {
        let currentMode = $('#selectAllPrivateCommentBtn').text();
        let checkboxes = $('input[name=privateCommentSelector]');
        if (currentMode === 'Select All') { 
            checkboxes.prop('checked', true);
            $('#selectAllPrivateCommentBtn').text('Deselect All');
        } else if (currentMode === 'Deselect All') {
            checkboxes.prop('checked', false);
            $('#selectAllPrivateCommentBtn').text('Select All');            
        }
    }

    render() {
        let tableHeader = this.privateCommentListHeader();
        let tableContents = this.privateCommentListTr();
        return (
            <div
                className='contents'
                id='mainCommentsArea'>
                {/* style={{display: 'flex'}}> */}
                <ul className="nav nav-tabs">
                    <li className="nav-item">
                        <a className="nav-link active" data-toggle="tab" href="#private">Private comments</a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link disabled" data-toggle="tab" href="#public">Public comments</a>
                    </li>
                </ul>
                <div id="myTabContent" className="tab-content">
                    <div className="tab-pane fade active show commentsArea" id="private">
                        <div id='privateCommentMenu' style={{float: 'right', marginBottom: '15px'}}>
                            <button
                                className='btn btn-primary btn-sm'
                                type='button'
                                id='selectAllPrivateCommentBtn'
                                onClick={this.selectAllPrivateComment.bind(this)}>
                                Select All
                            </button>
                            <button
                                className='btn btn-danger btn-sm'
                                type='button'
                                id={'deleteCommentBtn'}
                                onClick={this.deletePrivateComment.bind(this)}>
                                Delete
                            </button>
                            <button
                                className='btn btn-primary btn-sm'
                                type='button'
                                id='exportPrivateCommentBtn'
                                onClick={this.exportPrivateComment.bind(this)}>
                                Export
                            </button>
                        </div>
                        <table id='privateCommentTable' className="table table-hover tablesorter">
                            {tableHeader}
                            <tbody id='privateCommentBody'>
                                {tableContents}
                            </tbody>
                        </table>
                    </div>
                    <div className="tab-pane fade commentsArea" id="public">
                        Public comments will be here.
                    </div>
                </div>
            </div>
        );
    }
}
