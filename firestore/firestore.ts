import * as firebase from "firebase";
import { MockApp } from "../app";
import { CollectionReference } from "./collection-reference";
import { DataContainer } from "./data-container";
import { DocumentReference } from "./document-reference";

export class MockFirestore
  implements firebase.firestore.Firestore, DataContainer<CollectionReference> {
  // ?
  INTERNAL: { delete: () => Promise<void> };

  private id = 0;
  public readonly children = new Map<string, CollectionReference>();
  public readonly data = new Map<string, {}>();

  constructor(public readonly app: MockApp) {}

  batch(): firebase.firestore.WriteBatch {
    throw new Error("Method not implemented.");
  }

  enablePersistence(): Promise<void> {
    return Promise.resolve();
  }

  private child(path: string[]) {
    return path.reduce(
      (container, part, i) =>
        i % 2 === 0
          ? new CollectionReference(this, part, i === 0 ? null : container)
          : new DocumentReference(this, part, container),
      this as any
    );
  }

  collection(collectionPath: string): CollectionReference {
    const path = collectionPath.split("/").filter(Boolean);
    if (path.length % 2 === 0) {
      throw new Error("Not a collection");
    }

    return this.child(path);
  }

  doc(documentPath: string): DocumentReference {
    const path = documentPath.split("/").filter(Boolean);
    if (path.length % 2 === 1) {
      throw new Error("Not a document");
    }

    return this.child(path);
  }

  nextId() {
    return "__id" + this.id++;
  }

  runTransaction<T>(
    updateFunction: (transaction: firebase.firestore.Transaction) => Promise<T>
  ): Promise<T> {
    throw new Error("Method not implemented.");
  }

  settings(settings: firebase.firestore.Settings): void {}
}
