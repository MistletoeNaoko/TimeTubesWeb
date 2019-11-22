export function getGaussData(sigma) {
    let data = [];
    if (sigma > 0) {
        for (let i = -4; i <= 4; i++) {
            let gauss = Math.exp(-i * i / (2 * sigma * sigma)) / Math.sqrt(2 * Math.PI * sigma * sigma);
            data.push({x: i, y: gauss});
        }
    } else {
        data.push({x: -1, y: 1});
        data.push({x: 1, y: 1});
    }
    return data;
}

export function getGaussValue(xPos, sigma) {
    return Math.exp(-xPos * xPos / (2 * sigma * sigma)) / Math.sqrt(2 * Math.PI * sigma * sigma);
}
