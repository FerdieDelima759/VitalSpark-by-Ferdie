import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import ScrollBar from "./ScrollBar";

interface ScrollableViewProps {
  children: React.ReactNode;
  showScrollBar?: boolean;
  contentContainerStyle?: any;
  style?: any;
}

export default function ScrollableView({
  children,
  showScrollBar = true,
  contentContainerStyle,
  style,
}: ScrollableViewProps): React.ReactElement {
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  return (
    <View style={[styles.wrapper, style]} onLayout={handleLayout}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={contentContainerStyle}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={handleContentSizeChange}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {Platform.OS !== "web" && showScrollBar && (
        <ScrollBar
          contentHeight={contentHeight}
          containerHeight={containerHeight}
          scrollY={scrollY}
          visible={contentHeight > containerHeight}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
});

