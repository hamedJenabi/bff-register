const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, generateKeyPairSync } = require('node:crypto');
const { SHEET_COLUMNS, parseScheduleRows } = require('../lib/reg2026/sheet-schema');
const { writeScheduleCapacityToSheet, saveScheduleCapacity } = require('../lib/reg2026/google-sheets');
const { setAdminSession } = require('../lib/admin/session');
const { RegistrationError } = require('../lib/reg2026/errors');

const id = '1capacityTestWorkbook_012345678901234567890';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
let account = 0;
const credentials = () => ({ email: `capacity-${++account}@example.iam.gserviceaccount.com`, privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
const values = () => [SHEET_COLUMNS,
  ['partner-test','Friday','','13:30','14:45','Room A','Partner class','Teachers','Description','II','partner',20,20,'',true],
  ['solo-test','Friday','','15:15','16:30','Room B','Solo class','Teacher','Description','II','solo','','',30,true]];
const hash = (sessions) => createHash('sha256').update(JSON.stringify(sessions)).digest('hex');
const response = (data, ok = true) => ({ ok, text: async () => JSON.stringify(data) });
const metadata = { sheets: [{ properties: { title: "Teacher's Schedule", gridProperties: { rowCount:1000, columnCount:26 } } }] };
const publication = () => ({ id:1, spreadsheetId:id, sheetName:"Teacher's Schedule", sourceHash:hash(parseScheduleRows(values())), count:2, publishedAt:'2026-10-27T12:00:00Z' });
const expected = (total = 25) => parseScheduleRows(values()).map((session) => session.id === 'partner-test' ? { ...session, capacity:{ total } } : session);
const withEnv = async (updates, action) => {
  const previous = Object.fromEntries(Object.keys(updates).map((key) => [key,process.env[key]]));
  for (const [key,value] of Object.entries(updates)) value === undefined ? delete process.env[key] : process.env[key] = value;
  try { return await action(); } finally { for (const [key,value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; }
};

const google = ({ editedBeforeRead=false, failWrite=false, concurrent=false, reordered=false } = {}) => {
  const rows=values();
  if (editedBeforeRead) rows[1][6]='Unpublished title';
  if (reordered) rows.splice(1,2,rows[2],rows[1]);
  const calls=[], scopes=[];
  const fetchImpl=async(url,options) => {
    calls.push({url,options});
    if (url==='https://oauth2.googleapis.com/token') {
      const assertion=new URLSearchParams(options.body).get('assertion');
      const scope=JSON.parse(Buffer.from(assertion.split('.')[1],'base64url')).scope; scopes.push(scope);
      return response({access_token:scope.endsWith('.readonly')?'read-token':'write-token',expires_in:3600});
    }
    if (url.endsWith('/values:batchUpdate')) {
      if (failWrite) return response({error:'provider-secret'},false);
      for (const entry of JSON.parse(options.body).data) {
        const [,col,row]=entry.range.match(/!([A-Z]+)(\d+)$/);
        const column=[...col].reduce((total,char)=>total*26+char.charCodeAt(0)-64,0)-1;
        rows[Number(row)-1][column]=entry.values[0][0];
      }
      if (concurrent) rows[1][6]='Concurrent change';
      return response({totalUpdatedCells:3});
    }
    if (url.includes('/values/')) return response({values:rows});
    return response(metadata);
  };
  return {fetchImpl,calls,scopes,rows};
};

test('capacity saves update only the matched source row and use a separate write-scoped token',async()=>{
  const api=google({reordered:true});
  await writeScheduleCapacityToSheet({publication:publication(),id:'partner-test',capacity:{total:25},sessions:expected(),fetchImpl:api.fetchImpl,credentials:credentials()});
  const writes=api.calls.filter(({url})=>url.endsWith('/values:batchUpdate'));
  assert.equal(writes.length,1);
  assert.equal(writes[0].options.headers.Authorization,'Bearer write-token');
  assert.deepEqual(JSON.parse(writes[0].options.body),{valueInputOption:'RAW',data:[
    {range:"'Teacher''s Schedule'!L3",values:[['']]},
    {range:"'Teacher''s Schedule'!M3",values:[['']]},
    {range:"'Teacher''s Schedule'!N3",values:[[25]]},
  ]});
  assert.deepEqual(api.scopes,['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/spreadsheets']);
  const readCalls=api.calls.filter(({url})=>url.includes('/values/')||url.includes('?fields='));
  assert.ok(readCalls.every(({options})=>options.headers.Authorization==='Bearer read-token'));
  assert.deepEqual(parseScheduleRows(api.rows),expected());
});

test('unsynced Sheet edits never get overwritten or published by a dashboard capacity save',async()=>{
  const api=google({editedBeforeRead:true});
  await assert.rejects(writeScheduleCapacityToSheet({publication:publication(),id:'partner-test',capacity:{total:25},sessions:expected(),fetchImpl:api.fetchImpl,credentials:credentials()}),error=>error.status===409);
  assert.equal(api.calls.filter(({url})=>url.endsWith('/values:batchUpdate')).length,0);
  assert.equal(api.scopes.length,1);
});

test('write failures and concurrent Sheet changes preserve actionable errors without leaking provider responses',async()=>{
  for (const setup of [{failWrite:true},{concurrent:true}]) {
    const api=google(setup);
    await assert.rejects(writeScheduleCapacityToSheet({publication:publication(),id:'partner-test',capacity:{total:25},sessions:expected(),fetchImpl:api.fetchImpl,credentials:credentials()}),error=>{
      assert.equal(error.status,setup.failWrite?503:409);
      assert.ok(!error.message.includes('provider-secret'));
      assert.match(error.message,/published schedule was kept/);
      return true;
    });
  }
});

test('capacity save orchestration retains Google Sheets authority and rejects unconfigured source switches',async()=>withEnv({REG2026_SCHEDULE_SHEET_ID:id,REG2026_SCHEDULE_SHEET_NAME:"Teacher's Schedule"},async()=>{
  let published=publication(); const requests=[]; const writer=async()=>{};
  const store={schedulePublication:async()=>published,schedule:async()=>expected(),classInventory:async()=>({}),classRegistrantCount:async()=>0,competitionInventory:async()=>({}),competitionRegistrantCount:async()=>0,editPublishedCapacity:async(...args)=>{
    requests.push(args); published={...published,id:2}; return published;
  }};
  const saved=await saveScheduleCapacity(store,{id:'partner-test',capacity:{total:25},version:1},writer);
  assert.equal(saved.source.publication.id,2); assert.equal(saved.unchanged,false);
  assert.deepEqual(requests[0].slice(0,3),['partner-test',{total:25},1]); assert.equal(requests[0][3],writer);
  process.env.REG2026_SCHEDULE_SHEET_ID='1differentWorkbook_01234567890';
  await assert.rejects(saveScheduleCapacity(store,{id:'partner-test',capacity:{total:25},version:2},writer),error=>error.status===409);
  assert.equal(requests.length,1);
  store.schedulePublication=async()=>null;
  await assert.rejects(saveScheduleCapacity(store,{id:'partner-test',capacity:{total:25},version:0},writer),error=>error.status===409);
}));

test('capacity HTTP saves require organizer authentication, same origin and a published source',async()=>withEnv({ADMIN_USER:'capacity-organizer',ADMIN_SESSION_SECRET:'capacity-test-secret',REG2026_SCHEDULE_SHEET_ID:id,REG2026_SCHEDULE_SHEET_NAME:"Teacher's Schedule"},async()=>{
  const dbPath=require.resolve('../db/reg2026'), endpointPath=require.resolve('../pages/api/reg2026/schedule');
  const previousDb=require.cache[dbPath],previousEndpoint=require.cache[endpointPath]; let writes=0;
  const pub=publication();
  const inventory={'partner-test':{registered:4,held:1,remaining:20,followRemaining:10,roles:{}}};
  const store={schedulePublication:async()=>pub,schedule:async()=>expected(),classInventory:async()=>inventory,classRegistrantCount:async()=>3,competitionInventory:async()=>({}),competitionRegistrantCount:async()=>0,editPublishedCapacity:async(sessionId,capacity,version)=>{
    writes+=1; assert.equal(sessionId,'partner-test'); assert.deepEqual(capacity,{total:25}); assert.equal(version,1); return pub;
  }};
  const res=()=>({headers:{},code:200,setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;},end(){return this;}});
  require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{registrationStore:store}}; delete require.cache[endpointPath];
  try {
    const handler=require('../pages/api/reg2026/schedule').default;
    const body={action:'capacity',id:'partner-test',version:1,capacity:{total:25}};
    const unauth=res();await handler({method:'POST',headers:{},body},unauth);assert.equal(unauth.code,401);
    const auth=res();setAdminSession(auth);const cookie=auth.headers['Set-Cookie'].split(';')[0];
    const denied=res();await handler({method:'POST',headers:{cookie,host:'register.example.com',origin:'https://different.example.com'},body},denied);assert.equal(denied.code,403);assert.equal(writes,0);
    const counts=res();await handler({method:'GET',headers:{cookie}},counts);assert.equal(counts.code,200);assert.deepEqual(counts.body.inventory,inventory);
    assert.equal(counts.body.classRegistrantCount,3);
    store.classRegistrantCount=async()=>2;
    const success=res();await handler({method:'POST',headers:{cookie,host:'register.example.com',origin:'https://register.example.com'},body},success);assert.equal(success.code,200);assert.equal(writes,1);
    assert.deepEqual(success.body.inventory,inventory);
    assert.equal(success.body.classRegistrantCount,2);
  } finally {if(previousDb)require.cache[dbPath]=previousDb;else delete require.cache[dbPath];if(previousEndpoint)require.cache[endpointPath]=previousEndpoint;else delete require.cache[endpointPath];}
}));

test('competition capacity HTTP saves require organizer authentication and same origin, independently of Sheet editing',async()=>withEnv({ADMIN_USER:'competition-organizer',ADMIN_SESSION_SECRET:'competition-test-secret',REG2026_SCHEDULE_SHEET_ID:id},async()=>{
  const dbPath=require.resolve('../db/reg2026'),endpointPath=require.resolve('../pages/api/reg2026/schedule');
  const previousDb=require.cache[dbPath],previousEndpoint=require.cache[endpointPath];let writes=0;
  const competitionInventory={solo_battle:{total:{capacity:20,registered:4,held:1,remaining:15,version:1}}};
  const body={action:'competition-capacity',id:'solo_battle',pool:'total',capacity:'20',version:0};
  const store={schedulePublication:async()=>null,competitionInventory:async()=>competitionInventory,competitionRegistrantCount:async()=>3,editCompetitionCapacity:async(actual)=>{
    assert.deepEqual(actual,body);writes+=1;return{unchanged:false};
  }};
  const res=()=>({headers:{},code:200,setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;},end(){return this;}});
  require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{registrationStore:store}};delete require.cache[endpointPath];
  try{
    const handler=require('../pages/api/reg2026/schedule').default;
    const denied=res();await handler({method:'POST',headers:{},body},denied);assert.equal(denied.code,401);
    const auth=res();setAdminSession(auth);const cookie=auth.headers['Set-Cookie'].split(';')[0];
    const crossOrigin=res();await handler({method:'POST',headers:{cookie,host:'register.example.com',origin:'https://different.example.com'},body},crossOrigin);assert.equal(crossOrigin.code,403);assert.equal(writes,0);
    const counts=res();await handler({method:'GET',headers:{cookie}},counts);assert.equal(counts.code,200);assert.deepEqual(counts.body.competitionInventory,competitionInventory);
    assert.equal(counts.body.competitionRegistrantCount,3);
    store.competitionRegistrantCount=async()=>2;
    const saved=res();await handler({method:'POST',headers:{cookie,host:'register.example.com',origin:'https://register.example.com'},body},saved);
    assert.equal(saved.code,200);assert.equal(writes,1);assert.deepEqual(saved.body.competitionInventory,competitionInventory);assert.equal(saved.body.unchanged,false);
    assert.equal(saved.body.competitionRegistrantCount,2);
    store.editCompetitionCapacity=async()=>{throw new RegistrationError(409,'Refresh before saving.');};
    const stale=res();await handler({method:'POST',headers:{cookie,host:'register.example.com',origin:'https://register.example.com'},body},stale);assert.equal(stale.code,409);
  }finally{if(previousDb)require.cache[dbPath]=previousDb;else delete require.cache[dbPath];if(previousEndpoint)require.cache[endpointPath]=previousEndpoint;else delete require.cache[endpointPath];}
}));
