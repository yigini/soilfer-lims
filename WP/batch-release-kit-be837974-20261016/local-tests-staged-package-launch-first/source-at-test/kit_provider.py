"""Bounded, fresh GitHub primary records; no posting, token, shell or cache.

Every response is retained by CommandRunner before JSON predicates. Network
errors and a full last page refuse authority rather than imply absence. This
component is constructed only by the separately reviewed runtime/freezer.
"""
import datetime
import re
import time
from kit_contract import ACCEPTANCE_ID,TIMING_DIRECTION_ID,require
from retained_contract import exact_json
from retained_authority import (MAIN_CI,AUDITS,RULE_AUTHORITY_PINS,POST_REBOOT_PINS,
    STEP2_DIRECTION_PINS,ATTEMPT_AUTHORITY_PINS)

PREFIX='https://api.github.com/repos/yigini/soilfer-lims/'
MAX_PAGES=32
MAX_RESPONSE=16*1024**2
AUTHORITY_IDS=frozenset({ACCEPTANCE_ID,TIMING_DIRECTION_ID,6202252017,6203416404,6204518776,
    6206990387,*[row[1] for row in AUDITS],*map(int,RULE_AUTHORITY_PINS),
    *map(int,POST_REBOOT_PINS),*map(int,STEP2_DIRECTION_PINS),*map(int,ATTEMPT_AUTHORITY_PINS)})


def timestamp(value):
    require(isinstance(value,str) and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ',value),
        'Exact GitHub UTC timestamp required')
    return datetime.datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()


class GitHubProvider:
    def __init__(self,runner,namespace,clock=time.monotonic):
        require(re.fullmatch('[a-z][a-z0-9-]{0,35}',namespace),'Exclusive authority namespace required')
        self.runner=runner;self.namespace=namespace;self.clock=clock;self.sequence=0;self.calls=0;self.deadline=None

    def get(self,path):
        allowed=(path=='git/ref/heads/main' or path=='issues/191' or
            path=='actions/runs/'+str(MAIN_CI) or
            re.fullmatch(r'pulls/(295|296|297|298)',path) or
            re.fullmatch(r'issues/comments/[1-9][0-9]{8,11}',path) or
            re.fullmatch(r'issues/(162|295|296|297|298)/comments\?per_page=100&page=[1-9][0-9]?&since=\d{4}-\d\d-\d\dT\d\d%3A\d\d%3A\d\dZ',path))
        require(bool(allowed) and '..' not in path and '\\' not in path,'Unreviewed GitHub endpoint refused')
        self.calls+=1;require(self.calls<=256,'Bounded complete authority request inventory exceeded')
        timeout=15 if self.deadline is None else min(15,int(self.deadline-self.clock()))
        require(timeout>=1,'Authority collection deadline reached before network dispatch')
        label=self.namespace+'-github-'+str(self.calls).zfill(4)
        raw,err,_=self.runner.run(['curl','--silent','--show-error','--fail','--proto','=https',
            '--tlsv1.2','--connect-timeout','5','--max-time',str(timeout),'--max-filesize',str(MAX_RESPONSE),
            '--header','Accept: application/vnd.github+json','--header','X-GitHub-Api-Version: 2022-11-28',
            '--header','Cache-Control: no-cache',PREFIX+path],label,timeout)
        require(not err and 0<len(raw)<=MAX_RESPONSE,'Incomplete or oversized GitHub primary record')
        value=exact_json(raw)
        require(isinstance(value,(dict,list)),'GitHub response is not a primary object/list')
        return value

    def comment(self,identity):
        require(type(identity) is int and (identity in AUTHORITY_IDS or TIMING_DIRECTION_ID<identity<10**12),
            'Exact reviewed release comment ID required')
        value=self.get('issues/comments/'+str(identity))
        require(isinstance(value,dict) and value.get('id')==identity,'Returned GitHub comment identity differs')
        return value

    def comments_since(self,issue,since):
        require(issue in (162,295,296,297,298),'Unreviewed comment thread refused');timestamp(since)
        rows=[];seen=set();last=None
        for page in range(1,MAX_PAGES+1):
            value=self.get('issues/'+str(issue)+'/comments?per_page=100&page='+str(page)+
                '&since='+since.replace(':','%3A'))
            require(isinstance(value,list) and len(value)<=100,'Malformed complete GitHub comment page')
            for row in value:
                require(isinstance(row,dict) and type(row.get('id')) is int and row['id'] not in seen,
                    'Duplicate/malformed paged authority comment')
                require(row.get('issue_url')==PREFIX+'issues/'+str(issue),'Comment pagination crossed issue boundary')
                created=timestamp(row.get('created_at'));updated=timestamp(row.get('updated_at'))
                require(updated>=created and updated>=timestamp(since),'Comment timestamp outside requested interval')
                require(last is None or created>=last,'Comment pagination is unordered or changed while reading')
                require(isinstance(row.get('body'),str),'Comment body omitted')
                seen.add(row['id']);rows.append(row);last=created
            if len(value)<100:return rows
        raise RuntimeError('Full final GitHub page is not complete absence evidence')

    def snapshot(self,source_id,kit_id,human_id):
        require(len({source_id,kit_id,human_id})==3,'Three distinct current review/human records required')
        return self._snapshot(source_id,kit_id,human_id)

    def source_snapshot(self,source_id):
        """Fresh standing authority before capture/package; no invented kit/human."""
        return self._snapshot(source_id)

    def _snapshot(self,source_id,kit_id=None,human_id=None):
        began=self.clock();self.deadline=began+300;self.sequence+=1
        # Memoization is deliberately confined to this one fresh snapshot.
        records={}
        def comment(identity):
            if identity not in records:records[identity]=self.comment(identity)
            return records[identity]
        source=comment(source_id)
        out={'source':source,
            'main':self.get('git/ref/heads/main'),'ci':self.get('actions/runs/'+str(MAIN_CI)),
            'issue191':self.get('issues/191'),'prs':{},'verdicts':{},'comments':{}}
        if kit_id is not None:out.update(kit=comment(kit_id),human=comment(human_id))
        for pr,identity,head,merge in AUDITS:
            key=str(pr);verdict=comment(identity);out['verdicts'][key]=verdict
            out['prs'][key]=self.get('pulls/'+key)
            out['comments'][key]=self.comments_since(pr,verdict['created_at'])
        out['rules']={i:comment(int(i)) for i in RULE_AUTHORITY_PINS}
        out['r2Accepted']=comment(6202252017)
        out['postRebootAuthorities']={i:comment(int(i)) for i in POST_REBOOT_PINS}
        out['memoryDirection']=comment(6203416404);out['jobsScope']=comment(6204518776)
        out['diagnosticAccepted']=comment(6206990387)
        out['step2Authorities']={i:comment(int(i)) for i in STEP2_DIRECTION_PINS}
        out['attemptAuthorities']={i:comment(int(i)) for i in ATTEMPT_AUTHORITY_PINS}
        out['acceptance']=comment(ACCEPTANCE_ID);out['timingDirection']=comment(TIMING_DIRECTION_ID)
        out['releaseComments']=self.comments_since(162,source['created_at'])
        # A second main read closes the most significant cross-request race.
        require(self.get('git/ref/heads/main')==out['main'],'Main changed during authority collection')
        require(self.clock()-began<=300,'Complete fresh authority collection deadline exceeded')
        out['collectionSeconds']=self.clock()-began;out['collectionNumber']=self.sequence
        return out

    def gate_refresh(self,source,kit,human):
        began=self.clock();self.deadline=began+60
        out={'main':self.get('git/ref/heads/main'),
            'source':self.comment(source['id']),'kit':self.comment(kit['id']),
            'human':self.comment(human['id']),
            'releaseComments':self.comments_since(162,source['created_at'])}
        require(self.clock()-began<=60,'Immediate gate refresh deadline exceeded')
        return out
