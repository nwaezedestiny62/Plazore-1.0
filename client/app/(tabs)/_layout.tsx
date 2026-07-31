import { Tabs, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { Ionicons, Feather } from '@expo/vector-icons';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { COLORS } from '@/constants';
import { useCart } from '@/context/CartContext';

const { width } = Dimensions.get('window');

const TAB_COUNT = 4;
const BAR_WIDTH = width * 0.88;
const TAB_WIDTH = BAR_WIDTH / TAB_COUNT;

export default function TabLayout() {
  const { cartItems } = useCart();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          cartCount={cartItems.length}
        />
      )}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ focused, color, size }) => (
            <Feather
              name="shopping-cart"
              size={size}
              color={focused ? COLORS.primary : color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function CustomTabBar({
  state,
  descriptors,
  navigation,
  cartCount,
}: any) {
  const pathname = usePathname()
  const currentRouteName = state.routes[state.index]?.name

  // Hide bottom bar on Cart, Checkout, and Orders
  const shouldHide =
    currentRouteName === 'cart' ||
    currentRouteName === 'checkout' ||
    pathname === '/cart' ||
    pathname === '/checkout' ||
    (typeof pathname === 'string' && pathname.startsWith('/orders'))

  const translateX = useSharedValue(state.index * TAB_WIDTH)

  useEffect(() => {
    translateX.value = withSpring(state.index * TAB_WIDTH, {
      damping: 18,
      stiffness: 180,
    })
  }, [state.index])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: translateX.value,
      },
    ],
  }))

  if (shouldHide) return null;

  return (
    <View style={styles.container}>
      <BlurView
        intensity={90}
        tint="light"
        style={styles.blur}
      >
        <View style={styles.bar}>
          {/* Animated Active Background */}
          <Animated.View
            style={[
              styles.activeTabBackground,
              animatedStyle,
            ]}
          />

          {state.routes.map(
            (route: any, index: number) => {
              const { options } =
                descriptors[route.key];

              const focused =
                state.index === index;

              const icon =
                options.tabBarIcon?.({
                  focused,
                  color: focused
                    ? COLORS.primary
                    : '#8E8E93',
                  size: 25,
                });

              return (
                <TouchableOpacity
                  key={route.key}
                  activeOpacity={0.8}
                  style={styles.tab}
                  onPress={() =>
                    navigation.navigate(
                      route.name
                    )
                  }
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          scale: focused
                            ? 1.12
                            : 1,
                        },
                      ],
                    }}
                  >
                    <View>
                      {icon}

                      {/* Cart Badge */}
                      {route.name ===
                        'cart' &&
                        cartCount > 0 && (
                          <View
                            style={
                              styles.badge
                            }
                          />
                        )}
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              );
            }
          )}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom:
      Platform.OS === 'ios'
        ? 30
        : 18,
    width: '100%',
    alignItems: 'center',
  },

  blur: {
    borderRadius: 999,
    overflow: 'hidden',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,

    elevation: 20,
  },

  bar: {
    width: BAR_WIDTH,
    height: 72,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.45)',
  },

  tab: {
    width: TAB_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },

  activeTabBackground: {
    position: 'absolute',
    width: TAB_WIDTH,
    height: 58,
    marginVertical: 7,
    borderRadius: 999,
    backgroundColor:
      COLORS.primary + '18',
  },

  badge: {
    position: 'absolute',
    top: -2,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#39FF14',
  },
});