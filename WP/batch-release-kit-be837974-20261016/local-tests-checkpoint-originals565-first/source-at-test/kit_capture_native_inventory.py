"""Conditional complete MAIN B-tree write count for two restricted PRE profiles.

Input is a DECLARED full sqlite_schema observation, including sqlite_ names and
null-SQL autoindexes. Existing filtered logical-state objects are insufficient.
This pure function never opens a target or verifies the collector's observation.
No capture/release owner uses this inventory yet.
"""
import json
import pathlib
import re
from kit_contract import canonical,require,sha

PROOF_NAME='capture-native-inventory-source.json'
RECEIPT_SQL='CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'
RECEIPT_INDEX='sqlite_autoindex__schema_migrations_1'


def normalized(sql):
    # Whitespace outside quoted identifiers/literals only. Never lowercase,
    # strip string content, accept comments, or approximate SQL semantics.
    tokens=re.findall(r"'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|\s+|[^\s'\"]+",sql)
    return ''.join(t for t in tokens if not t.isspace()).removesuffix(';')


def declared_schema(value):
    require(type(value) is dict and set(value)=={'version','scope','encoding','rows'} and
        type(value['version']) is int and value['version']==1 and
        value['scope']=='DECLARED_COMPLETE_SQLITE_SCHEMA' and
        type(value['encoding']) is int and value['encoding']==1 and
        type(value['rows']) is list and 1<=len(value['rows'])<=100000,
        'A complete declared UTF-8 schema, including internal names and autoindexes, is required')
    names=set();roots=set()
    for row in value['rows']:
        require(type(row) is list and len(row)==5,'Full type/name/table/rootpage/sql schema rows required')
        kind,name,table,root,sql=row
        require(kind in ('table','index','trigger','view') and
            all(type(x) is str and 0<len(x.encode('utf-8'))<=1024 and '\0' not in x for x in (name,table)) and
            type(root) is int and 0<=root<=4294967294 and
            (sql is None or type(sql) is str and 0<len(sql.encode('utf-8'))<=1000000 and '\0' not in sql),
            'Malformed or oversized complete schema row')
        require(name.casefold() not in names,'Duplicate schema object name');names.add(name.casefold())
        if root:
            require(root not in roots,'Aliased schema root page');roots.add(root)
        require((kind in ('table','index'))==(root>0),'Ordinary persistent B-tree root profile required')
        require(sql is not None or kind=='index' and name.startswith('sqlite_autoindex_'),
            'Only an implicit index may have null SQL')
        if kind=='table':
            require(re.match(r'^CREATE\s+TABLE\b',sql,re.I) is not None,
                'Virtual tables and their module side effects are outside this profile')
    return value


def capture_native_inventory(label,schema):
    declared_schema(schema)
    raw=pathlib.Path(__file__).with_name(PROOF_NAME).read_bytes();proof=json.loads(raw)
    require(proof.get('scope')=='CONDITIONAL_CAPTURE_PRE_SCHEMA_NATIVE_WRITES' and
        proof.get('collectorBindingImplemented') is False and
        proof.get('writerGraphAdmissionImplemented') is False and
        proof.get('physicalFilesystemClosureClaimed') is False,
        'Exact conditional capture native source proof required')
    require(label in proof['profiles'],'Only the two explicit PRE capture profiles are supported')
    profile=proof['profiles'][label];rows=schema['rows']
    receipt=[r for r in rows if r[2].casefold()=='_schema_migrations']
    require(len(receipt)==2,'Extra or missing receipt indexes/triggers/objects refuse this profile')
    table=next((r for r in receipt if r[0]=='table' and r[1]=='_schema_migrations'),None)
    index=next((r for r in receipt if r[0]=='index' and r[1]==RECEIPT_INDEX),None)
    require(table is not None and normalized(table[4])==normalized(RECEIPT_SQL) and
        index is not None and index[4] is None,
        'Exact ordinary receipt table, default, primary-key autoindex and no extra writes required')
    require(not any(r[2].casefold() in ('sqlite_schema','sqlite_master') for r in rows),
        'No schema-table trigger or custom index profile is supported')
    new_names={o['name'].casefold() for o in profile['objects']}
    require(not new_names.intersection(r[1].casefold() for r in rows),
        'Only fully absent PRE objects are supported; FRESH/COMPLETE/partial shapes refuse')
    require(all(any(r[0]=='table' and r[1]==name for r in rows) for name in profile['existingTriggerTables']),
        'Declared existing trigger-owner tables are required')
    # Every created application table is empty: these DDLs contain no AS SELECT,
    # INSERT, AUTOINCREMENT or generated data. Explicit indexes target only those
    # new empty tables, so their refill loops execute zero index insertions.
    categories=[];insertions=[];roots=0;deletes=0
    for obj in profile['objects']:
        kind=obj['type'];root_count=1 if kind in ('table','index') else 0
        roots+=root_count
        if kind=='table':
            insertions.append({'calls':1,'maximumPayloadBytes':6})
            deletes+=1 # conservatively charge UPDATE's possible OP_Delete too
        insertions.append({'calls':1,'maximumPayloadBytes':profile['maximumSchemaPayloadBytes']})
        categories.append({'type':kind,'name':obj['name'],'createdRoots':root_count,
            'schemaInsertCalls':2 if kind=='table' else 1,'schemaDeleteCalls':1 if kind=='table' else 0,
            'applicationDataInsertCalls':0})
    # A single ordinary receipt INSERT has one table write and one TEXT-PK
    # autoindex write. Canonical DDL excludes generated columns, extra defaults,
    # foreign keys, checks, collations, custom functions and extra unique indexes.
    # Bound the COMPLETE native record, including header and rowid in the index.
    insertions.extend([{'calls':1,'maximumPayloadBytes':profile['maximumReceiptTablePayloadBytes']},
        {'calls':1,'maximumPayloadBytes':profile['maximumReceiptIndexPayloadBytes']}])
    operations={'version':1,'scope':'DECLARED_NATIVE_NORMAL_BTREE_MUTATIONS',
        'callerReviewSha256':sha(raw),'createdRoots':roots,'normalInsertions':insertions,'deletions':deletes}
    return {'version':1,'scope':'CONDITIONAL_CAPTURE_PRE_SCHEMA_NATIVE_WRITES','label':label,
        'sourceProofSha256':sha(raw),'declaredFullSchemaSha256':sha(canonical(schema)),
        'categories':categories,'operations':operations,'receiptTableInsertCalls':1,'receiptIndexInsertCalls':1,
        'completeMainBtreeWriteCountForDeclaredSupportedProfile':True,
        'requiresIntactPinnedDatabaseAndCompleteUnfilteredSchemaObservation':True,
        'requiresBeforeCreateSourceAndCollectorBinding':True,'requiresNoPreformattedTransferOrContinuedErrorWrites':True,
        'collectorBindingImplemented':False,'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,
        'mainFileLengthOrVfsPreallocationBounded':False,'walGrowthBounded':False,
        'statementOrSqlScratchBounded':False,'physicalFilesystemClosureClaimed':False}
