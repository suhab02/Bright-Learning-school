const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
function load(path,modules){const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(id=>Object.hasOwn(modules,id)?modules[id]:require(id),m,m.exports);return m.exports;}
const helpers=load('src/lib/sms.ts',{});
assert.equal(helpers.bangladeshMobile('০১৭০০০০০০০০'),'+8801700000000');
assert.equal(helpers.bangladeshMobile('+880 1700-000000'),'+8801700000000');
assert.equal(helpers.bangladeshMobile('+441234567890'),null);
assert.equal(helpers.smsSegments('Hello'),1);
assert.equal(helpers.smsSegments('ক'.repeat(70)),1);
assert.equal(helpers.smsSegments('ক'.repeat(71)),2);
assert.equal(helpers.smsSegments('^'.repeat(81)),2);

const ctx={userId:'10000000-0000-4000-8000-000000000001',schoolId:'20000000-0000-4000-8000-000000000001',role:'admin'};
const guardianId='30000000-0000-4000-8000-000000000001';
let allowed=true,configured=true,rate=0,calls=0,reply='success';const rows=new Map();
const db={from(table){let op='select',patch=null,filters={};const chain={
 select(_fields,options){if(options?.head)op='count';return chain;},eq(key,value){filters[key]=value;return chain;},gte(){return chain;},
 maybeSingle(){return Promise.resolve({data:table==='guardians'?{id:guardianId,phone:'০১৭০০০০০০০০'}:rows.get(filters.id)||null,error:null});},
 insert(row){if(rows.has(row.id))return Promise.resolve({error:{code:'23505'}});rows.set(row.id,{...row});return Promise.resolve({error:null});},
 update(value){op='update';patch=value;return chain;},
 then(resolve,reject){if(op==='update'){const row=rows.get(filters.id);if(row)Object.assign(row,patch);}return Promise.resolve(op==='count'?{count:rate,error:null}:{error:null}).then(resolve,reject);}
 };return chain;}};
global.fetch=async(_url,options)=>{calls++;const payload=JSON.parse(options.body);assert.deepEqual(payload.recipients,['+8801700000000']);assert.equal(options.headers['x-api-key'],'mock-private-key');if(reply==='timeout')throw Error('timeout');if(reply==='reject')return {status:401,ok:false};return {status:200,ok:true,json:async()=>({data:{success:true,smsBatchId:'abcdef123456abcdef123456'}})};};
const {sendGuardianSms}=load('src/lib/send-guardian-sms.ts',{
 '@/lib/auth':{requireContext:async()=>ctx,can:()=>allowed},'@/lib/supabase/server':{supabaseServer:async()=>db},
 '@/lib/sms':helpers,'@/lib/sms-config':{schoolSmsConfig:()=>configured?{apiKey:'mock-private-key',deviceId:'abcdef123456abcdef123456'}:null},
});
const input=id=>({guardianId,message:'স্কুলের একটি আপডেট',requestId:`40000000-0000-4000-8000-${String(id).padStart(12,'0')}`});
(async()=>{
 allowed=false;assert.equal((await sendGuardianSms(input(1))).status,'failed');assert.equal(calls,0);
 allowed=true;configured=false;assert.equal((await sendGuardianSms(input(1))).status,'failed');assert.equal(calls,0);
 configured=true;assert.equal((await sendGuardianSms({...input(1),message:'[student]'})).status,'failed');assert.equal(calls,0);
 const first=await sendGuardianSms(input(1));assert.equal(first.status,'queued');assert.equal(calls,1);assert.equal(rows.get(input(1).requestId).status,'queued');
 assert.equal((await sendGuardianSms(input(1))).status,'queued');assert.equal(calls,1,'Repeated request must not send twice');
 reply='timeout';assert.equal((await sendGuardianSms(input(2))).status,'unknown');assert.equal(calls,2);
 assert.equal((await sendGuardianSms(input(2))).status,'unknown');assert.equal(calls,2,'Unknown outcome must not be retried');
 reply='reject';assert.equal((await sendGuardianSms(input(3))).status,'failed');assert.equal(calls,3);
 rate=1;assert.equal((await sendGuardianSms(input(4))).status,'failed');assert.equal(calls,3,'Rate-limited send must not contact provider');
 console.log('SMS checks passed: Bangla numbers/segments, permissions, missing setup, placeholders, queue status, duplicate suppression, timeouts, provider rejection and rate limit. No real SMS sent.');
})().catch(error=>{console.error(error);process.exitCode=1;});
