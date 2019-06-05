import React from 'react';

export default class Feature extends React.Component {
    render() {
        return (
            <div id='featureArea' className='controllersElem'>
                <div className="custom-control custom-switch">
                    <input
                        type="checkbox"
                        className="custom-control-input"
                        id="switchVisualQuery"/>
                        <label
                            className="custom-control-label"
                            htmlFor="switchVisualQuery">
                            Visual query
                        </label>
                </div>
            </div>
        );
    }
}