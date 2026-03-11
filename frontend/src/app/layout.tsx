import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeBackground from "@/components/ThemeBackground";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkoutProvider } from "@/contexts/WorkoutContext";
import { UserProvider } from "@/contexts/UserContext";
import { PlansProvider } from "@/contexts/PlansContext";
import { ImageGenerationProvider } from "@/contexts/ImageGenerationContext";
import ImageGenerationProgress from "@/components/ImageGenerationProgress";
import PlanDialogProvider from "@/components/PlanDialogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VitalSpark - Your Fitness and Wellness Companion",
  description:
    "Transform your health journey with personalized workouts, meal plans, and wellness tracking.",
  keywords: [
    "fitness",
    "wellness",
    "workout",
    "health",
    "nutrition",
    "exercise",
  ],
  authors: [{ name: "VitalSpark Team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/images/Logo_VitalSpark.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeBackground>
          <AuthProvider>
            <UserProvider>
              <PlansProvider>
                <WorkoutProvider>
                  <ImageGenerationProvider>
                    {children}
                    <PlanDialogProvider />
                    <ImageGenerationProgress />
                  </ImageGenerationProvider>
                </WorkoutProvider>
              </PlansProvider>
            </UserProvider>
          </AuthProvider>
        </ThemeBackground>
      </body>
    </html>
  );
}
