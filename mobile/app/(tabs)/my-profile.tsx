import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/contexts/UserContext";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useUserData } from "@/hooks/useUserData";
import Dialog from "@/components/Dialog";
import Toast from "@/components/Toast";
import { useTranslation } from "@/node_modules/react-i18next";
import i18n from "@/i18n";

interface ToastMessage {
  id: string;
  type: "success" | "error";
  title: string;
  message: string;
}

interface SettingToggleProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

const SettingToggle = ({
  icon,
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: SettingToggleProps) => (
  <View
    className="flex-row items-center rounded-xl"
    style={{
      paddingVertical: 12,
      paddingHorizontal: 12,
    }}
  >
    <View
      className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center shrink-0"
      style={{ marginRight: 12 }}
    >
      <Ionicons name={icon} size={18} color="#0f766e" />
    </View>
    <View className="flex-1" style={{ paddingRight: 12 }}>
      <Text
        className="text-[15px] font-semibold text-gray-900"
        style={{ marginBottom: 2 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
      <Text
        className="text-[13px] text-gray-500"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {description}
      </Text>
    </View>
    <View className="shrink-0">
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#e5e7eb", true: "#a7f3d0" }}
        thumbColor={value ? "#0f766e" : "#9ca3af"}
        ios_backgroundColor="#e5e7eb"
      />
    </View>
  </View>
);

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  onPress: () => void;
  showChevron?: boolean;
  textColor?: string;
}

const SettingItem = ({
  icon,
  title,
  description,
  onPress,
  showChevron = true,
  textColor = "#111827",
}: SettingItemProps) => (
  <Pressable
    onPress={onPress}
    className="rounded-xl active:opacity-90"
    accessibilityRole="button"
    android_ripple={{ color: "rgba(0, 0, 0, 0.1)", borderless: false }}
  >
    <View
      className="flex-row items-center"
      style={{
        paddingVertical: 12,
        paddingHorizontal: 12,
      }}
    >
      <View
        className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center shrink-0"
        style={{ marginRight: 12 }}
      >
        <Ionicons name={icon} size={18} color="#0f766e" />
      </View>
      <View className="flex-1" style={{ paddingRight: 12 }}>
        <Text
          className="text-[15px] font-semibold"
          style={{ color: textColor, marginBottom: 2 }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {description && (
          <Text
            className="text-[13px] text-gray-500"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {description}
          </Text>
        )}
      </View>
      {showChevron && (
        <View className="shrink-0">
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </View>
      )}
    </View>
  </Pressable>
);

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

const SectionCard = ({ title, children }: SectionCardProps) => (
  <View
    className="bg-white rounded-[20px] border border-gray-200 mb-6 overflow-hidden"
    style={styles.sectionCardShadow}
  >
    <View
      className="bg-slate-50 border-b border-gray-200"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text className="text-xs tracking-[2px] font-bold text-gray-500 uppercase">
        {title}
      </Text>
    </View>
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 8,
      }}
    >
      {children}
    </View>
  </View>
);

const Divider = () => (
  <View
    style={{
      height: 1,
      backgroundColor: "#e5e7eb",
      marginHorizontal: 12,
      marginVertical: 0,
    }}
  />
);

export default function MyProfileScreen() {
  const { t } = useTranslation("common");
  const { user, signOut } = useAuth();
  const { userProfile, loadingState, refreshUserData, clearUserData } =
    useUserContext();
  const { updateUserProfile } = useUserData();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bmiModalOpen, setBmiModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const screenHeight = Dimensions.get("window").height;
  const screenWidth = Dimensions.get("window").width;
  const isWeb = Platform.OS === "web";
  const viewportHeight =
    isWeb && typeof window !== "undefined" ? window.innerHeight : screenHeight;
  const isSmallViewport = viewportHeight < 700 || screenWidth < 400;

  useMobileWebRedirect(true);

  // Toast helper functions
  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    const title = type === "success" ? t("common.success") : t("common.error");

    if (Platform.OS === "web") {
      // Show toast notification on web
      const newToast: ToastMessage = {
        id: Date.now().toString(),
        type,
        title,
        message,
      };
      setToasts((prev) => [...prev, newToast]);
    } else {
      // Show native alert on mobile
      Alert.alert(title, message);
    }
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Helper function to save language to storage
  const saveLanguageToStorage = async (language: string) => {
    try {
      if (Platform.OS === "web") {
        // Save to localStorage for web
        localStorage.setItem("i18nextLng", language);
      } else {
        // Save to AsyncStorage for mobile
        await AsyncStorage.setItem("i18nextLng", language);
      }
    } catch (error) {
      // Silently fail - language storage is not critical
    }
  };

  // Synchronize i18n language with userProfile preferred language
  useEffect(() => {
    const syncLanguage = async () => {
      if (
        userProfile?.preferred_language &&
        i18n.language !== userProfile.preferred_language
      ) {
        await i18n.changeLanguage(userProfile.preferred_language);
        await saveLanguageToStorage(userProfile.preferred_language);
      }
    };
    syncLanguage();
  }, [userProfile?.preferred_language]);

  const calculateBMI = (): string | null => {
    const height = userProfile?.height;
    const weight = userProfile?.weight;
    const heightUnit = userProfile?.height_unit;
    const weightUnit = userProfile?.weight_unit;

    if (!height || !weight) return null;

    // Convert height to meters
    let heightInMeters: number;
    if (heightUnit === "inches") {
      heightInMeters = height * 0.0254;
    } else if (heightUnit === "feet") {
      heightInMeters = height * 0.3048;
    } else {
      heightInMeters = height / 100; // cm to meters
    }

    // Convert weight to kg
    let weightInKg: number;
    if (weightUnit === "lbs" || weightUnit === "pounds") {
      weightInKg = weight * 0.453592;
    } else {
      weightInKg = weight;
    }

    return (weightInKg / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const getBMIClassification = (bmi: string | null) => {
    if (!bmi) return null;

    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) {
      return {
        label: t("profile.underweight"),
        color: "#3b82f6",
        bgColor: "#dbeafe",
      };
    } else if (bmiValue >= 18.5 && bmiValue <= 24.9) {
      return {
        label: t("profile.healthyWeight"),
        color: "#10b981",
        bgColor: "#d1fae5",
      };
    } else if (bmiValue >= 25.0 && bmiValue <= 29.9) {
      return {
        label: t("profile.overweight"),
        color: "#f59e0b",
        bgColor: "#fef3c7",
      };
    } else {
      return {
        label: t("profile.obesity"),
        color: "#ef4444",
        bgColor: "#fee2e2",
      };
    }
  };

  const formatHeight = (): string => {
    const height = userProfile?.height;
    const heightUnit = userProfile?.height_unit;

    if (!height) return "N/A";

    if (heightUnit === "inches") {
      const feet = Math.floor(height / 12);
      const inches = Math.round(height % 12);
      return `${feet}'${inches}"`;
    } else if (heightUnit === "feet") {
      return `${height} ft`;
    } else {
      return `${height} cm`;
    }
  };

  const formatWeight = (): string => {
    const weight = userProfile?.weight;
    const weightUnit = userProfile?.weight_unit;

    if (!weight) return "N/A";

    const unit = weightUnit || "kg";
    return `${weight} ${unit}`;
  };

  const handleManageProfile = () => {
    router.push("/(tabs)/manage-profile");
  };

  const handleSignOut = async () => {
    if (!user) {
      Alert.alert(t("common.error"), t("common.error"));
      return;
    }

    if (Platform.OS === "web") {
      setConfirmOpen(true);
      return;
    }

    Alert.alert(t("profile.signOut"), t("profile.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.signOut"),
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            // Clear user data first
            clearUserData();
            // Then sign out
            await signOut();
            // Navigate to login after successful sign out
            router.replace("/(auth)/login");
          } catch (error) {
            setBusy(false);
            Alert.alert(t("common.error"), t("common.error"));
          }
        },
      },
    ]);
  };

  const confirmSignOut = async () => {
    if (busy) return;

    if (!user) {
      Alert.alert(t("common.error"), t("common.error"));
      setConfirmOpen(false);
      return;
    }

    try {
      setBusy(true);
      // Clear user data first
      clearUserData();
      // Then sign out
      await signOut();
      // Navigate to login after successful sign out
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert(t("common.error"), t("common.error"));
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const getPlanBadgeText = (): string => {
    const planCode = userProfile?.plan_code?.toLowerCase();
    if (planCode === "premium") return "Premium Member";
    if (planCode === "pro") return "Pro Member";
    return "VitalSpark Member";
  };

  const getPlanBadgeColors = (): { bg: string; text: string } => {
    const planCode = userProfile?.plan_code?.toLowerCase();
    if (planCode === "premium") return { bg: "#fef3c7", text: "#f59e0b" };
    if (planCode === "pro") return { bg: "#dbeafe", text: "#3b82f6" };
    return { bg: "#fef3c7", text: "#f59e0b" };
  };

  const getLanguageDisplay = (langCode: string | undefined): string => {
    if (!langCode) return t("languages.en");
    const languageMap: Record<string, string> = {
      en: t("languages.en"),
      es: t("languages.es"),
      fil: t("languages.fil"),
    };
    return languageMap[langCode] || t("languages.en");
  };

  const handleLanguageEdit = () => {
    // Always use userProfile.preferred_language as source of truth
    const currentLang = userProfile?.preferred_language || "en";
    setSelectedLanguage(currentLang);
    setLanguageModalVisible(true);
  };

  const handleSaveLanguage = async () => {
    if (!user?.id || !selectedLanguage || savingLanguage) return;
    try {
      setSavingLanguage(true);

      // Change i18n language immediately for UI update
      await i18n.changeLanguage(selectedLanguage);

      // Save to storage (AsyncStorage for mobile, localStorage for web)
      await saveLanguageToStorage(selectedLanguage);

      setLanguageModalVisible(false);
      setSelectedLanguage("");
      setSavingLanguage(false);

      // Show success message and update database after user confirms
      if (Platform.OS === "web") {
        // Web: Update database immediately and show toast
        const updateData = { preferred_language: selectedLanguage };
        const result = await updateUserProfile(user.id, updateData);

        if (!result.success) {
          showToast(t("profile.languageUpdateError"), "error");
        } else {
          showToast(t("profile.languagePreferenceSaved"), "success");
        }
      } else {
        // Mobile: Show alert first, then update database when user clicks OK
        Alert.alert(t("common.success"), t("profile.languagePreferenceSaved"), [
          {
            text: t("common.ok"),
            onPress: async () => {
              // Update database after user dismisses alert (this will trigger refresh)
              const updateData = { preferred_language: selectedLanguage };
              const result = await updateUserProfile(user.id, updateData);

              if (!result.success) {
                Alert.alert(
                  t("common.error"),
                  t("profile.languageUpdateError")
                );
              }
            },
          },
        ]);
      }
    } catch (error) {
      setSavingLanguage(false);
      showToast(t("profile.languageUpdateError"), "error");
    }
  };

  if (loadingState.isLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#f1f5f9" }}
        edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: "#6b7280",
            }}
          >
            {t("common.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#f1f5f9" }}
      edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
    >
      {/* HERO BAND */}
      <LinearGradient
        colors={["#0d9488", "#0f766e", "#134e4a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: 24,
          paddingTop: Platform.OS === "ios" ? 20 : 40,
          paddingBottom: 140,
          borderBottomLeftRadius: 22,
          borderBottomRightRadius: 22,
        }}
      >
        <Text
          style={{
            color: "rgba(255, 255, 255, 0.9)",
            fontSize: 12,
            letterSpacing: 2,
            textTransform: "uppercase",
            fontWeight: "600",
          }}
        >
          {t("profile.account").toUpperCase()}
        </Text>
        <Text
          style={{
            color: "#ffffff",
            fontSize: 32,
            fontWeight: "800",
            marginTop: 4,
          }}
        >
          {t("profile.myProfile")}
        </Text>
        <Text
          style={{
            color: "#ccfbf1",
            fontSize: 13,
            marginTop: 4,
          }}
        >
          {t("profile.manageIdentity")}
        </Text>
      </LinearGradient>

      <ScrollView
        style={{
          flex: 1,
          marginTop: -128,
        }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 0,
          paddingBottom: 40,
        }}
        scrollEnabled={!confirmOpen}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === "ios"}
      >
        {/* OVERLAPPING PROFILE CARD */}
        <View
          style={[
            styles.profileCardShadow,
            {
              backgroundColor: "#ffffff",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              marginBottom: 24,
              paddingHorizontal: 20,
              paddingVertical: 24,
              marginTop: 0,
            },
          ]}
        >
          {/* Centered Icon with Amber Gradient */}
          <View className="items-center mb-4">
            <LinearGradient
              colors={["#f59e0b", "#d97706", "#b45309"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-20 h-20 rounded-[20px] items-center justify-center"
            >
              <Ionicons name="person" size={42} color="#ffffff" />
            </LinearGradient>
          </View>

          {/* Email and Member Chip */}
          <View className="items-center mb-6">
            <Text
              className="text-base font-bold text-gray-900 mb-2"
              numberOfLines={1}
            >
              {user?.email || "User"}
            </Text>
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: getPlanBadgeColors().bg }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: getPlanBadgeColors().text }}
              >
                {getPlanBadgeText()}
              </Text>
            </View>
          </View>

          {/* Height, Weight, BMI - 3 Columns */}
          <View className="flex-row justify-between mb-6">
            <View className="flex-1 items-center">
              <Text className="text-[11px] text-gray-500 uppercase tracking-[1px] mb-1">
                {t("profile.height").toUpperCase()}
              </Text>
              <Text className="text-base font-bold text-gray-900">
                {formatHeight()}
              </Text>
            </View>
            <View className="w-[1px] bg-gray-200 mx-2" />
            <View className="flex-1 items-center">
              <Text className="text-[11px] text-gray-500 uppercase tracking-[1px] mb-1">
                {t("profile.weight").toUpperCase()}
              </Text>
              <Text className="text-base font-bold text-gray-900">
                {formatWeight()}
              </Text>
            </View>
            <View className="w-[1px] bg-gray-200 mx-2" />
            <View className="flex-1 items-center">
              <View className="flex-row items-center mb-1">
                <Text className="text-[11px] text-gray-500 uppercase tracking-[1px]">
                  {t("profile.bmi").toUpperCase()}
                </Text>
                {calculateBMI() && (
                  <Pressable
                    onPress={() => setBmiModalOpen(true)}
                    className="ml-1"
                  >
                    <View
                      className="w-4 h-4 rounded-lg items-center justify-center"
                      style={{
                        backgroundColor:
                          getBMIClassification(calculateBMI())?.bgColor ||
                          "#f3f4f6",
                      }}
                    >
                      <Ionicons
                        name="information-circle"
                        size={10}
                        color={
                          getBMIClassification(calculateBMI())?.color ||
                          "#6b7280"
                        }
                      />
                    </View>
                  </Pressable>
                )}
              </View>
              <Text className="text-base font-bold text-gray-900">
                {calculateBMI() || "N/A"}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View
            className="flex-row items-center"
            style={{
              gap: 12,
              marginTop: 0,
            }}
          >
            <Pressable
              onPress={handleManageProfile}
              className="rounded-2xl overflow-hidden"
              style={[
                styles.manageButtonShadow,
                {
                  flex: 1,
                  height: 48,
                },
              ]}
              android_ripple={{
                color: "rgba(255, 255, 255, 0.2)",
                borderless: false,
              }}
            >
              <LinearGradient
                colors={["#f59e0b", "#d97706"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="settings"
                    size={14}
                    color="#ffffff"
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    className="text-[13px] font-semibold text-white"
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.8}
                    style={{ textAlign: "center" }}
                  >
                    {t("profile.manageProfile")}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Sign Out Button - Secondary Action */}
            {user && (
              <Pressable
                onPress={handleSignOut}
                className="rounded-2xl overflow-hidden"
                style={[
                  styles.signOutButtonShadow,
                  {
                    flex: 0,
                    minWidth: 100,
                    height: 48,
                  },
                ]}
                android_ripple={{
                  color: "rgba(255, 255, 255, 0.2)",
                  borderless: false,
                }}
              >
                <LinearGradient
                  colors={["#ef4444", "#dc2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 16,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={14}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      className="text-[13px] font-semibold text-white"
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.8}
                      style={{ textAlign: "center" }}
                    >
                      {t("profile.signOut")}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>

        {/* PREFERENCES */}
        <SectionCard title={t("profile.preferences").toUpperCase()}>
          <SettingToggle
            icon="notifications"
            title={t("profile.pushNotifications")}
            description={t("profile.receiveWorkoutReminders")}
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
          <Divider />
          <SettingToggle
            icon="moon"
            title={t("profile.darkMode")}
            description={t("profile.useDarkTheme")}
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
          />
          <Divider />
          <SettingItem
            icon="language"
            title={t("profile.language")}
            description={getLanguageDisplay(userProfile?.preferred_language)}
            onPress={handleLanguageEdit}
          />
        </SectionCard>

        {/* SUPPORT */}
        <SectionCard title={t("profile.support").toUpperCase()}>
          <SettingItem
            icon="help-circle"
            title={t("profile.helpCenter")}
            description={t("profile.getAnswersToQuestions")}
            onPress={() => {
              Alert.alert(t("profile.comingSoon"), t("profile.helpCenterSoon"));
            }}
          />
          <Divider />
          <SettingItem
            icon="chatbubble-ellipses"
            title={t("profile.contactSupport")}
            description={t("profile.getHelpFromTeam")}
            onPress={() => {
              Alert.alert(
                t("profile.comingSoon"),
                t("profile.supportChatSoon")
              );
            }}
          />
          <Divider />
          <SettingItem
            icon="star"
            title={t("profile.rateVitalSpark")}
            description={t("profile.shareYourFeedback")}
            onPress={() => {
              Alert.alert(
                t("profile.thankYou"),
                t("profile.appreciateFeedback")
              );
            }}
          />
        </SectionCard>

        {/* ABOUT */}
        <SectionCard title={t("profile.about").toUpperCase()}>
          <SettingItem
            icon="information-circle"
            title={t("profile.appVersion")}
            description="1.0.0"
            onPress={() => {}}
            showChevron={false}
          />
          <Divider />
          <SettingItem
            icon="document-text"
            title={t("profile.termsOfService")}
            onPress={() => {
              Alert.alert(t("profile.comingSoon"), t("profile.termsSoon"));
            }}
          />
          <Divider />
          <SettingItem
            icon="shield-checkmark"
            title={t("profile.privacyPolicy")}
            onPress={() => {
              Alert.alert(t("profile.comingSoon"), t("profile.privacySoon"));
            }}
          />
        </SectionCard>

        <View className="h-10" />
      </ScrollView>

      {/* Sign Out Confirmation Dialog */}
      <Dialog
        visible={confirmOpen}
        onDismiss={!busy ? () => setConfirmOpen(false) : undefined}
        dismissible={!busy}
        maxWidth={440}
        showCloseButton={!busy}
      >
        <View>
          <Text className="text-lg font-bold text-gray-900">
            {t("profile.signOut")}
          </Text>
          <Text className="text-gray-600 mt-1.5">
            {t("profile.signOutConfirm")}
          </Text>
          <View
            className="flex-row justify-end items-center mt-4"
            style={{ gap: 12 }}
          >
            <Pressable
              disabled={busy}
              onPress={() => setConfirmOpen(false)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 40,
              }}
              android_ripple={{
                color: "rgba(0, 0, 0, 0.1)",
                borderless: false,
              }}
            >
              <Text
                className="text-gray-900 font-semibold"
                style={{ textAlign: "center" }}
              >
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={confirmSignOut}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: busy ? "#f87171" : "#ef4444",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 40,
              }}
              android_ripple={{
                color: "rgba(255, 255, 255, 0.2)",
                borderless: false,
              }}
            >
              <Text
                className="text-white font-bold"
                style={{ textAlign: "center" }}
              >
                {busy ? t("profile.signingOut") : t("profile.signOut")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Dialog>

      {/* BMI Information Dialog */}
      <Modal
        visible={bmiModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBmiModalOpen(false)}
      >
        <Pressable
          onPress={() => setBmiModalOpen(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        />

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 20,
              width: "100%",
              maxWidth: 400,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              ...(Platform.OS !== "web" && {
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 8 },
                elevation: 15,
              }),
            }}
          >
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#e5e7eb",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  backgroundColor:
                    getBMIClassification(calculateBMI())?.bgColor || "#f3f4f6",
                }}
              >
                <Ionicons
                  name="fitness"
                  size={20}
                  color={
                    getBMIClassification(calculateBMI())?.color || "#6b7280"
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: isSmallViewport ? 16 : 18,
                    fontWeight: "800",
                    color: "#111827",
                  }}
                >
                  {t("profile.bmi")}{" "}
                  {t("common.result", { defaultValue: "Result" })}
                </Text>
                <Text
                  style={{
                    fontSize: isSmallViewport ? 13 : 14,
                    color: "#6b7280",
                    marginTop: 2,
                  }}
                >
                  {t("profile.bodyMassIndex")}
                </Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: viewportHeight * 0.6 }}>
              <View style={{ padding: 20 }}>
                <View
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 40 : 48,
                      fontWeight: "900",
                      color:
                        getBMIClassification(calculateBMI())?.color ||
                        "#6b7280",
                      marginBottom: 4,
                    }}
                  >
                    {calculateBMI()}
                  </Text>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 13 : 14,
                      color: "#6b7280",
                      fontWeight: "600",
                    }}
                  >
                    {t("profile.bmi")}{" "}
                    {t("common.score", { defaultValue: "Score" })}
                  </Text>
                </View>

                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 13 : 14,
                      color: "#6b7280",
                      marginBottom: 8,
                    }}
                  >
                    {t("profile.classification")}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor:
                        getBMIClassification(calculateBMI())?.bgColor ||
                        "#f3f4f6",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: isSmallViewport ? 13 : 14,
                        fontWeight: "800",
                        color:
                          getBMIClassification(calculateBMI())?.color ||
                          "#6b7280",
                        letterSpacing: 0.5,
                      }}
                    >
                      {getBMIClassification(calculateBMI())?.label || ""}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color="#0f766e"
                    />
                    <Text
                      style={{
                        fontSize: isSmallViewport ? 13 : 14,
                        fontWeight: "700",
                        color: "#111827",
                        marginLeft: 8,
                      }}
                    >
                      Health Tip
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 12 : 13,
                      color: "#6b7280",
                      lineHeight: 20,
                    }}
                  >
                    BMI is a screening tool. Consult with a healthcare
                    professional for personalized health advice.
                  </Text>
                </View>

                <View>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 13 : 14,
                      fontWeight: "800",
                      color: "#111827",
                      marginBottom: 12,
                    }}
                  >
                    {t("profile.bmiRanges")}
                  </Text>
                  <View style={{ rowGap: 8 }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          marginRight: 12,
                          backgroundColor: "#3b82f6",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          flex: 1,
                        }}
                      >
                        {t("profile.underweight")}
                      </Text>
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        &lt; 18.5
                      </Text>
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          marginRight: 12,
                          backgroundColor: "#10b981",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          flex: 1,
                        }}
                      >
                        {t("profile.healthyWeight")}
                      </Text>
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        18.5 - 24.9
                      </Text>
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          marginRight: 12,
                          backgroundColor: "#f59e0b",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          flex: 1,
                        }}
                      >
                        {t("profile.overweight")}
                      </Text>
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        25.0 - 29.9
                      </Text>
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          marginRight: 12,
                          backgroundColor: "#ef4444",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          flex: 1,
                        }}
                      >
                        {t("profile.obesity")}
                      </Text>
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        ≥ 30.0
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: "#e5e7eb",
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <TouchableOpacity
                onPress={() => setBmiModalOpen(false)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: "#0f766e",
                }}
              >
                <Text
                  style={{
                    fontSize: isSmallViewport ? 14 : 16,
                    fontWeight: "700",
                    color: "#fff",
                  }}
                >
                  {t("common.ok")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable
          onPress={() => setLanguageModalVisible(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 20,
              width: "100%",
              maxWidth: 400,
              padding: 20,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              ...(Platform.OS === "web"
                ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                : {
                    shadowColor: "#000",
                    shadowOpacity: 0.3,
                    shadowRadius: 15,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 15,
                  }),
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#111827",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              {t("profile.selectLanguage")}
            </Text>
            <View style={{ marginBottom: 20 }}>
              {[
                { value: "en", label: t("languages.en") },
                { value: "es", label: t("languages.es") },
                { value: "fil", label: t("languages.fil") },
              ].map((language) => (
                <TouchableOpacity
                  key={language.value}
                  onPress={() => setSelectedLanguage(language.value)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    marginBottom: 8,
                    backgroundColor:
                      selectedLanguage === language.value
                        ? "#f0fdfa"
                        : "#f9fafb",
                    borderWidth: 1,
                    borderColor:
                      selectedLanguage === language.value
                        ? "#14b8a6"
                        : "#e5e7eb",
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor:
                        selectedLanguage === language.value
                          ? "#14b8a6"
                          : "#d1d5db",
                      marginRight: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selectedLanguage === language.value && (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: "#14b8a6",
                        }}
                      />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color:
                        selectedLanguage === language.value
                          ? "#0f766e"
                          : "#374151",
                    }}
                  >
                    {language.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => setLanguageModalVisible(false)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: "#f3f4f6",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveLanguage}
                disabled={savingLanguage}
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  opacity: savingLanguage ? 0.7 : 1,
                  minWidth: 80,
                }}
              >
                <LinearGradient
                  colors={["#0f766e", "#14b8a6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {savingLanguage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#fff",
                      }}
                    >
                      {t("common.save")}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast Notifications (Web only) */}
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onDismiss={() => dismissToast(toast.id)}
          index={index}
        />
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Platform-specific shadows only
  profileCardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  manageButtonShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#f59e0b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 4px 8px rgba(245, 158, 11, 0.25)",
      },
    }),
  },
  signOutButtonShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#ef4444",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 4px 8px rgba(239, 68, 68, 0.25)",
      },
    }),
  },
  sectionCardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
      },
    }),
  },
});
