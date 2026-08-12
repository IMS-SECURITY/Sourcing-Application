// Phase 5 — small Firestore data-access helpers used by the app pages.
// Keeps route components free of low-level Firestore plumbing.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { firestore } from "./client";

/** Firestore Timestamp | ISO string | Date -> Date (or null). */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
  return null;
}

/** Same as toDate but always returns a Date so date-fns never throws. */
export function toDateSafe(value: unknown): Date {
  return toDate(value) ?? new Date(0);
}

function withId<T>(snap: QueryDocumentSnapshot<DocumentData>): T & { id: string } {
  return { id: snap.id, ...(snap.data() as T) };
}

export async function listDocs<T = DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<(T & { id: string })[]> {
  const snap = await getDocs(query(collection(firestore, collectionName), ...constraints));
  return snap.docs.map((d) => withId<T>(d));
}

/** Orders newest-first, tolerating docs that have no created_at yet. */
export async function listRecent<T = DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<(T & { id: string })[]> {
  try {
    return await listDocs<T>(collectionName, ...constraints, orderBy("created_at", "desc"));
  } catch {
    const rows = await listDocs<T>(collectionName, ...constraints);
    return rows.sort(
      (a, b) =>
        toDateSafe((b as DocumentData).created_at).getTime() -
        toDateSafe((a as DocumentData).created_at).getTime(),
    );
  }
}

export async function getDocById<T = DocumentData>(
  collectionName: string,
  id: string,
): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(firestore, collectionName, id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as T) }) : null;
}

export async function createDocIn(collectionName: string, data: DocumentData): Promise<string> {
  const ref = await addDoc(collection(firestore, collectionName), {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function setDocIn(collectionName: string, id: string, data: DocumentData) {
  await setDoc(
    doc(firestore, collectionName, id),
    { ...data, created_at: serverTimestamp(), updated_at: serverTimestamp() },
    { merge: true },
  );
}

export async function updateDocIn(collectionName: string, id: string, data: DocumentData) {
  await updateDoc(doc(firestore, collectionName, id), { ...data, updated_at: serverTimestamp() });
}

export async function deleteDocIn(collectionName: string, id: string) {
  await deleteDoc(doc(firestore, collectionName, id));
}

/** Batch-fetch docs by id (Firestore has no `whereIn` on document id in the SDK). */
export async function getDocsByIds<T = DocumentData>(
  collectionName: string,
  ids: string[],
): Promise<(T & { id: string })[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows = await Promise.all(unique.map((id) => getDocById<T>(collectionName, id)));
  return rows.filter((r) => r !== null) as (T & { id: string })[];

}

/** `where(field, 'in', …)` is capped at 30 values — this batches transparently. */
export async function listWhereIn<T = DocumentData>(
  collectionName: string,
  field: string,
  values: string[],
): Promise<(T & { id: string })[]> {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((chunk) => listDocs<T>(collectionName, where(field, "in", chunk))),
  );
  return results.flat();
}

export { serverTimestamp, where, orderBy };
