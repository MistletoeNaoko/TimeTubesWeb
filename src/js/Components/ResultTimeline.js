import React from 'react';
import * as d3 from 'd3';
import * as FeatureAction from '../Actions/FeatureAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';

export default class ResultTimeline extends React.Component {
    constructor(props) {
        super();
        this.id = props.id;
        this.results = props.results;
        this.data = DataStore.getData(this.id);
        this.height = props.height;

        this.resultsVQ = null;
        this.resultsFlare = null;
        this.resultsRotation = null;
        this.resultsAnomaly = null;
    }

    render() {
        if (document.getElementById('resultTimeline_' + this.id)) {
            this.updateTimeline();
        }
        return (
            <div
                id={'resultTimeline_' + this.id}
                className='timeline'>

            </div>
        );
    }

    componentDidMount() {
        this.initializeTimeline();
        this.setUpTimeline();
    }

    componentWillUnmount() {
        let parent = document.getElementById('resultTimeline_' + this.id);
        if (parent) {
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
            parent.parentNode.removeChild(parent);
        }
    }

    initializeTimeline() {
        this.svg = d3.select('#resultTimeline_' + this.id)
            .append('svg')
            .attr('id', 'resultTimelineSVG_' + this.id);
        this.xScale = d3.scaleLinear()
            .domain([this.data.data.meta.min.z, this.data.data.meta.max.z]);
        this.xAxis = this.svg
            .append('g')
            .attr('class', 'x-axis');

        this.tooltip = d3.select('#resultTimeline_' + this.id)
            .append('div')
            .attr('class', 'tooltip')
            .attr('id', 'tooltipResultTimeline_' + this.id)
            .style('opacity', 0.75)
            .style('visibility', 'hidden');
    }

    updateTimeline() {
        this.id = this.props.id;
        this.results = this.props.results;
        this.data = DataStore.getData(this.id);
        this.height = this.props.height;

        this.resultsVQ = null;
        this.resultsFlare = null;
        this.resultsRotation = null;
        this.resultsAnomaly = null;

        this.setUpTimeline();
    }

    setUpTimeline() {
        let parentArea = $('#resultTimelineArea_' + this.id);
        let outerWidth = parentArea.width(), outerHeight = this.height;
        let margin = {left: 20, right: 20};
        let width = outerWidth - margin.left - margin.right,
            height = outerHeight;// - margin.top - margin.bottom;
        
        this.svg
            .attr('width', outerWidth)
            .attr('height', outerHeight);
        
        this.xScale
            .domain([this.data.data.meta.min.z, this.data.data.meta.max.z])
            .nice()
            .range([0, width]);

        this.xLabel = d3.axisBottom(this.xScale)
            .ticks(10)
            .tickSize(10);

        this.xAxis
            .attr('transform', 'translate(' + margin.left + ',' + (height / 2 - 5) + ')')
            .call(this.xLabel);


        let resultsVQ = this.results.filter(d => d.distance !== undefined);
        let resultsRotation = this.results.filter(d => d.angle);
        let resultsFlare = [];
        this.results.forEach(d => {
            if (d.V) {
                resultsFlare.push(d);
            } else if (d.flares) {
                resultsFlare.push(d.flares);
            }
        });
        let resultsAnomaly = this.results.filter(d => d.anomalyDegree);

        this.svg
            .selectAll('line.resultsVQ')
            .data(resultsVQ)
            .exit()
            .remove();
        this.svg
            .selectAll('line.resultsRotation')
            .data(resultsRotation)
            .exit()
            .remove();
        this.svg
            .selectAll('circle.resultsFlare')
            .data(resultsFlare)
            .exit()
            .remove();
        this.svg
            .selectAll('circle.resultsAnomaly')
            .data(resultsAnomaly)
            .exit()
            .remove();

        if (resultsVQ.length > 0) {
            this.svg
                .selectAll('line.resultsVQ')
                .remove();
            this.resultsVQ = this.svg
                .selectAll('line.resultsVQ')
                .data(resultsVQ)
                .enter()
                .append('line')
                .attr('class', 'resultsVQ')
                .attr('x1', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('y1', height / 2 - 5)
                .attr('x2', function(d) {
                    return this.xScale(d.start + d.period);
                }.bind(this))
                .attr('y2', height / 2 - 5)
                .attr('stroke', '#1d95c6')
                .attr('stroke-width', 20)
                .attr('opacity', 0.5);
        }
        if (resultsRotation.length > 0) {
            this.svg
                .selectAll('line.resultsRotation')
                .remove();
            this.resultsRotation = this.svg
                .selectAll('line.resultsRotation')
                .data(resultsRotation)
                .enter()
                .append('line')
                .attr('class', 'resultsRotation')
                .attr('x1', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('y1', height / 2 - 5)
                .attr('x2', function(d) {
                    return this.xScale(d.start + d.period);
                }.bind(this))
                .attr('y2', height / 2 - 5)
                .attr('stroke', '#80b139')
                .attr('stroke-width', 20)
                .attr('opacity', 0.5);
        }
        if (resultsFlare.length > 0) {
            this.svg
                .selectAll('circle.resultsFlare')
                .remove();
            this.resultsFlare = this.svg
                .selectAll('circle.resultsFlare')
                .data(resultsFlare)
                .enter()
                .append('circle')
                .attr('class', 'resultsFlare')
                .attr('cx', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('cy', height / 2 - 5)
                .attr('r', 10)
                .attr('fill', '#f26418')
                .attr('opacity', 0.5);
        }
        if (resultsAnomaly.length > 0) {
            this.svg
                .selectAll('circle.resultsAnomaly')
                .remove();
            this.resultsAnomaly = this.svg
                .selectAll('circle.resultsAnomaly')
                .data(resultsAnomaly)
                .enter()
                .append('circle')
                .attr('class', 'resultsAnomaly')
                .attr('cx', function(d) {
                    return this.xScale(d.start);
                }.bind(this))
                .attr('cy', height / 2 - 5)
                .attr('r', 10)
                .attr('fill', '#d23430')
                .attr('opacity', 0.5);
        }
    }
}
