import React from 'react';
import Menu from './Menu';
import Visualization from "./Visualization";
import FeatureExtraction from './FeatureExtraction';
import About from './About';
import Comment from './Comment';
import AppStore from '../Stores/AppStore';
import FeatureStore from '../Stores/FeatureStore';

// Layout menu, visualization, feature form, etc.
export default class Layout extends React.Component {
    constructor() {
        super();
        this.state = {
            menu: 'visualization'
        };
        this.selectMainView('visualization');
    }

    componentDidMount() {
        AppStore.on('selectMenu', (menu) => {
            this.selectMainView(menu);
            scrollTo(0, 0);
            this.setState({
                menu: menu
            });
        });
        FeatureStore.on('recoverQuery', (query) => {
            setTimeout(function() {
                this.setState({
                    menu: 'feature'
                });
            }.bind(this), 0);
        });
    }

    selectMainView(menu) {
        // switch visibility
        switch (menu) {
            case 'about':
                $('body').css('overflow-y', 'scroll');
                break;
            case 'visualization':
                $('body').css('overflow-y', 'hidden');
                break;
            case 'feature':
                $('body').css('overflow-y', 'hidden');
                break;
            case 'comment':
                $('body').css('overflow-y', 'scroll');
                break;
        }
    }

    render() {
        return (
            <div>
                <Menu/>
                <div
                    className='maincontainer'
                    id='about'
                    style={{display: (this.state.menu === 'about') ? 'block': 'none', height: ($(window).height() - $('#appHeader').outerHeight())}}>
                    <About/>
                </div>
                <div
                    className='maincontainer'
                    id='visualization'
                    style={{display: (this.state.menu === 'visualization') ? 'block': 'none'}}>
                    <Visualization/>
                </div>
                <div className='maincontainer'
                     id='featureExtraction'
                     style={{display: (this.state.menu === 'feature') ? 'block': 'none'}}>
                    <FeatureExtraction/>
                </div>
                <div className='maincontainer'
                     id='fuserComments'
                     style={{display: (this.state.menu === 'comment') ? 'block': 'none'}}>
                    <Comment/>
                </div>
            </div>
        );
    }
}
