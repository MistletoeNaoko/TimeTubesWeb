import * as d3 from 'd3';
import DataStore from '../Stores/DataStore';

export function dataDrivenHistogram(data, dataKey) {
    // sort array in ascending order
    // extractedData.sort(function(a, b) {
    //     if (a < b) return -1;
    //     if (a > b) return 1;
    //     return 0;
    // });
    let x = d3.scaleLinear()
        .domain(d3.extent(data, function(d) {
            return d[dataKey];
        }))
        .range([0, 1000]);
    // length, x0, x1
    let histogram = d3.histogram()
        .value(function(d) {
            return d[dataKey];
        })
        .domain(x.domain())
        .thresholds(x.ticks(SturgesRule(data.length)));
    
    console.log(histogram(data));
}

function SturgesRule(sampleNum) {
    return Math.ceil(Math.log2(sampleNum) + 1);
}

export function histogramEqualizer(ranking, index, diag) {
    // 補間した値をさらに渡してるから既知の値についてのヒストグラムだけでは決められない
    // 変換式が必要->splineでやるしかない？
    // 今みているインデックスの前後をみて同じ値のものがあったら、平均値をとる
    let data = ranking[index];
    let sameVals = [], sameValCnt = 0;
    for (let i = 0; i < ranking.length; i++) {
        if (Math.abs(ranking[i].value - data.value) < 0.00001) {
            sameVals.push(i);
            sameValCnt++;
        }
    }
    let projectedVal;
    if (sameValCnt === 1) {
        projectedVal = (data.value * diag.value + data.rank * diag.rank) / (diag.value * diag.value + diag.rank * diag.rank);
    } else {
        projectedVal = 0;
        for (let i = 0; i < sameVals.length; i++) {            
            projectedVal += (ranking[sameVals[i]].value * diag.value + ranking[sameVals[i]].rank * diag.rank) / (diag.value * diag.value + diag.rank * diag.rank);
        }
        projectedVal /= sameValCnt;
    }
    return projectedVal;
}
