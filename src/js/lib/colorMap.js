export function histogramEqualizer(ranking, index, diag) {
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
