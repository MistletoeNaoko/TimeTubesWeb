import React from 'react';
import Header from './Header';
import Page1 from "./Page1";

export default class Layout extends React.Component {
    constructor() {
        super();
        this.state = {
            theTitle: 'Layout',
        };
    }

    changeTitleInterface(title) {
        this.setState({theTitle: title})
    }

    render() {
        return (
            //<h1>It {this.val} works!</h1>
            <Page1/>
            // <div>
            //     <Header title1={this.state.theTitle} />
            // </div>
        );
    }
}