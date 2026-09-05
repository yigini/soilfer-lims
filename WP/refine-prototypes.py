from pathlib import Path
p=Path(__file__).parent/'technician-workbench-concept.html'
s=p.read_text(encoding='utf-8')
s=s.replace("function validation(r){", "function validation(r){if(r.stage==='completed')return {tone:'good',label:'Task completed',why:'Preparation recorded; downstream readiness recalculated',eligible:false};")
s=s.replace("r.sync='saved';summary();refreshRow(r);", "r.sync='saved';summary();refreshRow(r);if(state.view==='review'&&state.reviewMode==='record'){state.confirmation=false;render();}")
s=s.replace("r.stage=submitting?'submitted':'recorded';", "r.stage=submitting?'submitted':r.method==='prep'?'completed':'recorded';")
s=s.replace("row(el.dataset.select).selected=el.checked;", "row(el.dataset.select).selected=el.checked;const count=screen.querySelector('[data-selection-count]');if(count)count.textContent=filtered().filter(r=>r.selected&&r.stage==='draft').length+' selected';")
s=s.replace("'<div class=\"wb-footer\"><span class=\"wb-small\">'", "'<div class=\"wb-footer\"><span class=\"wb-small\">'")
s=s.replace("<span class=\"wb-small\">'+rs.filter(r=>r.selected&&r.stage==='draft').length+' selected · Enter moves", "<span class=\"wb-small\"><span data-selection-count>'+rs.filter(r=>r.selected&&r.stage==='draft').length+' selected</span> · Enter moves")
s=s.replace("const list=screen.querySelector('[data-paste-preview-list]');", "const counts={};state.pasteRows.forEach(p=>counts[p.id]=(counts[p.id]||0)+1);state.pasteRows.forEach(p=>{if(counts[p.id]>1)p.error='Duplicate ID in pasted data';});const list=screen.querySelector('[data-paste-preview-list]');")
p.write_text(s,encoding='utf-8')
