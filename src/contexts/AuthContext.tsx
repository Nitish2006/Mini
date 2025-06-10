
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "user";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  currentUser: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin email for auto-assignment of admin role
const ADMIN_EMAIL = "eventspark7@gmail.com";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("Auth state changed:", event, newSession?.user?.email);
        setSession(newSession);
        setCurrentUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Fetch profile immediately for faster response
          await fetchUserProfile(newSession.user.id, newSession.user.email);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // Check for existing session
    const initializeAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log("Existing session:", currentSession?.user?.email);
      setSession(currentSession);
      setCurrentUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        await fetchUserProfile(currentSession.user.id, currentSession.user.email);
      } else {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, userEmail: string | undefined) => {
    try {
      console.log("Fetching profile for user:", userId, "Email:", userEmail);
      
      // Check if admin email first for immediate admin access
      if (userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        console.log("Admin email detected, setting admin role immediately");
        setUser({
          id: userId,
          name: 'Admin User',
          email: userEmail,
          role: 'admin'
        });
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error("Error fetching profile:", error);
        // If profile doesn't exist, create a default user
        setUser({
          id: userId,
          name: 'User',
          email: userEmail || "",
          role: 'user'
        });
        setIsLoading(false);
        return;
      }
      
      if (data) {
        const firstName = data.first_name as string || '';
        const lastName = data.last_name as string || '';
        const userRole = data.role as UserRole || 'user';
        
        console.log("User profile loaded:", userRole);
        
        setUser({
          id: userId,
          name: `${firstName} ${lastName}`.trim() || 'User',
          email: userEmail || "",
          role: userRole
        });
      }
    } catch (error) {
      console.error("Error:", error);
      // Fallback to basic user info
      setUser({
        id: userId,
        name: 'User',
        email: userEmail || "",
        role: userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log("Attempting login for:", email);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success("Login successful!");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
      throw error;
    }
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const role = email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
      console.log("Registering with role:", role, "for email:", email);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role,
          },
        },
      });

      if (error) throw error;
      
      toast.success("Registration successful! Please check your email to verify your account.");
    } catch (error: any) {
      toast.error(error.message || "Registration failed");
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success("Logged out successfully");
    } catch (error: any) {
      toast.error(error.message || "Logout failed");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser,
        session,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
