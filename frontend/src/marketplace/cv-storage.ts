// CV files stay in this browser. The demo store keeps library metadata in localStorage.
function openDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('talentiq-cv-files',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function fileTransaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('files',mode);
    const request=run(transaction.objectStore('files'));
    transaction.oncomplete=()=>{db.close();resolve(request.result);};
    transaction.onabort=()=>{db.close();reject(transaction.error);};
    transaction.onerror=()=>{db.close();reject(transaction.error);};
  });
}
export const saveCVFile=(id:string,file:File)=>fileTransaction('readwrite',store=>store.put(file,id));
export const readCVFile=(id:string)=>fileTransaction<Blob|undefined>('readonly',store=>store.get(id));
export const deleteCVFile=(id:string)=>fileTransaction('readwrite',store=>store.delete(id));
