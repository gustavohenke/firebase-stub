import * as firebase from "firebase";
import { MockDocumentReference } from "./document-reference";

export class MockDocumentSnapshot<T = firebase.firestore.DocumentData>
  implements firebase.firestore.DocumentSnapshot<T> {
  metadata: firebase.firestore.SnapshotMetadata;

  get id() {
    return this.ref.id;
  }

  get exists() {
    return this._data !== undefined;
  }

  constructor(
    public readonly ref: MockDocumentReference<T>,
    public readonly _data: firebase.firestore.DocumentData | undefined
  ) {}

  data(options?: firebase.firestore.SnapshotOptions | undefined): T | undefined {
    if (this._data === undefined) {
      return undefined;
    }
    const querySnapshot = new MockQueryDocumentSnapshot(this.ref, this._data);
    return querySnapshot.data(options);
  }

  get(
    fieldPath: string | firebase.firestore.FieldPath,
    options?: firebase.firestore.SnapshotOptions | undefined
  ) {
    return fieldPath
      .toString()
      .split(".")
      .reduce((obj, path) => (obj !== undefined ? obj[path] : obj), this._data);
  }

  isEqual(other: firebase.firestore.DocumentSnapshot<T>): boolean {
    return (
      other instanceof MockDocumentSnapshot &&
      other.ref.isEqual(this.ref) &&
      MockDocumentSnapshot.isDeepEqual(this._data, other._data)
    );
  }

  private static isDeepEqual(
    a?: firebase.firestore.DocumentData,
    b?: firebase.firestore.DocumentData
  ) {
    if (a === b) {
      // Data is exactly the same
      return true;
    } else if (a == null || b == null || typeof a !== "object" || typeof b !== "object") {
      // Either is undefined
      return false;
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      // The key set is different
      return false;
    }

    for (const key of aKeys) {
      if (!bKeys.includes(key) || !MockDocumentSnapshot.isDeepEqual(a[key], b[key])) {
        // Either key doesn't exist or the value is deeply not the same
        return false;
      }
    }

    return true;
  }
}

export class MockQueryDocumentSnapshot<T = firebase.firestore.DocumentData>
  extends MockDocumentSnapshot<T>
  implements firebase.firestore.QueryDocumentSnapshot<T> {
  constructor(
    ref: MockDocumentReference<T>,
    public readonly _data: firebase.firestore.DocumentData
  ) {
    super(ref, _data);
  }

  data(options?: firebase.firestore.SnapshotOptions): T {
    return this.ref.converter.fromFirestore(this, options || {});
  }
}
