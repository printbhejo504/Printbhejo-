const DB_NAME = "PrintBhejoDB";
const DB_VERSION = 2;
const STORE = "files";
const BATCH_STORE = "batches";
const batchExpiries = new Map();

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:"id"});store.createIndex("expiresAt","expiresAt");store.createIndex("sessionId","sessionId");store.createIndex("batchId","batchId");store.createIndex("ownerUserId","ownerUserId");}else{const store=req.transaction.objectStore(STORE);if(!store.indexNames.contains("batchId"))store.createIndex("batchId","batchId");if(!store.indexNames.contains("ownerUserId"))store.createIndex("ownerUserId","ownerUserId");}if(!db.objectStoreNames.contains(BATCH_STORE)){const batches=db.createObjectStore(BATCH_STORE,{keyPath:"id"});batches.createIndex("ownerUserId","ownerUserId");batches.createIndex("createdAt","createdAt");batches.createIndex("expiresAt","expiresAt");}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}

export async function saveBatch(batch){const normalized={...batch,createdAt:batch.createdAt||Date.now()};const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(BATCH_STORE,"readwrite");tx.objectStore(BATCH_STORE).put(normalized);tx.oncomplete=()=>{db.close();resolve(normalized);};tx.onerror=()=>{db.close();reject(tx.error);};});}

export async function getBatches(ownerUserId="anonymous"){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(BATCH_STORE,"readonly");const index=tx.objectStore(BATCH_STORE).index("ownerUserId");const req=index.getAll(IDBKeyRange.only(ownerUserId));req.onsuccess=()=>{db.close();resolve((req.result||[]).sort((a,b)=>b.createdAt-a.createdAt));};req.onerror=()=>{db.close();reject(req.error);};});}

export async function getNextBatchNumber(ownerUserId="anonymous"){const batches=await getBatches(ownerUserId);if(!batches.length)return 1;const active=batches.filter(b=>!b.expiresAt||b.expiresAt>Date.now());if(!active.length)return 1;return Math.max(0,...active.map(b=>Number(b.batchNumber)||0))+1;}

export async function removeBatch(batchId){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction([STORE,BATCH_STORE],"readwrite");tx.objectStore(BATCH_STORE).delete(batchId);const files=tx.objectStore(STORE).index("batchId");const req=files.openKeyCursor(IDBKeyRange.only(batchId));req.onsuccess=()=>{const cursor=req.result;if(cursor){tx.objectStore(STORE).delete(cursor.primaryKey);cursor.continue();}};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}

export async function saveFile(record){
  const normalized={...record};
  if(!normalized.batchId&&typeof normalized.id==="string"&&normalized.id.includes(":")) normalized.batchId=normalized.id.split(":")[0];
  normalized.ownerUserId=normalized.ownerUserId||"anonymous";
  if(normalized.batchId){let expiry=batchExpiries.get(normalized.batchId);if(!expiry||expiry<=Date.now()){expiry=Date.now()+10*60*1000;batchExpiries.set(normalized.batchId,expiry);}normalized.expiresAt=expiry;}
  const db=await openDB();
  return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(normalized);tx.oncomplete=()=>{db.close();resolve(normalized);};tx.onerror=()=>{db.close();reject(tx.error);};});
}

export async function getFile(id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly");const req=tx.objectStore(STORE).get(id);req.onsuccess=()=>{db.close();resolve(req.result||null);};req.onerror=()=>{db.close();reject(req.error);};});}
export async function listFiles(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly");const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>{db.close();resolve(req.result||[]);};req.onerror=()=>{db.close();reject(req.error);};});}
export async function deleteFile(id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
export async function clearFiles(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction([STORE,BATCH_STORE],"readwrite");tx.objectStore(STORE).clear();tx.objectStore(BATCH_STORE).clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
export async function deleteExpiredFiles(now=Date.now()){const files=await listFiles();const expired=files.filter(f=>f.expiresAt<=now);for(const file of expired)await deleteFile(file.id);const batches=await getBatches();for(const batch of batches)if(batch.expiresAt&&batch.expiresAt<=now)await removeBatch(batch.id);return expired.length;}
export async function requestPersistentStorage(){try{if(navigator.storage?.persist)return await navigator.storage.persist();}catch{}return false;}