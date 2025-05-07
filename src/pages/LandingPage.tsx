
import React from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Clock, ActivitySquare, Cloud, Lock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-primary mr-2">PDKS</div>
            <Badge variant="outline" className="hidden sm:inline-flex">Cloud</Badge>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="#features" className="text-foreground/80 hover:text-foreground transition-colors">Features</Link>
            <Link to="#pricing" className="text-foreground/80 hover:text-foreground transition-colors">Pricing</Link>
            <Link to="#about" className="text-foreground/80 hover:text-foreground transition-colors">About</Link>
            <Link to="#contact" className="text-foreground/80 hover:text-foreground transition-colors">Contact</Link>
          </nav>
          
          <div>
            <Button asChild variant="outline" className="mr-2 hidden sm:inline-flex">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link to="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Modern Attendance & Access Control System
              </h1>
              <p className="mt-6 text-xl text-muted-foreground">
                Streamline employee attendance tracking and access management with our secure, cloud-based solution.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-lg">
                  Request Demo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="text-lg">
                  Learn More
                </Button>
              </div>
            </div>
            <div className="hidden md:block w-full max-w-md">
              <div className="glass-card p-8 shadow-lg bg-card rounded-2xl rotate-3 relative">
                <div className="absolute -top-6 -right-6 w-12 h-12 rounded-full burgundy-gradient flex items-center justify-center text-white">
                  <QrCode className="h-6 w-6" />
                </div>
                <div className="rounded-lg bg-primary/5 p-3 mb-3">
                  <div className="h-2 w-24 bg-primary/10 rounded-full mb-2"></div>
                  <div className="h-2 w-32 bg-primary/10 rounded-full"></div>
                </div>
                <div className="flex items-center gap-3 my-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20"></div>
                  <div>
                    <div className="h-2 w-24 bg-primary/20 rounded-full mb-2"></div>
                    <div className="h-2 w-16 bg-primary/10 rounded-full"></div>
                  </div>
                  <div className="ml-auto">
                    <Badge variant="success">Giriş</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 my-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20"></div>
                  <div>
                    <div className="h-2 w-24 bg-primary/20 rounded-full mb-2"></div>
                    <div className="h-2 w-16 bg-primary/10 rounded-full"></div>
                  </div>
                  <div className="ml-auto">
                    <Badge variant="success">Giriş</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 my-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20"></div>
                  <div>
                    <div className="h-2 w-24 bg-primary/20 rounded-full mb-2"></div>
                    <div className="h-2 w-16 bg-primary/10 rounded-full"></div>
                  </div>
                  <div className="ml-auto">
                    <Badge variant="warning">Çıkış</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Powerful Features</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Our comprehensive solution offers everything you need for modern attendance tracking and access control.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">QR & Card-based Access</h3>
                <p className="text-muted-foreground">
                  Secure access control using QR codes and physical card readers for maximum flexibility.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Real-time Attendance</h3>
                <p className="text-muted-foreground">
                  Monitor employee attendance in real-time with automatic time tracking and notifications.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <ActivitySquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">AI-powered Reports</h3>
                <p className="text-muted-foreground">
                  Generate insightful analytics and reports with our powerful AI assistant.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Cloud className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Secure Cloud Storage</h3>
                <p className="text-muted-foreground">
                  All your data is securely stored in the cloud with enterprise-grade encryption.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Choose the plan that works best for your organization
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-1">Free</h3>
                  <div className="text-3xl font-bold my-4">₺0<span className="text-lg text-muted-foreground font-normal">/ay</span></div>
                  <p className="text-muted-foreground mb-6">Perfect for small teams</p>
                  <Button variant="outline" className="w-full">Start Free</Button>
                  
                  <div className="mt-8 text-left">
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Up to 5 employees
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Basic reports
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Email support
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-primary shadow-lg relative">
              <div className="absolute -top-3 left-0 right-0 mx-auto w-fit">
                <Badge className="px-3 py-1">POPULAR</Badge>
              </div>
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-1">Professional</h3>
                  <div className="text-3xl font-bold my-4">₺299<span className="text-lg text-muted-foreground font-normal">/ay</span></div>
                  <p className="text-muted-foreground mb-6">For growing businesses</p>
                  <Button className="w-full">Start 14-Day Trial</Button>
                  
                  <div className="mt-8 text-left">
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Up to 50 employees
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Advanced reports & AI insights
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Priority support
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Multiple access points
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-1">Enterprise</h3>
                  <div className="text-3xl font-bold my-4">Custom</div>
                  <p className="text-muted-foreground mb-6">For large organizations</p>
                  <Button variant="outline" className="w-full">Contact Sales</Button>
                  
                  <div className="mt-8 text-left">
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Unlimited employees
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Custom integrations
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Dedicated account manager
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      On-premise options available
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">What Our Customers Say</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Trusted by businesses of all sizes across Turkey
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <p className="italic text-muted-foreground">
                      "This system has transformed how we manage employee attendance. The reports are incredible and the QR code system is so easy to use."
                    </p>
                  </div>
                  <div className="mt-auto flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div className="ml-3">
                      <p className="font-medium">Ahmet Yılmaz</p>
                      <p className="text-sm text-muted-foreground">HR Director, Tekno A.Ş.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <p className="italic text-muted-foreground">
                      "The AI-powered reports have given us insights we never had before. Implementation was smooth and their support team is very responsive."
                    </p>
                  </div>
                  <div className="mt-auto flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div className="ml-3">
                      <p className="font-medium">Elif Kaya</p>
                      <p className="text-sm text-muted-foreground">Operations Manager, Global Logistics</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <p className="italic text-muted-foreground">
                      "Security was our main concern, and this system exceeded our expectations. The cloud storage is secure and the access control features are robust."
                    </p>
                  </div>
                  <div className="mt-auto flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div className="ml-3">
                      <p className="font-medium">Mehmet Can</p>
                      <p className="text-sm text-muted-foreground">CTO, Security Solutions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-muted py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-2xl font-bold text-primary mb-4">PDKS Cloud</div>
              <p className="text-muted-foreground">
                Modern attendance tracking and access control for modern businesses.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Careers</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Press Kit</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Help Center</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Connect With Us</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Lock className="h-5 w-5" />
                  <span className="sr-only">Facebook</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Lock className="h-5 w-5" />
                  <span className="sr-only">Twitter</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Lock className="h-5 w-5" />
                  <span className="sr-only">LinkedIn</span>
                </a>
              </div>
              <div className="mt-6">
                <Button variant="outline" className="w-full">Contact Us</Button>
              </div>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} PDKS Cloud. All rights reserved.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link to="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
              <Link to="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
              <Link to="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
