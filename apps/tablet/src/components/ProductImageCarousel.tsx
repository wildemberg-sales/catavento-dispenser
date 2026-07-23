import React, { useState } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme/colors";

export function ProductImageCarousel({ images }: { images: { url: string; position: number }[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  // useWindowDimensions (não Dimensions.get, que só lê uma vez) — reage a
  // mudanças reais de tamanho (rotação, split-screen no Android). O carrossel
  // é full-bleed de propósito (ocupa a largura inteira da tela, sem o cap de
  // MAX_CONTENT_WIDTH usado no resto do conteúdo) — é a foto do produto, faz
  // sentido aproveitar o máximo de espaço disponível tanto no celular quanto
  // no tablet, diferente de texto/botões que ficam melhores numa coluna mais estreita.
  const windowWidth = useWindowDimensions().width;
  const contentWidth = windowWidth;

  if (images.length === 0) return null;

  const sorted = [...images].sort((a, b) => a.position - b.position);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / contentWidth);
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
        style={[styles.container, { width: contentWidth }]}
      >
        {sorted.map((image) => (
          <Image
            key={image.url}
            source={{ uri: image.url }}
            style={[styles.image, { width: contentWidth }]}
            contentFit="cover"
            cachePolicy="disk"
          />
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
    height: 340,
  },
  // Sem borderRadius de propósito — a imagem é full-bleed (encosta nas duas
  // bordas da tela), então cantos arredondados cortariam estranho.
  image: {
    height: 340,
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
