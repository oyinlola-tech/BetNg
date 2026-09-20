import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from "@react-navigation/native";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Radio, Receipt, Trophy, UserRound } from "lucide-react-native";
import { Pressable, SlipBar, Text } from "../components";
import { useTheme } from "../theme";
import type { RootStackParamList, TabParamList } from "./types";
import {
  AccountScreen,
  BetsScreen,
  HistoryScreen,
  HomeScreen,
  LeagueScreen,
  LiveScreen,
  MatchScreen,
  NotificationsScreen,
  ResultsScreen,
  SettingsScreen,
  StandingsScreen,
  TeamScreen,
  TransactionsScreen,
  VirtualsScreen,
  WalletScreen,
} from "../screens";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS = {
  Home,
  Live: Radio,
  Virtuals: Trophy,
  Bets: Receipt,
  Account: UserRound,
} as const;

function TabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <>
      <SlipBar bottom={insets.bottom + 56} />
      <View
        style={{
          flexDirection: "row",
          backgroundColor: t.colors.surface,
          borderTopWidth: 1,
          borderTopColor: t.colors.border,
          paddingBottom: insets.bottom,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = TAB_ICONS[route.name as keyof typeof TAB_ICONS];
          const label = descriptors[route.key]?.options.title ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented)
                  navigation.navigate(route.name);
              }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                height: 56,
                gap: 3,
              }}
            >
              <View style={{ position: "relative" }}>
                <Icon
                  size={22}
                  color={focused ? t.colors.brand : t.colors.textMuted}
                  strokeWidth={focused ? 2.4 : 2}
                />
                {route.name === "Live" && (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -4,
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: t.colors.live,
                    }}
                  />
                )}
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: focused ? "700" : "500",
                  color: focused ? t.colors.brand : t.colors.textMuted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function Tabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="Live"
        component={LiveScreen}
        options={{ title: "Live" }}
      />
      <Tab.Screen
        name="Virtuals"
        component={VirtualsScreen}
        options={{ title: "Virtuals" }}
      />
      <Tab.Screen
        name="Bets"
        component={BetsScreen}
        options={{ title: "Bets" }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: "Account" }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator(): React.JSX.Element {
  const t = useTheme();
  const base = t.name === "dark" ? DarkTheme : DefaultTheme;
  const navTheme: NavTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: t.colors.brand,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.colors.textPrimary,
      border: t.colors.border,
      notification: t.colors.live,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: t.colors.surface },
          headerTintColor: t.colors.textPrimary,
          headerTitleStyle: { fontWeight: "700", fontSize: 16 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: t.colors.background },
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Match"
          component={MatchScreen}
          options={{ title: "Match" }}
        />
        <Stack.Screen
          name="League"
          component={LeagueScreen}
          options={{ title: "League" }}
        />
        <Stack.Screen
          name="Standings"
          component={StandingsScreen}
          options={{ title: "Standings" }}
        />
        <Stack.Screen
          name="Results"
          component={ResultsScreen}
          options={{ title: "Results" }}
        />
        <Stack.Screen
          name="Team"
          component={TeamScreen}
          options={{ title: "Team" }}
        />
        <Stack.Screen
          name="Wallet"
          component={WalletScreen}
          options={{ title: "Wallet" }}
        />
        <Stack.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ title: "Transactions" }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: "Notifications" }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Settings" }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: "Watched" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
