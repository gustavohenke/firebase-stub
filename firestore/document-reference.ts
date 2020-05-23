import * as firebase from "firebase";
import { EventEmitter, Observer } from "../util";
import { MockDocumentSnapshot } from "./document-snapshot";
import { MockFirestore } from "./firestore";

export const SNAPSHOT_NEXT_EVENT = "snapshot:next";
export const SNAPSHOT_ERROR_EVENT = "snapshot:error";
export const SNAPSHOT_COMPLETE_EVENT = "snapshot:complete";

export class MockDocumentReference<T = firebase.firestore.DocumentData>
  implements firebase.firestore.DocumentReference<T> {
  get path(): string {
    return this.parent.path + "/" + this.id;
  }

  private get emitter() {
    const emitter = this.firestore.documentEvents.get(this.path) || new EventEmitter();
    this.firestore.documentEvents.set(this.path, emitter);
    return emitter;
  }

  private get currentData() {
    return this.firestore.documentData.get(this.path);
  }

  constructor(
    public readonly firestore: MockFirestore,
    public readonly id: string,
    public readonly parent: firebase.firestore.CollectionReference<T>,
    public readonly converter: firebase.firestore.FirestoreDataConverter<T>
  ) {}

  collection(
    collectionPath: string
  ): firebase.firestore.CollectionReference<firebase.firestore.DocumentData> {
    return this.firestore.collection(this.path + "/" + collectionPath);
  }
  isEqual(other: firebase.firestore.DocumentReference<T>): boolean {
    throw new Error("Method not implemented.");
  }
  async set(data: T, options: firebase.firestore.SetOptions | undefined = {}): Promise<void> {
    if (options.mergeFields && options.mergeFields.length) {
      throw new Error("Option mergeFields is not supported");
    }

    const parsedData = this.converter.toFirestore(data);

    this.firestore.documentData.set(
      this.path,
      Object.assign(options.merge ? this.currentData : {}, parsedData)
    );
    this.firestore.collectionDocuments.set(this.parent.path, this.path);
    await this.emitChange();
  }

  update(data: firebase.firestore.UpdateData): Promise<void>;
  update(
    field: string | firebase.firestore.FieldPath,
    value: any,
    ...moreFieldsAndValues: any[]
  ): Promise<void>;
  async update(data: any, ...rest: any[]): Promise<void> {
    if (typeof data === "string" || data instanceof firebase.firestore.FieldPath) {
      throw new Error("Document updating by field is not supported");
    }
    if (this.currentData === undefined) {
      return Promise.reject();
    }

    Object.keys(data).forEach((key) => {
      key.split(".").reduce((obj, part, index, path) => {
        if (path.length === index + 1) {
          obj[part] = data[key];
        } else {
          obj[part] = typeof obj[part] === "object" ? obj[part] : {};
        }

        return obj[part];
      }, this.currentData || {});
    });
    await this.emitChange();
  }

  async emitChange() {
    const snapshot = await this.get();
    this.emitter.emit(SNAPSHOT_NEXT_EVENT, [snapshot]);
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  get(options?: firebase.firestore.GetOptions): Promise<firebase.firestore.DocumentSnapshot<T>> {
    return Promise.resolve(
      new MockDocumentSnapshot(this, this.currentData ? Object.assign(this.currentData) : undefined)
    );
  }

  onSnapshot(observer: {
    next?: ((snapshot: firebase.firestore.DocumentSnapshot<T>) => void) | undefined;
    error?: ((error: firebase.firestore.FirestoreError) => void) | undefined;
    complete?: (() => void) | undefined;
  }): () => void;
  onSnapshot(
    options: firebase.firestore.SnapshotListenOptions,
    observer: {
      next?: ((snapshot: firebase.firestore.DocumentSnapshot<T>) => void) | undefined;
      error?: ((error: Error) => void) | undefined;
      complete?: (() => void) | undefined;
    }
  ): () => void;
  onSnapshot(
    onNext: (snapshot: firebase.firestore.DocumentSnapshot<T>) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;
  onSnapshot(
    options: firebase.firestore.SnapshotListenOptions,
    onNext: (snapshot: firebase.firestore.DocumentSnapshot<T>) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;
  onSnapshot(options: any, onNext?: any, onError?: any, onCompletion?: any): () => void {
    let actualListeners: Observer<firebase.firestore.DocumentSnapshot<T>>;

    if (typeof options === "object") {
      if (typeof onNext === "object") {
        actualListeners = onNext;
      } else if (typeof onNext === "function") {
        actualListeners = {
          next: onNext,
          error: onError,
          complete: onCompletion,
        };
      } else {
        actualListeners = options;
      }
    } else {
      actualListeners = {
        next: options,
        error: onNext,
        complete: onError,
      };
    }

    const { next, complete, error } = actualListeners;
    this.emitter.on(SNAPSHOT_NEXT_EVENT, next);
    error && this.emitter.on(SNAPSHOT_ERROR_EVENT, error);
    complete && this.emitter.on(SNAPSHOT_COMPLETE_EVENT, complete);

    // Don't emit SNAPSHOT_NEXT_EVENT otherwise every listener will get it
    this.get().then((snapshot) => next(snapshot));

    return () => {
      this.emitter.off(SNAPSHOT_NEXT_EVENT, next);
      error && this.emitter.off(SNAPSHOT_ERROR_EVENT, error);
      complete && this.emitter.off(SNAPSHOT_COMPLETE_EVENT, complete);
    };
  }

  withConverter<U>(
    converter: firebase.firestore.FirestoreDataConverter<U>
  ): MockDocumentReference<U> {
    return new MockDocumentReference(
      this.firestore,
      this.id,
      this.parent.withConverter(converter),
      converter
    );
  }
}
