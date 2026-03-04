import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  View,
  Dimensions,
  Animated,
  LayoutChangeEvent,
} from "react-native";
import ScrollBar from "./ScrollBar";

export interface DialogProps {
  visible: boolean;
  onDismiss?: () => void;
  children: ReactNode;
  dismissible?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  showCloseButton?: boolean;
  contentPadding?:
    | number
    | { top?: number; right?: number; bottom?: number; left?: number };
}

export default function Dialog({
  visible,
  onDismiss,
  children,
  dismissible = true,
  maxWidth = 450,
  maxHeight = 600,
  showCloseButton = true,
  contentPadding,
}: DialogProps) {
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  if (!visible) return null;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const handleContentSizeChange = (width: number, height: number) => {
    setContentHeight(height);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerHeight(event.nativeEvent.layout.height);
  };

  // Responsive sizing based on viewport width
  const getResponsiveValues = () => {
    if (Platform.OS !== "web") {
      return {
        scale: 1,
        padding: 16,
        maxWidthPercentage: 0.92,
        maxHeightPercentage: 0.8,
      };
    }

    const width = typeof window !== "undefined" ? window.innerWidth : 1280;
    const height = typeof window !== "undefined" ? window.innerHeight : 800;

    // Mobile
    if (width < 640) {
      return {
        scale: 0.85,
        padding: 16,
        maxWidthPercentage: 0.95,
        maxHeightPercentage: 0.9,
      };
    }

    // Tablet
    if (width < 1024) {
      return {
        scale: 0.95,
        padding: 32,
        maxWidthPercentage: 0.85,
        maxHeightPercentage: 0.85,
      };
    }

    // Desktop
    return {
      scale: 1,
      padding: 40,
      maxWidthPercentage: 0.9,
      maxHeightPercentage: 0.9,
    };
  };

  const { scale, padding, maxWidthPercentage, maxHeightPercentage } =
    getResponsiveValues();

  const handleBackdropPress = () => {
    if (dismissible && onDismiss) {
      onDismiss();
    }
  };

  const getContentPadding = () => {
    if (contentPadding === undefined) {
      return { padding: 24 * scale };
    }
    if (typeof contentPadding === "number") {
      return { padding: contentPadding * scale };
    }
    return {
      paddingTop: (contentPadding.top ?? 24) * scale,
      paddingRight: (contentPadding.right ?? 24) * scale,
      paddingBottom: (contentPadding.bottom ?? 24) * scale,
      paddingLeft: (contentPadding.left ?? 24) * scale,
    };
  };

  const calculatedMaxWidth =
    Platform.OS === "web" && typeof window !== "undefined"
      ? Math.min(maxWidth * scale, window.innerWidth * maxWidthPercentage)
      : Math.min(
          maxWidth * scale,
          Dimensions.get("window").width * maxWidthPercentage
        );

  const calculatedMaxHeight =
    Platform.OS === "web" && typeof window !== "undefined"
      ? Math.min(
          maxHeight * scale,
          window.innerHeight * (maxHeightPercentage || 0.9)
        )
      : Math.min(
          maxHeight * scale,
          Dimensions.get("window").height * (maxHeightPercentage || 0.9)
        );

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999999,
        elevation: 999999,
        padding: padding * scale,
        ...(Platform.OS === "web" && {
          position: "fixed" as any,
        }),
      }}
    >
      {/* Backdrop */}
      <Pressable
        onPress={handleBackdropPress}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
        }}
      />

      {/* Dialog Content */}
      <View
        style={{
          backgroundColor: "white",
          borderRadius: 16 * scale,
          maxWidth: calculatedMaxWidth,
          ...(Platform.OS === "web"
            ? { maxHeight: calculatedMaxHeight }
            : { height: calculatedMaxHeight }),
          width: "100%",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          zIndex: 2,
          elevation: 10,
          overflow: "hidden",
          position: "relative",
          ...(Platform.OS === "web" && {
            // @ts-ignore - web only
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          }),
        }}
      >
        {/* Close Button */}
        {showCloseButton && onDismiss && (
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            style={{
              position: "absolute",
              top: 12 * scale,
              right: 12 * scale,
              zIndex: 10,
              width: 32 * scale,
              height: 32 * scale,
              borderRadius: 16 * scale,
              backgroundColor: "#f3f4f6",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={20 * scale} color="#6b7280" />
          </Pressable>
        )}

        <View
          style={{
            flex: Platform.OS !== "web" ? 1 : undefined,
            position: "relative",
          }}
        >
          <ScrollView
            style={{
              flex: 1,
            }}
            contentContainerStyle={getContentPadding()}
            showsVerticalScrollIndicator={false}
            bounces={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
          >
            {children}
          </ScrollView>

          {/* Custom ScrollBar */}
          {Platform.OS !== "web" && (
            <ScrollBar
              contentHeight={contentHeight}
              containerHeight={containerHeight}
              scrollY={scrollY}
              visible={contentHeight > containerHeight}
            />
          )}
        </View>
      </View>
    </View>
  );
}
