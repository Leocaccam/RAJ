import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, getDocs, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const COLLECTION = 'submittals';
const itemsRef = collection(db, COLLECTION);

/* ---------- Auth ---------- */

export function requireAuth(onReady){
  // Redirects to login.html if not signed in. Calls onReady(user) once confirmed signed in.
  // Used on add.html (the editing page) so nobody can reach it without logging in.
  onAuthStateChanged(auth, user => {
    if(!user){
      location.href = 'login.html';
      return;
    }
    onReady(user);
  });
}

export function watchAuth(callback){
  // Like requireAuth, but never redirects — just reports the current sign-in state.
  // Used on index.html (the public view) so anyone can see the log, signed in or not,
  // while the page still knows whether to show editing controls.
  return onAuthStateChanged(auth, user => callback(user));
}

export function doSignIn(email, password){
  return signInWithEmailAndPassword(auth, email, password);
}

export function doSignOut(){
  return signOut(auth).then(() => { location.href = 'login.html'; });
}

/* ---------- Data (live sync) ---------- */

export function subscribeItems(callback){
  // callback receives an array of { id, ...fields } every time data changes, on any device
  return onSnapshot(itemsRef, snapshot => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  }, err => {
    console.error('Sync error', err);
    alert('Could not sync with the database: ' + err.message);
  });
}

export async function getItemsOnce(){
  const snap = await getDocs(itemsRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getItem(id){
  const items = await getItemsOnce();
  return items.find(i => i.id === id) || null;
}

export function addItem(data){
  return addDoc(itemsRef, data);
}

export function updateItem(id, data){
  return updateDoc(doc(db, COLLECTION, id), data);
}

export function deleteItem(id){
  return deleteDoc(doc(db, COLLECTION, id));
}

/* ---------- Backup / restore ---------- */

export async function exportItems(){
  const items = await getItemsOnce();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `submittal-log-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function replaceAllItems(newItems){
  const existing = await getItemsOnce();
  const batch = writeBatch(db);
  existing.forEach(it => batch.delete(doc(db, COLLECTION, it.id)));
  newItems.forEach(it => {
    const { id, ...fields } = it;
    const ref = id ? doc(db, COLLECTION, id) : doc(itemsRef);
    batch.set(ref, fields);
  });
  await batch.commit();
}

export async function mergeItems(newItems){
  const existing = await getItemsOnce();
  const existingIds = new Set(existing.map(i => i.id));
  const batch = writeBatch(db);
  newItems.forEach(it => {
    if(it.id && existingIds.has(it.id)) return;
    const { id, ...fields } = it;
    const ref = id ? doc(db, COLLECTION, id) : doc(itemsRef);
    batch.set(ref, fields);
  });
  await batch.commit();
}
