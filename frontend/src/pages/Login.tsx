import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, Lock, ArrowRight, Chrome, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [loginType, setLoginType] = useState<'user' | 'admin'>('user');
  const { user, loading, logout } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // If user is authenticated
  if (user) {
    // If this was a fresh login (user just clicked sign in), auto-redirect
    if (isLoggingIn) {
      const target = user.role === 'Admin' ? '/admin' : '/cashier';
      return <Navigate to={target} replace />;
    }

    // If this is a persisted session, show the "Welcome Back" view
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gray-900">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-900 via-black to-gray-900"></div>
        <div className="relative z-10 w-full max-w-md p-8 space-y-8 rounded-2xl shadow-2xl bg-black/40 backdrop-blur-xl ring-1 ring-black/5 mx-4 text-center border border-white/10">
          <h2 className="text-3xl font-bold text-white mb-4">Welcome Back</h2>
          <p className="text-gray-300 mb-6">
            You are currently logged in as <br />
            <span className="text-indigo-400 font-medium">{user.email}</span>
          </p>
          <div className="bg-white/10 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400 uppercase tracking-wider">Current Role</p>
            <p className="text-xl font-bold text-white">{user.role}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setIsLoggingIn(true)} // Trigger auto-redirect logic
              className="w-full py-3 px-4 rounded-lg shadow text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all font-semibold"
            >
              Continue to Dashboard
            </button>
            <button
              onClick={() => logout()}
              className="w-full py-3 px-4 rounded-lg shadow text-sm font-medium text-red-200 bg-red-500/20 hover:bg-red-500/30 transition-all"
            >
              Logout & Switch Account
            </button>
          </div>
        </div>
        <div className="absolute bottom-4 text-center text-gray-400 text-sm z-20">
          &copy; Flipflex 2025
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gray-900">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-900 via-black to-gray-900"></div>
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 w-full max-w-md p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl mx-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tighter text-white mb-2">
            Raju Electricals
          </h1>
          <p className="text-sm text-gray-300">Sign in to continue</p>
        </div>

        {/* Role Switcher */}
        <div className="p-1 space-x-1 bg-black/20 rounded-xl flex">
          <button
            onClick={() => setLoginType('user')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${loginType === 'user'
              ? 'bg-white/20 shadow text-white border border-white/10'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            Cashier
          </button>

          <button
            onClick={() => setLoginType('admin')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${loginType === 'admin'
              ? 'bg-white/20 shadow text-white border border-white/10'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            Admin
          </button>
        </div>

        {loginType === 'user' ? (
          <LoginForm
            expectedRole="Cashier"
            buttonText="Sign In"
            buttonClass="bg-blue-600 hover:bg-blue-700"
            setIsLoggingIn={setIsLoggingIn}
          />
        ) : (
          <LoginForm
            expectedRole="Admin"
            buttonText="Access Admin Panel"
            buttonClass="bg-red-600 hover:bg-red-700"
            setIsLoggingIn={setIsLoggingIn}
          />
        )}
      </div>

      <div className="absolute bottom-4 text-center text-gray-400 text-sm z-20">
        &copy; Flipflex 2025
      </div>
    </div>
  );
};

interface LoginFormProps {
  expectedRole: 'Admin' | 'Cashier';
  buttonText: string;
  buttonClass: string;
  setIsLoggingIn: (val: boolean) => void;
}

const LoginForm = ({ expectedRole, buttonText, buttonClass, setIsLoggingIn }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    setIsLoggingIn(true); // Signal that we are attempting a fresh login

    // Basic client-side validation
    if (!email.includes('@') || email.length < 5) {
      setError("Please enter a valid email address.");
      setIsLoading(false);
      setIsLoggingIn(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setIsLoading(false);
      setIsLoggingIn(false);
      return;
    }

    try {
      // Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Check Role in Firestore (Create if missing)
      const docRef = doc(db, "users", firebaseUser.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // SECURITY CHECK: Only allow specific emails to auto-create as Admin
        // This prevents any authenticated user from becoming an Admin just by trying.
        if (expectedRole === 'Admin' && firebaseUser.email !== 'admin@mail.com') {
          await auth.signOut(); // Force logout
          throw new Error("Access denied: You do not have Administrator privileges.");
        }

        // Auto-create user document (Bootstrap for admin@mail.com or default for Cashiers)
        await setDoc(docRef, {
          email: firebaseUser.email,
          role: expectedRole,
          createdAt: new Date()
        });
        console.log(`Created new user profile for ${email} as ${expectedRole}`);
      } else {
        const userData = docSnap.data();
        if (userData.role !== expectedRole) {
          // Role mismatch
          await auth.signOut(); // Force logout so they aren't stuck in "Welcome Back" with wrong role
          throw new Error(`Access denied: You are not a ${expectedRole}.`);
        }
      }
      // Success! AuthContext will update 'user', triggering re-render of Login component.
      // Login component will see 'isLoggingIn' is true and auto-redirect.

    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Incorrect email or password.");
      setIsLoading(false);
      setIsLoggingIn(false); // Reset if failed
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleLogin}>
      {/* Email Input */}
      <div className="space-y-1">
        <label htmlFor="email" className="flex items-center text-sm font-medium text-gray-300">
          <User className="mr-2" size={16} />
          {expectedRole} Email
        </label>
        <input
          type="email"
          id="email"
          className="block w-full py-2.5 px-3 text-sm text-white bg-black/20 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`Enter your ${expectedRole.toLowerCase()} email`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {/* Password Input */}
      <div className="space-y-1">
        <label htmlFor="password" className="flex items-center text-sm font-medium text-gray-300">
          <Lock className="mr-2" size={16} />
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            className="block w-full py-2.5 px-3 text-sm text-white bg-black/20 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-white focus:outline-none"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-center text-sm bg-red-500/10 p-2 rounded">{error}</p>}

      <div className="flex items-center justify-between">
        <a href="#" className="text-xs text-gray-300 hover:text-white transition">Forgot Password?</a>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`group w-full flex items-center justify-center py-3 px-4 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-all duration-300 ${buttonClass}`}
      >
        {isLoading ? "Signing In..." : buttonText}
        {!isLoading && <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />}
      </button>

      {/* Divider - Visual only, keeping layout consitency */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-gray-400/30"></div>
        <span className="flex-shrink mx-4 text-gray-400 text-xs">SECURE LOGIN</span>
        <div className="flex-grow border-t border-gray-400/30"></div>
      </div>

    </form>
  );
};

export default Login;
