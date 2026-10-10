import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { Icon } from "@/src/components/Icon";
import { usesNativeTabs } from "@/src/navigation";
import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brand}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" />
          <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="setups">
          <NativeTabs.Trigger.Icon sf="scope" />
          <NativeTabs.Trigger.Label>Setups</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="charts">
          <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" />
          <NativeTabs.Trigger.Label>Charts</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="news">
          <NativeTabs.Trigger.Icon sf="newspaper.fill" />
          <NativeTabs.Trigger.Label>News</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarButtonTestID: "tab-dashboard",
          tabBarIcon: ({ color }) => <Icon name="view-dashboard-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="setups"
        options={{
          title: "Setups",
          tabBarButtonTestID: "tab-setups",
          tabBarIcon: ({ color }) => <Icon name="crosshairs-gps" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: "Charts",
          tabBarButtonTestID: "tab-charts",
          tabBarIcon: ({ color }) => <Icon name="chart-line" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "News",
          tabBarButtonTestID: "tab-news",
          tabBarIcon: ({ color }) => <Icon name="newspaper-variant-outline" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
