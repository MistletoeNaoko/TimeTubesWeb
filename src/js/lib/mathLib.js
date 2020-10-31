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

export function ordinalSuffixOf(num) {
    let i = num % 10,
        j = num % 100;
    if (i == 1 && j != 11) {
        return num + "st";
    }
    if (i == 2 && j != 12) {
        return num + "nd";
    }
    if (i == 3 && j != 13) {
        return num + "rd";
    }
    return num + "th";
}
