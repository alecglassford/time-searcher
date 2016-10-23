'use strict';

var margin = 50,
    svg = d3.select('svg'),
    width = svg.attr('width') - 2 * margin,
    height = svg.attr('height') - 2 * margin,
    canvas = svg.append('g').attr('transform', 'translate(' + margin + ',' + margin + ')');

var parseDate = d3.timeParse('%m/%d/%y');
function parse(d) {
    d.date = parseDate(d.date);
    return d;
}

d3.csv('data/stock_data.csv', parse, function(error, data) {
    if (error) {
        return console.warn(error);
    }

    // Data processing (and much else)
    // inspired by https://bl.ocks.org/mbostock/3884955
    var stocks = data.columns.slice(1).map(function(tickerSymbol) {
        return {
            tickerSymbol: tickerSymbol.trim(),
            values: data.map(function(d) {
                return {date: d.date, price: +d[tickerSymbol]};
            })
        };
    });

    console.log(stocks);

    var x = d3.scaleTime()
        .domain(d3.extent(data, function(d) { return d.date; }))
        .range([0, width]);
    var y = d3.scaleLinear()
        .domain([
            d3.min(stocks, function(stock) {
                return d3.min(stock.values, function(d) { return d.price; });
            }),
            d3.max(stocks, function(stock) {
                return d3.max(stock.values, function(d) { return d.price; });
            })
        ])
        .range([height, 0]);

    // x axis
    canvas.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x));

    // y axis
    canvas.append('g')
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y));

    var line = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.price); });

    var stockLines = canvas.selectAll('.stock-line')
        .data(stocks)
        .enter()
        .append('g')
        .attr('class', 'stock-line')
        .on('mouseover', function(d) { console.log(d.tickerSymbol); });

    stockLines.append('path')
        .attr('d', function(d) { return line(d.values);});
});
