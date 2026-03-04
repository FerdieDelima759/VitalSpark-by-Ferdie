"use client";

import { DailyWorkout, Exercise } from "@/utils/parseWorkoutResponse";

interface WorkoutCardProps {
  workout: DailyWorkout;
}

export default function WorkoutCard({ workout }: WorkoutCardProps) {
  const ExerciseItem = ({ exercise, index }: { exercise: Exercise; index: number }) => (
    <div className="mb-6 last:mb-0">
      <h4 className="text-lg font-bold text-gray-900 mb-3">
        {index + 1}. {exercise.name}
      </h4>
      <div className="space-y-2 ml-6">
        <div className="flex items-start gap-2">
          <span className="text-teal-600 mt-1">-</span>
          <span className="text-gray-700">{exercise.details}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-teal-600 mt-1">-</span>
          <span className="text-gray-700">{exercise.target}</span>
        </div>
        {exercise.instruction && (
          <div className="flex items-start gap-2">
            <span className="text-teal-600 mt-1">-</span>
            <p className="text-gray-700 leading-relaxed">{exercise.instruction}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
      {/* Day Header */}
      <div className="mb-6 pb-4 border-b-2 border-teal-200">
        <h3 className="text-2xl font-extrabold text-teal-800">
          Day {workout.dayNumber}: {workout.title}
        </h3>
      </div>

      {/* Warm-up Section */}
      {workout.warmup.length > 0 && (
        <div className="mb-8">
          <h4 className="text-xl font-bold text-gray-900 mb-4">Warm-up</h4>
          <div className="space-y-4">
            {workout.warmup.map((exercise, index) => (
              <ExerciseItem key={`warmup-${index}`} exercise={exercise} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {workout.warmup.length > 0 && workout.mainWorkout.length > 0 && (
        <div className="border-t border-gray-200 my-6" />
      )}

      {/* Main Workout Section */}
      {workout.mainWorkout.length > 0 && (
        <div className={workout.cooldown.length > 0 ? "mb-8" : ""}>
          <h4 className="text-xl font-bold text-gray-900 mb-4">Main Workout</h4>
          <div className="space-y-4">
            {workout.mainWorkout.map((exercise, index) => (
              <ExerciseItem key={`main-${index}`} exercise={exercise} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {workout.mainWorkout.length > 0 && workout.cooldown.length > 0 && (
        <div className="border-t border-gray-200 my-6" />
      )}

      {/* Cooldown Section */}
      {workout.cooldown.length > 0 && (
        <div>
          <h4 className="text-xl font-bold text-gray-900 mb-4">Cooldown</h4>
          <div className="space-y-4">
            {workout.cooldown.map((exercise, index) => (
              <ExerciseItem key={`cooldown-${index}`} exercise={exercise} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
