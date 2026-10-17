"""Repeatable READ-ONLY local heartbeat guard; never edits a timer or posts.

Unlike consumed once-publishers, this guard is intentionally run at the start
of each heartbeat. It prints metadata only, never the prompt or private history.
"""
import hashlib
import json
import pathlib
import sys
import tomllib

ID='coordinate-lims-release-with-claudio'
THREAD='01a10475-07f1-7521-9e0d-3bb89daca083'
LIMIT=20000


def inspect(raw):
    value=tomllib.loads(raw.decode('utf-8'));prompt=value.get('prompt')
    if type(prompt) is not str:raise ValueError('Prompt field is not text')
    characters=len(prompt);units=len(prompt.encode('utf-16-le'))//2
    identity=value.get('id')==ID and value.get('kind')=='heartbeat' and value.get('target_thread_id')==THREAD
    active=value.get('status')=='ACTIVE' and value.get('rrule')=='FREQ=MINUTELY;INTERVAL=2'
    below=max(characters,units)<LIMIT
    return {'automationId':ID,'sameThreadAndHeartbeat':identity,'activeEveryTwoMinutes':active,
        'promptCharacters':characters,'promptUtf16CodeUnits':units,'promptUtf8Bytes':len(prompt.encode('utf-8')),
        'limitExclusive':LIMIT,'belowActiveInstructionLimit':below,
        'promptSha256':hashlib.sha256(prompt.encode('utf-8')).hexdigest(),
        'pass':identity and active and below,'actualDispatchProvedByConfiguration':False,
        'actionRequired':not(identity and active and below),'promptOrHistoryPrinted':False,
        'timersEdited':0,'messagesPosted':0,'hostCalls':0}


def main():
    path=pathlib.Path('C:/Users/yigin/.codex/automations')/ID/'automation.toml'
    try:result=inspect(path.read_bytes())
    except Exception as error:
        result={'automationId':ID,'pass':False,'actionRequired':True,'errorType':type(error).__name__,
            'promptOrHistoryPrinted':False,'timersEdited':0,'messagesPosted':0,'hostCalls':0}
    print(json.dumps(result,sort_keys=True))
    return 0 if result['pass'] else 1


if __name__=='__main__':sys.exit(main())
