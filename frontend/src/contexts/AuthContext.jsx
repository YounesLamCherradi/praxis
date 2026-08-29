import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import AuthService from "../services/auth";
import { queryClient } from "../queryClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      const cachedProfile = AuthService.getProfile();
      if (cachedProfile && active) {
        setUser(cachedProfile);
      }

      try {
        const restoredProfile = await AuthService.restoreSession();
        if (restoredProfile && active) {
          setUser(restoredProfile);
        }
      } catch (error) {
        // A temporary backend outage must not create an unhandled rejection.
        // Keep the cached profile so local recovery data remains accessible.
        console.error("Could not restore the server session:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    bootstrapAuth();

    return () => {
      active = false;
    };
  }, []);

  async function signIn(
    email,
    password,
    stayLoggedIn = true,
    loginSurface = "portal"
  ) {
    // Query keys are shared by route, so remove the previous account's
    // authenticated data before establishing a different session.
    queryClient.clear();

    const profile = await AuthService.signIn(
      email,
      password,
      stayLoggedIn,
      loginSurface
    );

    setUser(profile);

    return profile;
  }

  async function signUp(name, email, password, role, otpCode = "") {
    queryClient.clear();
    const profile = otpCode
      ? await AuthService.signUpWithCode(
          name,
          email,
          password,
          role,
          otpCode
        )
      : await AuthService.signUp(
          name,
          email,
          password,
          role
        );

    setUser(profile);

    return profile;
  }

  async function signOut() {
    await AuthService.signOut();
    queryClient.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setUser,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
