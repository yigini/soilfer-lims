const fs=require('node:fs'),path=require('node:path');
const { mountUi }=require('../helpers/qcWorksheetUi');
const item=(patch={})=>({workItemId:'owned-work',sampleId:'owned-sample',sampleDisplayId:'Owned sample',
    status:'COMPLETED',numberFormat:{decimal:',',thousands:null},readiness:{isReady:true},
    sampleReplicates:{requiredCount:2,source:'FROZEN',countSource:'CURRENT',status:'PENDING',measurements:[],canAppend:true,canAddThird:false},...patch});
const props=(row)=>({item:row,disabled:false,unit:'mg/kg',onDraftChange:jest.fn(),onEnterNext:jest.fn()});
const editors=host=>host.all().filter(node=>node.props?.ariaLabel && node.props?.onChange);
test('the grid shows two columns and keeps one durable draft/recording step at a time',async()=>{
    const options=props(item()),host=mountUi('components/workbench/SampleReplicateEntry.jsx',options);
    await host.render();
    const cells=editors(host);expect(cells).toHaveLength(2);
    expect(cells.map(cell=>cell.props.disabled)).toEqual([false,true]);
    cells[0].props.onChange('10,0');
    expect(options.onDraftChange).toHaveBeenCalledWith('owned-work','10,0',{replicateNo:1});
    expect(host.text()).toContain('replicateGrid.recordInOrder');
});
test('a retained first cell is immutable and the second cell sends replica2 through the existing draft callback',async()=>{
    const options=props(item({draft:{replicateNo:2,value:'12,0'},sampleReplicates:{requiredCount:2,status:'PENDING',
        measurements:[{replicateNo:1,rawInput:'10,0',value:'10'}],source:'FROZEN',countSource:'FROZEN',canAppend:true}}));
    const host=mountUi('components/workbench/SampleReplicateEntry.jsx',options);await host.render();
    expect(host.all().filter(node=>node.type==='output').map(node=>node.props['data-replicate'])).toEqual([1]);
    expect(editors(host)).toHaveLength(1);
    expect(editors(host)[0].props).toMatchObject({value:'12,0',disabled:false});
    editors(host)[0].props.onChange('12,1');
    expect(options.onDraftChange).toHaveBeenCalledWith('owned-work','12,1',{replicateNo:2});
});
test('the third action reveals only an empty third cell, never selecting the displayed mean',async()=>{
    const options=props(item({sampleReplicates:{requiredCount:2,status:'FAIL',source:'FROZEN',countSource:'FROZEN',mean:11,rpd:18.18,
        measurements:[{replicateNo:1,value:'10'},{replicateNo:2,value:'12'}],canAppend:true,canAddThird:true}}));
    const host=mountUi('components/workbench/SampleReplicateEntry.jsx',options);await host.render();
    expect(editors(host)).toHaveLength(0);
    const action=host.all().find(node=>node.type==='button');action.props.onClick();await host.render();
    expect(editors(host)).toHaveLength(1);
    expect(editors(host)[0].props).toMatchObject({value:'',disabled:false});
    expect(options.onDraftChange).not.toHaveBeenCalled();
    expect(host.text()).toContain('18,18');
    editors(host)[0].props.onChange('11,0');
    expect(options.onDraftChange).toHaveBeenCalledWith('owned-work','11,0',{replicateNo:3});
});
test.each(['PASS','NOT_EVALUABLE','REVIEW_REQUIRED'])('%s shows no new third action or mean selection control',async status=>{
    const host=mountUi('components/workbench/SampleReplicateEntry.jsx',props(item({sampleReplicates:{requiredCount:2,status,
        measurements:[{replicateNo:1,value:'10'},{replicateNo:2,value:'12'}],canAddThird:false,range:2}})));
    await host.render();expect(host.all().filter(node=>node.type==='button')).toHaveLength(0);
    expect(editors(host)).toHaveLength(0);
    expect(host.text()).toContain('replicateGrid.selectionHint');
});
test('all five client and server locales share every new label, source, verdict, reason and stable refusal',()=>{
    const root=path.resolve(__dirname,'../../..');
    function keys(value,prefix=''){return Object.entries(value).flatMap(([key,item])=>typeof item==='object'?keys(item,prefix+key+'.'):[prefix+key]);}
    const expected=keys(JSON.parse(fs.readFileSync(path.join(root,'client/src/translations/en.json'),'utf8')).replicateGrid).sort();
    for(const dir of ['client/src/translations','server/locales'])for(const locale of ['en','es','es-419','fr','pt']){
        const messages=JSON.parse(fs.readFileSync(path.join(root,dir,locale+'.json'),'utf8')).replicateGrid;
        expect(keys(messages).sort()).toEqual(expected);
        expect(Object.values(messages.errors).every(value=>typeof value==='string'&&value.trim())).toBe(true);
    }
});
