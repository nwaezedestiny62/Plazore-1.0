import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { COLORS } from '@/constants';

const { width } = Dimensions.get('window');
const PILL_WIDTH = width * 0.88;
const TAB_WIDTH = PILL_WIDTH / 4;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather name="shopping-cart" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const translateX = useSharedValue(0);

  React.useEffect(() => {
    const centerOffset = (TAB_WIDTH - (TAB_WIDTH - 28)) / 2; // Perfect centering

    translateX.value = withSpring(state.index * TAB_WIDTH + centerOffset, {
      damping: 25,
      stiffness: 180,
      mass: 0.8,
    });
  }, [state.index]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container}>
      <BlurView intensity={85} tint="light" style={styles.blurContainer}>
        <View style={styles.pill}>
          {/* Glowing Active Indicator */}
          <Animated.View style={[styles.glowIndicator, animatedGlowStyle]} />

          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const icon = options.tabBarIcon({
              color: isFocused ? COLORS.primary : '#8E8E93',
              focused: isFocused,
            });

            const isCart = index === 1; // Middle tab (Cart)

            return (
              <TouchableOpacity
                key={index}
                onPress={() => navigation.navigate(route.name)}
                style={[styles.tab, isCart && styles.middleTab]}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={[
                    styles.iconContainer,
                    { transform: [{ scale: isFocused ? 1.0 : 1 }] },
                  ]}
                >
                  {icon}
                </Animated.View>

                {/* Active dot for non-middle tabs */}
                {isFocused && !isCart && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  blurContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  pill: {
    width: PILL_WIDTH,
    height: 68,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  glowIndicator: {
    position: 'absolute',
    top: 6,
    left: 0,
    width: TAB_WIDTH - 28,
    height: 56,
    backgroundColor: COLORS.primary + '22',
    borderRadius: 999,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  middleTab: {
    transform: [{ scale: 1.18 }],
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: 10,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
});