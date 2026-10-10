const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const React=require('../../../client/node_modules/react'),ReactDOMServer=require('../../../client/node_modules/react-dom/server');
const esbuild=require('../../../client/node_modules/esbuild'),PDFDocument=require('pdfkit');
const {generateReportPdfBuffer}=require('../../services/pdfGenerator');
const mod={exports:{}};
vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname,'../../../client/src/components/report/ReportContent.jsx'),'utf8'),
 {loader:'jsx',format:'cjs'}).code,{module:mod,exports:mod.exports,require:name=>name==='react'?React:{},console});
const ReportContent=mod.exports.default;

test.each(['en','es','es-419','fr','pt'])('%s retained content re-renders the full withdrawal UUID in both HTML and every PDF page',async locale=>{
 const amendmentId='cbddf04f-4107-44a1-b0c1-ab06bfd571bc';
 const labels=require('../../locales/'+locale+'.json').resultReports,client=require('../../../client/src/translations/'+locale+'.json').resultReports;
 expect(client.withdrawnPendingAmendment).toBe(labels.withdrawnPendingAmendment);expect(labels.filterWithdrawn).toBeTruthy();
 const banner=labels.withdrawnPendingAmendment.replace('{{amendmentId}}',amendmentId);
 const data={sample:{id:'retained-sample'},client:{},lab:{},generated:{},resultGroups:[],meta:{locale},retained:'é精确'};
 const before=JSON.stringify(data),publication={status:'WITHDRAWN',withdrawal:{amendmentId}};
 const html=ReactDOMServer.renderToStaticMarkup(React.createElement(ReportContent,{data,publication,withdrawalBanner:banner}));
 expect(html).toContain('data-testid="report-withdrawal-banner"');expect(html).toContain(banner);
 const text=jest.spyOn(PDFDocument.prototype,'text');
 try{
  const pdf=await generateReportPdfBuffer(data,publication);expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  // Header plus every numbered page footer carries the same complete UUID.
  const banners=text.mock.calls.filter(([value])=>value===banner),pages=text.mock.calls.filter(([value])=>/^Page \d+ of \d+$/.test(value));
  expect(pages.length).toBeGreaterThan(0);expect(banners).toHaveLength(pages.length+1);
 }finally{text.mockRestore();}
 expect(JSON.stringify(data)).toBe(before);
});
