import { Text, TouchableOpacity, View } from "react-native";
import { ONBOARDING_HEADER_HEIGHT } from "@/lib/constants";
import StepBar from "@/components/StepBar";

export interface OnboardingHeaderProps {
  title?: string;
  currentStep: number;
  totalSteps: number;
  canGoNext?: boolean;
  canGoBack?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextIconColor?: string;
  backIconColor?: string;
}

export default function OnboardingHeader({
  currentStep,
  totalSteps,
  canGoNext = true,
  canGoBack = true,
  onBack,
  onNext,
  nextDisabled,
  nextIconColor = "#e5e7eb",
  backIconColor = "#e5e7eb",
}: OnboardingHeaderProps) {
  const backDisabled = !canGoBack || !onBack;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingVertical: 46,
        height: ONBOARDING_HEADER_HEIGHT,
        backgroundColor: "#101A2C",
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        disabled={backDisabled}
        style={{
          width: 40,
          height: 40,
          marginTop: 18,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 24,
            color: !backDisabled ? backIconColor : "rgba(229,231,235,0.4)",
          }}
        >
          ←
        </Text>
      </TouchableOpacity>

      <View
        style={{ flex: 1, marginTop: 18 }} // Spacer
      >
        <StepBar currentStep={currentStep} totalSteps={totalSteps} />
      </View>
      <TouchableOpacity
        onPress={onNext}
        disabled={!!nextDisabled || !canGoNext}
        style={{
          width: 40,
          height: 40,
          marginTop: 18,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 24,
            color:
              !nextDisabled && canGoNext
                ? nextIconColor
                : "rgba(229,231,235,0.4)",
          }}
        >
          →
        </Text>
      </TouchableOpacity>
    </View>
  );
}
