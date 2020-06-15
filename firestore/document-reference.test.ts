import { createMockInstance } from "jest-create-mock-instance";
import { MockApp } from "../app";
import { MockDocumentReference, MockFirestore } from "./";

let firestore: MockFirestore;
beforeEach(() => {
  firestore = new MockFirestore(createMockInstance(MockApp));
});

it("exposes #firestore", () => {
  const doc = firestore.doc("foo/bar");
  expect(doc).toHaveProperty("firestore", firestore);
});

it("exposes #id", () => {
  const doc = firestore.doc("foo/bar");
  expect(doc).toHaveProperty("id", "bar");
});

it("exposes #path", () => {
  const doc = firestore.doc("foo/bar");
  expect(doc.path).toBe("/foo/bar");
});

it("exposes #parent", () => {
  const doc = firestore.doc("foo/bar");
  expect(doc.parent.path).toBe("/foo");
});

it("shares same data as other instances", async () => {
  const doc1 = firestore.doc("foo/bar");
  await doc1.set({ foo: "bar" });

  const doc2 = firestore.doc("foo/bar");
  expect((await doc2.get()).data()).toEqual({ foo: "bar" });
});

describe("#collection()", () => {
  it("returns child collection", () => {
    const doc = firestore.doc("foo/bar");
    expect(doc.collection("baz").path).toEqual("/foo/bar/baz");
  });
});

describe("#get()", () => {
  it("instantiates a snapshot with the current data", async () => {
    const ref = firestore.doc("foo/bar");
    await ref.set({ foo: "bar" });

    const doc = await ref.get();
    expect(doc).toHaveProperty("ref", ref);
    expect(doc.data()).toEqual({ foo: "bar" });

    await ref.set({ bar: "baz" });
    expect(doc.data()).toEqual({ foo: "bar" });
  });
});

describe("#isEqual()", () => {
  it("returns false if Firestore instances are not the same", () => {
    const firestore2 = new MockFirestore(createMockInstance(MockApp));
    const isEqual = firestore.doc("foo/bar").isEqual(firestore2.doc("foo/bar"));
    expect(isEqual).toBe(false);
  });

  it("returns false if paths are not the same", () => {
    const isEqual = firestore.doc("foo/bar").isEqual(firestore.doc("bar/bar"));
    expect(isEqual).toBe(false);
  });

  it("returns false if converters are not the same", () => {
    const isEqual = firestore.doc("foo/bar").isEqual(
      firestore.doc("foo/bar").withConverter({
        fromFirestore: jest.fn(),
        toFirestore: jest.fn(),
      })
    );
    expect(isEqual).toBe(false);
  });

  it("returns true otherwise", () => {
    const isEqual = firestore.doc("foo/bar").isEqual(firestore.doc("foo/bar"));
    expect(isEqual).toBe(true);
  });
});

describe("#onSnapshot()", () => {
  const createTests = (executor: (doc: MockDocumentReference, onNext: any) => () => void) => () => {
    it("sets onNext and emits it right away", async () => {
      const doc = firestore.doc("foo/bar");

      const onNext = jest.fn();
      executor(doc, onNext);

      return doc.get().then((snapshot) => {
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledWith(snapshot);
      });
    });

    it("unsets the onNext listener on disposal", () => {
      const doc = firestore.doc("foo/bar");

      const onNext = jest.fn();
      const disposer = executor(doc, onNext);
      disposer();

      return doc.get().then((snapshot) => {
        expect(onNext).toHaveBeenCalledTimes(1);
      });
    });
  };

  describe(
    "with listener args",
    createTests((doc, onNext) => doc.onSnapshot(onNext))
  );

  describe(
    "with options + listener args",
    createTests((doc, onNext) => doc.onSnapshot({}, onNext))
  );

  describe(
    "with observer arg",
    createTests((doc, onNext) => doc.onSnapshot({ next: onNext }))
  );

  describe(
    "with options + observer args",
    createTests((doc, onNext) => doc.onSnapshot({}, { next: onNext }))
  );
});

describe("#set()", () => {
  it("overwrites current data by default", async () => {
    const doc = firestore.doc("foo/bar");

    await doc.set({ bla: "blabla" });
    await doc.set({ bar: "baz" });

    expect((await doc.get()).data()).toEqual({ bar: "baz" });
  });

  it("merges into current data if options.merge is true", async () => {
    const doc = firestore.doc("foo/bar");

    await doc.set({ bla: "blabla" });
    await doc.set({ bar: "baz" }, { merge: true });

    expect((await doc.get()).data()).toEqual({
      bla: "blabla",
      bar: "baz",
    });
  });

  it("parses data with the converter", async () => {
    const doc = firestore.doc("foo/bar");
    const doc2 = doc.withConverter({
      fromFirestore: jest.fn(),
      toFirestore: jest.fn().mockReturnValue({ super: "fun" }),
    });

    await doc2.set({ foo: "bar" });
    expect((await doc.get()).data()).toEqual({ super: "fun" });
  });

  it("emits snapshot events", async () => {
    const doc = firestore.doc("foo/bar");

    const onNext = jest.fn();
    doc.onSnapshot(onNext);

    await doc.set({ bla: "blabla" });

    // 1 for the snapshot setting, 1 for the set value
    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it("emits change events on the parent collection", async () => {
    const coll = firestore.collection("foo");
    const listener = jest.fn();
    coll.onSnapshot(listener);

    const doc = coll.doc("bar");
    await doc.set({ bla: "blabla" });

    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("#update()", () => {
  it("patches existing document data deeply", async () => {
    const ref = firestore.doc("foo/bar");
    await ref.set({
      foo: 123,
      bar: { bar: 456 },
      baz: 789,
      qux: false,
    });

    await ref.update({
      "foo.foo": "foo",
      "bar.otherBar": "otherBar",
      baz: "baz",
    });

    const doc = await ref.get();
    expect(doc.data()).toEqual({
      foo: {
        foo: "foo",
      },
      bar: {
        bar: 456,
        otherBar: "otherBar",
      },
      baz: "baz",
      qux: false,
    });
  });

  it("fails when the document doesn't exist", async () => {
    const promise = firestore.doc("foo/bar").update({ baz: "yes" });
    await expect(promise).rejects.toThrowError();
  });

  it("emits snapshot events", async () => {
    const doc = firestore.doc("foo/bar");
    await doc.set({ bla: "blabla" });

    const onNext = jest.fn();
    doc.onSnapshot(onNext);
    await doc.update({ bla: "BLA" });

    // 1 for the snapshot setting, 1 for the set value
    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it("emits change events on the parent collection", async () => {
    const coll = firestore.collection("foo");
    const doc = coll.doc("bar");
    await doc.set({ bla: "blabla" });

    const listener = jest.fn();
    coll.onSnapshot(listener);
    await doc.update({ bla: "BLA" });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not emit events if no value actually changed", async () => {
    const doc = firestore.doc("foo/bar");
    await doc.set({ bla: "blabla" });

    const onNext = jest.fn();
    doc.onSnapshot(onNext);

    await doc.update({ bla: "blabla" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe("#delete()", () => {
  it("removes the document data", async () => {
    const doc1 = firestore.doc("foo/bar");
    const doc2 = firestore.doc("foo/bar");

    await doc1.set({ baz: "qux" });
    doc2.delete();

    expect((await doc1.get()).exists).toBe(false);
  });

  it("emits snapshot events if doc exists", async () => {
    const doc1 = firestore.doc("foo/bar");
    await doc1.set({ baz: "qux" });

    const listener = jest.fn();
    doc1.onSnapshot(listener);
    await doc1.delete();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("doesn't emit snapshot events if doc doesn't exist", async () => {
    const doc1 = firestore.doc("foo/bar");

    const listener = jest.fn();
    doc1.onSnapshot(listener);
    await doc1.delete();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits change events on the parent collection", async () => {
    const coll = firestore.collection("foo");
    const doc = coll.doc("bar");
    await doc.set({ bla: "blabla" });

    const listener = jest.fn();
    coll.onSnapshot(listener);
    await doc.delete();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
