import DataStore from '../Stores/DataStore';

export function makeQueryfromQBE(source, period, ignored) {
    let roundedPeriod = [Math.floor(period[0]), Math.ceil(period[1])];
    let minJD = DataStore.getData(source).data.meta.min.z;
    let lookup = DataStore.getData(source).data.lookup;
    let query = {};
    for (let key in lookup) {
        if (ignored.indexOf(key) < 0) {
            query[key] = [];
        }
    }
    for (let i = roundedPeriod[0]; i <= roundedPeriod[1]; i++) {
        let values = DataStore.getValues(source, i - minJD);
        for (let key in query) {
            if (key !== 'z') {
                query[key].push(values[key]);
            } else {
                query[key].push(i);
            }
        }
    }
    query['minJD'] = roundedPeriod[0];
    console.log(roundedPeriod, minJD, query);
    return query;
}