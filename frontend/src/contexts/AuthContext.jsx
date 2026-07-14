import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import AuthService from "../services/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const profile = AuthService.getProfile();

    if (profile) {
      setUser(profile);
    }

    setLoading(false);
  }, []);

  async function signIn(email, password, stayLoggedIn = true) {
    const profile = await AuthService.signIn(
      email,
      password,
      stayLoggedIn
    );

    setUser(profile);

    return profile;
  }

  async function signUp(name, email, password, role) {
    const profile = await AuthService.signUp(
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
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}