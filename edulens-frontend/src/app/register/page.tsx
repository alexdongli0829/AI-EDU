'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Loader2, Users, Shield } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    if (!/[a-zA-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      alert('Password must contain at least one letter and one number');
      return;
    }

    try {
      const registerData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'parent', // Always register as parent first
      };

      await register(registerData);
      router.push('/login?registered=true');
    } catch (err) {
      // Error handled by store
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Create Parent Account</CardTitle>
            <CardDescription>
              Start by creating your parent account. You'll be able to add student profiles afterwards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Info Banner */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Parent Account Required</p>
                  <p>Create your parent account first. After registration, you can create and manage student profiles for your children.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Parent Name
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email Address
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Min 8 characters, include a letter and number"
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Create Parent Account
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center">
              <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded-lg">
                <p className="font-medium mb-1">Next Steps:</p>
                <p>After creating your parent account, you'll be able to:</p>
                <p>• Add student profiles for your children</p>
                <p>• Monitor their learning progress</p>
                <p>• Chat with the AI educational advisor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}