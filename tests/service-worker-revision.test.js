import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

test('a controlled page cannot load a network module from a different asset revision',async()=>{
  const root='https://example.test/s/apps/web/';
  const handlers=new Map();
  const stored=readFileSync(new URL('../apps/web/app.js',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../apps/web/sw.js',import.meta.url),'utf8');
  const fetch=async()=>new Response('/* a different deployment */');
  let written=false;
  runInNewContext(worker,{
    URL,crypto:webcrypto,Uint8Array,fetch,Response,
    self:{registration:{scope:root},location:{href:new URL('sw.js',root).href},addEventListener:(name,action)=>handlers.set(name,action)},
    caches:{match:async()=>new Response(stored),open:async()=>({put:()=>{written=true}})}
  });
  let response;
  const pending=[];
  handlers.get('fetch')({
    request:{method:'GET',url:new URL('app.js',root).href,mode:'cors'},
    respondWith:value=>{response=value},waitUntil:value=>pending.push(value)
  });
  assert.equal(await(await response).text(),stored);
  await Promise.all(pending);
  assert.equal(written,false);
});

