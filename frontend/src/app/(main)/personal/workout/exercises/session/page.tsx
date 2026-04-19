"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/lib/api/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { getUserSessionData } from "@/utils/sessionStorage";
import Toast, { ToastProps } from "@/components/Toast";
import {
  WorkoutSessionExercise,
  WorkoutSessionSet,
  WorkoutSessionSetCreatePayload,
  WorkoutSessionExerciseCreatePayload,
} from "@/types/WorkoutSession";
import {
  HiXMark,
  HiPlay,
  HiPause,
  HiArrowLeft,
  HiArrowRight,
  HiCheckCircle,
  HiArrowPath,
  HiClock,
  HiBolt,
  HiMusicalNote,
} from "react-icons/hi2";

// ===========================
// Type Definitions
// ===========================

interface ExerciseDetails {
  id: string;
  name: string;
  image_slug: string | null;
  safety_cue: string | null;
}

interface Exercise {
  plan_step_id: string;
  exercise_id: string;
  position: number;
  section: string;
  image_path: string | null;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
  safety_tip: string | null;
  per_side: boolean;
  details: ExerciseDetails | null;
}

// Expanded workout flow item - each set becomes a separate item
interface WorkoutFlowItem {
  exercise: Exercise;
  setNumber: number; // Which set this is (1, 2, 3, etc.)
  totalSets: number; // Total sets for this exercise
  orderInSession: number; // Order in the entire workout flow (1-based, includes all sets)
  exerciseOrder: number; // Unique exercise order (1-based, increments per exercise not set)
  isRestAfter: boolean; // Whether there's rest after this set
  side: "left" | "right" | "both"; // Which side this set is for (for per_side exercises)
}

interface WorkoutPlan {
  id: string;
  name: string;
  level?: string | null;
  total_exercises?: number | null;
}

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

type VoiceGender = "male" | "female";
type PreRecordedCueKind = "ready" | "countdown" | "rest-countdown";
type TtsResponseFormat = "mp3" | "wav" | "opus" | "aac" | "flac" | "pcm";
type CountdownCueOptions = {
  interrupt?: boolean;
  maxWaitMs?: number;
  audioContent?: string;
  rate?: number;
  onPlaybackStart?: (playbackInfo?: { durationMs: number | null }) => void;
};
type OpenAiTtsResponse = {
  audioContent?: string;
  format?: TtsResponseFormat;
  voiceName?: string;
  error?: string;
};
const MALE_VOICE_PRIORITY = ["cedar", "ash"] as const;
const FEMALE_VOICE_PRIORITY = ["marin", "sage"] as const;
const MALE_VOICE_HINTS = [
  "male",
  "man",
  "boy",
  "guy",
  "david",
  "daniel",
  "mark",
  "alex",
  "james",
  "john",
  "michael",
  "thomas",
  "cedar",
  "ash",
] as const;
const FEMALE_VOICE_HINTS = [
  "female",
  "woman",
  "girl",
  "samantha",
  "victoria",
  "karen",
  "susan",
  "aria",
  "jenny",
  "joanna",
  "sara",
  "emma",
  "marin",
  "sage",
] as const;
const BACKGROUND_MUSIC_TRACKS = [
  "/audio/background/B-1.mp3",
  "/audio/background/B-2.mp3",
  "/audio/background/B-3.mp3",
] as const;
const MALE_REST_ENTRANCE_TRACKS = [
  "/audio/male/rest/M-Rest-1.wav",
  "/audio/male/rest/M-Rest-2.wav",
  "/audio/male/rest/M-Rest-3.wav",
  "/audio/male/rest/M-Rest-4.wav",
  "/audio/male/rest/M-Rest-5.wav",
  "/audio/male/rest/M-Rest-6.wav",
  "/audio/male/rest/M-Rest-7.wav",
] as const;
const FEMALE_REST_ENTRANCE_TRACKS = [
  "/audio/female/rest/F-Rest-1.wav",
  "/audio/female/rest/F-Rest-2.wav",
  "/audio/female/rest/F-Rest-3.wav",
  "/audio/female/rest/F-Rest-4.wav",
  "/audio/female/rest/F-Rest-5.wav",
  "/audio/female/rest/F-Rest-6.wav",
  "/audio/female/rest/F-Rest-7.wav",
] as const;

export default function ExerciseSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId") || searchParams.get("id");
  const dayPlanId = searchParams.get("dayPlanId");
  const weekParam = searchParams.get("week");
  const dayParam = searchParams.get("day");
  const fullscreenParam = searchParams.get("fullscreen");
  const shouldEnforceFullscreen = fullscreenParam === "1";
  const workoutDetailsPath = planId
    ? `/personal/workout/details?id=${planId}`
    : "/personal";

  const {
    userProfile,
    loadingState: userLoadingState,
    refreshUserData,
  } = useUserContext();

  // ===========================
  // State Management
  // ===========================
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutFlow, setWorkoutFlow] = useState<WorkoutFlowItem[]>([]);
  const [currentFlowIndex, setCurrentFlowIndex] = useState<number>(0);
  const [userGender, setUserGender] = useState<string>("male");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(false);
  const [showExitConfirmation, setShowExitConfirmation] =
    useState<boolean>(false);
  const [showRestartDialog, setShowRestartDialog] = useState<boolean>(false);
  const [oldSessionId, setOldSessionId] = useState<string | null>(null);
  const [isRestartingFromReload, setIsRestartingFromReload] =
    useState<boolean>(false);
  const [isSkipping, setIsSkipping] = useState<boolean>(false);
  const [isGoingNext, setIsGoingNext] = useState<boolean>(false);
  const [isGoingPrevious, setIsGoingPrevious] = useState<boolean>(false);
  const [isQuitting, setIsQuitting] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState<boolean>(false);
  const [isStartingWorkout, setIsStartingWorkout] = useState<boolean>(false);
  const [startCountdown, setStartCountdown] = useState<number>(0); // Start at 0, only set to 3 when countdown actually starts
  const [isFullscreenGuardActive, setIsFullscreenGuardActive] =
    useState<boolean>(false);
  const [showSessionRiskDialog, setShowSessionRiskDialog] =
    useState<boolean>(false);
  const [sessionRiskReason, setSessionRiskReason] = useState<
    "fullscreen" | "tab" | null
  >(null);
  const [resolvedDayPlanId, setResolvedDayPlanId] = useState<string | null>(
    dayPlanId,
  );
  const [resolvedWeeklyPlanId, setResolvedWeeklyPlanId] = useState<
    string | null
  >(null);
  const [showWorkoutCompleteSheet, setShowWorkoutCompleteSheet] =
    useState<boolean>(false);
  const [workoutRpe, setWorkoutRpe] = useState<number>(5);
  const [isSavingWorkoutRpe, setIsSavingWorkoutRpe] = useState<boolean>(false);
  const resolvedDayPlanIdRef = useRef<string | null>(dayPlanId);
  const resolvedWeeklyPlanIdRef = useRef<string | null>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionExercises, setSessionExercises] = useState<
    Map<string, WorkoutSessionExercise>
  >(new Map());
  const [sessionSets, setSessionSets] = useState<
    Map<string, WorkoutSessionSet>
  >(new Map());
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const restEntranceAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastRestEntranceTrackRef = useRef<string | null>(null);
  const backgroundMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastBackgroundTrackRef = useRef<string | null>(null);

  // Refs for tracking time and state
  const sessionStartTimeRef = useRef<Date | null>(null);
  const exerciseStartTimeRef = useRef<Date | null>(null);
  const setStartTimeRef = useRef<Date | null>(null);
  const restStartTimeRef = useRef<Date | null>(null);
  const totalWorkoutTimeRef = useRef<number>(0);
  const totalRestTimeRef = useRef<number>(0);
  const hasTimerTickedRef = useRef<boolean>(false);

  // Optimization refs
  const sessionInitializedRef = useRef<boolean>(false);
  const exercisesAddedRef = useRef<Set<string>>(new Set());
  const shouldAutoAdvanceRef = useRef<boolean>(false);
  const isClearingSessionRef = useRef<boolean>(false);
  const hasCheckedActiveSessionRef = useRef<boolean>(false);
  const isRestartingFromReloadRef = useRef<boolean>(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCountdownRunningRef = useRef<boolean>(false);
  const isStartingSessionRef = useRef<boolean>(false);
  const isFetchingWorkoutDataRef = useRef<boolean>(false);
  const inFlightSetRecordingsRef = useRef<Set<string>>(new Set());
  const isHandlingNextRef = useRef<boolean>(false);
  const isSessionRiskDialogOpenRef = useRef<boolean>(false);
  const shouldEnforceFullscreenRef = useRef<boolean>(shouldEnforceFullscreen);
  const isFullscreenGuardActiveRef = useRef<boolean>(false);
  const allowFullscreenExitRef = useRef<boolean>(false);
  const isIntroVoicePlayingRef = useRef<boolean>(false);
  const preloadedImageUrlsRef = useRef<Set<string>>(new Set());
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const preferredVoiceGenderRef = useRef<VoiceGender | null>(null);
  const nextExerciseAnnouncementKeyRef = useRef<string | null>(null);
  const lastRestEntranceCueKeyRef = useRef<string | null>(null);
  const safetyCueTargetSetByExerciseRef = useRef<Map<string, number>>(new Map());
  const playedSafetyCueExerciseKeysRef = useRef<Set<string>>(new Set());

  const stopBackgroundMusic = useCallback((resetTrack: boolean = false) => {
    const audio = backgroundMusicAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    backgroundMusicAudioRef.current = null;
    if (resetTrack) {
      lastBackgroundTrackRef.current = null;
    }
  }, []);

  const playRandomBackgroundMusic = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined") return;

    stopBackgroundMusic(false);

    const previousTrack = lastBackgroundTrackRef.current;
    const availableTracks =
      BACKGROUND_MUSIC_TRACKS.length > 1 && previousTrack
        ? BACKGROUND_MUSIC_TRACKS.filter((track) => track !== previousTrack)
        : [...BACKGROUND_MUSIC_TRACKS];
    const selectedTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)] ||
      BACKGROUND_MUSIC_TRACKS[0];

    const audio = new Audio(selectedTrack);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0.5;
    backgroundMusicAudioRef.current = audio;
    lastBackgroundTrackRef.current = selectedTrack;

    try {
      await audio.play();
    } catch {
      // Autoplay can be blocked until user interaction.
    }
  }, [stopBackgroundMusic]);

  const resetWorkoutState = useCallback(() => {
    exercisesAddedRef.current.clear();
    setSessionExercises(new Map());
    setSessionSets(new Map());
    sessionInitializedRef.current = false;
    setActiveSessionId(null);
    setCurrentFlowIndex(0);
    setIsResting(false);
    setIsPaused(false);
    setTimer(0);
    totalWorkoutTimeRef.current = 0;
    totalRestTimeRef.current = 0;
    exerciseStartTimeRef.current = null;
    setStartTimeRef.current = null;
    restStartTimeRef.current = null;
    shouldAutoAdvanceRef.current = false;
    isStartingSessionRef.current = false;
    inFlightSetRecordingsRef.current.clear();
    isHandlingNextRef.current = false;
    isIntroVoicePlayingRef.current = false;
    setIsFullscreenGuardActive(false);
    isFullscreenGuardActiveRef.current = false;
    allowFullscreenExitRef.current = false;
    setShowWorkoutCompleteSheet(false);
    setWorkoutRpe(5);
    setIsSavingWorkoutRpe(false);
    const restEntranceAudio = restEntranceAudioRef.current;
    if (restEntranceAudio) {
      restEntranceAudio.pause();
      restEntranceAudio.currentTime = 0;
      restEntranceAudioRef.current = null;
    }
    lastRestEntranceTrackRef.current = null;
    lastRestEntranceCueKeyRef.current = null;
    safetyCueTargetSetByExerciseRef.current.clear();
    playedSafetyCueExerciseKeysRef.current.clear();
    stopBackgroundMusic(true);
  }, [stopBackgroundMusic]);

  // Normalize gender for image paths (only male/female images available)
  const normalizedGender = useMemo(() => {
    const gender = userGender.toLowerCase();
    if (gender === "female") return "female";
    return "male";
  }, [userGender]);

  // ===========================
  // Helper Functions
  // ===========================

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }, []);

  const showToast = useCallback(
    (type: "success" | "error", title: string, message: string) => {
      const id = toastIdRef.current++;
      setToasts((prev) => [...prev, { id, type, title, message }]);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const normalizeStoredGender = useCallback(
    (rawGender: string | null | undefined): VoiceGender => {
      const normalized = (rawGender || "").toLowerCase().trim();
      return normalized === "female" || normalized === "f" ? "female" : "male";
    },
    [],
  );

  const readGenderFromStorage = useCallback((): VoiceGender | null => {
    if (typeof window === "undefined") return null;

    try {
      const sessionData = getUserSessionData();
      if (sessionData.userProfile?.gender) {
        return normalizeStoredGender(sessionData.userProfile.gender);
      }
    } catch {
      // Ignore session parsing issues and continue with direct storage lookups.
    }

    const profileKeys = [
      "vitalspark_user_profile",
      "user_profile",
      "userProfile",
    ];
    const directGenderKeys = ["gender", "user_gender", "userGender"];
    const storageTargets = [window.sessionStorage, window.localStorage];

    for (const storage of storageTargets) {
      try {
        for (const key of profileKeys) {
          const value = storage.getItem(key);
          if (!value) continue;
          const parsed = JSON.parse(value) as { gender?: string | null };
          if (parsed?.gender) {
            return normalizeStoredGender(parsed.gender);
          }
        }

        for (const key of directGenderKeys) {
          const value = storage.getItem(key);
          if (value) {
            return normalizeStoredGender(value);
          }
        }
      } catch {
        // Ignore malformed local/session storage values and continue.
      }
    }

    return null;
  }, [normalizeStoredGender]);

  const getCurrentVoiceGender = useCallback((): VoiceGender => {
    if (userProfile?.gender) {
      return normalizeStoredGender(userProfile.gender);
    }
    const storedGender = readGenderFromStorage();
    if (storedGender) return storedGender;
    return normalizedGender === "female" ? "female" : "male";
  }, [
    normalizedGender,
    normalizeStoredGender,
    readGenderFromStorage,
    userProfile?.gender,
  ]);

  const getPreRecordedCuePath = useCallback(
    (cue: PreRecordedCueKind): string => {
      const voiceGender = getCurrentVoiceGender();
      if (cue === "rest-countdown") {
        return voiceGender === "female"
          ? "/audio/female/countdown/F-rest-countdown.wav"
          : "/audio/male/countdown/M-rest-countdown.wav";
      }
      if (cue === "countdown") {
        return voiceGender === "female"
          ? "/audio/female/countdown/Countdown-Female.wav"
          : "/audio/male/countdown/Countdown-Male.wav";
      }
      return voiceGender === "female"
        ? "/audio/female/ready/Female-Ready.wav"
        : "/audio/male/ready/Male-Ready.wav";
    },
    [getCurrentVoiceGender],
  );

  const stopCountdownAudio = useCallback(() => {
    if (!countdownAudioRef.current) return;
    countdownAudioRef.current.pause();
    countdownAudioRef.current.currentTime = 0;
    countdownAudioRef.current = null;
  }, []);

  const stopRestEntranceAudio = useCallback(() => {
    if (!restEntranceAudioRef.current) return;
    restEntranceAudioRef.current.pause();
    restEntranceAudioRef.current.currentTime = 0;
    restEntranceAudioRef.current = null;
  }, []);

  const playRandomRestEntranceAudio = useCallback(async (): Promise<void> => {
    const voiceGender = getCurrentVoiceGender();
    const tracks =
      voiceGender === "female"
        ? FEMALE_REST_ENTRANCE_TRACKS
        : MALE_REST_ENTRANCE_TRACKS;
    const previousTrack = lastRestEntranceTrackRef.current;
    const availableTracks =
      tracks.length > 1 && previousTrack
        ? tracks.filter((track) => track !== previousTrack)
        : [...tracks];
    const selectedTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)] ||
      tracks[0];

    stopRestEntranceAudio();

    const audio = new Audio(selectedTrack);
    audio.preload = "auto";
    restEntranceAudioRef.current = audio;
    lastRestEntranceTrackRef.current = selectedTrack;

    try {
      await audio.play();
    } catch {
      // Ignore blocked autoplay and continue session flow.
    }
  }, [getCurrentVoiceGender, stopRestEntranceAudio]);

  const stopCountdownSpeech = useCallback(() => {
    stopCountdownAudio();
    stopRestEntranceAudio();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, [stopCountdownAudio, stopRestEntranceAudio]);

  useEffect(() => {
    const storedGender = readGenderFromStorage();
    if (storedGender) {
      setUserGender(storedGender);
      return;
    }

    if (userProfile?.gender) {
      setUserGender(normalizeStoredGender(userProfile.gender));
    }
  }, [readGenderFromStorage, normalizeStoredGender, userProfile?.gender]);

  const getVoiceIdentity = useCallback(
    (voice: SpeechSynthesisVoice): string =>
      `${voice.name} ${voice.voiceURI}`.toLowerCase(),
    [],
  );

  const getVoiceForGender = useCallback(
    (targetGender: VoiceGender): SpeechSynthesisVoice | null => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return null;
      }

      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return null;

      // Reuse previously selected voice for stable gender-specific playback.
      if (
        preferredVoiceRef.current &&
        preferredVoiceGenderRef.current === targetGender
      ) {
        const cachedVoice = preferredVoiceRef.current;
        const stillAvailable = voices.find(
          (voice) =>
            voice.voiceURI === cachedVoice.voiceURI &&
            voice.name === cachedVoice.name,
        );
        if (stillAvailable) {
          return stillAvailable;
        }
      }

      const englishVoices = voices.filter((voice) =>
        (voice.lang || "").toLowerCase().startsWith("en"),
      );
      const pool = englishVoices.length > 0 ? englishVoices : voices;

      const prioritizedVoices =
        targetGender === "female" ? FEMALE_VOICE_PRIORITY : MALE_VOICE_PRIORITY;

      for (const preferredName of prioritizedVoices) {
        const matchedVoice = pool.find((voice) =>
          getVoiceIdentity(voice).includes(preferredName),
        );
        if (matchedVoice) {
          preferredVoiceRef.current = matchedVoice;
          preferredVoiceGenderRef.current = targetGender;
          return matchedVoice;
        }
      }

      const targetHints =
        targetGender === "female" ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
      const oppositeHints =
        targetGender === "female" ? MALE_VOICE_HINTS : FEMALE_VOICE_HINTS;

      const explicitGenderMatch = pool.find((voice) => {
        const identity = getVoiceIdentity(voice);
        const hasTarget = targetHints.some((hint) => identity.includes(hint));
        const hasOpposite = oppositeHints.some((hint) =>
          identity.includes(hint),
        );
        return hasTarget && !hasOpposite;
      });
      if (explicitGenderMatch) {
        preferredVoiceRef.current = explicitGenderMatch;
        preferredVoiceGenderRef.current = targetGender;
        return explicitGenderMatch;
      }

      const looseGenderMatch = pool.find((voice) => {
        const identity = getVoiceIdentity(voice);
        return targetHints.some((hint) => identity.includes(hint));
      });
      if (looseGenderMatch) {
        preferredVoiceRef.current = looseGenderMatch;
        preferredVoiceGenderRef.current = targetGender;
        return looseGenderMatch;
      }

      const fallbackVoice = pool[0] ?? null;
      if (fallbackVoice) {
        preferredVoiceRef.current = fallbackVoice;
        preferredVoiceGenderRef.current = targetGender;
      }
      return fallbackVoice;
    },
    [getVoiceIdentity],
  );

  const ensureSpeechVoicesLoaded = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    if (synth.getVoices().length > 0) return;

    await new Promise<void>((resolve) => {
      const maxWaitMs = 2500;
      const pollEveryMs = 150;
      const startedAt = Date.now();

      const onVoicesChanged = () => {
        if (synth.getVoices().length > 0) {
          window.clearInterval(pollId);
          window.clearTimeout(timeoutId);
          synth.removeEventListener?.("voiceschanged", onVoicesChanged);
          resolve();
        }
      };

      const timeoutId = window.setTimeout(() => {
        window.clearInterval(pollId);
        synth.removeEventListener?.("voiceschanged", onVoicesChanged);
        resolve();
      }, maxWaitMs);

      const pollId = window.setInterval(() => {
        if (
          synth.getVoices().length > 0 ||
          Date.now() - startedAt >= maxWaitMs
        ) {
          window.clearInterval(pollId);
          window.clearTimeout(timeoutId);
          synth.removeEventListener?.("voiceschanged", onVoicesChanged);
          resolve();
        }
      }, pollEveryMs);

      synth.addEventListener?.("voiceschanged", onVoicesChanged);
      synth.getVoices();
    });
  }, []);

  const getAudioMimeType = useCallback((format?: TtsResponseFormat): string => {
    switch (format) {
      case "wav":
        return "audio/wav";
      case "opus":
        return "audio/opus";
      case "aac":
        return "audio/aac";
      case "flac":
        return "audio/flac";
      case "pcm":
        return "audio/pcm";
      case "mp3":
      default:
        return "audio/mpeg";
    }
  }, []);

  const fetchOpenAiCueAudio = useCallback(
    async (
      text: string,
      targetGender: VoiceGender,
    ): Promise<OpenAiTtsResponse | null> => {
      try {
        const response = await fetch("/api/openai-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            gender: targetGender,
            responseFormat: "mp3",
            instructions:
              "Speak like a concise workout coach with clean pacing, brief pauses, and no trailing silence.",
          }),
        });

        const payload = (await response.json()) as OpenAiTtsResponse;
        if (!response.ok || !payload.audioContent) {
          return null;
        }

        return payload;
      } catch {
        return null;
      }
    },
    [],
  );

  const playGeneratedCueAudioAndWait = useCallback(
    async (
      audioContent: string,
      format: TtsResponseFormat | undefined,
      options?: CountdownCueOptions,
    ): Promise<void> => {
      if (options?.interrupt) {
        stopCountdownAudio();
      }

      const audio = new Audio(
        `data:${getAudioMimeType(format)};base64,${audioContent}`,
      );
      audio.preload = "auto";
      audio.volume = 1;

      await new Promise<void>((resolve) => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          resolve();
          return;
        }

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          audio.removeEventListener("loadedmetadata", finish);
          audio.removeEventListener("error", finish);
          resolve();
        };

        const timeoutId = window.setTimeout(finish, 1500);
        audio.addEventListener("loadedmetadata", finish);
        audio.addEventListener("error", finish);
        audio.load();
      });

      countdownAudioRef.current = audio;
      audio.onended = () => {
        if (countdownAudioRef.current === audio) {
          countdownAudioRef.current = null;
        }
      };
      audio.onerror = () => {
        if (countdownAudioRef.current === audio) {
          countdownAudioRef.current = null;
        }
      };

      const playPromise = audio.play();
      if (playPromise) {
        await playPromise;
      }

      const durationMs =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.ceil(audio.duration * 1000)
          : null;
      options?.onPlaybackStart?.({ durationMs });

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          audio.onended = null;
          audio.onerror = null;
          resolve();
        };

        const audioDurationMs =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.ceil(audio.duration * 1000) + 1200
            : 10000;
        const timeoutId = window.setTimeout(
          finish,
          options?.maxWaitMs
            ? Math.max(options.maxWaitMs, audioDurationMs)
            : audioDurationMs,
        );

        audio.onended = finish;
        audio.onerror = finish;
      });
    },
    [getAudioMimeType, stopCountdownAudio],
  );

  const speakCountdownCueAndWaitFallback = useCallback(
    async (text: string, options?: CountdownCueOptions): Promise<void> => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      const synth = window.speechSynthesis;
      if (options?.interrupt) {
        synth.cancel();
      }

      await ensureSpeechVoicesLoaded();

      const utterance = new SpeechSynthesisUtterance(text);
      const targetGender = getCurrentVoiceGender();
      const selectedVoice = getVoiceForGender(targetGender);

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang || "en-US";
      } else {
        utterance.lang = "en-US";
      }

      const requestedRate =
        typeof options?.rate === "number" && Number.isFinite(options.rate)
          ? options.rate
          : 1;
      utterance.rate = Math.min(2, Math.max(0.5, requestedRate));
      utterance.pitch = 1.15;
      utterance.volume = 0.6;

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          utterance.onend = null;
          utterance.onerror = null;
          resolve();
        };

        const timeoutId = window.setTimeout(
          finish,
          options?.maxWaitMs ?? Math.max(700, text.length * 65),
        );

        utterance.onend = finish;
        utterance.onerror = finish;
        options?.onPlaybackStart?.();
        synth.speak(utterance);
      });
    },
    [ensureSpeechVoicesLoaded, getCurrentVoiceGender, getVoiceForGender],
  );

  const playPreRecordedCueAndWait = useCallback(
    async (
      cue: PreRecordedCueKind,
      options?: CountdownCueOptions,
    ): Promise<boolean> => {
      try {
        if (options?.interrupt) {
          stopCountdownAudio();
        }

        const audio = new Audio(getPreRecordedCuePath(cue));
        audio.preload = "auto";
        await new Promise<void>((resolve) => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            resolve();
            return;
          }

          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            audio.removeEventListener("loadedmetadata", finish);
            audio.removeEventListener("error", finish);
            resolve();
          };

          const timeoutId = window.setTimeout(finish, 1000);
          audio.addEventListener("loadedmetadata", finish);
          audio.addEventListener("error", finish);
          audio.load();
        });
        countdownAudioRef.current = audio;
        audio.onended = () => {
          if (countdownAudioRef.current === audio) {
            countdownAudioRef.current = null;
          }
        };
        audio.onerror = () => {
          if (countdownAudioRef.current === audio) {
            countdownAudioRef.current = null;
          }
        };

        const playPromise = audio.play();
        if (playPromise) {
          await playPromise;
          const durationMs =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? Math.ceil(audio.duration * 1000)
              : null;
          options?.onPlaybackStart?.({ durationMs });
        } else {
          const durationMs =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? Math.ceil(audio.duration * 1000)
              : null;
          options?.onPlaybackStart?.({ durationMs });
        }

        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            audio.onended = null;
            audio.onerror = null;
            resolve();
          };

          const audioDurationMs =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? Math.ceil(audio.duration * 1000) + 1200
              : 10000;
          const timeoutId = window.setTimeout(
            finish,
            options?.maxWaitMs
              ? Math.max(options.maxWaitMs, audioDurationMs)
              : audioDurationMs,
          );
          audio.onended = finish;
          audio.onerror = finish;
        });

        return true;
      } catch {
        return false;
      }
    },
    [getPreRecordedCuePath, stopCountdownAudio],
  );

  const speakCountdownCueAndWait = useCallback(
    async (text: string, options?: CountdownCueOptions): Promise<void> => {
      const targetGender = getCurrentVoiceGender();
      const generatedCue = await fetchOpenAiCueAudio(text, targetGender);

      if (generatedCue?.audioContent) {
        await playGeneratedCueAudioAndWait(
          generatedCue.audioContent,
          generatedCue.format,
          options,
        );
        return;
      }

      await speakCountdownCueAndWaitFallback(text, options);
    },
    [
      fetchOpenAiCueAudio,
      getCurrentVoiceGender,
      playGeneratedCueAudioAndWait,
      speakCountdownCueAndWaitFallback,
    ],
  );

  const getExerciseAnnouncementSuffix = useCallback(
    (item: WorkoutFlowItem | undefined): string => {
      if (!item?.exercise?.per_side) return "";
      if (item.side === "left") return " on the left side";
      if (item.side === "right") return " on the right side";
      return " on both sides";
    },
    [],
  );

  const getExerciseIdentityKey = useCallback(
    (item: WorkoutFlowItem | undefined): string | null => {
      if (!item) return null;
      return `${item.exercise.exercise_id}:${item.exercise.position}:${item.exerciseOrder}`;
    },
    [],
  );

  const getExerciseSafetyCueText = useCallback(
    (item: WorkoutFlowItem | undefined): string | null => {
      const rawCue =
        item?.exercise?.details?.safety_cue?.trim() ||
        item?.exercise?.safety_tip?.trim() ||
        "";
      if (!rawCue) return null;
      return `Remember to ${rawCue}`;
    },
    [],
  );

  const getSafetyCueTargetSet = useCallback(
    (item: WorkoutFlowItem | undefined): number | null => {
      const exerciseKey = getExerciseIdentityKey(item);
      if (!exerciseKey || !item) return null;

      const existingTarget =
        safetyCueTargetSetByExerciseRef.current.get(exerciseKey);
      if (existingTarget) {
        return existingTarget;
      }

      const totalSets = Math.max(1, item.totalSets || item.exercise.sets || 1);
      const minimumEligibleSet = Math.min(
        totalSets,
        Math.max(1, item.setNumber || 1),
      );
      const remainingSetCount = totalSets - minimumEligibleSet + 1;
      const targetSet =
        remainingSetCount > 1
          ? minimumEligibleSet +
            Math.floor(Math.random() * remainingSetCount)
          : minimumEligibleSet;

      safetyCueTargetSetByExerciseRef.current.set(exerciseKey, targetSet);
      return targetSet;
    },
    [getExerciseIdentityKey],
  );

  const announceRestMidpointCueIfNeeded =
    useCallback(async (): Promise<void> => {
      if (!activeSessionId) return;
      const currentItem = workoutFlow[currentFlowIndex];
      if (!currentItem || !currentItem.isRestAfter) return;

      const restSeconds = currentItem.exercise.rest_seconds || 0;
      if (restSeconds <= 0) return;
      const halfRestRemaining = Math.ceil(restSeconds / 1.5);
      if (timer !== halfRestRemaining) {
        return;
      }

      let announcementText: string | null = null;
      let announcementVariant = "";
      const currentExerciseName =
        currentItem.exercise.details?.name?.trim() ?? "this exercise";

      if (currentItem.setNumber < currentItem.totalSets) {
        const upcomingSetNumber = currentItem.setNumber + 1;
        const nextItem = workoutFlow[currentFlowIndex + 1];
        const upcomingSetSuffix = getExerciseAnnouncementSuffix(nextItem);
        announcementText = `Let's do set ${upcomingSetNumber} of ${currentExerciseName}${upcomingSetSuffix}`;
        announcementVariant = `set-${upcomingSetNumber}-${nextItem?.side ?? "both"}`;
      } else {
        const nextIndex = currentFlowIndex + 1;
        if (nextIndex >= workoutFlow.length) return;
        const nextItem = workoutFlow[nextIndex];
        const nextExerciseName =
          nextItem?.exercise?.details?.name?.trim() ?? "";
        if (!nextExerciseName) return;
        const nextExerciseSuffix = getExerciseAnnouncementSuffix(nextItem);
        announcementText = `Next up, ${nextExerciseName}${nextExerciseSuffix}`;
        announcementVariant = `next-${nextIndex}`;
      }

      const announcementKey = `${activeSessionId}:${currentFlowIndex}:${lastTimerSetRef.current}:${announcementVariant}:half`;
      if (nextExerciseAnnouncementKeyRef.current === announcementKey) {
        return;
      }
      nextExerciseAnnouncementKeyRef.current = announcementKey;

      await ensureSpeechVoicesLoaded();
      await speakCountdownCueAndWait(announcementText, {
        interrupt: true,
        rate: 0.9,
        maxWaitMs: Math.max(2200, announcementText.length * 120),
      });
    }, [
      activeSessionId,
      workoutFlow,
      currentFlowIndex,
      timer,
      getExerciseAnnouncementSuffix,
      ensureSpeechVoicesLoaded,
      speakCountdownCueAndWait,
    ]);

  const getSectionLabel = useCallback((section: string): string => {
    if (section === "warmup") return "Warm Up";
    if (section === "main") return "Main Exercise";
    if (section === "cooldown") return "Cool Down";
    return section;
  }, []);

  const getSideLabel = useCallback(
    (side: "left" | "right" | "both"): string => {
      if (side === "left") return "Left Side";
      if (side === "right") return "Right Side";
      return "";
    },
    [],
  );

  const getExerciseImageUrl = useCallback(
    (section: string, imageSlug: string): string => {
      const baseUrl =
        "https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/";
      return `${baseUrl}${normalizedGender}/${section}/${imageSlug}.png`;
    },
    [normalizedGender],
  );

  const getExerciseResolvedImageUrl = useCallback(
    (exercise: Exercise): string => {
      const directImagePath = exercise.image_path?.trim();
      if (directImagePath) {
        return directImagePath;
      }

      const slug = exercise.details?.image_slug;
      if (!slug) return "";
      return getExerciseImageUrl(exercise.section, slug);
    },
    [getExerciseImageUrl],
  );

  const preloadImageUrl = useCallback((url: string) => {
    if (!url || typeof window === "undefined") return;
    if (preloadedImageUrlsRef.current.has(url)) return;

    preloadedImageUrlsRef.current.add(url);
    const image = new window.Image();
    image.decoding = "async";
    image.src = url;
  }, []);

  const preloadFlowImages = useCallback(
    (flow: WorkoutFlowItem[]) => {
      flow.forEach((item) => {
        const imageUrl = getExerciseResolvedImageUrl(item.exercise);
        if (!imageUrl) return;
        preloadImageUrl(imageUrl);
      });
    },
    [getExerciseResolvedImageUrl, preloadImageUrl],
  );

  useEffect(() => {
    preloadedImageUrlsRef.current.clear();
  }, [planId, normalizedGender]);

  const hasActiveFullscreen = useCallback((): boolean => {
    if (typeof document === "undefined") return false;
    const fsDocument = document as Document & {
      webkitFullscreenElement?: Element | null;
      mozFullScreenElement?: Element | null;
      msFullscreenElement?: Element | null;
    };
    return Boolean(
      fsDocument.fullscreenElement ||
      fsDocument.webkitFullscreenElement ||
      fsDocument.mozFullScreenElement ||
      fsDocument.msFullscreenElement,
    );
  }, []);

  const requestSessionFullscreen = useCallback(async (): Promise<boolean> => {
    if (typeof document === "undefined") return false;
    if (hasActiveFullscreen()) return true;

    try {
      const target = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        mozRequestFullScreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
      };
      const requestFullscreen =
        target.requestFullscreen ||
        target.webkitRequestFullscreen ||
        target.mozRequestFullScreen ||
        target.msRequestFullscreen;
      if (!requestFullscreen) return false;

      await requestFullscreen.call(target);
      return hasActiveFullscreen();
    } catch (error) {
      return false;
    }
  }, [hasActiveFullscreen]);

  const exitSessionFullscreen = useCallback(async (): Promise<void> => {
    if (typeof document === "undefined") return;
    if (!hasActiveFullscreen()) return;

    try {
      const fsDocument = document as Document & {
        webkitExitFullscreen?: () => Promise<void> | void;
        mozCancelFullScreen?: () => Promise<void> | void;
        msExitFullscreen?: () => Promise<void> | void;
      };
      const exitFullscreen =
        fsDocument.exitFullscreen ||
        fsDocument.webkitExitFullscreen ||
        fsDocument.mozCancelFullScreen ||
        fsDocument.msExitFullscreen;
      if (!exitFullscreen) return;

      await exitFullscreen.call(fsDocument);
    } catch (error) {
      // Ignore fullscreen exit errors and continue quitting flow.
    }
  }, [hasActiveFullscreen]);

  const handleCancelSessionRisk = useCallback(async () => {
    allowFullscreenExitRef.current = false;
    const restoredFullscreen = await requestSessionFullscreen();
    setShowSessionRiskDialog(false);
    setSessionRiskReason(null);
    if (restoredFullscreen) {
      setIsPaused(false);
    }
  }, [requestSessionFullscreen]);

  const ensureFullscreenBeforeWorkoutStart =
    useCallback(async (): Promise<boolean> => {
      if (!shouldEnforceFullscreenRef.current) {
        return true;
      }

      const enteredFullscreen = await requestSessionFullscreen();
      setIsFullscreenGuardActive(enteredFullscreen);
      isFullscreenGuardActiveRef.current = enteredFullscreen;
      if (enteredFullscreen) {
        allowFullscreenExitRef.current = false;
      }
      return enteredFullscreen;
    }, [requestSessionFullscreen]);

  // ===========================
  // Database Operations
  // ===========================

  const retryDatabaseOperation = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      operationName: string,
      maxRetries: number = 2,
      timeoutMs: number = 3000,
    ): Promise<T | null> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await Promise.race([
            operation(),
            new Promise<T>((_, reject) =>
              setTimeout(
                () => reject(new Error("Operation timeout")),
                timeoutMs,
              ),
            ),
          ]);
          return result;
        } catch (error: unknown) {
          const errorLike =
            error && typeof error === "object"
              ? (error as { message?: string; code?: string })
              : {};
          const isLastAttempt = attempt === maxRetries;
          const isNetworkError =
            errorLike.message?.includes("network") ||
            errorLike.message?.includes("fetch") ||
            errorLike.message?.includes("timeout") ||
            errorLike.code === "ECONNREFUSED" ||
            errorLike.code === "ETIMEDOUT";

          // Retry on network errors

          if (isLastAttempt) {
            return null;
          }

          // Exponential backoff with jitter
          const baseDelay = 200 * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 100;
          const delay = Math.min(baseDelay + jitter, 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      return null;
    },
    [],
  );

  // ===========================
  // Workout Flow Creation
  // ===========================

  const createWorkoutFlow = useCallback(
    (exerciseList: Exercise[]): WorkoutFlowItem[] => {
      // Ensure exercises are properly organized by section in correct order
      const sections = ["warmup", "main", "cooldown"];
      const flow: WorkoutFlowItem[] = [];
      let setOrderCounter = 1; // Counts all sets
      let exerciseOrderCounter = 1; // Counts unique exercises

      sections.forEach((sectionName) => {
        const sectionExercises = exerciseList
          .filter(
            (ex) => ex.section.toLowerCase() === sectionName.toLowerCase(),
          )
          .sort((a, b) => a.position - b.position);

        sectionExercises.forEach((exercise, idx) => {
          const totalSets = exercise.sets || 1;
          const currentExerciseOrder = exerciseOrderCounter;
          const isLastExerciseInSection = idx === sectionExercises.length - 1;
          const isLastSection = sectionName === "cooldown";
          const isVeryLastExercise = isLastExerciseInSection && isLastSection;

          if (exercise.per_side) {
            // For per_side exercises
            if (totalSets === 1) {
              // Single set: treated as "both" sides in one flow item
              const isRestAfterSet =
                !isVeryLastExercise && exercise.rest_seconds > 0;

              flow.push({
                exercise,
                setNumber: 1,
                totalSets: 1,
                orderInSession: setOrderCounter,
                exerciseOrder: currentExerciseOrder,
                isRestAfter: isRestAfterSet,
                side: "both",
              });
              setOrderCounter++;
            } else {
              // Multiple sets: alternate between left and right, full duration
              for (let setNum = 1; setNum <= totalSets; setNum++) {
                const isLastSet = setNum === totalSets;
                const isLastSetOfLastExercise = isLastSet && isVeryLastExercise;
                const isRestAfter =
                  !isLastSetOfLastExercise && exercise.rest_seconds > 0;
                // Alternate: odd sets = left, even sets = right
                const side = setNum % 2 === 1 ? "left" : "right";

                flow.push({
                  exercise,
                  setNumber: setNum,
                  totalSets,
                  orderInSession: setOrderCounter,
                  exerciseOrder: currentExerciseOrder,
                  isRestAfter,
                  side,
                });

                setOrderCounter++;
              }
            }
          } else {
            // Normal exercises (not per-side, side will be null)
            for (let setNum = 1; setNum <= totalSets; setNum++) {
              const isLastSet = setNum === totalSets;
              const isLastSetOfLastExercise = isLastSet && isVeryLastExercise;
              const isRestAfter =
                !isLastSetOfLastExercise && exercise.rest_seconds > 0;

              flow.push({
                exercise,
                setNumber: setNum,
                totalSets,
                orderInSession: setOrderCounter,
                exerciseOrder: currentExerciseOrder,
                isRestAfter,
                side: "both", // Will be converted to null in recordCompletedSet for non-per_side
              });

              setOrderCounter++;
            }
          }

          // Increment exercise order once per unique exercise
          exerciseOrderCounter++;
        });
      });

      return flow;
    },
    [],
  );

  // ===========================
  // Session Management
  // ===========================

  /**
   * Completely deletes a session including all exercises, sets, and the session record itself.
   */
  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        // First, get all exercise IDs for this session
        const { data: exercisesData, error: fetchError } = await supabase
          .from("user_workout_session_exercises")
          .select("id")
          .eq("session_id", sessionId);

        if (fetchError) {
          return false;
        }

        // Delete all sets for these exercises (must be done first due to foreign key constraints)
        if (exercisesData && exercisesData.length > 0) {
          const exerciseIds = exercisesData.map((ex) => ex.id);

          await supabase
            .from("user_workout_session_sets")
            .delete()
            .in("session_exercise_id", exerciseIds);
        }

        // Then delete all exercises
        const { error: exercisesError } = await supabase
          .from("user_workout_session_exercises")
          .delete()
          .eq("session_id", sessionId);

        if (exercisesError) {
          return false;
        }

        // Finally, delete the session itself
        const { error: sessionError } = await supabase
          .from("user_workout_sessions")
          .delete()
          .eq("id", sessionId);

        if (sessionError) {
          return false;
        }
        return true;
      } catch (error) {
        return false;
      }
    },
    [],
  );

  /**
   * Best-effort deletion for unfinished sessions (retry a few times to avoid leaving orphans).
   */
  const deleteUnfinishedSession = useCallback(
    async (sessionId: string | null): Promise<boolean> => {
      if (!sessionId) return true;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const deleted = await deleteSession(sessionId);
        if (deleted) {
          return true;
        }

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
      }

      return false;
    },
    [deleteSession],
  );

  /**
   * MASTER CLEANUP FUNCTION
   * Removes ACTIVE workout sessions (ended_at = NULL) and exercises for the current user and plan.
   */
  const cleanupAllSessionsAndExercises =
    useCallback(async (): Promise<boolean> => {
      if (!userProfile?.user_id || !planId) {
        return false;
      }

      try {
        // STEP 1: Find and delete ONLY ACTIVE sessions (ended_at = NULL) for this user+plan
        const { data: activeSessions, error: sessionsError } = await supabase
          .from("user_workout_sessions")
          .select("id, started_at, ended_at")
          .eq("user_id", userProfile.user_id)
          .eq("plan_id", planId)
          .is("ended_at", null); // Only get active sessions

        if (sessionsError) {
          return false;
        }

        if (activeSessions && activeSessions.length > 0) {
          for (const session of activeSessions) {
            const deleted = await deleteSession(session.id);
            if (!deleted) {
              return false;
            }
          }
        }

        // Clear local state immediately
        exercisesAddedRef.current.clear();
        setSessionExercises(new Map());
        setSessionSets(new Map());

        return true;
      } catch (error) {
        return false;
      }
    }, [userProfile?.user_id, planId, deleteSession]);

  /**
   * Starts a new workout session
   */
  const startWorkoutSession = useCallback(
    async (
      dayPlanIdOverride?: string | null,
      weeklyPlanIdOverride?: string | null,
    ) => {
      if (!userProfile?.user_id || !planId) {
        return null;
      }

      if (isStartingSessionRef.current) {
        return activeSessionId;
      }

      isStartingSessionRef.current = true;

      try {
        // STEP 1: Strictly remove unfinished sessions before creating a fresh one.
        const cleaned = await cleanupAllSessionsAndExercises();
        if (!cleaned) {
          return null;
        }

        // Clear local state to ensure fresh start
        resetWorkoutState();

        // STEP 4: Create new workout session
        const deviceInfo = {
          platform: "web",
          userAgent:
            typeof window !== "undefined"
              ? window.navigator.userAgent
              : "unknown",
          screenWidth: typeof window !== "undefined" ? window.innerWidth : 0,
        };

        // Create session with retry logic
        const session = await retryDatabaseOperation(
          async () => {
            const resolvedDayPlanForSession =
              dayPlanIdOverride ??
              resolvedDayPlanIdRef.current ??
              resolvedDayPlanId ??
              null;
            const resolvedWeeklyPlanForSession =
              weeklyPlanIdOverride ??
              resolvedWeeklyPlanIdRef.current ??
              resolvedWeeklyPlanId ??
              null;

            const baseSessionPayload = {
              user_id: userProfile.user_id,
              plan_id: planId as string,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              device_info: deviceInfo,
              started_at: new Date().toISOString(),
            };

            const sessionPayload =
              resolvedDayPlanForSession !== null ||
              resolvedWeeklyPlanForSession !== null
                ? {
                    ...baseSessionPayload,
                    ...(resolvedDayPlanForSession !== null
                      ? { day_plan_id: resolvedDayPlanForSession }
                      : {}),
                    ...(resolvedWeeklyPlanForSession !== null
                      ? { weekly_plan_id: resolvedWeeklyPlanForSession }
                      : {}),
                  }
                : baseSessionPayload;

            let { data, error } = await supabase
              .from("user_workout_sessions")
              .insert(sessionPayload)
              .select()
              .single();

            // Backward compatibility: if DB schema has not added day_plan_id/weekly_plan_id yet, retry without missing columns.
            if (
              error &&
              (resolvedDayPlanForSession !== null ||
                resolvedWeeklyPlanForSession !== null)
            ) {
              const errorMessage =
                typeof error.message === "string" ? error.message : "";
              const missingDayPlanColumn =
                errorMessage.toLowerCase().includes("day_plan_id") &&
                (errorMessage.toLowerCase().includes("column") ||
                  errorMessage.toLowerCase().includes("could not find"));
              const missingWeeklyPlanColumn =
                errorMessage.toLowerCase().includes("weekly_plan_id") &&
                (errorMessage.toLowerCase().includes("column") ||
                  errorMessage.toLowerCase().includes("could not find"));

              if (missingDayPlanColumn || missingWeeklyPlanColumn) {
                const fallbackPayload = {
                  ...baseSessionPayload,
                  ...(resolvedDayPlanForSession !== null &&
                  !missingDayPlanColumn
                    ? { day_plan_id: resolvedDayPlanForSession }
                    : {}),
                  ...(resolvedWeeklyPlanForSession !== null &&
                  !missingWeeklyPlanColumn
                    ? { weekly_plan_id: resolvedWeeklyPlanForSession }
                    : {}),
                };

                const fallbackResponse = await supabase
                  .from("user_workout_sessions")
                  .insert(fallbackPayload)
                  .select()
                  .single();

                data = fallbackResponse.data;
                error = fallbackResponse.error;
              }
            }

            if (error) {
              throw error;
            }

            return data;
          },
          "startNewWorkoutSession",
          3,
        );

        if (session) {
          // Update local state
          sessionInitializedRef.current = true;
          setActiveSessionId(session.id);
          sessionStartTimeRef.current = new Date();
          setCurrentFlowIndex(0); // Ensure we start from first exercise

          // Wait a brief moment to ensure state is updated before proceeding
          await new Promise((resolve) => setTimeout(resolve, 100));

          return session.id;
        }
      } catch (error) {
        // Failed to create session
      } finally {
        isStartingSessionRef.current = false;
      }

      return null;
    },
    [
      activeSessionId,
      userProfile?.user_id,
      planId,
      resolvedDayPlanId,
      resolvedWeeklyPlanId,
      cleanupAllSessionsAndExercises,
      retryDatabaseOperation,
      resetWorkoutState,
    ],
  );

  // ===========================
  // Exercise Management
  // ===========================

  /**
   * Adds an exercise to the current session
   */
  const addExerciseToSession = useCallback(
    async (
      exercise: Exercise,
      exerciseOrder: number,
      sessionIdOverride?: string | null,
    ): Promise<string | null> => {
      // Use provided sessionId or fall back to activeSessionId from state
      const sessionId = sessionIdOverride ?? activeSessionId;

      if (!sessionId || !userProfile?.user_id) {
        return null;
      }

      const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;

      // Fast path: Already added and in state
      if (exercisesAddedRef.current.has(exerciseKey)) {
        const fromState = sessionExercises.get(exerciseKey);
        if (fromState?.id) {
          return fromState.id;
        }
      }

      // Check database first to prevent duplicate key errors
      try {
        const { data: dbExercise, error: dbError } = await supabase
          .from("user_workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .eq("exercise_id", exercise.exercise_id)
          .eq("plan_position", exercise.position)
          .maybeSingle();

        if (dbExercise && !dbError) {
          // Exercise already exists in database
          exercisesAddedRef.current.add(exerciseKey);
          setSessionExercises((prev) => {
            const newMap = new Map(prev);
            newMap.set(exerciseKey, dbExercise);
            return newMap;
          });
          exerciseStartTimeRef.current = new Date();
          return dbExercise.id;
        }
      } catch (dbCheckError) {
        // Continue to creation if check fails
      }

      const exercisePayload: WorkoutSessionExerciseCreatePayload = {
        session_id: sessionId,
        user_id: userProfile.user_id,
        exercise_id: exercise.exercise_id,
        plan_id: exercise.plan_step_id,
        plan_position: exercise.position,
        order_in_session: exerciseOrder,
        exercise_name_snapshot: exercise.details?.name || null,
        section_snapshot: exercise.section,
        safety_tip_snapshot:
          exercise.safety_tip || exercise.details?.safety_cue || null,
        target_sets: exercise.sets,
        target_reps: exercise.reps,
        target_duration_seconds: exercise.duration_seconds,
      };

      // Use retry logic for adding exercise
      let sessionExercise: WorkoutSessionExercise | null = null;
      try {
        sessionExercise = await retryDatabaseOperation(
          async () => {
            const { data, error } = await supabase
              .from("user_workout_session_exercises")
              .insert(exercisePayload)
              .select()
              .single();

            if (error) {
              throw error;
            }

            return data;
          },
          "addExerciseToSession",
          3,
        );
      } catch (error: unknown) {
        const errorLike =
          error && typeof error === "object"
            ? (error as { message?: string; code?: string })
            : {};

        // Handle duplicate key error (23505) - exercise already exists
        if (
          errorLike.code === "23505" ||
          errorLike.message?.includes("duplicate key")
        ) {
          // Immediately check database for existing exercise
          try {
            const { data: dbExercise, error: dbError } = await supabase
              .from("user_workout_session_exercises")
              .select("*")
              .eq("session_id", sessionId)
              .eq("exercise_id", exercise.exercise_id)
              .eq("plan_position", exercise.position)
              .maybeSingle();

            if (dbExercise && !dbError) {
              exercisesAddedRef.current.add(exerciseKey);
              setSessionExercises((prev) => {
                const newMap = new Map(prev);
                newMap.set(exerciseKey, dbExercise);
                return newMap;
              });
              exerciseStartTimeRef.current = new Date();
              return dbExercise.id;
            }
          } catch (fetchError) {
            // Continue to final check
          }
        }
      }

      if (sessionExercise) {
        exercisesAddedRef.current.add(exerciseKey);
        setSessionExercises((prev) => {
          const newMap = new Map(prev);
          newMap.set(exerciseKey, sessionExercise!);
          return newMap;
        });
        exerciseStartTimeRef.current = new Date();

        return sessionExercise.id;
      }

      // If creation failed, check database one more time
      try {
        const { data: dbExercise, error: dbError } = await supabase
          .from("user_workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .eq("exercise_id", exercise.exercise_id)
          .eq("plan_position", exercise.position)
          .maybeSingle();

        if (dbExercise && !dbError) {
          exercisesAddedRef.current.add(exerciseKey);
          setSessionExercises((prev) => {
            const newMap = new Map(prev);
            newMap.set(exerciseKey, dbExercise);
            return newMap;
          });
          exerciseStartTimeRef.current = new Date();
          return dbExercise.id;
        }
      } catch (finalCheckError) {
        // Failed to add exercise
      }

      return null;
    },
    [activeSessionId, userProfile?.user_id, planId, retryDatabaseOperation],
  );

  /**
   * Ensures an exercise exists in the session and is available in state.
   */
  const ensureExerciseExists = useCallback(
    async (
      exercise: Exercise,
      exerciseOrder: number,
      maxWaitMs: number = 2000,
    ): Promise<string | null> => {
      if (!activeSessionId) {
        return null;
      }

      if (!userProfile?.user_id) {
        return null;
      }

      const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;

      // Fast path: Already added and in state
      if (exercisesAddedRef.current.has(exerciseKey)) {
        const fromState = sessionExercises.get(exerciseKey);
        if (fromState?.id && fromState?.session_id) {
          return fromState.id;
        }
      }

      // Try to get from database first
      try {
        const { data: dbExercise, error: dbError } = await supabase
          .from("user_workout_session_exercises")
          .select("*")
          .eq("session_id", activeSessionId)
          .eq("exercise_id", exercise.exercise_id)
          .eq("plan_position", exercise.position)
          .maybeSingle();

        if (dbExercise && !dbError) {
          // Exercise exists in database, update state
          exercisesAddedRef.current.add(exerciseKey);
          setSessionExercises((prev) => {
            const newMap = new Map(prev);
            newMap.set(exerciseKey, dbExercise);
            return newMap;
          });
          exerciseStartTimeRef.current = new Date();
          return dbExercise.id;
        }
      } catch (dbCheckError) {
        // Continue to creation if check fails
      }

      // Create the exercise
      const sessionExerciseId = await addExerciseToSession(
        exercise,
        exerciseOrder,
      );

      if (!sessionExerciseId) {
        return null;
      }

      // Wait for exercise to be available in state (with timeout)
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs) {
        const exerciseInState = sessionExercises.get(exerciseKey);
        if (exerciseInState?.id && exerciseInState?.session_id) {
          return exerciseInState.id;
        }
        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // If still not in state after waiting, verify it exists in database
      try {
        const { data: dbExercise, error: dbError } = await supabase
          .from("user_workout_session_exercises")
          .select("*")
          .eq("id", sessionExerciseId)
          .maybeSingle();

        if (dbExercise && !dbError) {
          // Update state with the exercise
          exercisesAddedRef.current.add(exerciseKey);
          setSessionExercises((prev) => {
            const newMap = new Map(prev);
            newMap.set(exerciseKey, dbExercise);
            return newMap;
          });
          return dbExercise.id;
        }

        // Exercise verified in database
      } catch (finalCheckError) {
        // Error in final check
      }

      // If we have the ID but it's not in state, return it anyway (it exists in DB)
      return sessionExerciseId;
    },
    [
      activeSessionId,
      userProfile?.user_id,
      sessionExercises,
      addExerciseToSession,
    ],
  );

  // ===========================
  // Set Recording
  // ===========================

  // Queue for failed database operations to retry later
  const failedOperationsRef = useRef<Array<() => Promise<void>>>([]);

  // Retry failed operations in background
  useEffect(() => {
    const retryFailedOperations = async () => {
      if (failedOperationsRef.current.length === 0) return;

      const operations = [...failedOperationsRef.current];
      failedOperationsRef.current = [];

      for (const operation of operations) {
        try {
          await operation();
        } catch (error) {
          // Re-queue if still failing (will retry later)
          failedOperationsRef.current.push(operation);
        }
      }
    };

    // Retry every 10 seconds
    const interval = setInterval(retryFailedOperations, 10000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount / route change
  useEffect(() => {
    return () => {
      resetWorkoutState();
    };
  }, [resetWorkoutState]);

  /**
   * Records a completed set for an exercise in the current session.
   * Side handling logic:
   * - Normal exercises (per_side = false): side = null
   * - Per-side exercises with 1 set: side = 'both' (1 record)
   * - Per-side exercises with multiple sets: side = 'left' or 'right' alternating (1 record per set)
   *
   * This function is now non-blocking - it updates local state immediately
   * and syncs to database in the background to ensure smooth transitions.
   */
  const recordCompletedSet = useCallback(
    async (
      exercise: Exercise,
      setNumber: number,
      actualDuration?: number,
      actualRest?: number,
      side: "left" | "right" | "both" = "both",
      options?: {
        completed?: boolean;
        isRestUpdate?: boolean;
      },
    ): Promise<boolean> => {
      if (!activeSessionId || !userProfile?.user_id) return false;

      const isRestUpdate = options?.isRestUpdate === true;
      const completed = options?.completed !== false;
      const finalSide = !exercise.per_side ? null : side;
      const setOperationKey = [
        activeSessionId,
        exercise.exercise_id,
        exercise.position,
        setNumber,
        finalSide ?? "null",
        isRestUpdate ? "rest" : "set",
        completed ? "completed" : "skipped",
      ].join("_");

      // Guard against accidental re-entrancy (double tap/auto+manual overlap).
      if (inFlightSetRecordingsRef.current.has(setOperationKey)) {
        return true;
      }
      inFlightSetRecordingsRef.current.add(setOperationKey);

      const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;
      let sessionExercise = sessionExercises.get(exerciseKey);

      // Ensure session exercise exists - create if not found
      if (!sessionExercise) {
        // First try to get from database
        try {
          const { data: dbExercise, error: dbError } = await supabase
            .from("user_workout_session_exercises")
            .select("*")
            .eq("session_id", activeSessionId)
            .eq("exercise_id", exercise.exercise_id)
            .eq("plan_position", exercise.position)
            .maybeSingle();

          if (dbExercise && !dbError) {
            sessionExercise = dbExercise;
            setSessionExercises((prev) => {
              const newMap = new Map(prev);
              newMap.set(exerciseKey, dbExercise);
              return newMap;
            });
          }
        } catch (dbQueryError) {
          // Error querying database
        }

        // If still not found, create it
        if (!sessionExercise) {
          const currentItem = workoutFlow[currentFlowIndex];
          if (!currentItem) {
            return false;
          }

          const sessionExerciseId = await addExerciseToSession(
            exercise,
            currentItem.exerciseOrder,
          );

          if (!sessionExerciseId) {
            return false;
          }

          // Get the created exercise - check state first, then database
          sessionExercise = sessionExercises.get(exerciseKey);

          if (!sessionExercise) {
            // Wait a brief moment for state to update (React state is async)
            await new Promise((resolve) => setTimeout(resolve, 50));
            sessionExercise = sessionExercises.get(exerciseKey);
          }

          if (!sessionExercise) {
            // Query database directly using the ID we got back
            const { data: dbExercise, error: dbError } = await supabase
              .from("user_workout_session_exercises")
              .select("*")
              .eq("id", sessionExerciseId)
              .maybeSingle();

            if (dbExercise && !dbError) {
              sessionExercise = dbExercise;
              setSessionExercises((prev) => {
                const newMap = new Map(prev);
                newMap.set(exerciseKey, dbExercise);
                return newMap;
              });
              exercisesAddedRef.current.add(exerciseKey);
            }
          }

          if (
            !sessionExercise ||
            !sessionExercise.id ||
            !sessionExercise.session_id
          ) {
            return false;
          }
        }
      }

      // Validate session exercise has required fields
      if (!sessionExercise.id || !sessionExercise.session_id) {
        return false;
      }

      try {
        const findSetInDatabase = async (
          sessionExerciseId: string,
          setNo: number,
          sideValue: string | null,
        ) => {
          let query = supabase
            .from("user_workout_session_sets")
            .select("*")
            .eq("session_exercise_id", sessionExerciseId)
            .eq("set_number", setNo);

          query =
            sideValue === null
              ? query.is("side", null)
              : query.eq("side", sideValue);

          return query.maybeSingle();
        };

        // Reps for this set (skip sets should not carry reps)
        const baseReps = completed ? exercise.reps || null : null;

        // Upsert set record
        const setKey = `${exerciseKey}_${setNumber}_${finalSide ?? "null"}`;
        let existingSet = sessionSets.get(setKey);

        // If not in local state, check database to avoid duplicates
        if (!existingSet) {
          try {
            const { data: dbSet, error: dbError } = await findSetInDatabase(
              sessionExercise.id,
              setNumber,
              finalSide,
            );

            if (dbSet && !dbError) {
              existingSet = dbSet;
              setSessionSets((prev) => {
                const copy = new Map(prev);
                copy.set(setKey, dbSet);
                return copy;
              });
            }
          } catch (dbCheckError) {
            // Continue if check fails
          }
        }

        // If the set was already completed and this is a skip attempt, do nothing
        if (!completed && existingSet?.completed) {
          return true;
        }

        // Duration fallback if needed (only when completing a set)
        let finalDuration =
          completed && !isRestUpdate ? actualDuration : undefined;
        if (
          completed &&
          !isRestUpdate &&
          !finalDuration &&
          exercise.duration_seconds &&
          setStartTimeRef.current
        ) {
          const elapsed = Math.floor(
            (new Date().getTime() - setStartTimeRef.current.getTime()) / 1000,
          );
          finalDuration = elapsed;
        }

        // Preserve prior values when doing rest-only updates
        const finalReps = isRestUpdate
          ? (existingSet?.reps ?? baseReps)
          : baseReps;
        const finalRest = actualRest ?? existingSet?.rest_seconds ?? null;
        const resolvedDuration =
          finalDuration ?? existingSet?.duration_seconds ?? null;

        // Totals tracking (avoid double-counting)
        const wasCompleted = existingSet?.completed === true;
        const shouldCountSet = completed && !wasCompleted && !isRestUpdate;
        const shouldAddDuration =
          !isRestUpdate &&
          completed &&
          resolvedDuration != null &&
          existingSet?.duration_seconds == null;
        const shouldAddReps =
          !isRestUpdate &&
          completed &&
          baseReps != null &&
          existingSet?.reps == null;
        const shouldAddRest =
          actualRest != null && existingSet?.rest_seconds == null;

        if (shouldAddDuration && resolvedDuration) {
          totalWorkoutTimeRef.current += resolvedDuration;
        }
        if (shouldAddRest && finalRest) {
          totalRestTimeRef.current += finalRest;
        }

        // Validate session exercise ID before creating payload
        if (!sessionExercise.id) {
          return false;
        }

        const setPayload: WorkoutSessionSetCreatePayload = {
          session_exercise_id: sessionExercise.id,
          user_id: userProfile.user_id,
          set_number: setNumber,
          side: finalSide,
          reps: finalReps ?? null,
          duration_seconds: resolvedDuration,
          rest_seconds: finalRest,
          completed,
        };

        // Validate payload before saving
        if (!setPayload.session_exercise_id || !setPayload.user_id) {
          return false;
        }

        // Update local state IMMEDIATELY for smooth transitions
        const localSetData: WorkoutSessionSet = existingSet
          ? {
              ...existingSet,
              reps: finalReps ?? null,
              duration_seconds: resolvedDuration,
              rest_seconds: finalRest,
              completed,
            }
          : ({
              id: `temp-${Date.now()}`, // Temporary ID for local state
              session_exercise_id: sessionExercise.id,
              user_id: userProfile.user_id,
              set_number: setNumber,
              side: finalSide,
              reps: finalReps ?? null,
              duration_seconds: resolvedDuration,
              rest_seconds: finalRest,
              completed,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as WorkoutSessionSet);

        // Update local state immediately
        setSessionSets((prev) => {
          const copy = new Map(prev);
          copy.set(setKey, localSetData);
          return copy;
        });

        // Update local exercise state immediately
        const setDelta = shouldCountSet ? 1 : 0;
        const durationDelta = shouldAddDuration ? resolvedDuration || 0 : 0;
        const repsDelta = shouldAddReps ? finalReps || 0 : 0;
        const restDelta = shouldAddRest ? finalRest || 0 : 0;

        if (setDelta || durationDelta || repsDelta || restDelta) {
          setSessionExercises((prev) => {
            const newMap = new Map(prev);
            const updated = {
              ...sessionExercise,
              actual_sets: (sessionExercise.actual_sets || 0) + setDelta,
              actual_duration_seconds:
                (sessionExercise.actual_duration_seconds || 0) + durationDelta,
              actual_reps: (sessionExercise.actual_reps || 0) + repsDelta,
              actual_rest_seconds:
                (sessionExercise.actual_rest_seconds || 0) + restDelta,
            };
            newMap.set(exerciseKey, updated);
            return newMap;
          });
        }

        // Sync to database in background (non-blocking)
        // Define sync function outside try block to avoid closure issues
        const syncToDatabase = async (): Promise<void> => {
          try {
            let savedSet: WorkoutSessionSet | null = null;

            if (existingSet) {
              // Update existing set with retry
              const updateResult = await retryDatabaseOperation(
                async () => {
                  const { data, error } = await supabase
                    .from("user_workout_session_sets")
                    .update({
                      reps: finalReps ?? null,
                      duration_seconds: resolvedDuration,
                      rest_seconds: finalRest,
                      completed,
                    })
                    .eq("id", existingSet!.id)
                    .select()
                    .single();

                  if (error) {
                    throw error;
                  }

                  return data;
                },
                "updateExerciseSet",
                2,
              );

              if (updateResult) {
                savedSet = updateResult;
                // Update local state with real database ID
                setSessionSets((prev) => {
                  const copy = new Map(prev);
                  copy.set(setKey, savedSet!);
                  return copy;
                });
              } else {
                // Queue for retry
                failedOperationsRef.current.push(syncToDatabase);
                return;
              }
            } else {
              // Check database first to prevent duplicate key errors
              try {
                const { data: dbSet, error: dbError } = await findSetInDatabase(
                  setPayload.session_exercise_id,
                  setPayload.set_number,
                  setPayload.side ?? null,
                );

                if (dbSet && !dbError) {
                  // Set already exists in database
                  savedSet = dbSet;
                  setSessionSets((prev) => {
                    const copy = new Map(prev);
                    copy.set(setKey, dbSet);
                    return copy;
                  });
                }
              } catch (dbCheckError) {
                // Continue to creation if check fails
              }

              // If not found in database, create it
              if (!savedSet) {
                const createResult = await retryDatabaseOperation(
                  async () => {
                    const { data, error } = await supabase
                      .from("user_workout_session_sets")
                      .insert(setPayload)
                      .select()
                      .single();

                    if (error) {
                      throw error;
                    }

                    return data;
                  },
                  "addSetToExercise",
                  2,
                );

                if (createResult) {
                  savedSet = createResult;
                  // Update local state with real database ID
                  setSessionSets((prev) => {
                    const copy = new Map(prev);
                    copy.set(setKey, createResult);
                    return copy;
                  });
                } else {
                  // Check database one more time (might have been created by another call)
                  try {
                    const { data: dbSet, error: dbError } =
                      await findSetInDatabase(
                        setPayload.session_exercise_id,
                        setPayload.set_number,
                        setPayload.side ?? null,
                      );

                    if (dbSet && !dbError) {
                      savedSet = dbSet;
                      setSessionSets((prev) => {
                        const copy = new Map(prev);
                        copy.set(setKey, dbSet);
                        return copy;
                      });
                    } else {
                      // Queue for retry
                      failedOperationsRef.current.push(syncToDatabase);
                      return;
                    }
                  } catch (finalCheckError) {
                    // Queue for retry
                    failedOperationsRef.current.push(syncToDatabase);
                    return;
                  }
                }
              }

              // Update cumulative on session exercise (background)
              if (
                savedSet &&
                (setDelta || durationDelta || repsDelta || restDelta)
              ) {
                const currentActualSets = sessionExercise.actual_sets || 0;
                const currentActualDuration =
                  sessionExercise.actual_duration_seconds || 0;
                const currentActualReps = sessionExercise.actual_reps || 0;
                const currentActualRest =
                  sessionExercise.actual_rest_seconds || 0;

                await retryDatabaseOperation(
                  async () => {
                    const { data, error } = await supabase
                      .from("user_workout_session_exercises")
                      .update({
                        actual_sets: currentActualSets + setDelta,
                        actual_duration_seconds:
                          currentActualDuration + durationDelta,
                        actual_reps: currentActualReps + repsDelta,
                        actual_rest_seconds: currentActualRest + restDelta,
                      })
                      .eq("id", sessionExercise!.id)
                      .select()
                      .single();

                    if (error) {
                      throw error;
                    }

                    return true;
                  },
                  "updateSessionExercise",
                  2,
                );
              }
            }
          } catch (syncError) {
            // Queue for retry
            failedOperationsRef.current.push(syncToDatabase);
          }
        };

        // Start background sync (non-blocking)
        syncToDatabase().catch(() => {
          // Background sync failed, will retry
        });

        // Return true immediately after updating local state
        return true;
      } catch (error) {
        return false;
      } finally {
        inFlightSetRecordingsRef.current.delete(setOperationKey);
      }
    },
    [
      activeSessionId,
      userProfile?.user_id,
      sessionExercises,
      sessionSets,
      workoutFlow,
      currentFlowIndex,
      addExerciseToSession,
      retryDatabaseOperation,
    ],
  );

  // ===========================
  // Timer Logic
  // ===========================

  // State to track when timer should restart (increments when timer is set to new value)
  const [timerRestartKey, setTimerRestartKey] = useState<number>(0);

  // Timer countdown effect - only restarts when pause changes or timerRestartKey changes
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTimerRef = useRef<number>(timer);
  const lastExerciseFinalCountdownCueKeyRef = useRef<string | null>(null);
  const lastRestFinalCountdownCueKeyRef = useRef<string | null>(null);

  // Keep currentTimerRef in sync with timer
  useEffect(() => {
    currentTimerRef.current = timer;
    currentTimerValueRef.current = timer;
  }, [timer]);

  useEffect(() => {
    // Clear any existing interval first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Don't start if paused
    if (isPaused) {
      return;
    }

    // Check both timer state and ref to ensure we have the latest value
    // Prioritize ref if it's set (more reliable for immediate updates)
    // Otherwise use timer state
    const currentTimerValue =
      currentTimerRef.current > 0
        ? currentTimerRef.current
        : timer > 0
          ? timer
          : 0;

    if (currentTimerValue <= 0) {
      return;
    }

    // Ensure ref is in sync with state if state is available
    if (timer > 0 && currentTimerRef.current !== timer) {
      currentTimerRef.current = timer;
      currentTimerValueRef.current = timer;
    }

    // Start countdown interval
    // Use the ref value as the source of truth (it's updated synchronously)
    // This handles the case where showStartCountdown set the ref but state hasn't updated yet
    const countdownValue =
      currentTimerRef.current > 0 ? currentTimerRef.current : timer;

    // If state is 0 but ref has value, update state immediately
    if (countdownValue > 0 && timer === 0) {
      setTimer(countdownValue);
    }

    timerIntervalRef.current = setInterval(() => {
      // Always use ref as source of truth, fall back to state
      const currentValue =
        currentTimerRef.current > 0 ? currentTimerRef.current : timer;

      if (currentValue <= 0) {
        clearInterval(timerIntervalRef.current!);
        timerIntervalRef.current = null;
        setTimer(0);
        return;
      }

      hasTimerTickedRef.current = true; // ✅ MARK REAL START
      const next = currentValue - 1;
      currentTimerRef.current = next;
      currentTimerValueRef.current = next;
      setTimer(next);

      if (next <= 0) {
        clearInterval(timerIntervalRef.current!);
        timerIntervalRef.current = null;
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isPaused, timerRestartKey]); // Only restart when pause or restart key changes

  // Play a pre-recorded 5..1 countdown once per exercise segment.
  useEffect(() => {
    if (isStartingWorkout || isIntroVoicePlayingRef.current) return;
    if (!activeSessionId || isPaused || isResting) return;
    if (timer !== 5) return;

    const segmentKey = `${activeSessionId}:${currentFlowIndex}:${lastTimerSetRef.current}`;
    if (lastExerciseFinalCountdownCueKeyRef.current === segmentKey) {
      return;
    }
    lastExerciseFinalCountdownCueKeyRef.current = segmentKey;

    void playPreRecordedCueAndWait("countdown", {
      interrupt: true,
      maxWaitMs: 7000,
    });
  }, [
    timer,
    isPaused,
    isResting,
    isStartingWorkout,
    activeSessionId,
    currentFlowIndex,
    playPreRecordedCueAndWait,
  ]);

  useEffect(() => {
    if (isStartingWorkout || isIntroVoicePlayingRef.current) return;
    if (!activeSessionId || isPaused || !isResting) return;

    const currentItem = workoutFlow[currentFlowIndex];
    if (!currentItem || !currentItem.isRestAfter) return;
    const restSeconds = currentItem.exercise.rest_seconds || 0;
    if (restSeconds <= 0) return;
    if (timer !== restSeconds) return;

    const segmentKey = `${activeSessionId}:${currentFlowIndex}:${lastTimerSetRef.current}`;
    if (lastRestEntranceCueKeyRef.current === segmentKey) {
      return;
    }
    lastRestEntranceCueKeyRef.current = segmentKey;

    void playRandomRestEntranceAudio();
  }, [
    timer,
    isPaused,
    isResting,
    isStartingWorkout,
    activeSessionId,
    workoutFlow,
    currentFlowIndex,
    playRandomRestEntranceAudio,
  ]);

  useEffect(() => {
    if (isStartingWorkout || isIntroVoicePlayingRef.current) return;
    if (!activeSessionId || isPaused || !isResting) return;
    void announceRestMidpointCueIfNeeded();
  }, [
    timer,
    isPaused,
    isResting,
    isStartingWorkout,
    activeSessionId,
    announceRestMidpointCueIfNeeded,
  ]);

  useEffect(() => {
    if (isStartingWorkout || isIntroVoicePlayingRef.current) return;
    if (!activeSessionId || isPaused || isResting) return;

    const currentItem = workoutFlow[currentFlowIndex];
    if (!currentItem) return;

    const durationSeconds = currentItem.exercise.duration_seconds || 0;
    if (durationSeconds <= 0) return;

    const midpointRemaining = Math.ceil(durationSeconds / 2);
    if (timer !== midpointRemaining) return;

    const exerciseKey = getExerciseIdentityKey(currentItem);
    if (!exerciseKey) return;

    const targetSet = getSafetyCueTargetSet(currentItem);
    if (targetSet == null || currentItem.setNumber !== targetSet) return;

    const playedKey = `${activeSessionId}:${exerciseKey}`;
    if (playedSafetyCueExerciseKeysRef.current.has(playedKey)) {
      return;
    }

    const safetyCueText = getExerciseSafetyCueText(currentItem);
    if (!safetyCueText) return;

    playedSafetyCueExerciseKeysRef.current.add(playedKey);

    void speakCountdownCueAndWait(safetyCueText, {
      interrupt: true,
      rate: 0.92,
      maxWaitMs: Math.max(2600, safetyCueText.length * 130),
    });
  }, [
    timer,
    isPaused,
    isResting,
    isStartingWorkout,
    activeSessionId,
    workoutFlow,
    currentFlowIndex,
    getExerciseIdentityKey,
    getExerciseSafetyCueText,
    getSafetyCueTargetSet,
    speakCountdownCueAndWait,
  ]);

  useEffect(() => {
    if (!isResting) {
      stopRestEntranceAudio();
    }
  }, [isResting, stopRestEntranceAudio]);

  useEffect(() => {
    if (isStartingWorkout || isIntroVoicePlayingRef.current) return;
    if (!activeSessionId || isPaused || !isResting) return;
    if (timer !== 3) return;

    const currentItem = workoutFlow[currentFlowIndex];
    if (!currentItem || !currentItem.isRestAfter) return;

    const segmentKey = `${activeSessionId}:${currentFlowIndex}:${lastTimerSetRef.current}`;
    if (lastRestFinalCountdownCueKeyRef.current === segmentKey) {
      return;
    }
    lastRestFinalCountdownCueKeyRef.current = segmentKey;

    void playPreRecordedCueAndWait("rest-countdown", {
      interrupt: true,
      maxWaitMs: 7000,
    });
  }, [
    timer,
    isPaused,
    isResting,
    isStartingWorkout,
    activeSessionId,
    workoutFlow,
    currentFlowIndex,
    playPreRecordedCueAndWait,
  ]);

  // Track previous values to prevent unnecessary timer resets
  const prevFlowIndexRef = useRef<number>(-1);
  const prevIsRestingRef = useRef<boolean>(false);
  const hasInitializedTimerRef = useRef<boolean>(false);
  const workoutFlowRef = useRef<WorkoutFlowItem[]>([]);
  const prevIsStartingWorkoutRef = useRef<boolean>(false);
  const expectedTimerValueRef = useRef<number>(0);
  const currentTimerValueRef = useRef<number>(0); // Track current timer value

  // Keep workoutFlowRef in sync with workoutFlow
  useEffect(() => {
    workoutFlowRef.current = workoutFlow;
  }, [workoutFlow]);

  // Keep the currently visible image and upcoming images hot in cache.
  useEffect(() => {
    if (workoutFlow.length === 0) return;

    const lookaheadItems = [
      workoutFlow[currentFlowIndex],
      workoutFlow[currentFlowIndex + 1],
      workoutFlow[currentFlowIndex + 2],
    ].filter(Boolean) as WorkoutFlowItem[];

    preloadFlowImages(lookaheadItems);
  }, [workoutFlow, currentFlowIndex, preloadFlowImages]);

  // Update timer when flow index or resting state changes
  const isUpdatingTimerRef = useRef<boolean>(false);
  const lastTimerSetRef = useRef<number>(0); // Track when timer was last set

  useEffect(() => {
    // Don't run if workout flow is empty
    if (workoutFlow.length === 0 || workoutFlowRef.current.length === 0) {
      return;
    }

    // Don't initialize timer if session is not active yet
    // This ensures exercises are fully loaded and session is ready
    if (!activeSessionId) {
      return;
    }

    // 🔒 FIX: Do not touch timer while workout is still starting
    if (isStartingWorkout) {
      prevIsStartingWorkoutRef.current = true;
      return;
    }

    // Keep timer frozen while intro voice is playing.
    if (isIntroVoicePlayingRef.current) {
      return;
    }

    // Reset timer initialization refs when countdown completes (transitioning from starting to not starting)
    // This ensures the first exercise timer gets initialized properly
    const wasStarting = prevIsStartingWorkoutRef.current;
    const justFinishedCountdown = wasStarting && !isStartingWorkout;
    if (justFinishedCountdown) {
      hasInitializedTimerRef.current = false;
      prevFlowIndexRef.current = -1;
      prevIsRestingRef.current = false;
      expectedTimerValueRef.current = 0;
      lastTimerSetRef.current = 0;
    }
    prevIsStartingWorkoutRef.current = isStartingWorkout;

    // CRITICAL: If countdown just finished, wait a moment for showStartCountdown to set the timer
    // This prevents this effect from resetting the timer that was just set
    if (justFinishedCountdown) {
      // Give showStartCountdown time to set the timer (it sets it synchronously)
      // Check if timer was just set (within last 500ms)
      const timeSinceLastSet = Date.now() - lastTimerSetRef.current;
      if (
        timeSinceLastSet < 500 &&
        (timer > 0 || currentTimerValueRef.current > 0)
      ) {
        // Timer was just set by showStartCountdown, don't reset it
        hasInitializedTimerRef.current = true;
        prevFlowIndexRef.current = currentFlowIndex;
        prevIsRestingRef.current = isResting;
        return;
      }
    }

    // Prevent concurrent updates
    if (isUpdatingTimerRef.current) {
      return;
    }

    // Only update timer if flow index or resting state actually changed
    const flowIndexChanged = prevFlowIndexRef.current !== currentFlowIndex;
    const restingStateChanged = prevIsRestingRef.current !== isResting;

    // Timer effect detects changes

    // CRITICAL: If timer is currently counting down (timer > 0), don't reset it unless we're changing exercises
    // This prevents the timer from being reset while it's actively counting
    const currentItem =
      workoutFlow[currentFlowIndex] || workoutFlowRef.current[currentFlowIndex];

    // Prevent resetting timer if it was just set (within last 1 second)
    // BUT allow it if we're transitioning states (resting state changed or flow index changed)
    const timeSinceLastSet = Date.now() - lastTimerSetRef.current;
    if (
      timeSinceLastSet < 1000 &&
      currentTimerValueRef.current > 0 &&
      !flowIndexChanged &&
      !restingStateChanged
    ) {
      // Timer was just set and nothing changed, don't reset it
      return;
    }

    if (
      currentItem &&
      currentTimerValueRef.current > 0 &&
      !flowIndexChanged &&
      !restingStateChanged
    ) {
      const expectedDuration = isResting
        ? currentItem.exercise.rest_seconds || 0
        : currentItem.exercise.duration_seconds || 0;

      // If timer is counting down and matches the expected exercise, don't reset it
      // Check if timer is within expected range (allowing for countdown)
      if (
        expectedDuration > 0 &&
        currentTimerValueRef.current <= expectedDuration
      ) {
        // Timer is actively counting for the current exercise, don't touch it
        return;
      }
    }

    // On first initialization, we need to set the timer even if nothing "changed"
    // But only if the workout flow is ready and we haven't initialized yet
    // This is critical for the first exercise after countdown completes
    const isFirstInit =
      !hasInitializedTimerRef.current &&
      currentFlowIndex === 0 &&
      !isResting &&
      workoutFlow.length > 0;

    // CRITICAL: Also check if timer is 0 and we should have a duration for exercise
    // This ensures the timer displays correctly even if initialization was missed
    // Check for first exercise OR any exercise that needs timer initialization
    const needsTimerInit =
      isFirstInit ||
      (!isResting &&
        currentTimerValueRef.current === 0 &&
        currentItem?.exercise?.duration_seconds &&
        currentItem.exercise.duration_seconds > 0 &&
        !hasInitializedTimerRef.current);

    // CRITICAL: If transitioning to rest and timer is 0, we MUST initialize rest timer
    // This handles the case where exercise timer reached 0 and we're transitioning to rest
    // Check both restingStateChanged OR if we're in rest state but timer hasn't been initialized
    const needsRestInit =
      isResting &&
      (restingStateChanged ||
        (!hasInitializedTimerRef.current &&
          currentTimerValueRef.current === 0)) &&
      currentTimerValueRef.current === 0 &&
      currentItem?.exercise?.rest_seconds &&
      currentItem.exercise.rest_seconds > 0;

    // CRITICAL: If transitioning from rest to exercise and timer is 0, we MUST initialize exercise timer
    // This handles the case where rest timer reached 0 and we're transitioning to next exercise
    const needsExerciseInit =
      !isResting &&
      (flowIndexChanged || restingStateChanged) &&
      currentTimerValueRef.current === 0 &&
      currentItem?.exercise?.duration_seconds &&
      currentItem.exercise.duration_seconds > 0 &&
      !hasInitializedTimerRef.current;

    // Check if timer needs initialization

    // Only proceed if something actually changed or it's the first init or needs rest/exercise init
    // IMPORTANT: Don't reset timer if it's already running and nothing changed
    if (
      !flowIndexChanged &&
      !restingStateChanged &&
      !isFirstInit &&
      !needsTimerInit &&
      !needsRestInit &&
      !needsExerciseInit
    ) {
      return; // No change, don't reset timer
    }

    if (!currentItem) return;

    // Mark as updating
    isUpdatingTimerRef.current = true;

    // Update refs BEFORE setting timer to prevent re-triggering
    prevFlowIndexRef.current = currentFlowIndex;
    prevIsRestingRef.current = isResting;
    hasInitializedTimerRef.current = true;

    if (isResting) {
      if (currentItem.exercise.rest_seconds > 0) {
        const restSeconds = currentItem.exercise.rest_seconds;
        hasTimerTickedRef.current = false;
        expectedTimerValueRef.current = restSeconds;
        currentTimerValueRef.current = restSeconds;
        currentTimerRef.current = restSeconds; // CRITICAL: Update immediately so countdown effect can start
        lastTimerSetRef.current = Date.now();
        setTimer(restSeconds);
        setTimerRestartKey((prev) => prev + 1); // Trigger timer restart
        shouldAutoAdvanceRef.current = true;
        restStartTimeRef.current = new Date();
      } else {
        expectedTimerValueRef.current = 0;
        currentTimerValueRef.current = 0;
        currentTimerRef.current = 0;
        lastTimerSetRef.current = Date.now();
        setTimer(0);
        shouldAutoAdvanceRef.current = false;
        restStartTimeRef.current = null;
      }
    } else {
      if (
        currentItem.exercise.duration_seconds &&
        currentItem.exercise.duration_seconds > 0
      ) {
        const durationSeconds = currentItem.exercise.duration_seconds;
        hasTimerTickedRef.current = false;
        expectedTimerValueRef.current = durationSeconds;
        currentTimerValueRef.current = durationSeconds;
        currentTimerRef.current = durationSeconds; // CRITICAL: Update immediately so countdown effect can start
        lastTimerSetRef.current = Date.now();
        setTimer(durationSeconds);
        setTimerRestartKey((prev) => prev + 1); // Trigger timer restart
        shouldAutoAdvanceRef.current = true;
        setStartTimeRef.current = new Date();
      } else {
        expectedTimerValueRef.current = 0;
        currentTimerValueRef.current = 0;
        currentTimerRef.current = 0;
        lastTimerSetRef.current = Date.now();
        setTimer(0);
        shouldAutoAdvanceRef.current = false;
        setStartTimeRef.current = null;
      }
    }

    // Reset updating flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isUpdatingTimerRef.current = false;
    }, 100);
  }, [
    currentFlowIndex,
    isResting,
    isStartingWorkout,
    activeSessionId,
    workoutFlow.length,
  ]); // Include activeSessionId and workoutFlow.length to ensure timer initializes when ready

  // State to trigger auto-advance when timer reaches 0
  const [shouldTriggerNext, setShouldTriggerNext] = useState<boolean>(false);

  useEffect(() => {
    if (
      timer === 0 &&
      !isPaused &&
      shouldAutoAdvanceRef.current &&
      hasTimerTickedRef.current && // ✅ PREVENT FALSE ZERO
      activeSessionId && // Only auto-advance if session is active
      !isRestarting // Don't auto-advance during restart
    ) {
      shouldAutoAdvanceRef.current = false;
      hasTimerTickedRef.current = false; // reset for next cycle
      setShouldTriggerNext(true);
    }
  }, [
    timer,
    isPaused,
    activeSessionId,
    isRestarting,
    isResting,
    currentFlowIndex,
  ]);

  // ===========================
  // Navigation Handlers
  // ===========================

  /**
   * Persists workout session end record.
   */
  const endWorkoutSessionRecord = useCallback(async (): Promise<void> => {
    if (!activeSessionId) return;
    await retryDatabaseOperation(
      async () => {
        const { error } = await supabase
          .from("user_workout_sessions")
          .update({
            ended_at: new Date().toISOString(),
            total_duration_seconds: totalWorkoutTimeRef.current,
            notes: `Workout completed. Total workout time: ${totalWorkoutTimeRef.current}s, Rest time: ${totalRestTimeRef.current}s`,
          })
          .eq("id", activeSessionId);

        if (error) {
          throw error;
        }

        return true;
      },
      "endWorkoutSession",
      3,
    );
  }, [activeSessionId, retryDatabaseOperation]);

  const openWorkoutCompleteSheet = useCallback(() => {
    setIsPaused(true);
    setShowWorkoutCompleteSheet(true);
    stopBackgroundMusic(false);
  }, [stopBackgroundMusic]);

  const handleSaveWorkoutRpe = useCallback(async () => {
    if (isSavingWorkoutRpe) return;

    if (!resolvedDayPlanId) {
      showToast(
        "error",
        "Unable to save rating",
        "Workout day plan was not found. Please try again.",
      );
      return;
    }

    try {
      setIsSavingWorkoutRpe(true);

      const { error: dayPlanUpdateError } = await supabase
        .from("user_workout_weekly_day_plan")
        .update({ rpe_record: workoutRpe, isCompleted: true })
        .eq("id", resolvedDayPlanId);

      if (dayPlanUpdateError) {
        const code =
          typeof dayPlanUpdateError.code === "string"
            ? dayPlanUpdateError.code
            : "";
        const message =
          typeof dayPlanUpdateError.message === "string"
            ? dayPlanUpdateError.message.toLowerCase()
            : "";
        const isColumnMismatch =
          code === "42703" ||
          message.includes("column") ||
          message.includes("iscompleted");

        if (isColumnMismatch) {
          const { error: fallbackUpdateError } = await supabase
            .from("user_workout_weekly_day_plan")
            .update({ rpe_record: workoutRpe, is_completed: true })
            .eq("id", resolvedDayPlanId);

          if (fallbackUpdateError) {
            throw fallbackUpdateError;
          }
        } else {
          throw dayPlanUpdateError;
        }
      }

      await endWorkoutSessionRecord();
      allowFullscreenExitRef.current = true;
      setIsFullscreenGuardActive(false);
      isFullscreenGuardActiveRef.current = false;
      await exitSessionFullscreen();
      resetWorkoutState();
      router.push(workoutDetailsPath);
    } catch {
      showToast(
        "error",
        "Failed to save workout rating",
        "Please try submitting your rating again.",
      );
    } finally {
      setIsSavingWorkoutRpe(false);
    }
  }, [
    isSavingWorkoutRpe,
    resolvedDayPlanId,
    workoutRpe,
    endWorkoutSessionRecord,
    exitSessionFullscreen,
    resetWorkoutState,
    router,
    workoutDetailsPath,
    showToast,
  ]);

  /**
   * NEXT - Always ensure the exercise exists, then record set or skip rest.
   */
  const handleNext = useCallback(
    async (isAutoAdvance: boolean = false) => {
      if (
        isHandlingNextRef.current ||
        isGoingNext ||
        isSkipping ||
        isGoingPrevious ||
        isRestarting ||
        showWorkoutCompleteSheet
      )
        return;

      if (!activeSessionId || !userProfile?.user_id) {
        return;
      }

      const currentItem = workoutFlow[currentFlowIndex];
      if (!currentItem) {
        return;
      }

      isHandlingNextRef.current = true;
      if (!isAutoAdvance) setIsGoingNext(true);

      try {
        const { exercise, setNumber, isRestAfter } = currentItem;

        // If we are in rest, just move forward and capture actual rest
        if (isResting) {
          let actualRest: number | undefined;
          if (exercise.rest_seconds && restStartTimeRef.current) {
            const elapsed = Math.floor(
              (new Date().getTime() - restStartTimeRef.current.getTime()) /
                1000,
            );
            actualRest = elapsed;
          }

          // Ensure session exercise exists and is available before recording
          const sessionExerciseId = await ensureExerciseExists(
            exercise,
            currentItem.exerciseOrder,
          );

          if (!sessionExerciseId) {
            setIsGoingNext(false);
            return;
          }

          // Record the rest as part of the same set
          await recordCompletedSet(
            exercise,
            setNumber,
            undefined,
            actualRest,
            currentItem.side,
            { isRestUpdate: true },
          );

          // Transition from rest to next exercise/set
          // Reset timer initialization refs BEFORE state changes to ensure timer effect detects the transition
          hasInitializedTimerRef.current = false;
          // Set prev refs to current values so timer effect can detect the changes
          prevFlowIndexRef.current = currentFlowIndex;
          prevIsRestingRef.current = true; // Set to true so false change is detected

          // Advance to next item in flow and exit rest state
          // These state changes will trigger the timer effect to initialize the next exercise timer
          const nextIndex = Math.min(
            currentFlowIndex + 1,
            workoutFlow.length - 1,
          );

          // Now update state - timer effect will detect both flowIndexChanged and restingStateChanged
          setCurrentFlowIndex(nextIndex);
          setIsResting(false);
          setIsGoingNext(false);
          return;
        }

        // Ensure session exercise exists and is available before proceeding
        const sessionExerciseId = await ensureExerciseExists(
          exercise,
          currentItem.exerciseOrder,
        );

        if (!sessionExerciseId) {
          setIsGoingNext(false);
          return;
        }

        // Compute actual duration if needed
        let actualDuration: number | undefined;
        if (exercise.duration_seconds && setStartTimeRef.current) {
          const elapsed = Math.floor(
            (new Date().getTime() - setStartTimeRef.current.getTime()) / 1000,
          );
          actualDuration = elapsed;
        }

        // Record this set
        await recordCompletedSet(
          exercise,
          setNumber,
          actualDuration,
          undefined,
          currentItem.side,
        );

        const isLastItem = currentFlowIndex >= workoutFlow.length - 1;

        // If rest follows, enter rest state; else advance
        // Note: Timer update effect will handle setting the rest timer when isResting changes
        if (isRestAfter && exercise.rest_seconds) {
          // Reset timer initialization refs BEFORE state change to ensure timer effect detects the transition
          hasInitializedTimerRef.current = false;
          prevIsRestingRef.current = false; // Set to false so true change is detected

          // CRITICAL: Clear timer refs to ensure clean transition to rest
          // Don't reset lastTimerSetRef - let timer effect set it when it initializes rest timer
          currentTimerRef.current = 0;
          currentTimerValueRef.current = 0;
          expectedTimerValueRef.current = 0;

          // Set isResting to true - timer effect will detect restingStateChanged and set rest timer
          // The timer effect will set the rest timer automatically
          setIsResting(true);
        } else if (isLastItem) {
          // Workout complete - open RPE sheet
          openWorkoutCompleteSheet();
          return;
        } else {
          // Moving to next exercise/set (no rest)
          // Reset timer initialization refs BEFORE state change to ensure timer effect detects the transition
          hasInitializedTimerRef.current = false;
          prevFlowIndexRef.current = currentFlowIndex; // Set to current so next index change is detected
          setCurrentFlowIndex((i) => {
            return Math.min(i + 1, workoutFlow.length - 1);
          });
        }
      } catch (err) {
        // Error handling
      } finally {
        isHandlingNextRef.current = false;
        if (!isAutoAdvance) setIsGoingNext(false);
      }
    },
    [
      isGoingNext,
      isSkipping,
      isGoingPrevious,
      isRestarting,
      showWorkoutCompleteSheet,
      workoutFlow,
      currentFlowIndex,
      isResting,
      activeSessionId,
      userProfile?.user_id,
      ensureExerciseExists,
      recordCompletedSet,
      openWorkoutCompleteSheet,
    ],
  );

  // Handle auto-advance when timer reaches 0
  useEffect(() => {
    // Only trigger auto-advance if we have an active session and we're not already advancing
    if (
      shouldTriggerNext &&
      activeSessionId &&
      !isRestarting &&
      !isGoingNext &&
      !isSkipping
    ) {
      setShouldTriggerNext(false);
      handleNext(true); // Pass true to indicate auto-advance (no loader)
    } else if (shouldTriggerNext && !activeSessionId) {
      // If no session, just clear the flag
      setShouldTriggerNext(false);
    } else if (shouldTriggerNext) {
      // If we can't advance right now, clear the flag to prevent getting stuck
      setShouldTriggerNext(false);
    }
  }, [
    shouldTriggerNext,
    handleNext,
    activeSessionId,
    isRestarting,
    isGoingNext,
    isSkipping,
    isResting,
    currentFlowIndex,
  ]);

  /**
   * PREVIOUS - Go back to previous set/exercise
   */
  const handlePrevious = useCallback(async () => {
    if (
      currentFlowIndex === 0 ||
      isGoingPrevious ||
      isSkipping ||
      isGoingNext
    ) {
      return;
    }

    setIsGoingPrevious(true);

    try {
      // Simply move back one index
      setCurrentFlowIndex((i) => Math.max(i - 1, 0));
      setIsResting(false);
    } catch (e) {
      // Error handling
    } finally {
      setIsGoingPrevious(false);
    }
  }, [currentFlowIndex, isGoingPrevious, isSkipping, isGoingNext]);

  /**
   * SKIP - Records the exercise and all remaining sets as skipped
   */
  const handleSkip = useCallback(async () => {
    if (isSkipping || isGoingNext || isGoingPrevious || isRestarting) return;

    setIsSkipping(true);

    try {
      if (!activeSessionId || !userProfile?.user_id) {
        setIsSkipping(false);
        return;
      }

      const currentItem = workoutFlow[currentFlowIndex];
      if (!currentItem) {
        setIsSkipping(false);
        return;
      }

      const { exercise } = currentItem;
      const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;

      // Ensure session exercise exists
      const sessionExerciseId = await ensureExerciseExists(
        exercise,
        currentItem.exerciseOrder,
      );

      if (!sessionExerciseId) {
        setIsSkipping(false);
        return;
      }

      // Find all remaining sets for this exercise (current set + all future sets)
      const remainingSets: WorkoutFlowItem[] = [];
      let nextIndex = currentFlowIndex;

      // Include current set and all future sets for this exercise
      while (nextIndex < workoutFlow.length) {
        const item = workoutFlow[nextIndex];
        if (
          item.exercise.exercise_id !== exercise.exercise_id ||
          item.exercise.position !== exercise.position
        ) {
          break;
        }
        remainingSets.push(item);
        nextIndex++;
      }

      // Record skipped sets (completed = false) for this exercise
      for (const item of remainingSets) {
        await recordCompletedSet(
          item.exercise,
          item.setNumber,
          undefined,
          undefined,
          item.side,
          { completed: false },
        );
      }

      // Check if the last skipped set should have rest after it
      // If so, enter rest state before moving to next exercise
      const lastSkippedSet =
        remainingSets.length > 0
          ? remainingSets[remainingSets.length - 1]
          : null;

      if (
        lastSkippedSet &&
        lastSkippedSet.isRestAfter &&
        exercise.rest_seconds &&
        exercise.rest_seconds > 0
      ) {
        // Last skipped set has rest - enter rest state

        // Reset timer initialization refs to ensure rest timer initializes
        hasInitializedTimerRef.current = false;
        prevIsRestingRef.current = false;
        prevFlowIndexRef.current = currentFlowIndex;

        // Set flow index to last skipped set (so rest uses correct exercise)
        const lastSetIndex = nextIndex - 1;
        setCurrentFlowIndex(lastSetIndex);

        // Clear timer refs for clean transition
        currentTimerRef.current = 0;
        currentTimerValueRef.current = 0;
        expectedTimerValueRef.current = 0;
        setTimer(0);

        // Enter rest state - timer effect will detect and set rest timer
        setIsResting(true);
      } else if (nextIndex >= workoutFlow.length) {
        // Skipped through final exercise - end session record
        await endWorkoutSessionRecord();
        resetWorkoutState();
        router.push(workoutDetailsPath);
        return;
      } else {
        // No rest needed - advance directly to next exercise
        setIsResting(false);

        // Reset timer initialization refs for next exercise
        hasInitializedTimerRef.current = false;
        prevFlowIndexRef.current = currentFlowIndex;
        setCurrentFlowIndex(Math.min(nextIndex, workoutFlow.length - 1));
      }
    } catch (e) {
      // Error handling
    } finally {
      setIsSkipping(false);
    }
  }, [
    isSkipping,
    isGoingNext,
    isGoingPrevious,
    isRestarting,
    workoutFlow,
    currentFlowIndex,
    activeSessionId,
    userProfile?.user_id,
    ensureExerciseExists,
    recordCompletedSet,
    resetWorkoutState,
    endWorkoutSessionRecord,
    router,
    workoutDetailsPath,
  ]);

  /**
   * Handles pause/resume toggle.
   */
  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  /**
   * Handles showing the exit confirmation modal.
   */
  const handleBackPress = useCallback(() => {
    setIsPaused(true); // Pause the timer
    setShowExitConfirmation(true);
  }, []);

  /**
   * Handles finishing the entire workout.
   */
  const handleFinish = useCallback(async () => {
    if (isGoingNext || showWorkoutCompleteSheet) {
      return;
    }

    setIsGoingNext(true);

    try {
      // Record the last set if not already recorded and not in rest period
      const currentItem = workoutFlow[currentFlowIndex];
      if (currentItem && !isResting) {
        // Ensure session exercise exists
        const sessionExerciseId = await ensureExerciseExists(
          currentItem.exercise,
          currentItem.exerciseOrder,
        );

        if (sessionExerciseId) {
          let actualDuration: number | undefined;
          if (
            currentItem.exercise.duration_seconds &&
            setStartTimeRef.current
          ) {
            const elapsed = Math.floor(
              (new Date().getTime() - setStartTimeRef.current.getTime()) / 1000,
            );
            actualDuration = elapsed;
          }

          const finalSetRecorded = await recordCompletedSet(
            currentItem.exercise,
            currentItem.setNumber,
            actualDuration,
            undefined,
            currentItem.side,
          );

          if (!finalSetRecorded) {
            // Failed to record final set, but continuing
          }
        }
      }

      openWorkoutCompleteSheet();
    } catch {
      showToast("error", "Unable to finish workout", "Please try again.");
    } finally {
      setIsGoingNext(false);
    }
  }, [
    isGoingNext,
    showWorkoutCompleteSheet,
    workoutFlow,
    currentFlowIndex,
    isResting,
    ensureExerciseExists,
    recordCompletedSet,
    openWorkoutCompleteSheet,
    showToast,
  ]);

  /**
   * END WORKOUT - Navigate away immediately; delete session in background.
   */
  const handleEndWorkout = useCallback(async () => {
    if (isQuitting || isRestarting) return;

    setIsQuitting(true);
    allowFullscreenExitRef.current = true;
    setIsFullscreenGuardActive(false);
    isFullscreenGuardActiveRef.current = false;

    try {
      const sessionId = activeSessionId;

      setShowExitConfirmation(false);
      setShowSessionRiskDialog(false);
      setSessionRiskReason(null);

      // If user quits while in fullscreen, exit fullscreen immediately.
      await exitSessionFullscreen();
      stopBackgroundMusic(true);

      // Ensure unfinished session is deleted before leaving.
      await deleteUnfinishedSession(sessionId);

      resetWorkoutState();
      setIsQuitting(false);
      router.push(workoutDetailsPath);
    } catch (error) {
      resetWorkoutState();
      setIsQuitting(false);
      router.push(workoutDetailsPath);
    }
  }, [
    isQuitting,
    isRestarting,
    activeSessionId,
    workoutDetailsPath,
    resetWorkoutState,
    router,
    deleteUnfinishedSession,
    exitSessionFullscreen,
    stopBackgroundMusic,
  ]);

  const handleProceedSessionRisk = useCallback(async () => {
    allowFullscreenExitRef.current = true;
    await handleEndWorkout();
  }, [handleEndWorkout]);

  // ===========================
  // Data Fetching
  // ===========================

  const showStartCountdown = useCallback(async (): Promise<void> => {
    const HOLD_ON_THREE_MS = 2000;
    const SHOW_TWO_AFTER_COUNTDOWN_START_MS = HOLD_ON_THREE_MS;
    const SHOW_ONE_AFTER_COUNTDOWN_START_MS = HOLD_ON_THREE_MS + 1000;
    const COMPLETE_COUNTDOWN_AFTER_MS = HOLD_ON_THREE_MS + 2000;
    const INTRO_CUE_BASE_MAX_WAIT_MS = 2600;

    // Prevent multiple countdowns from running simultaneously
    if (isCountdownRunningRef.current) {
      return;
    }

    isCountdownRunningRef.current = true;

    // Clear any existing countdown interval to prevent glitches
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    stopCountdownSpeech();
    // Ensure voices are loaded before selecting gender-specific voice.
    await ensureSpeechVoicesLoaded();

    // Show 3-second countdown
    return new Promise<void>((resolve, reject) => {
      (async () => {
        const uiTickTimers: number[] = [];
        let hasSyncedCountdownUi = false;
        let hasPlayedReadyCue = false;
        let countdownUiSyncPromise: Promise<void> | null = null;
        try {
          setIsStartingWorkout(true);
          // Keep countdown UI at "3" while "Ready" audio is playing.
          setStartCountdown(3);

          // Wait a frame so "Ready" is visible before requesting fullscreen.
          await new Promise<void>((resolveFrame) =>
            window.requestAnimationFrame(() => resolveFrame()),
          );

          const isFullscreenAvailable =
            await ensureFullscreenBeforeWorkoutStart();
          if (!isFullscreenAvailable && shouldEnforceFullscreenRef.current) {
            setIsStartingWorkout(false);
            setStartCountdown(0);
            isCountdownRunningRef.current = false;
            throw new Error("Fullscreen permission was not granted.");
          }

          const startSyncedCountdownUi = (_playbackInfo?: {
            durationMs: number | null;
          }) => {
            if (hasSyncedCountdownUi) return;
            hasSyncedCountdownUi = true;
            setStartCountdown(3);
            countdownUiSyncPromise = new Promise<void>((resolveCountdownUi) => {
              uiTickTimers.push(
                window.setTimeout(() => {
                  if (isCountdownRunningRef.current) {
                    setStartCountdown(2);
                  }
                }, SHOW_TWO_AFTER_COUNTDOWN_START_MS),
              );
              uiTickTimers.push(
                window.setTimeout(() => {
                  if (isCountdownRunningRef.current) {
                    setStartCountdown(1);
                  }
                }, SHOW_ONE_AFTER_COUNTDOWN_START_MS),
              );
              uiTickTimers.push(
                window.setTimeout(() => {
                  resolveCountdownUi();
                }, COMPLETE_COUNTDOWN_AFTER_MS),
              );
            });
          };

          if (!hasPlayedReadyCue) {
            hasPlayedReadyCue = true;
            await playPreRecordedCueAndWait("ready", {
              interrupt: true,
              onPlaybackStart: startSyncedCountdownUi,
            });
          }

          if (!hasSyncedCountdownUi) {
            startSyncedCountdownUi({ durationMs: null });
          }

          if (countdownUiSyncPromise) {
            await countdownUiSyncPromise;
          }

          if (!isCountdownRunningRef.current) {
            setIsStartingWorkout(false);
            setStartCountdown(0);
            uiTickTimers.forEach((timerId) => window.clearTimeout(timerId));
            resolve();
            return;
          }

          uiTickTimers.forEach((timerId) => window.clearTimeout(timerId));

          if (!isCountdownRunningRef.current) {
            setIsStartingWorkout(false);
            setStartCountdown(0);
            uiTickTimers.forEach((timerId) => window.clearTimeout(timerId));
            resolve();
            return;
          }

          const flow = workoutFlowRef.current;

          // Show the first exercise only after pre-recorded countdown finishes.
          if (flow.length > 0) {
            setWorkoutFlow(flow);
            setCurrentFlowIndex(0);
          }

          setIsStartingWorkout(false);
          setStartCountdown(0);
          isCountdownRunningRef.current = false;

          // CRITICAL: Immediately initialize timer for first exercise after intro voice
          // This ensures the timer displays the correct duration instead of 00:00
          // Use refs to get current values without dependencies

          const firstExerciseName =
            flow[0]?.exercise?.details?.name?.trim() || "this exercise";
          const introCueText = `Let's warm up with ${firstExerciseName}!`;
          isIntroVoicePlayingRef.current = true;
          try {
            await speakCountdownCueAndWait(introCueText, {
              interrupt: true,
              rate: 1,
              maxWaitMs: Math.max(
                INTRO_CUE_BASE_MAX_WAIT_MS,
                introCueText.length * 75,
              ),
            });
          } finally {
            isIntroVoicePlayingRef.current = false;
          }

          await playRandomBackgroundMusic();

          if (flow.length > 0) {
            const firstItem = flow[0];
            // Initialize first exercise timer when it has a duration.
            if (
              firstItem &&
              firstItem.exercise.duration_seconds &&
              firstItem.exercise.duration_seconds > 0
            ) {
              const durationSeconds = firstItem.exercise.duration_seconds;
              // CRITICAL: Update refs FIRST, then state, then trigger restart
              // This ensures the countdown effect sees the correct value
              currentTimerRef.current = durationSeconds;
              currentTimerValueRef.current = durationSeconds;
              expectedTimerValueRef.current = durationSeconds;
              hasTimerTickedRef.current = false;
              lastTimerSetRef.current = Date.now();
              shouldAutoAdvanceRef.current = true;
              setStartTimeRef.current = new Date();
              hasInitializedTimerRef.current = true;
              prevFlowIndexRef.current = 0;
              prevIsRestingRef.current = false;

              // Set timer state and trigger restart immediately
              // The countdown effect will use currentTimerRef.current if timer state hasn't updated yet
              setTimer(durationSeconds);
              setTimerRestartKey((prev) => prev + 1);
            }
          }

          resolve();
        } catch (error) {
          uiTickTimers.forEach((timerId) => window.clearTimeout(timerId));
          // Reset countdown ref on error
          isCountdownRunningRef.current = false;
          setIsStartingWorkout(false);
          setStartCountdown(0);
          isIntroVoicePlayingRef.current = false;
          setIsFullscreenGuardActive(false);
          isFullscreenGuardActiveRef.current = false;
          allowFullscreenExitRef.current = false;
          stopCountdownSpeech();
          reject(error);
        }
      })();
    });
  }, [
    ensureFullscreenBeforeWorkoutStart,
    ensureSpeechVoicesLoaded,
    playRandomBackgroundMusic,
    playPreRecordedCueAndWait,
    speakCountdownCueAndWait,
    stopCountdownSpeech,
  ]);

  /**
   * RESTART THIS EXERCISE / WORKOUT
   */
  const handleRestartWorkout = useCallback(async () => {
    if (
      isRestarting ||
      isSkipping ||
      isGoingNext ||
      isGoingPrevious ||
      isRestartingFromReloadRef.current
    )
      return;

    try {
      setIsRestarting(true);
      setShowExitConfirmation(false);

      if (!userProfile?.user_id || !planId) {
        setIsRestarting(false);
        return;
      }

      const oldSessionId = activeSessionId;

      // Clear local state immediately
      setActiveSessionId(null);
      exercisesAddedRef.current.clear();
      safetyCueTargetSetByExerciseRef.current.clear();
      playedSafetyCueExerciseKeysRef.current.clear();
      setSessionExercises(new Map());
      setSessionSets(new Map());
      sessionInitializedRef.current = false;

      // Reset flow/timers
      totalWorkoutTimeRef.current = 0;
      totalRestTimeRef.current = 0;
      exerciseStartTimeRef.current = null;
      setStartTimeRef.current = null;
      restStartTimeRef.current = null;
      shouldAutoAdvanceRef.current = false;

      setIsResting(false);
      setIsPaused(false);
      setCurrentFlowIndex(0);

      // OPTIMIZATION: Create session FIRST, then show countdown
      // During countdown, save first exercise to database (non-blocking background operation)
      // After countdown, re-initialize the workout
      const newSessionId = await startWorkoutSession();

      if (!newSessionId) {
        setIsRestarting(false);
        return;
      }

      // Wait a brief moment to ensure activeSessionId state is updated
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Start saving first exercise during countdown (non-blocking background operation)
      // Pass sessionId directly to avoid state update timing issues
      if (workoutFlow.length > 0) {
        const firstItem = workoutFlow[0];
        if (firstItem && firstItem.exercise) {
          // Fire and forget - save in background during countdown
          addExerciseToSession(
            firstItem.exercise,
            firstItem.exerciseOrder,
            newSessionId,
          )
            .then(() => {
              // Exercise saved in background
            })
            .catch(() => {
              // Continue anyway - exercise will be created on demand
            });
        }
      }

      // Show countdown - this is the FIRST display (workout will re-initialize after countdown completes)
      await showStartCountdown();

      // AFTER countdown: Re-initialize the workout flow
      setCurrentFlowIndex(0);
      prevFlowIndexRef.current = -1;
      hasInitializedTimerRef.current = false;
      isUpdatingTimerRef.current = false;

      // Reset restart flag after countdown
      setIsRestarting(false);

      // Wait a brief moment to ensure state is updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Delete old session in background (non-blocking)
      if (oldSessionId) {
        deleteSession(oldSessionId).catch(() => {
          // Background cleanup failed - not critical
        });
      }
    } catch (error) {
      setIsRestarting(false);
    }
  }, [
    isRestarting,
    isSkipping,
    isGoingNext,
    isGoingPrevious,
    userProfile?.user_id,
    planId,
    activeSessionId,
    workoutFlow,
    startWorkoutSession,
    deleteSession,
    addExerciseToSession,
    // showStartCountdown is a stable callback (empty deps), safe to omit
  ]);

  const fetchWorkoutData = useCallback(async () => {
    // Prevent multiple calls if countdown is already running
    if (
      isCountdownRunningRef.current ||
      isStartingWorkout ||
      isFetchingWorkoutDataRef.current
    ) {
      return;
    }

    isFetchingWorkoutDataRef.current = true;

    try {
      setIsLoading(true);

      // Validate required data before proceeding
      if (!userProfile?.user_id || !planId) {
        setIsLoading(false);
        return;
      }

      // Resolve gender from session/local storage first, then context.
      const storedGender = readGenderFromStorage();
      if (storedGender) {
        setUserGender(storedGender);
      } else if (userProfile?.gender) {
        setUserGender(normalizeStoredGender(userProfile.gender));
      }

      const resolveSessionPlanContext = async (): Promise<{
        dayPlanId: string | null;
        weeklyPlanId: string | null;
      }> => {
        if (dayPlanId) {
          const { data: directDayPlan, error: directDayPlanError } =
            await supabase
              .from("user_workout_weekly_day_plan")
              .select("id, week_plan_id")
              .eq("id", dayPlanId)
              .maybeSingle();

          if (
            !directDayPlanError &&
            directDayPlan?.id &&
            directDayPlan.week_plan_id
          ) {
            return {
              dayPlanId: directDayPlan.id,
              weeklyPlanId: directDayPlan.week_plan_id,
            };
          }
        }

        const parsedWeek = weekParam ? Number(weekParam) : null;

        let weekPlanQuery = supabase
          .from("user_workout_weekly_plan")
          .select("id, week_number")
          .eq("plan_id", planId);

        if (parsedWeek && Number.isFinite(parsedWeek)) {
          weekPlanQuery = weekPlanQuery.eq("week_number", parsedWeek);
        }

        const { data: weekPlans, error: weekError } = await weekPlanQuery
          .order("week_number", { ascending: true })
          .limit(1);

        if (weekError || !weekPlans || weekPlans.length === 0) {
          return { dayPlanId: null, weeklyPlanId: null };
        }

        const resolvedWeekPlanIdValue = weekPlans[0].id;

        let dayPlanQuery = supabase
          .from("user_workout_weekly_day_plan")
          .select("id, day")
          .eq("week_plan_id", weekPlans[0].id);

        if (dayParam) {
          dayPlanQuery = dayPlanQuery.ilike("day", dayParam);
        }

        const { data: dayPlans, error: dayError } = await dayPlanQuery
          .order("created_at", { ascending: true })
          .limit(1);

        if (dayError || !dayPlans || dayPlans.length === 0) {
          return { dayPlanId: null, weeklyPlanId: resolvedWeekPlanIdValue };
        }

        return {
          dayPlanId: dayPlans[0].id,
          weeklyPlanId: resolvedWeekPlanIdValue,
        };
      };

      const {
        dayPlanId: resolvedDayPlanIdValue,
        weeklyPlanId: resolvedWeeklyPlanIdValue,
      } = await resolveSessionPlanContext();
      if (!resolvedDayPlanIdValue) {
        setIsLoading(false);
        return;
      }
      resolvedDayPlanIdRef.current = resolvedDayPlanIdValue;
      setResolvedDayPlanId(resolvedDayPlanIdValue);
      resolvedWeeklyPlanIdRef.current = resolvedWeeklyPlanIdValue;
      setResolvedWeeklyPlanId(resolvedWeeklyPlanIdValue);

      // Fetch plan and exercises in parallel
      const [planDataResult, exercisesResult] = await Promise.all([
        supabase
          .from("user_workout_plans")
          .select("id, name")
          .eq("id", planId)
          .maybeSingle(),
        supabase
          .from("user_workout_plan_exercises")
          .select(
            `
          id,
          exercise_id,
          position,
          section,
          image_path,
          sets,
          reps,
          duration_seconds,
          rest_seconds,
          per_side,
          exercise_details:user_exercises_details (
            id,
            name,
            image_slug,
            safety_cue
          )
        `,
          )
          .eq("weekly_plan_id", resolvedDayPlanIdValue)
          .order("position", { ascending: true }),
      ]);

      // Validate plan data
      if (planDataResult?.data) {
        setWorkoutPlan(planDataResult.data);
      } else {
        setIsLoading(false);
        return;
      }

      const exercisesData = exercisesResult?.data as
        | Array<{
            id: string;
            exercise_id: string;
            position: number;
            section: string;
            image_path: string | null;
            sets: number | null;
            reps: number | null;
            duration_seconds: number | null;
            rest_seconds: number | null;
            per_side: boolean | null;
            exercise_details?: {
              id: string;
              name: string;
              image_slug: string | null;
              safety_cue: string | null;
            } | null;
          }>
        | null
        | undefined;

      if (exercisesData && exercisesData.length > 0) {
        const formattedExercises: Exercise[] = exercisesData.map((ex) => ({
          plan_step_id: ex.id,
          exercise_id: ex.exercise_id,
          position: ex.position,
          section: ex.section,
          image_path: ex.image_path ?? null,
          sets: ex.sets,
          reps: ex.reps,
          duration_seconds: ex.duration_seconds,
          rest_seconds: ex.rest_seconds ?? 0,
          safety_tip: ex.exercise_details?.safety_cue ?? null,
          per_side: ex.per_side ?? false,
          details: ex.exercise_details || null,
        }));

        // Create workout flow locally
        const flow = createWorkoutFlow(formattedExercises);
        // Set ref immediately so showStartCountdown can access it for timer initialization
        workoutFlowRef.current = flow;
        preloadFlowImages(flow);

        // OPTIMIZATION: Create session FIRST, then show countdown
        // During countdown, save first exercise to database (non-blocking background operation)
        // After countdown, load the workout flow and set isLoading to false
        const newSessionId = await startWorkoutSession(
          resolvedDayPlanIdValue,
          resolvedWeeklyPlanIdValue,
        );
        if (!newSessionId) {
          setIsLoading(false);
          return;
        }

        // Wait a brief moment to ensure activeSessionId state is updated
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Start saving first exercise during countdown (non-blocking background operation)
        // Pass sessionId directly to avoid state update timing issues
        if (flow.length > 0) {
          const firstItem = flow[0];
          if (firstItem && firstItem.exercise) {
            // Fire and forget - save in background during countdown
            addExerciseToSession(
              firstItem.exercise,
              firstItem.exerciseOrder,
              newSessionId,
            ).catch(() => {
              // Continue anyway - exercise will be created on demand
            });
          }
        }

        // Show countdown - this is the FIRST display (workout will load after countdown completes)
        await showStartCountdown();

        // AFTER countdown: Batch all state updates together to prevent double render
        // Small delay to ensure countdown state is fully cleared before showing exercise
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Batch all state updates in a single render cycle
        // React 18 automatically batches these, but we ensure they happen together
        setExercises(formattedExercises);
        setWorkoutFlow(flow);
        // Reset flow index when flow is loaded
        setCurrentFlowIndex(0);
        prevFlowIndexRef.current = -1;
        hasInitializedTimerRef.current = false;
        isUpdatingTimerRef.current = false;

        // Now set loading to false so workout can display
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error: unknown) {
      const fullscreenPermissionDenied =
        error instanceof Error &&
        error.message === "Fullscreen permission was not granted.";
      setIsLoading(false);
      if (fullscreenPermissionDenied && shouldEnforceFullscreenRef.current) {
        showToast(
          "error",
          "Fullscreen required",
          "Could not enter fullscreen automatically. Please tap Start Workout again.",
        );
        router.push(workoutDetailsPath);
      }
    } finally {
      isFetchingWorkoutDataRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    planId,
    dayPlanId,
    weekParam,
    dayParam,
    userProfile?.user_id,
    userProfile?.gender,
    readGenderFromStorage,
    normalizeStoredGender,
    preloadFlowImages,
    showToast,
    router,
    workoutDetailsPath,
  ]);

  // ===========================
  // Restart Handler for Reload
  // ===========================

  const handleRestartFromReload = useCallback(async () => {
    if (!oldSessionId || !userProfile?.user_id || !planId) return;
    if (isRestartingFromReloadRef.current) return; // Prevent multiple calls

    try {
      isRestartingFromReloadRef.current = true;
      setIsRestartingFromReload(true);
      setShowRestartDialog(false);

      // Clear old session ID
      setOldSessionId(null);

      // Mark as checked to prevent the check active session effect from running again
      hasCheckedActiveSessionRef.current = true;

      // Delete old session in background (non-blocking) - startWorkoutSession will also clean up
      // but we delete the specific one here to ensure it's gone
      deleteSession(oldSessionId).catch(() => {
        // Background cleanup failed - not critical, startWorkoutSession will handle it
      });

      // Now fetch workout data to start the workout (this will create a new session)
      // startWorkoutSession will handle deleting all active sessions in the background
      await fetchWorkoutData();

      // Reset restart state after successful fetch
      setIsRestartingFromReload(false);
      isRestartingFromReloadRef.current = false;
    } catch (error) {
      // On error, show dialog again and reset state
      setShowRestartDialog(true);
      setIsRestartingFromReload(false);
      isRestartingFromReloadRef.current = false;
      hasCheckedActiveSessionRef.current = false; // Allow retry
    }
  }, [
    oldSessionId,
    userProfile?.user_id,
    planId,
    deleteSession,
    fetchWorkoutData,
  ]);

  // ===========================
  // Effects
  // ===========================

  useEffect(() => {
    isSessionRiskDialogOpenRef.current = showSessionRiskDialog;
  }, [showSessionRiskDialog]);

  useEffect(() => {
    shouldEnforceFullscreenRef.current = shouldEnforceFullscreen;
  }, [shouldEnforceFullscreen]);

  useEffect(() => {
    isFullscreenGuardActiveRef.current = isFullscreenGuardActive;
  }, [isFullscreenGuardActive]);

  useEffect(() => {
    resolvedDayPlanIdRef.current = resolvedDayPlanId;
  }, [resolvedDayPlanId]);

  useEffect(() => {
    resolvedWeeklyPlanIdRef.current = resolvedWeeklyPlanId;
  }, [resolvedWeeklyPlanId]);

  useEffect(() => {
    if (!shouldEnforceFullscreen || !isFullscreenGuardActive) return;

    const openSessionRiskDialog = (reason: "fullscreen" | "tab") => {
      if (
        !isFullscreenGuardActiveRef.current ||
        allowFullscreenExitRef.current
      ) {
        return;
      }
      if (!activeSessionId) return;
      if (isSessionRiskDialogOpenRef.current) {
        // If fullscreen closes after an earlier tab/blur signal, prefer fullscreen reason.
        if (reason === "fullscreen") {
          setSessionRiskReason("fullscreen");
        }
        return;
      }
      setIsPaused(true);
      setSessionRiskReason(reason);
      setShowSessionRiskDialog(true);
    };

    const handleFullscreenChange = () => {
      if (hasActiveFullscreen()) return;
      openSessionRiskDialog("fullscreen");
      void requestSessionFullscreen();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        openSessionRiskDialog("tab");
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && hasActiveFullscreen()) {
        event.preventDefault();
        event.stopPropagation();
        openSessionRiskDialog("fullscreen");
      }
    };

    const handleWindowBlur = () => {
      if (!document.hidden) {
        openSessionRiskDialog("tab");
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!document.hidden) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    shouldEnforceFullscreen,
    isFullscreenGuardActive,
    activeSessionId,
    hasActiveFullscreen,
    requestSessionFullscreen,
  ]);

  // Check for active session on reload (only once per planId/userProfile combination)
  useEffect(() => {
    const checkActiveSession = async () => {
      // Prevent multiple checks
      if (
        !planId ||
        !userProfile?.user_id ||
        hasCheckedActiveSessionRef.current
      ) {
        return;
      }

      // Skip if already restarting or if dialog is already shown
      if (isRestartingFromReloadRef.current || showRestartDialog) {
        return;
      }

      hasCheckedActiveSessionRef.current = true;

      try {
        // Check if there's an active session (ended_at is null) for this user and plan
        const { data: activeSessions, error } = await supabase
          .from("user_workout_sessions")
          .select("id, started_at")
          .eq("user_id", userProfile.user_id)
          .eq("plan_id", planId)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1);

        if (!error && activeSessions && activeSessions.length > 0) {
          // Found unfinished session(s): auto-start fresh flow (cleanup + create in startWorkoutSession).
          setOldSessionId(null);
          setShowRestartDialog(false);
          hasCheckedActiveSessionRef.current = false; // Reset to allow normal init path
          if (!isRestartingFromReloadRef.current) {
            fetchWorkoutData();
          }
        } else {
          // No active session - start workout flow immediately.
          hasCheckedActiveSessionRef.current = false; // Reset to allow check on next mount
          if (!isRestartingFromReloadRef.current) {
            fetchWorkoutData();
          }
        }
      } catch (error) {
        // On error, proceed with normal flow.
        hasCheckedActiveSessionRef.current = false; // Reset to allow retry
        if (!isRestartingFromReloadRef.current) {
          fetchWorkoutData();
        }
      }
    };

    checkActiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    planId,
    dayPlanId,
    weekParam,
    dayParam,
    userProfile?.user_id,
    showRestartDialog,
  ]);

  // Reset state when workout scope changes
  useEffect(() => {
    if (planId) {
      // Reset all state flags
      setIsQuitting(false);
      setIsRestarting(false);
      setIsSkipping(false);
      setIsGoingNext(false);
      setIsGoingPrevious(false);
      setIsStartingWorkout(false);
      isIntroVoicePlayingRef.current = false;
      setStartCountdown(0); // Reset countdown to 0
      setIsFullscreenGuardActive(false);
      isFullscreenGuardActiveRef.current = false;
      allowFullscreenExitRef.current = false;
      setIsPaused(false);
      setIsResting(false);
      setShowExitConfirmation(false);
      setShowSessionRiskDialog(false);
      setSessionRiskReason(null);
      setIsLoading(true);
      setIsRestartingFromReload(false);
      setShowRestartDialog(false);
      setOldSessionId(null);
      resolvedDayPlanIdRef.current = dayPlanId;
      setResolvedDayPlanId(dayPlanId);
      resolvedWeeklyPlanIdRef.current = null;
      setResolvedWeeklyPlanId(null);
      setShowWorkoutCompleteSheet(false);
      setWorkoutRpe(5);
      setIsSavingWorkoutRpe(false);

      // Clear session state
      setActiveSessionId(null);
      exercisesAddedRef.current.clear();
      safetyCueTargetSetByExerciseRef.current.clear();
      playedSafetyCueExerciseKeysRef.current.clear();
      setSessionExercises(new Map());
      setSessionSets(new Map());
      sessionInitializedRef.current = false;

      // Reset refs
      exerciseStartTimeRef.current = null;
      setStartTimeRef.current = null;
      restStartTimeRef.current = null;
      sessionStartTimeRef.current = null;
      totalWorkoutTimeRef.current = 0;
      totalRestTimeRef.current = 0;
      shouldAutoAdvanceRef.current = false;
      hasCheckedActiveSessionRef.current = false;
      isRestartingFromReloadRef.current = false;
      isCountdownRunningRef.current = false;
      isFetchingWorkoutDataRef.current = false;

      // Clear any existing countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      stopCountdownSpeech();
      stopBackgroundMusic(true);

      // Reset flow
      setCurrentFlowIndex(0);
      setTimer(0);
      hasInitializedTimerRef.current = false;
      prevFlowIndexRef.current = -1;
      prevIsRestingRef.current = false;
      prevIsStartingWorkoutRef.current = false;
      expectedTimerValueRef.current = 0;
      currentTimerValueRef.current = 0;
      lastTimerSetRef.current = 0;
    }
  }, [
    planId,
    dayPlanId,
    weekParam,
    dayParam,
    stopCountdownSpeech,
    stopBackgroundMusic,
  ]);

  useEffect(() => {
    const audio = backgroundMusicAudioRef.current;
    if (!audio) return;

    if (isPaused || isStartingWorkout || showWorkoutCompleteSheet) {
      audio.pause();
      return;
    }

    const resumePromise = audio.play();
    if (resumePromise) {
      void resumePromise.catch(() => {
        // Ignore resume errors caused by browser autoplay policy.
      });
    }
  }, [isPaused, isStartingWorkout, showWorkoutCompleteSheet]);

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      stopCountdownSpeech();
      stopBackgroundMusic(true);
    };
  }, [stopCountdownSpeech, stopBackgroundMusic]);

  // Main initialization effect (only if restart dialog is not shown and not restarting from reload)
  useEffect(() => {
    if (
      planId &&
      userProfile?.user_id &&
      !showRestartDialog &&
      !isRestartingFromReload &&
      !isRestartingFromReloadRef.current &&
      hasCheckedActiveSessionRef.current &&
      workoutFlow.length === 0 &&
      !activeSessionId
    ) {
      // Only fetch if:
      // 1. We've checked for active sessions
      // 2. No workout flow is loaded yet
      // 3. No active session exists
      // This prevents double fetching when restarting from reload
      fetchWorkoutData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    planId,
    dayPlanId,
    weekParam,
    dayParam,
    userProfile?.user_id,
    showRestartDialog,
    isRestartingFromReload,
    workoutFlow.length,
    activeSessionId,
  ]);

  // When the flow item changes, ensure the exercise is created first
  useEffect(() => {
    const currentItem = workoutFlow[currentFlowIndex];
    if (!currentItem || !activeSessionId || !userProfile?.user_id) return;

    if (isClearingSessionRef.current) return;
    if (isRestarting) return; // Don't create exercises during restart

    const { exercise, exerciseOrder, setNumber } = currentItem;
    const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;

    // Ensure exercise is created for set 1 (first set of each exercise)
    if (setNumber === 1 && !exercisesAddedRef.current.has(exerciseKey)) {
      ensureExerciseExists(exercise, exerciseOrder).catch(() => {
        // Exercise creation failed, will retry on demand
      });
    }

    if (!isResting) {
      setStartTimeRef.current = new Date();
    }
  }, [
    currentFlowIndex,
    activeSessionId,
    userProfile?.user_id,
    workoutFlow,
    isResting,
    isRestarting,
    ensureExerciseExists,
  ]);

  const hasSessionStarted =
    isStartingWorkout || Boolean(activeSessionId) || workoutFlow.length > 0;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const bottomNav = document.querySelector<HTMLElement>(".main-bottom-nav");
    if (!bottomNav) return;

    const previousDisplay = bottomNav.style.display;
    bottomNav.style.display = hasSessionStarted
      ? "none"
      : previousDisplay || "";

    return () => {
      bottomNav.style.display = previousDisplay;
    };
  }, [hasSessionStarted]);

  // ===========================
  // UI Rendering
  // ===========================

  if (!planId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-300">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!userProfile?.user_id) {
    if (userLoadingState.isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
          <div className="text-center">
            <p className="text-slate-600 dark:text-slate-300">
              Loading workout...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
        <div className="text-center px-6">
          <p className="text-red-600 dark:text-red-300 font-semibold mb-2">
            Unable to load your profile.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            {userLoadingState.error
              ? "Please retry or go back to workout details."
              : "Please retry loading your data or go back."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void refreshUserData()}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push(workoutDetailsPath)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading screen only if not starting workout (countdown screen will show instead)
  if (
    isLoading &&
    workoutFlow.length === 0 &&
    !isStartingWorkout &&
    !showRestartDialog
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-300">
            Loading workout...
          </p>
        </div>
      </div>
    );
  }

  if (isQuitting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-300 font-semibold">
            Ending workout...
          </p>
        </div>
      </div>
    );
  }

  // Show restart dialog if there's an active session from reload
  if (showRestartDialog) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl dark:shadow-black/50 p-8 max-w-md w-full mx-4 border border-slate-200/80 dark:border-slate-700/80">
          <div className="text-center mb-6">
            <div className="mb-4">
              <HiArrowPath className="w-16 h-16 mx-auto text-teal-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Resume Workout?
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              You have an active workout session. Would you like to restart it?
            </p>
            {isRestartingFromReload && (
              <div className="flex items-center justify-center gap-2 text-teal-600">
                <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">
                  Restarting workout...
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                if (isRestartingFromReload) return; // Disable during restart
                setShowRestartDialog(false);
                hasCheckedActiveSessionRef.current = false;
                await deleteUnfinishedSession(oldSessionId);
                resetWorkoutState();
                router.push(workoutDetailsPath);
              }}
              disabled={isRestartingFromReload}
              className="flex-1 px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleRestartFromReload}
              disabled={isRestartingFromReload}
              className="flex-1 px-4 py-3 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestartingFromReload ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Restarting...</span>
                </>
              ) : (
                <>
                  <HiArrowPath className="w-5 h-5" />
                  Restart This Workout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only access workout flow if it's loaded (after countdown)
  // During countdown, workoutFlow.length will be 0, so we'll only show countdown screen
  const currentItem =
    workoutFlow.length > 0 ? workoutFlow[currentFlowIndex] : null;
  const currentExercise = currentItem?.exercise;
  const currentSet = currentItem?.setNumber || 1;
  const totalSets = currentItem?.totalSets || 1;
  const currentSide = currentItem?.side || "both";
  const progress =
    workoutFlow.length > 0
      ? ((currentFlowIndex + 1) / workoutFlow.length) * 100
      : 0;

  // Normalize duration_seconds: treat null/undefined as 0
  const normalizedDurationSeconds = currentExercise?.duration_seconds ?? 0;
  const currentExerciseImageUrl = currentExercise
    ? getExerciseResolvedImageUrl(currentExercise)
    : "";
  const workoutChallengeScale = [
    { value: 1, label: "Very Light", emoji: "\u{1F60C}" },
    { value: 3, label: "Light", emoji: "\u{1F642}" },
    { value: 5, label: "Moderate", emoji: "\u{1F610}" },
    { value: 7, label: "Hard", emoji: "\u{1F624}" },
    { value: 10, label: "Very Hard", emoji: "\u{1F975}" },
  ] as const;
  const lastWorkoutChallengeIndex = workoutChallengeScale.length - 1;
  const workoutChallengeBandIndex = Math.max(
    0,
    workoutChallengeScale.findIndex((item) => item.value >= workoutRpe),
  );

  return (
    <div
      className={`min-h-screen bg-slate-50 dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] text-slate-900 dark:text-slate-100 ${
        hasSessionStarted ? "pb-[120px]" : "pb-[140px]"
      }`}
    >
      {/* Starting Workout Countdown Screen */}
      {isStartingWorkout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-teal-700 via-teal-500 to-teal-600">
          <div className="text-center">
            <div className="mb-8">
              <HiBolt className="w-20 h-20 mx-auto text-white" />
            </div>
            <h2 className="text-4xl font-black text-white mb-8 uppercase tracking-wide">
              Starting Workout
            </h2>
            <div className="w-48 h-48 mx-auto mb-8 rounded-full bg-white/25 border-4 border-white flex items-center justify-center">
              <span className="text-9xl font-black text-white">
                {startCountdown}
              </span>
            </div>
            <p className="text-xl font-semibold text-white/90">
              {startCountdown >= 3 ? "Ready" : "Get ready to move!"}
            </p>
          </div>
        </div>
      )}

      {/* Don't render exercise content during countdown */}
      {!isStartingWorkout && workoutFlow.length > 0 && (
        <>
          <div className="pointer-events-none fixed right-5 top-24 z-50">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/60">
              <HiMusicalNote className="h-6 w-6 text-slate-700" />
            </div>
          </div>

          {/* Header with Progress */}
          <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={handleBackPress}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  aria-label="Exit workout"
                >
                  <HiXMark className="w-6 h-6 text-teal-700" />
                </button>
                <div className="flex-1 text-center px-4">
                  <h1 className="text-lg font-bold text-teal-700">
                    {workoutPlan?.name || "Workout"}
                  </h1>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Set {currentFlowIndex + 1}/{workoutFlow.length} •{" "}
                    {getSectionLabel(currentExercise?.section || "")}
                  </p>
                </div>
                <div className="w-10" /> {/* Spacer for centering */}
              </div>
              {/* Progress Bar */}
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-600 to-teal-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            {/* Rest or Exercise State */}
            {isResting ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-teal-700 mb-2">
                    Rest Time
                  </h2>
                  {currentFlowIndex < workoutFlow.length - 1 && (
                    <p className="text-slate-600 dark:text-slate-300">
                      Next:{" "}
                      {workoutFlow[currentFlowIndex + 1]?.exercise?.details
                        ?.name || "Exercise"}{" "}
                      - Set {workoutFlow[currentFlowIndex + 1]?.setNumber || 1}/
                      {workoutFlow[currentFlowIndex + 1]?.totalSets || 1}
                    </p>
                  )}
                </div>

                {/* Rest Timer Circle */}
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg
                    className="absolute inset-0 -rotate-90"
                    width="256"
                    height="256"
                  >
                    <circle
                      cx="128"
                      cy="128"
                      r="120"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    <circle
                      cx="128"
                      cy="128"
                      r="120"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 120}`}
                      strokeDashoffset={`${
                        currentExercise?.rest_seconds &&
                        currentExercise.rest_seconds > 0
                          ? 2 *
                            Math.PI *
                            120 *
                            (1 - timer / currentExercise.rest_seconds)
                          : 2 * Math.PI * 120
                      }`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="text-center z-10">
                    <p className="text-5xl font-black text-amber-500 mb-1">
                      {formatTime(timer)}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 font-semibold">
                      remaining
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleNext(false)}
                  disabled={isGoingNext || isSkipping || isGoingPrevious}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors"
                >
                  {isGoingNext ? "Processing..." : "Skip Rest"}
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Left Column: Exercise Info & Image */}
                <div className="space-y-4">
                  {/* Exercise Info Tags */}
                  <div className="flex flex-wrap gap-2">
                    {currentExercise?.per_side &&
                      currentSide !== "both" &&
                      getSideLabel(currentSide) !== "" && (
                        <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-semibold rounded-full flex items-center gap-1">
                          <HiArrowRight className="w-3 h-3" />
                          {getSideLabel(currentSide)}
                        </span>
                      )}
                    {totalSets > 1 && (
                      <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-semibold rounded-full flex items-center gap-1">
                        <HiBolt className="w-3 h-3" />
                        Set {currentSet} of {totalSets}
                      </span>
                    )}
                    {currentExercise?.reps && currentExercise.reps > 0 && (
                      <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-full">
                        {currentExercise.reps === 1 ? "Rep" : "Reps"}:{" "}
                        {currentExercise.reps}
                      </span>
                    )}
                    {currentExercise?.rest_seconds &&
                      currentExercise.rest_seconds > 0 && (
                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full flex items-center gap-1">
                          <HiClock className="w-3 h-3" />
                          Rest: {currentExercise.rest_seconds}s
                        </span>
                      )}
                  </div>

                  {/* Exercise Image */}
                  <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {currentExerciseImageUrl ? (
                      <Image
                        src={currentExerciseImageUrl}
                        alt={currentExercise?.details?.name || "Exercise"}
                        fill
                        className="object-cover"
                        loading="eager"
                        fetchPriority="high"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <HiBolt className="w-16 h-16 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}
                  </div>

                  {/* Skip Button for non-timer exercises */}
                  {normalizedDurationSeconds <= 0 && (
                    <button
                      onClick={handleSkip}
                      disabled={isSkipping}
                      className="w-full py-3 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl border-2 border-red-200 dark:border-red-900/50 transition-colors"
                    >
                      {isSkipping ? "Skipping..." : "Skip Exercise"}
                    </button>
                  )}
                </div>

                {/* Right Column: Timer for duration-based exercises */}
                {normalizedDurationSeconds > 0 && (
                  <div className="flex flex-col items-center justify-center min-h-[400px]">
                    {/* Timer Circle */}
                    <div className="relative w-64 h-64 flex items-center justify-center mb-6">
                      <svg
                        className="absolute inset-0 -rotate-90"
                        width="256"
                        height="256"
                      >
                        <circle
                          cx="128"
                          cy="128"
                          r="120"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-slate-200 dark:text-slate-700"
                        />
                        <circle
                          cx="128"
                          cy="128"
                          r="120"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="8"
                          strokeDasharray={`${2 * Math.PI * 120}`}
                          strokeDashoffset={`${
                            normalizedDurationSeconds > 0
                              ? 2 *
                                Math.PI *
                                120 *
                                (1 - timer / normalizedDurationSeconds)
                              : 2 * Math.PI * 120
                          }`}
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="text-center z-10">
                        <p className="text-6xl font-black text-amber-500 mb-2">
                          {formatTime(timer)}
                        </p>
                      </div>
                    </div>

                    {/* Skip Button */}
                    <button
                      onClick={handleSkip}
                      disabled={isSkipping}
                      className="px-6 py-2 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-lg transition-colors"
                    >
                      {isSkipping ? "Skipping..." : "Skip Exercise"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div
            className={`fixed left-0 right-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-black/40 backdrop-blur z-40 ${
              hasSessionStarted ? "bottom-0" : "bottom-[70px]"
            }`}
          >
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
              {/* Exercise Name */}
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-teal-700">
                  {currentExercise?.details?.name || "Exercise"}
                  {currentExercise?.per_side &&
                    currentSide !== "both" &&
                    getSideLabel(currentSide) !== "" && (
                      <span className="text-sm font-semibold text-teal-600 ml-2">
                        ({getSideLabel(currentSide)})
                      </span>
                    )}
                  {totalSets > 1 && (
                    <span className="text-base font-semibold text-slate-600 dark:text-slate-300 ml-2">
                      - Set {currentSet}/{totalSets}
                    </span>
                  )}
                </h3>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={handlePrevious}
                  disabled={currentFlowIndex === 0 || isGoingPrevious}
                  className="p-3 disabled:opacity-30 disabled:cursor-not-allowed text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors"
                  aria-label="Previous exercise"
                >
                  {isGoingPrevious ? (
                    <div className="w-6 h-6 border-2 border-teal-700 dark:border-teal-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HiArrowLeft className="w-7 h-7" />
                  )}
                </button>

                <button
                  onClick={handlePauseToggle}
                  className="p-4 bg-gradient-to-br from-teal-600 to-teal-500 dark:from-teal-500 dark:to-teal-400 hover:from-teal-700 hover:to-teal-600 dark:hover:from-teal-400 dark:hover:to-teal-300 text-white rounded-full shadow-lg hover:shadow-xl dark:shadow-black/40 transition-all"
                  aria-label={isPaused ? "Resume workout" : "Pause workout"}
                >
                  {isPaused ? (
                    <HiPlay className="w-8 h-8" />
                  ) : (
                    <HiPause className="w-8 h-8" />
                  )}
                </button>

                {currentFlowIndex === workoutFlow.length - 1 ? (
                  <button
                    onClick={handleFinish}
                    disabled={isGoingNext || isQuitting}
                    className="p-3 disabled:opacity-30 disabled:cursor-not-allowed text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors"
                    aria-label="Finish workout"
                  >
                    {isGoingNext || isQuitting ? (
                      <div className="w-6 h-6 border-2 border-teal-700 dark:border-teal-300 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <HiCheckCircle className="w-7 h-7" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleNext(false)}
                    disabled={isGoingNext}
                    className="p-3 disabled:opacity-30 disabled:cursor-not-allowed text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors"
                    aria-label={
                      isResting ? "Skip rest and continue" : "Next set"
                    }
                  >
                    {isGoingNext ? (
                      <div className="w-6 h-6 border-2 border-teal-700 dark:border-teal-300 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <HiArrowRight className="w-7 h-7" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {showWorkoutCompleteSheet && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
              <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-black/50">
                <div className="bg-gradient-to-r from-teal-600 to-cyan-500 p-6 text-white">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                    <HiCheckCircle className="h-7 w-7" />
                  </div>
                  <h3 className="text-center text-3xl font-black tracking-tight">
                    Workout Complete
                  </h3>
                  <p className="mt-2 text-center text-sm font-semibold text-white/90">
                    Session finished. Log your effort before closing.
                  </p>
                </div>

                <div className="space-y-6 p-6 sm:p-7">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        How challenging was this workout?
                      </p>
                    </div>

                    <div className="mt-1 px-4">
                      <input
                        type="range"
                        min={0}
                        max={lastWorkoutChallengeIndex}
                        step={1}
                        value={workoutChallengeBandIndex}
                        onChange={(event) => {
                          const index = Number(event.target.value);
                          const selected = workoutChallengeScale[index];
                          if (selected) {
                            setWorkoutRpe(selected.value);
                          }
                        }}
                        disabled={isSavingWorkoutRpe}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-teal-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:accent-teal-500"
                        aria-label="Workout challenge rating from 1 to 10"
                      />
                    </div>

                    <div className="mt-2 px-4">
                      <div className="relative h-11">
                        {workoutChallengeScale.map(
                          ({ label, emoji }, index) => (
                            <div
                              key={label}
                              style={{
                                left: `${(index / lastWorkoutChallengeIndex) * 100}%`,
                              }}
                              className={`absolute top-0 -translate-x-1/2 flex flex-col items-center justify-center text-center ${
                                workoutChallengeBandIndex === index
                                  ? "text-teal-700 dark:text-teal-300"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              <span className="mb-1 text-lg leading-none">
                                {emoji}
                              </span>
                              <span className="text-[10px] font-semibold leading-tight">
                                {label}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveWorkoutRpe}
                    disabled={isSavingWorkoutRpe}
                    className="w-full rounded-2xl bg-gradient-to-r from-teal-600 to-teal-500 py-3.5 font-bold text-white transition-colors hover:from-teal-700 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50 dark:from-teal-500 dark:to-teal-400 dark:hover:from-teal-400 dark:hover:to-teal-300"
                  >
                    {isSavingWorkoutRpe
                      ? "Saving..."
                      : "Save Rating and Finish"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Exit Confirmation Modal */}
          {showExitConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl dark:shadow-black/50 border border-slate-200/80 dark:border-slate-700/80">
                {/* Motivational Header */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-5xl">💪</span>
                    <HiBolt className="w-12 h-12 text-amber-500" />
                    <span className="text-5xl">💪</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">
                    Don&apos;t give up now.
                  </h3>
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">
                    You can do this!
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Only{" "}
                    <span className="font-black text-amber-500 text-xl">
                      {Math.max(
                        0,
                        workoutFlow.length -
                          (workoutFlow[currentFlowIndex]?.exerciseOrder || 0),
                      )}
                    </span>{" "}
                    exercises left
                  </p>
                </div>

                {/* Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowExitConfirmation(false);
                      setIsPaused(false);
                    }}
                    disabled={
                      isQuitting ||
                      isRestarting ||
                      isGoingNext ||
                      isSkipping ||
                      isGoingPrevious
                    }
                    className="w-full py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:via-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    <HiPlay className="w-5 h-5" />
                    Resume
                  </button>

                  <button
                    onClick={handleRestartWorkout}
                    disabled={
                      isQuitting ||
                      isRestarting ||
                      isGoingNext ||
                      isSkipping ||
                      isGoingPrevious
                    }
                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-teal-600 dark:text-teal-300 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    {isRestarting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-teal-600 dark:border-teal-300 border-t-transparent rounded-full animate-spin" />
                        Restarting workout, please wait...
                      </>
                    ) : (
                      <>
                        <HiArrowPath className="w-5 h-5" />
                        Restart this workout
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleEndWorkout}
                    disabled={
                      isQuitting ||
                      isRestarting ||
                      isGoingNext ||
                      isSkipping ||
                      isGoingPrevious
                    }
                    className="w-full py-3 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed font-bold rounded-xl transition-colors"
                  >
                    {isQuitting ? "Ending..." : "Quit"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSessionRiskDialog && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl dark:shadow-black/50 border border-slate-200/80 dark:border-slate-700/80">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">
                  This session might end...
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                  Keep this workout in fullscreen and stay on this tab to avoid
                  interruptions.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                  {sessionRiskReason === "tab"
                    ? "A tab switch was detected."
                    : "Fullscreen was closed."}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      void handleCancelSessionRisk();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProceedSessionRisk}
                    disabled={
                      isQuitting ||
                      isRestarting ||
                      isGoingNext ||
                      isSkipping ||
                      isGoingPrevious
                    }
                    className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
                  >
                    {isQuitting ? "Ending..." : "Proceed"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Toast Notifications */}
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
    </div>
  );
}
