import React from "react";

export default class Header extends React.Component {
    handleChange(e) {
        const title = e.target.value;
        this.props.callback1(title);
    }


    render() {

        return (
            <div>
                <h1>{this.props.title1}</h1>
                {/*<input onChange={this.handleChange.bind(this)}/>*/}
            </div>
        );
    }
}