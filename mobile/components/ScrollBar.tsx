import React from "react";
import { View, StyleSheet, Animated } from "react-native";

interface ScrollBarProps {
  contentHeight: number;
  containerHeight: number;
  scrollY: Animated.Value;
  visible?: boolean;
}

export default function ScrollBar({
  contentHeight,
  containerHeight,
  scrollY,
  visible = true,
}: ScrollBarProps): React.ReactElement | null {
  if (!visible || contentHeight <= containerHeight) {
    return null;
  }

  // Track margins
  const TRACK_TOP_MARGIN = 24;
  const TRACK_BOTTOM_MARGIN = 12;
  const trackHeight = containerHeight - TRACK_TOP_MARGIN - TRACK_BOTTOM_MARGIN;

  // Calculate scrollbar height based on container/content ratio
  // Cap at ~1.5 inches (approximately 100-120px on mobile)
  const calculatedHeight = (containerHeight / contentHeight) * trackHeight;
  const scrollbarHeight = Math.min(
    Math.max(30, calculatedHeight), // Minimum 30px
    100 // Maximum ~1.5 inches on mobile
  );

  // Calculate maximum scroll distance
  const maxScroll = contentHeight - containerHeight;
  const maxScrollbarOffset = trackHeight - scrollbarHeight;

  // Interpolate scroll position to scrollbar position
  const scrollbarOffset = scrollY.interpolate({
    inputRange: [0, maxScroll],
    outputRange: [0, maxScrollbarOffset],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.track} pointerEvents="none">
      <Animated.View
        style={[
          styles.thumb,
          {
            height: scrollbarHeight,
            transform: [{ translateY: scrollbarOffset }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: "absolute",
    right: 8,
    top: 24,
    width: 6,
    borderRadius: 3,
    backgroundColor: "transparent",
  },
  thumb: {
    width: "100%",
    borderRadius: 3,
    backgroundColor: "#9ca3af",
    opacity: 0.6,
  },
});
