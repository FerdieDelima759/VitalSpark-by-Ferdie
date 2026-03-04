"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";
import countriesData from "@/lib/data/countries.json";
import subdivisionsData from "@/lib/data/subdivisions.json";

export default function LocationOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
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
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const stateDropdownRef = useRef<HTMLDivElement>(null);

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
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.country) {
            setSelectedCountry(result.data.country);
            try {
              const countrySubdivisions =
                subdivisionsData[
                  result.data.country as keyof typeof subdivisionsData
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
          if (result.data.region_province) {
            setSelectedState(result.data.region_province);
          }
        }
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false);
        setCountrySearch("");
      }
      if (
        stateDropdownRef.current &&
        !stateDropdownRef.current.contains(event.target as Node)
      ) {
        setShowStateDropdown(false);
        setStateSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isValid = !!selectedCountry && !!selectedState;

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setShowCountryDropdown(false);
    setSelectedState(null);
    setCountrySearch("");
    setStateSearch("");
    try {
      const countrySubdivisions =
        subdivisionsData[country as keyof typeof subdivisionsData];
      if (countrySubdivisions) {
        const stateNames = countrySubdivisions.map(
          (subdivision: any) => subdivision.name
        );
        setStates(stateNames);
      } else {
        setStates([]);
      }
    } catch {
      setStates([]);
    }
  };

  const handleStateSelect = (state: string) => {
    setSelectedState(state);
    setShowStateDropdown(false);
    setStateSearch("");
  };

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      const { data: currentUser } = await auth.getCurrentUser();
      if (!currentUser?.user) {
        setError("Please sign in again to continue onboarding.");
        return;
      }

      const result = await upsertUserProfile({
        user_id: currentUser.user.id,
        country: selectedCountry || undefined,
        region_province: selectedState || undefined,
        plan_code: userProfile?.plan_code ?? "premium",
        current_step: Math.max(userProfile?.current_step || 4, 5),
        is_onboarding_complete: false,
      });

      if (!result.success) {
        console.error("Failed to save location:", result.error);
        setError("Failed to save your location. Please try again.");
        setBusy(false);
        return;
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/onboarding/height");
    } catch (e: any) {
      console.error("Location save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/onboarding/profile");
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

  const filteredCountries = countries.filter((country) =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredStates = states.filter((state) =>
    state.toLowerCase().includes(stateSearch.toLowerCase())
  );

  return (
    <div 
      className="bg-[#101A2C] flex justify-center pt-12"
      style={{
        minHeight: showCountryDropdown || showStateDropdown ? 'calc(100vh + 500px)' : '100vh',
        paddingBottom: showCountryDropdown || showStateDropdown ? '500px' : '3rem'
      }}
    >
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 relative">
        <div className="text-center mb-8">
          <h2 className="text-amber-500 text-2xl sm:text-3xl font-bold mb-2">
            Where are you located?
          </h2>
          <p className="text-gray-300 text-base sm:text-lg">
            Help us provide location-specific recommendations
          </p>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Country
            </label>
            <div className="relative" ref={countryDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowCountryDropdown(!showCountryDropdown);
                  if (!showCountryDropdown) setCountrySearch("");
                }}
                disabled={busy || loading}
                className={`w-full bg-[#18223A] text-left py-4 px-5 rounded-xl border-2 transition-all ${
                  selectedCountry
                    ? "border-amber-500 text-gray-100"
                    : "border-gray-600 text-gray-400"
                } ${busy || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} flex items-center justify-between`}
              >
                <span>
                  {selectedCountry ||
                    (loading ? "Loading..." : "Select Country")}
                </span>
                <span
                  className={`transform transition-transform ${
                    showCountryDropdown ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {showCountryDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-[#18223A] rounded-xl border border-gray-600 shadow-lg max-h-80 overflow-hidden">
                  <input
                    type="text"
                    placeholder="Search country..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="w-full bg-[#101A2C] text-gray-100 px-4 py-2.5 border-b border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-t-xl"
                    autoFocus
                  />
                  <div className="max-h-64 overflow-y-auto">
                    {filteredCountries.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        className={`w-full text-left px-5 py-3.5 hover:bg-[#101A2C] transition-colors border-b border-gray-700 last:border-b-0 ${
                          selectedCountry === country
                            ? "text-amber-500 font-semibold bg-[#101A2C]"
                            : "text-gray-100"
                        }`}
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Region/Province/State
            </label>
            <div className="relative" ref={stateDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowStateDropdown(!showStateDropdown);
                  if (!showStateDropdown) setStateSearch("");
                }}
                disabled={busy || loading || !selectedCountry}
                className={`w-full bg-[#18223A] text-left py-4 px-5 rounded-xl border-2 transition-all ${
                  selectedState
                    ? "border-amber-500 text-gray-100"
                    : "border-gray-600 text-gray-400"
                } ${busy || loading || !selectedCountry ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} flex items-center justify-between`}
              >
                <span>
                  {selectedCountry
                    ? selectedState || "Select Region"
                    : "Select Country First"}
                </span>
                <span
                  className={`transform transition-transform ${
                    showStateDropdown ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {showStateDropdown && selectedCountry && (
                <div className="absolute z-50 w-full mt-2 bg-[#18223A] rounded-xl border border-gray-600 shadow-lg max-h-80 overflow-hidden">
                  {states.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">
                      No regions available
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Search region..."
                        value={stateSearch}
                        onChange={(e) => setStateSearch(e.target.value)}
                        className="w-full bg-[#101A2C] text-gray-100 px-4 py-2.5 border-b border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-t-xl"
                        autoFocus
                      />
                      <div className="max-h-64 overflow-y-auto">
                        {filteredStates.map((state) => (
                          <button
                            key={state}
                            type="button"
                            onClick={() => handleStateSelect(state)}
                            className={`w-full text-left px-5 py-3.5 hover:bg-[#101A2C] transition-colors border-b border-gray-700 last:border-b-0 ${
                              selectedState === state
                                ? "text-amber-500 font-semibold bg-[#101A2C]"
                                : "text-gray-100"
                            }`}
                          >
                            {state}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            disabled={busy || !isValid}
            onClick={handleContinue}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              isValid && !busy
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            }`}
          >
            {busy ? (
              <div className="flex items-center justify-center">
                <Loader size="sm" inline />
                <span className="ml-2">Loading...</span>
              </div>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
