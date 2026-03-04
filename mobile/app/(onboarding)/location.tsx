import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnboardingHeader } from "../../contexts/OnboardingHeaderContext";
import { useDesktopWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useUserData } from "../../hooks/useUserData";
import { useUserContext } from "../../contexts/UserContext";
import { auth } from "../../hooks/useAuth";
import countriesData from "../../lib/data/countries.json";
import subdivisionsData from "../../lib/data/subdivisions.json";

export default function LocationOnboarding() {
  const { t } = useTranslation("common");
  const { setHeader } = useOnboardingHeader();
  const [countries, setCountries] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });
  const { upsertUserProfile } = useUserData();
  const { userProfile } = useUserContext();

  useDesktopWebRedirect();

  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isWeb = Platform.OS === "web";

  const getScaleFactor = () => {
    if (!isWeb) return 1;
    if (screenWidth >= 1280) return 1;
    if (screenWidth >= 1024) return 0.85;
    if (screenWidth >= 768) return 0.75;
    return 0.65;
  };
  const scaleFactor = getScaleFactor();

  const viewportHeight =
    isWeb && typeof window !== "undefined" ? window.innerHeight : screenHeight;

  const isSmallViewport = viewportHeight < 700;
  const topMargin = isSmallViewport
    ? isWeb && screenWidth < 1280
      ? 8
      : 16
    : 0;
  const titleSize = isSmallViewport ? 22 : 26;
  const subtitleSize = isSmallViewport ? 14 : 16;

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    try {
      const countryNames = countriesData.map((c) => c.name);
      setCountries(countryNames);
    } catch (e) {
      setError("Failed to load countries");
    } finally {
      setLoading(false);
    }
  }, []);

  // Preload existing user location data
  useEffect(() => {
    if (userProfile) {
      if (userProfile.country) {
        setSelectedCountry(userProfile.country);
        try {
          const countrySubdivisions =
            subdivisionsData[
              userProfile.country as keyof typeof subdivisionsData
            ];
          if (countrySubdivisions) {
            const stateNames = countrySubdivisions.map(
              (subdivision: any) => subdivision.name
            );
            setStates(stateNames);
          }
        } catch {
          setStates([]);
        }
      }
      if (userProfile.region_province) {
        setSelectedState(userProfile.region_province);
      }
    }
  }, [userProfile]);

  const isValid = !!selectedCountry && !!selectedState;

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      const { data: user } = await auth.getCurrentUser();
      if (user) {
        const result = await upsertUserProfile({
          user_id: user.id,
          country: selectedCountry || undefined,
          region_province: selectedState || undefined,
          current_step: Math.max(userProfile?.current_step || 4, 5),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save location:", result.error);
          setError("Failed to save your location. Please try again.");
          setBusy(false);
          return;
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/height");
    } catch (e: any) {
      console.error("Location save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/(onboarding)/profile");
  };

  const onNext = () => {
    if (isValid) handleContinue();
  };

  useEffect(() => {
    setHeader({
      currentStep: 4,
      totalSteps: 9,
      onBack,
      onNext,
      nextDisabled: busy || !isValid,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, isValid]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#101A2C" }}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#101A2C",
          alignItems: isWeb ? "center" : "stretch",
          justifyContent: "flex-start",
        }}
      >
        <View
          style={[
            {
              flex: 1,
              backgroundColor: "#101A2C",
              paddingHorizontal: isSmallViewport ? 16 : 24,
              paddingTop: isSmallViewport ? 8 : 16,
              paddingBottom: isSmallViewport ? 16 : 32,
              width: isWeb ? "80%" : "100%",
              maxWidth: 960,
              maxHeight: isWeb ? viewportHeight - 80 : undefined,
              alignSelf: "center",
            },
            isWeb && scaleFactor < 1
              ? { transform: [{ scale: scaleFactor }] }
              : null,
          ]}
        >
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
              <ScrollView
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingBottom: isSmallViewport ? 8 : 16,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Pressable
                  onPress={() => {
                    setShowCountryDropdown(false);
                    setShowStateDropdown(false);
                    setCountrySearch("");
                    setStateSearch("");
                  }}
                >
                  <View style={{ marginTop: topMargin, marginBottom: 24 }}>
                    <Text
                      style={{
                        color: "#f59e0b",
                        fontSize: titleSize,
                        fontWeight: "700",
                        textAlign: "center",
                        marginBottom: 10,
                        letterSpacing: 0.5,
                      }}
                    >
                      {t("onboarding.letsGetToKnowYou")}
                    </Text>
                    <Text
                      style={{
                        color: "#e5e7eb",
                        fontSize: subtitleSize,
                        textAlign: "center",
                        lineHeight: 22,
                        opacity: 0.8,
                      }}
                    >
                      {t("onboarding.tellUsWhereYouAre")}
                    </Text>
                    {error && (
                      <Text
                        style={{
                          color: "#ef4444",
                          textAlign: "center",
                          marginTop: 16,
                          fontSize: 14,
                        }}
                      >
                        {error}
                      </Text>
                    )}
                  </View>

                  <View style={{ marginBottom: 24 }}>
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: "500",
                        marginBottom: 12,
                        letterSpacing: 0.3,
                      }}
                    >
                      {t("onboarding.country")}
                    </Text>
                    <View style={{ position: "relative" }}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowCountryDropdown((s) => !s);
                          if (!showCountryDropdown) setCountrySearch("");
                        }}
                        disabled={busy || loading}
                        style={{
                          width: "100%",
                          paddingHorizontal: 20,
                          paddingVertical: 16,
                          borderRadius: 14,
                          backgroundColor: "#18223A",
                          borderWidth: 1,
                          borderColor: selectedCountry ? "#f59e0b" : "#374151",
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            color: selectedCountry ? "#e5e7eb" : "#9ca3af",
                          }}
                        >
                          {selectedCountry ||
                            (loading
                              ? t("common.loading")
                              : t("onboarding.selectCountry"))}
                        </Text>
                        <Text
                          style={{
                            fontSize: 16,
                            color: "#9ca3af",
                            transform: [
                              {
                                rotate: showCountryDropdown ? "180deg" : "0deg",
                              },
                            ],
                          }}
                        >
                          ▼
                        </Text>
                      </TouchableOpacity>

                      {showCountryDropdown && (
                        <View
                          style={{
                            backgroundColor: "#18223A",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#374151",
                            marginTop: 4,
                            maxHeight: 300,
                            overflow: "hidden",
                          }}
                        >
                          <TextInput
                            placeholder={t("onboarding.searchCountry")}
                            placeholderTextColor="#9ca3af"
                            value={countrySearch}
                            onChangeText={setCountrySearch}
                            style={
                              {
                                backgroundColor: "#101A2C",
                                color: "#e5e7eb",
                                borderRadius: 8,
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                margin: 10,
                                borderWidth: 1,
                                borderColor: "#374151",
                                ...(Platform.OS === "web" && {
                                  outlineStyle: "none",
                                }),
                              } as any
                            }
                            autoFocus
                          />
                          <ScrollView nestedScrollEnabled>
                            {countries
                              .filter((country) =>
                                country
                                  .toLowerCase()
                                  .includes(countrySearch.toLowerCase())
                              )
                              .map((country, idx, arr) => (
                                <TouchableOpacity
                                  key={country}
                                  onPress={() => {
                                    setSelectedCountry(country);
                                    setShowCountryDropdown(false);
                                    setSelectedState(null);
                                    setCountrySearch("");
                                    setStateSearch("");
                                    try {
                                      const countrySubdivisions =
                                        subdivisionsData[
                                          country as keyof typeof subdivisionsData
                                        ];
                                      if (countrySubdivisions) {
                                        const stateNames =
                                          countrySubdivisions.map(
                                            (subdivision: any) =>
                                              subdivision.name
                                          );
                                        setStates(stateNames);
                                      } else {
                                        setStates([]);
                                      }
                                    } catch {
                                      setStates([]);
                                    }
                                  }}
                                  style={{
                                    paddingHorizontal: 20,
                                    paddingVertical: 14,
                                    borderBottomWidth:
                                      idx < arr.length - 1 ? 1 : 0,
                                    borderBottomColor: "#374151",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 16,
                                      color:
                                        selectedCountry === country
                                          ? "#f59e0b"
                                          : "#e5e7eb",
                                      fontWeight:
                                        selectedCountry === country
                                          ? "600"
                                          : "400",
                                    }}
                                  >
                                    {country}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={{ marginBottom: 24 }}>
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: "500",
                        marginBottom: 12,
                        letterSpacing: 0.3,
                      }}
                    >
                      {t("onboarding.regionProvinceState")}
                    </Text>
                    <View style={{ position: "relative" }}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowStateDropdown((s) => !s);
                          if (!showStateDropdown) setStateSearch("");
                        }}
                        disabled={busy || loading || !selectedCountry}
                        style={{
                          width: "100%",
                          paddingHorizontal: 20,
                          paddingVertical: 16,
                          borderRadius: 14,
                          backgroundColor: "#18223A",
                          borderWidth: 1,
                          borderColor: selectedState ? "#f59e0b" : "#374151",
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            color: selectedState ? "#e5e7eb" : "#9ca3af",
                          }}
                        >
                          {selectedCountry
                            ? selectedState || t("onboarding.selectRegion")
                            : t("onboarding.selectCountryFirst")}
                        </Text>
                        <Text
                          style={{
                            fontSize: 16,
                            color: "#9ca3af",
                            transform: [
                              { rotate: showStateDropdown ? "180deg" : "0deg" },
                            ],
                          }}
                        >
                          ▼
                        </Text>
                      </TouchableOpacity>

                      {showStateDropdown && (
                        <View
                          style={{
                            backgroundColor: "#18223A",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#374151",
                            marginTop: 4,
                            maxHeight: 300,
                            overflow: "hidden",
                          }}
                        >
                          {states.length === 0 ? (
                            <View style={{ padding: 16, alignItems: "center" }}>
                              <Text style={{ color: "#9ca3af" }}>
                                {t("onboarding.noRegionsAvailable")}
                              </Text>
                            </View>
                          ) : (
                            <>
                              <TextInput
                                placeholder={t("onboarding.searchRegion")}
                                placeholderTextColor="#9ca3af"
                                value={stateSearch}
                                onChangeText={setStateSearch}
                                style={
                                  {
                                    backgroundColor: "#101A2C",
                                    color: "#e5e7eb",
                                    borderRadius: 8,
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    margin: 10,
                                    borderWidth: 1,
                                    borderColor: "#374151",
                                    ...(Platform.OS === "web" && {
                                      outlineStyle: "none",
                                    }),
                                  } as any
                                }
                                autoFocus
                              />
                              <ScrollView nestedScrollEnabled>
                                {states
                                  .filter((s) =>
                                    s
                                      .toLowerCase()
                                      .includes(stateSearch.toLowerCase())
                                  )
                                  .map((s, idx, arr) => (
                                    <TouchableOpacity
                                      key={s}
                                      onPress={() => {
                                        setSelectedState(s);
                                        setShowStateDropdown(false);
                                        setStateSearch("");
                                      }}
                                      style={{
                                        paddingHorizontal: 20,
                                        paddingVertical: 14,
                                        borderBottomWidth:
                                          idx < arr.length - 1 ? 1 : 0,
                                        borderBottomColor: "#374151",
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 16,
                                          color:
                                            selectedState === s
                                              ? "#f59e0b"
                                              : "#e5e7eb",
                                          fontWeight:
                                            selectedState === s ? "600" : "400",
                                        }}
                                      >
                                        {s}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                              </ScrollView>
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>

            <View style={{ paddingBottom: isSmallViewport ? 0 : 8 }}>
              <TouchableOpacity
                disabled={busy || !isValid}
                onPress={handleContinue}
                style={{
                  width: "100%",
                  paddingVertical: isSmallViewport ? 14 : 18,
                  borderRadius: 14,
                  backgroundColor: isValid && !busy ? "#059669" : "#d1d5db",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: isWeb ? (screenWidth < 1280 ? -24 : 10) : 0,
                  ...(Platform.OS !== "web" && {
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }),
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: isSmallViewport ? 16 : 18,
                    }}
                  >
                    {t("onboarding.continue")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
