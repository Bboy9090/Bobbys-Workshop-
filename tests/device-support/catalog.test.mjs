import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonical, catalogDigest, validateCatalog, verifyCatalogEnvelope } from '../../scripts/device-support/catalog-lib.mjs';

const catalog=JSON.parse(await readFile('resources/device-support/catalog.json','utf8'));
assert.deepEqual(validateCatalog(catalog),[]);
assert.match(catalogDigest(catalog),/^[a-f0-9]{64}$/);
for(const entry of catalog.entries){ assert.equal(entry.executionAuthorized,false); assert.equal(entry.physicalQualificationRequiredForWrites,true); }

const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
const signature=sign('sha256',Buffer.from(canonical(catalog)),privateKey).toString('base64');
const envelope={schema:'com.bobbyblanco.bobfwtools.signed-device-support-catalog.v1',catalog,catalogSha256:catalogDigest(catalog),signature:{provider:'test-key',value:signature}};
const verified=verifyCatalogEnvelope(envelope,publicKey.export({type:'spki',format:'pem'}));
assert.equal(verified.executionAuthorized,false);

const tampered=structuredClone(envelope); tampered.catalog.entries[0].models=['SM-T501'];
assert.throws(()=>verifyCatalogEnvelope(tampered,publicKey.export({type:'spki',format:'pem'})),/digest mismatch/);

const unsafe=structuredClone(catalog); unsafe.entries[0].executionAuthorized=true;
assert.ok(validateCatalog(unsafe).some(x=>x.includes('execution authority')));
console.log('device support catalog contract passed');
