import React from 'react';
import Menu from './Menu';
import Visualization from "./Visualization";
import FeatureExtraction from './FeatureExtraction';
import Comment from './Comment';
import AppStore from '../Stores/AppStore';

// Layout menu, visualization, feature form, etc.
export default class Layout extends React.Component {
    constructor() {
        super();
        this.state = {
            menu: 'visualization'
        };
        this.selectMainView();
    }

    componentDidMount() {
        AppStore.on('selectMenu', (menu) => {
            this.setState({
                menu: menu
            });
            this.selectMainView();
        });
    }

    selectMainView() {
        // switch visibility
        switch (this.state.menu) {
            case 'visualization':
                $('body').css('overflow-y', 'hidden');
                break;
            case 'feature':
                $('body').css('overflow-y', 'scroll');
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
