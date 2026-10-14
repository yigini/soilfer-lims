// Retained entry point; #209 owns both edit routes in one transaction service.
module.exports = { reviseAnalyses: require('./orderService').reviseAnalyses };
