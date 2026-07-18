import React, { useState } from "react";
import { ScrollView, View, StyleSheet, Dimensions, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme/colors";

const CONTENT_WIDTH = Dimensions.get("window").width - 48;

export function ProductImageCarousel({ images }: { images: { url: string; position: number }[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;

  const sorted = [...images].sort((a, b) => a.position - b.position);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / CONTENT_WIDTH);
    setActiveIndex(index);
  }

  return (
    <View>
      <ScrollView
        testID="carousel-scrollview"
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.container}
      >
        {sorted.map((image) => (
          <Image key={image.url} source={{ uri: image.url }} style={styles.image} contentFit="cover" cachePolicy="disk" />
        ))}
      </ScrollView>
      {sorted.length > 1 ? (
        <View style={styles.dots} testID="carousel-dots">
          {sorted.map((image, index) => (
            <View
              key={image.url}
              testID={index === activeIndex ? "carousel-dot-active" : "carousel-dot"}
              style={[styles.dot, index === activeIndex ? styles.dotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CONTENT_WIDTH,
    height: 340,
  },
  image: {
    width: CONTENT_WIDTH,
    height: 340,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
});
