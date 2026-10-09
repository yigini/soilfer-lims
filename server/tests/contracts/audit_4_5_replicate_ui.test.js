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

test.each(['WorksheetArea','SingleSampleEditor'])('%s uses the pair editor only for required-count2, and keeps count1 on the original scalar editor',async name=>{
    const row=item({sampleReplicates:{requiredCount:2,status:'FAIL',source:'CURRENT',countSource:'CURRENT',measurements:[],canAppend:true}});
    const activeGroup={analysis:'OWNED-NUMERIC',unit:'mg/kg',items:[row]},onDraftChange=jest.fn();
    const host=mountUi(`components/workbench/${name}.jsx`,{activeGroup,items:[row],onDraftChange,onIndexChange:jest.fn(),currentIndex:0});
    await host.render();
    const pair=host.all().find(node=>node.props?.item===row&&node.props?.onDraftChange===onDraftChange);
    expect(pair).toBeDefined();expect(pair.props.disabled).toBe(false);
    expect(onDraftChange).not.toHaveBeenCalled();
    row.sampleReplicates={...row.sampleReplicates,requiredCount:1,status:'NOT_REQUIRED',canAppend:false};
    row.status='IN_PROGRESS';await host.render();
    expect(host.all().some(node=>node.props?.item===row&&node.props?.onDraftChange===onDraftChange)).toBe(false);
    expect(host.all().some(node=>node.props?.ariaLabel==='Owned sample determination')).toBe(true);
});

test('equal replica2 becomes ready independently of replica1, while a retained cell stays immutable', async()=>{
    const row=item({currentResult:'10.0',draft:{replicateNo:2,value:'10.0'},sampleReplicates:{requiredCount:2,
        status:'PENDING',measurements:[{replicateNo:1,rawInput:'10.0'}],canAppend:true}}),record=jest.fn();
    const host=mountUi('components/workbench/WorksheetArea.jsx',{activeGroup:{analysis:'OWNED-NUMERIC',items:[row]},
        onDraftChange:jest.fn(),onReviewRecord:record});
    await host.render();host.find('record-all-ready').props.onClick();expect(record).toHaveBeenCalledWith(['owned-work']);
    row.draft.replicateNo=1;await host.render();expect(host.find('record-all-ready').props['aria-disabled']).toBe(true);
});

test('replicate Escape uses the existing client-only restore with the exact replica number',async()=>{
    const restore=jest.fn(),options={...props(item({draft:{replicateNo:2,value:'12.0'},sampleReplicates:{requiredCount:2,
        status:'PENDING',measurements:[{replicateNo:1,value:'10'}]}})),onRevertDraft:restore};
    const host=mountUi('components/workbench/SampleReplicateEntry.jsx',options);await host.render();
    expect(editors(host)[0].props.worksheetColumn).toBe('replicate-2');
    editors(host)[0].props.onRevertValue('11.0');expect(restore).toHaveBeenCalledWith('owned-work','11.0',{replicateNo:2});
    expect(options.onDraftChange).not.toHaveBeenCalled();expect(host.axios.post).not.toHaveBeenCalled();
});

test('actual DOM keyboard movement keeps replica2 across rows with different retained cells',()=>{
    const {JSDOM}=require('jsdom'),vm=require('node:vm'),esbuild=require('../../../client/node_modules/esbuild');
    const moduleObject={exports:{}};
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname,
        '../../../client/src/components/workbench/qcWorksheetNavigation.js'),'utf8'),{format:'cjs'}).code,
        {module:moduleObject,exports:moduleObject.exports});
    const dom=new JSDOM('<table><tr><td><output>10</output><input id="a2" data-worksheet-column="replicate-2"></td></tr>'+
        '<tr><td><input id="b1" data-worksheet-column="replicate-1"><input id="b2" data-worksheet-column="replicate-2" disabled></td></tr>'+
        '<tr><td><input id="c1" data-worksheet-column="replicate-1"><input id="c2" data-worksheet-column="replicate-2"></td></tr></table><button id="record">Record</button>');
    try{const doc=dom.window.document,move=(id,key)=>{const target=doc.getElementById(id);target.focus();
        moduleObject.exports.advanceWorksheetCell({target,currentTarget:doc.querySelector('table'),key,
            preventDefault:jest.fn(),stopPropagation:jest.fn()},doc.getElementById('record'));return doc.activeElement.id;};
        expect(move('a2','Enter')).toBe('c2');expect(move('c2','ArrowUp')).toBe('a2');
        expect(move('c2','Enter')).toBe('record');expect(move('a2','Tab')).toBe('b1');
    }finally{dom.window.close();}
});
