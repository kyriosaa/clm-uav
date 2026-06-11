import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Helper function: Transforms raw Firestore documents into the standardized drone payload format.
 */
function transformDocs(snapshot) {
  return snapshot.docs.map((d) => {
    const data = d.data();
    const rawData = data.payload || data;
    
    return {
      id: d.id,
      ...data,
      _droneTs: Number(rawData.timestamp ?? data.timestamp ?? 0)
    };
  });
}

export function useSensorData(max = 1) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!db) return;

    const internalId = db._databaseId?.databaseId || db.databaseId;
    if (internalId === '(default)') return;

    const colRef = collection(db, 'sensor');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(max));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = transformDocs(snap);
        setItems(arr);
      },
      (error) => {
        console.error("Live stream listener dropped:", error);
      }
    );

    return () => unsub();
  }, [max]);

  return items;
}