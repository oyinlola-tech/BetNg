import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/** Lets code outside the navigator (the bet slip sheet, the auth gate) open a screen. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
