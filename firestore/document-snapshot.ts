import * as firebase from "firebase";
import { DocumentReference } from "./document-reference";
import { MockFirestore } from "./firestore";

export class DocumentSnapshot implements firebase.firestore.DocumentSnapshot {
  exists: boolean;
  metadata: firebase.firestore.SnapshotMetadata;

  get firestore(): MockFirestore {
    return this.ref.firestore;
  }

  get id() {
    return this.ref.id;
  }

  constructor(public readonly ref: DocumentReference, private readonly _data: {}) {}

  data(): firebase.firestore.DocumentData {
    return this._data;
  }

  get(fieldPath: string) {
    return fieldPath
      .split(".")
      .reduce((obj, path) => (obj !== undefined ? obj[path] : obj), this._data);
  }

  isEqual(other: firebase.firestore.DocumentSnapshot): boolean {
    const otherData = other.data();
    const thisData = this.data();
    if (!otherData || !thisData) {
      return otherData === thisData;
    }

    return Object.keys(otherData).every(key => {
      return otherData[key] === thisData[key];
    });
  }
}
