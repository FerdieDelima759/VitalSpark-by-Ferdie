/**
 * Example Workout Screens
 * 
 * These are example components showing how to use the Workout Context and Hooks
 * Copy and adapt these patterns for your actual screens
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useWorkoutContext } from '../contexts/WorkoutContext';
import { useWorkoutData } from '../hooks/useWorkoutData';
import { WorkoutPlan, WorkoutPlanFull } from '../types/Workout';

// ===========================
// Example 1: Workout List Screen
// ===========================

export function WorkoutListScreen() {
  const { workoutPlans, loadingState } = useWorkoutContext();

  if (loadingState.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Loading workouts...</Text>
      </View>
    );
  }

  if (loadingState.error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {loadingState.error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout Plans</Text>
      <FlatList
        data={workoutPlans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <WorkoutCard plan={item} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// ===========================
// Example 2: Filtered Workout List (by Level)
// ===========================

export function BeginnerWorkoutsScreen() {
  const { filterPlansByLevel, loadingState } = useWorkoutContext();
  const beginnerPlans = filterPlansByLevel('beginner');

  if (loadingState.isLoading) {
    return <ActivityIndicator />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Beginner Workouts</Text>
      <FlatList
        data={beginnerPlans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <WorkoutCard plan={item} />}
      />
    </View>
  );
}

// ===========================
// Example 3: Workout Detail Screen
// ===========================

export function WorkoutDetailScreen({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<WorkoutPlanFull | null>(null);
  const { fetchWorkoutPlanFull, isLoading, error } = useWorkoutData();

  useEffect(() => {
    async function loadPlan() {
      const result = await fetchWorkoutPlanFull(planId);
      if (result.success && result.data) {
        setPlan(result.data);
      }
    }
    loadPlan();
  }, [planId]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (error || !plan) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error || 'Workout not found'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.planTitle}>{plan.name}</Text>
        <Text style={styles.planLevel}>{plan.level.toUpperCase()}</Text>
      </View>

      {/* Description */}
      {plan.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{plan.description}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        {plan.total_minutes && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{plan.total_minutes}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
        )}
        {plan.total_calories && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{plan.total_calories}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
        )}
        {plan.total_exercises && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{plan.total_exercises}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
        )}
      </View>

      {/* Tags */}
      {plan.tags && plan.tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsContainer}>
            {plan.tags.map((tag) => (
              <View key={tag.id} style={styles.tag}>
                <Text style={styles.tagText}>{tag.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Exercises */}
      {plan.exercises && plan.exercises.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          {plan.exercises.map((exercise, index) => (
            <View key={exercise.exercise_id} style={styles.exerciseCard}>
              <Text style={styles.exerciseNumber}>{index + 1}</Text>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>
                  {exercise.exercise_details?.name || 'Exercise'}
                </Text>
                {exercise.exercise_details?.primary_muscle && (
                  <Text style={styles.exerciseMuscle}>
                    {exercise.exercise_details.primary_muscle}
                  </Text>
                )}
                <View style={styles.exerciseDetails}>
                  {exercise.sets && (
                    <Text style={styles.exerciseDetail}>
                      {exercise.sets} sets
                    </Text>
                  )}
                  {exercise.reps && (
                    <Text style={styles.exerciseDetail}>
                      {exercise.reps} reps
                    </Text>
                  )}
                  {exercise.duration_seconds && (
                    <Text style={styles.exerciseDetail}>
                      {exercise.duration_seconds}s
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Start Button */}
      <TouchableOpacity style={styles.startButton}>
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ===========================
// Example 4: Filter by Tags
// ===========================

export function WorkoutsByTagScreen({ tagName }: { tagName: string }) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const { filterPlansByTag } = useWorkoutContext();

  useEffect(() => {
    async function loadPlans() {
      setLoading(true);
      const filtered = await filterPlansByTag(tagName);
      setPlans(filtered);
      setLoading(false);
    }
    loadPlans();
  }, [tagName]);

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tagName} Workouts</Text>
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <WorkoutCard plan={item} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No workouts found for this tag
          </Text>
        }
      />
    </View>
  );
}

// ===========================
// Reusable Components
// ===========================

function WorkoutCard({ plan }: { plan: WorkoutPlan }) {
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{plan.name}</Text>
        <Text style={styles.cardLevel}>{plan.level}</Text>
        {plan.total_minutes && (
          <Text style={styles.cardMeta}>{plan.total_minutes} min</Text>
        )}
        {plan.is_free && (
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>FREE</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ===========================
// Styles
// ===========================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f766e',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  cardLevel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  freeBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    padding: 20,
    backgroundColor: '#0f766e',
  },
  planTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
  },
  planLevel: {
    fontSize: 14,
    color: '#ccfbf1',
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#fff',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f766e',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  exerciseNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f766e',
    marginRight: 16,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  exerciseMuscle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  exerciseDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  exerciseDetail: {
    fontSize: 12,
    color: '#94a3b8',
  },
  startButton: {
    backgroundColor: '#0f766e',
    margin: 20,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    marginTop: 40,
  },
});

