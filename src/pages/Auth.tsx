import { useState, useEffect, useCallback } from "react";
import { Music, Eye, EyeOff, Mail, Lock, User, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Password validation interface
interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "8-16 characters", test: (pwd) => pwd.length >= 8 && pwd.length <= 16 },
  { label: "One uppercase letter", test: (pwd) => /[A-Z]/.test(pwd) },
  { label: "One lowercase letter", test: (pwd) => /[a-z]/.test(pwd) },
  { label: "One number", test: (pwd) => /\d/.test(pwd) },
  { label: "One special character", test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) },
];

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form states
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    displayName: "",
  });

  // Clear form data when switching between tabs for security
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setFormData({
      email: "",
      password: "",
      username: "",
      displayName: "",
    });
    setPasswordValidation(passwordRequirements.map(() => false));
    setUsernameStatus({ isChecking: false, isUnique: null });
    setEmailStatus({ isChecking: false, isUnique: null });
  };

  // Real-time password validation
  const [passwordValidation, setPasswordValidation] = useState(
    passwordRequirements.map(() => false)
  );

  // Real-time username and email validation states
  const [usernameStatus, setUsernameStatus] = useState<{
    isChecking: boolean;
    isUnique: boolean | null;
  }>({ isChecking: false, isUnique: null });

  const [emailStatus, setEmailStatus] = useState<{
    isChecking: boolean;
    isUnique: boolean | null;
  }>({ isChecking: false, isUnique: null });

  // Check password requirements in real-time
  useEffect(() => {
    const validation = passwordRequirements.map(req => req.test(formData.password));
    setPasswordValidation(validation);
  }, [formData.password]);

  const isPasswordValid = passwordValidation.every(valid => valid);

  // Debounced username uniqueness check
  const debouncedCheckUsername = useCallback(
    async (username: string) => {
      if (username.length < 3) {
        setUsernameStatus({ isChecking: false, isUnique: null });
        return;
      }

      setUsernameStatus({ isChecking: true, isUnique: null });

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username.toLowerCase())
          .maybeSingle();
        
        const isUnique = !data && !error;
        setUsernameStatus({ isChecking: false, isUnique });
      } catch (error) {
        setUsernameStatus({ isChecking: false, isUnique: null });
      }
    },
    []
  );

  // Debounced email uniqueness check
  const debouncedCheckEmail = useCallback(
    async (email: string) => {
      if (!email.includes('@')) {
        setEmailStatus({ isChecking: false, isUnique: null });
        return;
      }

      setEmailStatus({ isChecking: true, isUnique: null });

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('email', email.toLowerCase())
          .maybeSingle();
        
        const isUnique = !data && !error;
        setEmailStatus({ isChecking: false, isUnique });
      } catch (error) {
        setEmailStatus({ isChecking: false, isUnique: null });
      }
    },
    []
  );

  // Username validation effect with debounce
  useEffect(() => {
    if (activeTab !== 'signup') return;
    
    const timeoutId = setTimeout(() => {
      if (formData.username) {
        debouncedCheckUsername(formData.username);
      } else {
        setUsernameStatus({ isChecking: false, isUnique: null });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.username, activeTab, debouncedCheckUsername]);

  // Email validation effect with debounce
  useEffect(() => {
    if (activeTab !== 'signup') return;
    
    const timeoutId = setTimeout(() => {
      if (formData.email) {
        debouncedCheckEmail(formData.email);
      } else {
        setEmailStatus({ isChecking: false, isUnique: null });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.email, activeTab, debouncedCheckEmail]);

  // Check username uniqueness (legacy function for signup)
  const checkUsernameUnique = async (username: string): Promise<boolean> => {
    if (username.length < 3) return false;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    
    return !data && !error;
  };


  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        navigate("/home");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate password
      if (!isPasswordValid) {
        toast({
          title: "Password Invalid",
          description: "Please meet all password requirements",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check username uniqueness
      const isUsernameUnique = await checkUsernameUnique(formData.username);
      if (!isUsernameUnique) {
        toast({
          title: "Username Taken",
          description: "This username is already taken. Please choose another.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: formData.username.toLowerCase(),
            display_name: formData.displayName,
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: "Email Already Exists",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign Up Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Account Created!",
          description: "Please check your email to verify your account.",
        });
        setActiveTab("signin");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address first",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast({
          title: "Reset Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset Email Sent",
          description: "Check your email for password reset instructions",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground gradient-hero">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-glow">
            <Music className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Clean Beats</h1>
          <p className="text-muted-foreground">Your pure music experience awaits</p>
        </div>

        {/* Auth Card */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-foreground">Welcome</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Email address"
                        className="pl-10"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        className="pl-10 pr-10"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      "Sign In"
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-accent hover:text-accent/80 underline"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Display name"
                        className="pl-10"
                        value={formData.displayName}
                        onChange={(e) => handleInputChange('displayName', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                   <div className="space-y-2">
                     <div className="relative">
                       <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                       <Input
                         type="text"
                         placeholder="Username"
                         className="pl-10 pr-10"
                         value={formData.username}
                         onChange={(e) => handleInputChange('username', e.target.value.toLowerCase())}
                         required
                         minLength={3}
                       />
                       <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                         {usernameStatus.isChecking ? (
                           <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                         ) : usernameStatus.isUnique === true ? (
                           <Check className="w-4 h-4 text-green-500" />
                         ) : usernameStatus.isUnique === false ? (
                           <X className="w-4 h-4 text-red-500" />
                         ) : null}
                       </div>
                     </div>
                     {/* Username status message */}
                     {formData.username.length >= 3 && usernameStatus.isUnique !== null && !usernameStatus.isChecking && (
                       <div className="flex items-center space-x-2 text-xs">
                         {usernameStatus.isUnique ? (
                           <>
                             <Check className="w-3 h-3 text-green-500" />
                             <span className="text-green-500">Username is available</span>
                           </>
                         ) : (
                           <>
                             <X className="w-3 h-3 text-red-500" />
                             <span className="text-red-500">Username is already taken</span>
                           </>
                         )}
                       </div>
                     )}
                   </div>
                  
                   <div className="space-y-2">
                     <div className="relative">
                       <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                       <Input
                         type="email"
                         placeholder="Email address"
                         className="pl-10 pr-10"
                         value={formData.email}
                         onChange={(e) => handleInputChange('email', e.target.value)}
                         required
                       />
                       <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                         {emailStatus.isChecking ? (
                           <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                         ) : emailStatus.isUnique === true ? (
                           <Check className="w-4 h-4 text-green-500" />
                         ) : emailStatus.isUnique === false ? (
                           <X className="w-4 h-4 text-red-500" />
                         ) : null}
                       </div>
                     </div>
                     {/* Email status message */}
                     {formData.email.includes('@') && emailStatus.isUnique !== null && !emailStatus.isChecking && (
                       <div className="flex items-center space-x-2 text-xs">
                         {emailStatus.isUnique ? (
                           <>
                             <Check className="w-3 h-3 text-green-500" />
                             <span className="text-green-500">Email is available</span>
                           </>
                         ) : (
                           <>
                             <X className="w-3 h-3 text-red-500" />
                             <span className="text-red-500">Email is already registered</span>
                           </>
                         )}
                       </div>
                     )}
                   </div>
                  
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        className="pl-10 pr-10"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        required
                        minLength={8}
                        maxLength={16}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Requirements */}
                    {formData.password && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">Password requirements:</p>
                        {passwordRequirements.map((req, index) => (
                          <div key={index} className="flex items-center space-x-2 text-xs">
                            {passwordValidation[index] ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <X className="w-3 h-3 text-red-500" />
                            )}
                            <span className={passwordValidation[index] ? "text-green-500" : "text-red-500"}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !isPasswordValid}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      "Create Account"
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-accent hover:text-accent/80 underline"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
            
            <div className="text-center mt-6 text-sm text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;