import { createContext, useContext, useState, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isVulnerable: boolean;
  vulnerableTypes?: string[];
  location: string;
  profileImage?: string;
  birthdate?: string;
  bio?: string;
}

interface SignupData extends Partial<User> {
  password?: string;
  certificateFile?: File | null;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  signupData: SignupData | null;
  setSignupData: (data: SignupData | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [signupData, setSignupData] = useState<SignupData | null>(null);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
        signupData,
        setSignupData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
}
