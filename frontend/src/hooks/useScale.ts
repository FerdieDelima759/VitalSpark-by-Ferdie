"use client";

import { useState, useEffect, useMemo } from "react";

interface Dimensions {
  width: number;
  height: number;
}

export function useScale() {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 1280, height: 800 });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark as client-side after mount to prevent hydration mismatch
    setIsClient(true);
    
    if (typeof window === "undefined") return;

    // Set initial dimensions
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = useMemo(() => {
    return dimensions.width < 768;
  }, [dimensions]);

  const isTablet = useMemo(() => {
    return dimensions.width >= 768 && dimensions.width < 1024;
  }, [dimensions]);

  const isSmallDesktop = useMemo(() => {
    return dimensions.width >= 1024 && (dimensions.width < 1280 || dimensions.height < 800);
  }, [dimensions]);

  const isLargeScreen = useMemo(() => {
    return dimensions.width >= 1440 && dimensions.height >= 1024;
  }, [dimensions]);

  const scale = useMemo(() => {
    // Use scale of 1 during SSR to prevent hydration mismatch
    if (!isClient) return 1;
    
    // Mobile devices (< 768px)
    if (isMobile) {
      // Base mobile width is 375px (iPhone standard)
      // Scale based on actual width, but ensure minimum readability
      const baseWidth = 375;
      const widthScale = dimensions.width / baseWidth;
      // For mobile, scale between 0.85 and 1.1 to maintain readability
      return Math.max(Math.min(widthScale, 1.1), 0.85);
    }
    
    // Tablet devices (768px - 1024px)
    if (isTablet) {
      // Base tablet width is 768px
      // Scale based on actual width, maintaining good proportions
      const baseWidth = 768;
      const widthScale = dimensions.width / baseWidth;
      // For tablet, scale between 0.9 and 1.15
      return Math.max(Math.min(widthScale, 1.15), 0.9);
    }
    
    // Small desktop (1024px - 1280px or height < 800)
    if (isSmallDesktop) {
      const widthScale = Math.min(dimensions.width / 1280, 1);
      const heightScale = Math.min(dimensions.height / 800, 1);
      // Scale down but not too much to maintain usability
      return Math.max(Math.min(widthScale, heightScale), 0.75);
    }
    
    // Large desktop screens (>= 1440x1024)
    if (isLargeScreen) {
      const widthScale = dimensions.width / 1280;
      const heightScale = dimensions.height / 800;
      return Math.min(widthScale, heightScale, 1.5);
    }
    
    // Standard desktop (1280px - 1440px)
    return 1;
  }, [isMobile, isTablet, isSmallDesktop, isLargeScreen, dimensions, isClient]);

  return { 
    scale, 
    isMobile, 
    isTablet, 
    isSmallDesktop, 
    isLargeScreen, 
    dimensions, 
    isClient 
  };
}

