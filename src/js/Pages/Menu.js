import React from "react";
import {BrowserRouter as Router, Link, Route} from "react-router-dom";
import Header from '../Components/Header';

// Header of the TimeTubes web
export default class Menu extends React.Component {
    constructor() {
        super();
    }

    render() {
        // adding className 'active' to li elements in ul, the text will be highlighted
        return (
            <nav className="navbar navbar-expand-lg navbar-dark bg-primary" id='appHeader'>
                <a className="navbar-brand" href="#">TimeTubes</a>
                <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarColor01"
                        aria-controls="navbarColor01" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className="collapse navbar-collapse" id="navbarColor01">
                    <ul className="navbar-nav mr-auto">
                        <li className="nav-item">
                            <Link className="nav-link" to='/about'>About</Link>
                        </li>
                        <li className="nav-item active">
                            <Link className="nav-link" to='/'>Visualization</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to='/about'>Feature Extraction</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to='/original'>Original Data</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to='/contact'>Contact</Link>
                        </li>
                    </ul>
                </div>

            </nav>
        );
    }
}