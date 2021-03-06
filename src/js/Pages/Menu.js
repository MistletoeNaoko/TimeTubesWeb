import React from "react";
import * as d3 from 'd3';
import * as AppAction from '../Actions/AppAction';
import AppStore from '../Stores/AppStore';

// Header of the TimeTubes web
export default class Menu extends React.Component {
    constructor() {
        super();
        this.menu = 'Visualization';
    }

    componentDidMount() {
        $("ul[id*=mainMenuList] li").click(function () {
            d3.selectAll('.mainMenu')
                .classed('active', false);
            let selectedVal = $(this).attr('value');
            d3.select(this)
                .classed('active', true);
            AppAction.selectMenu(selectedVal);
        });

        AppStore.on('selectMenu', (menu) => {
           this.menu = menu;
        });
    }

    render() {
        // adding className 'active' to li elements in ul, the text will be highlighted
        return (
            <nav className="navbar navbar-expand-lg navbar-dark bg-primary" id='appHeader'>
                <a className="navbar-brand">TimeTubesX</a>
                <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarColor01"
                        aria-controls="navbarColor01" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className="collapse navbar-collapse" id="navbarMainMenu">
                    <ul className="navbar-nav mr-auto" id='mainMenuList'>
                        <li className="nav-item mainMenu" value='about'>
                            <label className="nav-link menuLabel">About</label>
                        </li>
                        <li className="nav-item mainMenu active" value='visualization'>
                            <label className="nav-link menuLabel">Visualization</label>
                        </li>
                        <li className="nav-item mainMenu" value='feature'>
                            <label className="nav-link menuLabel">Feature Extraction</label>
                        </li>
                        <li className="nav-item mainMenu" value='comment'>
                            <label className="nav-link menuLabel">Comment</label>
                        </li>
                    </ul>
                </div>
            </nav>
        );
    }
}
