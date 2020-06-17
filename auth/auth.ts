import * as firebase from "firebase";
import { MockApp } from "../app";
import { SocialSignInMock } from "./social-signin-mock";
import { User } from "./user";
import { UserStore } from "./user-store";
import { AuthSettings } from "./auth-settings";

export type AuthStateChangeListener = (user: firebase.User | null) => void;

export class MockAuth implements firebase.auth.Auth {
  public currentUser: User | null = null;
  public languageCode: string | null = null;
  public settings: firebase.auth.AuthSettings = new AuthSettings();
  public tenantId: string | null;
  public readonly store = new UserStore();
  private readonly socialSignIns = new Set<SocialSignInMock>();
  private readonly authStateEvents = new Set<AuthStateChangeListener>();

  constructor(public readonly app: MockApp) {}

  applyActionCode(code: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  checkActionCode(code: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  confirmPasswordReset(code: string, newPassword: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  createUserWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<firebase.auth.UserCredential> {
    if (this.store.findByEmail(email)) {
      throw new Error("auth/email-already-in-use");
    }

    const user = this.store.add({ email, password });
    return this.signIn(user);
  }

  fetchProvidersForEmail(email: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  fetchSignInMethodsForEmail(email: string): Promise<string[]> {
    throw new Error("Method not implemented.");
  }

  getRedirectResult(): Promise<any> {
    throw new Error("Method not implemented.");
  }

  isSignInWithEmailLink(emailLink: string): boolean {
    throw new Error("Method not implemented.");
  }

  mockSocialSignIn(provider: firebase.auth.AuthProvider) {
    const mock = new SocialSignInMock(provider.providerId);
    this.socialSignIns.add(mock);
    return mock;
  }

  onAuthStateChanged(
    nextOrObserver: AuthStateChangeListener,
    error?: (a: firebase.auth.Error) => void,
    completed?: firebase.Unsubscribe
  ): firebase.Unsubscribe {
    this.authStateEvents.add(nextOrObserver);
    nextOrObserver(this.currentUser);

    return () => {
      this.authStateEvents.delete(nextOrObserver);
    };
  }

  onIdTokenChanged(
    nextOrObserver: firebase.Observer<any, any> | ((a: firebase.User | null) => void),
    error?: (a: firebase.auth.Error) => void,
    completed?: firebase.Unsubscribe
  ): firebase.Unsubscribe {
    throw new Error("Method not implemented.");
  }

  sendPasswordResetEmail(
    email: string,
    actionCodeSettings?: firebase.auth.ActionCodeSettings | null
  ): Promise<any> {
    throw new Error("Method not implemented.");
  }

  sendSignInLinkToEmail(
    email: string,
    actionCodeSettings: firebase.auth.ActionCodeSettings
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  setPersistence(persistence: string): Promise<void> {
    return Promise.resolve();
  }

  private signIn(user: User): Promise<firebase.auth.UserCredential> {
    this.currentUser = user;
    this.authStateEvents.forEach((listener) => {
      listener(user);
    });

    return Promise.resolve<firebase.auth.UserCredential>({
      user,
      additionalUserInfo: null,
      credential: null,
      operationType: "signIn",
    });
  }

  signInAndRetrieveDataWithCredential(credential: firebase.auth.AuthCredential): Promise<any> {
    throw new Error("Method not implemented.");
  }

  signInAnonymously(): Promise<firebase.auth.UserCredential> {
    if (this.currentUser && this.currentUser.isAnonymous) {
      return this.signIn(this.currentUser);
    }

    const user = this.store.add({ isAnonymous: true });
    return this.signIn(user);
  }

  signInWithCredential(credential: firebase.auth.AuthCredential): Promise<any> {
    throw new Error("Method not implemented.");
  }

  signInWithCustomToken(token: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  signInWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<firebase.auth.UserCredential> {
    const user = this.store.findByEmail(email);
    if (!user) {
      return Promise.reject(new Error("auth/user-not-found"));
    } else if (user.password !== password) {
      return Promise.reject(new Error("auth/wrong-password"));
    }

    return this.signIn(user);
  }

  signInWithEmailLink(
    email: string,
    emailLink?: string | undefined
  ): Promise<firebase.auth.UserCredential> {
    throw new Error("Method not implemented.");
  }

  signInWithPhoneNumber(
    phoneNumber: string,
    applicationVerifier: firebase.auth.ApplicationVerifier
  ): Promise<any> {
    throw new Error("Method not implemented.");
  }

  async signInWithPopup(
    provider: firebase.auth.AuthProvider
  ): Promise<firebase.auth.UserCredential> {
    const mock = Array.from(this.socialSignIns.values()).find(
      (mock) => mock.type === provider.providerId
    );

    if (!mock) {
      throw new Error("No mock response set.");
    }

    // Mock is used, then it must go
    this.socialSignIns.delete(mock);

    const data = await mock.response;
    let user = this.store.findByEmail(data.email);
    if (user) {
      if (user.providerId !== provider.providerId) {
        throw new Error("auth/account-exists-with-different-credential");
      }

      return this.signIn(user);
    }

    user = this.store.add({ ...data, providerId: provider.providerId });
    return this.signIn(user);
  }

  signInWithRedirect(provider: firebase.auth.AuthProvider): Promise<void> {
    throw new Error("Method not implemented.");
  }

  signOut(): Promise<void> {
    this.currentUser = null;
    this.authStateEvents.forEach((listener) => listener(this.currentUser));
    return Promise.resolve();
  }

  updateCurrentUser(user: firebase.User | null): Promise<void> {
    throw new Error("Method not implemented.");
  }

  useDeviceLanguage() {}

  verifyPasswordResetCode(code: string): Promise<any> {
    throw new Error("Method not implemented.");
  }
}
