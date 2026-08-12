import { SignJWT, importPKCS8 } from "jose";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function projectId(): string {
  const id = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!id) throw new Error("Missing FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID");
  return id;
}

export async function getGoogleAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
  }

  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env var: " + (err instanceof Error ? err.message : String(err)));
  }

  const privateKey = serviceAccount.private_key;
  const clientEmail = serviceAccount.client_email;
  if (!privateKey || !clientEmail) {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON: missing private_key or client_email");
  }

  const key = await importPKCS8(privateKey, "RS256");

  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/identitytoolkit",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setExpirationTime("1h")
    .setIssuedAt()
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to exchange JWT for token: ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

export function mapFields(fields: any): any {
  if (!fields) return {};
  const res: any = {};
  for (const [key, val] of Object.entries(fields)) {
    res[key] = mapValue(val);
  }
  return res;
}

function mapValue(val: any): any {
  if (!val) return null;
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return parseInt(val.integerValue, 10);
  if ("doubleValue" in val) return parseFloat(val.doubleValue);
  if ("booleanValue" in val) return val.booleanValue;
  if ("timestampValue" in val) return val.timestampValue; // ISO string
  if ("arrayValue" in val) {
    return (val.arrayValue.values ?? []).map((v: any) => mapValue(v));
  }
  if ("mapValue" in val) {
    return mapFields(val.mapValue.fields);
  }
  if ("nullValue" in val) return null;
  return val;
}

export function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    fields[key] = toFirestoreValue(val);
  }
  return { fields };
}

function toFirestoreValue(val: any): any {
  if (val === null) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    return { mapValue: toFirestoreFields(val) };
  }
  return { nullValue: null };
}

export async function adminFirestoreRequest(path: string, options: RequestInit = {}) {
  const token = await getGoogleAuthToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Firestore admin request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Admin-only User Creation in Firebase Auth */
export async function adminCreateUser(opts: {
  email: string;
  password?: string;
  displayName?: string;
}) {
  const token = await getGoogleAuthToken();
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId()}/accounts`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: opts.email,
      password: opts.password,
      emailVerified: true,
      displayName: opts.displayName,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create Firebase user: ${await res.text()}`);
  }

  const data = (await res.json()) as { localId: string };
  return { uid: data.localId };
}

/** Delete a Firebase Auth user */
export async function adminDeleteUser(uid: string) {
  const token = await getGoogleAuthToken();
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId()}/accounts:delete`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: uid,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to delete Firebase user: ${await res.text()}`);
  }
}

/** Get document by path */
export async function adminGetDoc(collection: string, docId: string): Promise<any | null> {
  try {
    const data = await adminFirestoreRequest(`${collection}/${docId}`);
    return { id: docId, ...mapFields(data.fields) };
  } catch (err: any) {
    if (err.message?.includes("404")) return null;
    throw err;
  }
}

/** Create or overwrite doc */
export async function adminSetDoc(collection: string, docId: string, data: any) {
  const fields = toFirestoreFields({
    ...data,
    updated_at: new Date().toISOString(),
  });
  await adminFirestoreRequest(`${collection}/${docId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

/** Delete doc */
export async function adminDeleteDoc(collection: string, docId: string) {
  await adminFirestoreRequest(`${collection}/${docId}`, {
    method: "DELETE",
  });
}

/** Add a document with auto-generated ID */
export async function adminCreateDoc(collectionName: string, data: any): Promise<string> {
  const now = new Date().toISOString();
  const fields = toFirestoreFields({
    ...data,
    created_at: now,
    updated_at: now,
  });
  const res = await adminFirestoreRequest(collectionName, {
    method: "POST",
    body: JSON.stringify(fields),
  });
  const nameParts = res.name.split("/");
  return nameParts[nameParts.length - 1];
}

/** Query collection (documents:runQuery) */
export async function adminRunQuery(collectionName: string, structuredQuery: any): Promise<any[]> {
  const token = await getGoogleAuthToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents:runQuery`;
  const queryPayload = {
    structuredQuery: {
      from: [{ collectionId: collectionName }],
      ...structuredQuery,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(queryPayload),
  });

  if (!res.ok) {
    throw new Error(`Firestore runQuery failed (${res.status}): ${await res.text()}`);
  }

  const rawResults = (await res.json()) as any[];
  const docs: any[] = [];
  for (const item of rawResults) {
    if (item.document) {
      const docPath = item.document.name;
      const parts = docPath.split("/");
      const id = parts[parts.length - 1];
      docs.push({ id, ...mapFields(item.document.fields) });
    }
  }
  return docs;
}

/** List all documents in a collection */
export async function adminListDocs(collectionName: string): Promise<any[]> {
  try {
    const res = await adminFirestoreRequest(collectionName);
    if (!res.documents) return [];
    return res.documents.map((doc: any) => {
      const parts = doc.name.split("/");
      const id = parts[parts.length - 1];
      return { id, ...mapFields(doc.fields) };
    });
  } catch (err: any) {
    if (err.message?.includes("404")) return [];
    throw err;
  }
}

