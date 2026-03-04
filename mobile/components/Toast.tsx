import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ToastProps {
  type: "success" | "error";
  message: string;
  title?: string;
  duration?: number;
  onDismiss: () => void;
  index?: number;
}

export default function Toast({
  type,
  message,
  title,
  duration = 4000,
  onDismiss,
  index = 0,
}: ToastProps) {
  const translateX = useSharedValue(400);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Simple slide in from right
    translateX.value = withTiming(0, { duration: 200 });
    opacity.value = withTiming(1, { duration: 200 });

    // Auto dismiss after duration
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    // Simple slide out to right
    translateX.value = withTiming(400, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => {
      onDismiss();
    }, 200);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const colors = {
    success: {
      background: "rgba(34, 139, 34, 0.95)",
      icon: "#ffffff",
      text: "#ffffff",
    },
    error: {
      background: "rgba(220, 38, 38, 0.9)",
      icon: "#ffffff",
      text: "#ffffff",
    },
  };

  const iconName = type === "success" ? "checkmark-circle" : "close-circle";
  const colorScheme = colors[type];

  // Responsive sizing based on viewport width
  const getResponsiveSize = () => {
    if (Platform.OS !== "web") return 1;

    const width = typeof window !== "undefined" ? window.innerWidth : 1280;
    if (width < 640) return 0.75; // Mobile
    if (width < 1024) return 0.85; // Tablet
    return 1; // Desktop
  };

  const scale = getResponsiveSize();

  // Calculate vertical offset for stacked toasts
  const toastHeight = 70; // Approximate height including margin
  const verticalOffset = index * toastHeight * scale;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: (16 + verticalOffset) * scale,
          right: 16 * scale,
          zIndex: 9999 - index,
          minWidth: 240 * scale,
          maxWidth: 320 * scale,
          backgroundColor: colorScheme.background,
          borderRadius: 8 * scale,
          padding: 10 * scale,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          ...(Platform.OS === "web" && {
            // @ts-ignore - web only
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
          }),
        },
        animatedStyle,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Ionicons
          name={iconName}
          size={18 * scale}
          color={colorScheme.icon}
          style={{ marginRight: 8 * scale, marginTop: 1 * scale }}
        />
        <View style={{ flex: 1, marginRight: 4 * scale }}>
          {title && (
            <Text
              style={{
                fontSize: 13 * scale,
                fontWeight: "600",
                color: colorScheme.text,
                marginBottom: 2 * scale,
              }}
            >
              {title}
            </Text>
          )}
          <Text
            style={{
              fontSize: 12 * scale,
              color: colorScheme.text,
              lineHeight: 16 * scale,
              opacity: 0.9,
            }}
          >
            {message}
          </Text>
        </View>
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          style={{
            padding: 2 * scale,
          }}
        >
          <Ionicons
            name="close"
            size={16 * scale}
            color={colorScheme.text}
            style={{ opacity: 0.6 }}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}
